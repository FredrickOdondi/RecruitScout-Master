import React, { useState, useEffect } from 'react';
import { supabaseClient, SupabaseJob } from '../shared/supabase';
import { storage } from '../shared/storage';
import { MessageType, EmailScheduleConfig, EmailScheduleState, EmailScheduleLog } from '../shared/types';

interface LeadsFlowTabProps {
  sendMessage: <T>(message: any) => Promise<T>;
}

interface MatchedRecruiter {
  recruiter: any;
  jobs: SupabaseJob[];
}

// ---------------------------------------------------------------------------
// Fuzzy specialty matching helpers
// ---------------------------------------------------------------------------

/**
 * Extract meaningful keywords from a category/specialty string.
 * Strips punctuation, splits on "/" and " ", filters short/stop words.
 */
function extractKeywords(str: string): Set<string> {
  const stopWords = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'a', 'an', 'to']);
  const words = str
    .toLowerCase()
    .replace(/[^a-z0-9 /]/g, ' ')
    .split(/[\s/]+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !stopWords.has(w));
  return new Set(words);
}

/**
 * Returns true if the recruiter specialty and job category share enough keywords.
 * - Exact match → always true
 * - At least 1 significant keyword in common → fuzzy match
 */
function specialtyMatches(recSpecialty: string, jobCategory: string): boolean {
  const recLow = recSpecialty.trim().toLowerCase();
  const jobLow = jobCategory.trim().toLowerCase();

  // Fast path: exact match
  if (recLow === jobLow) return true;

  const recKw = extractKeywords(recLow);
  const jobKw = extractKeywords(jobLow);

  // Count shared keywords
  let shared = 0;
  for (const kw of recKw) {
    if (jobKw.has(kw)) shared++;
  }

  // Require at least 1 shared keyword
  return shared >= 1;
}

// ── Debug mode ──────────────────────────────────────────────────────────────
// Set to your email to intercept ALL outgoing emails during testing.
// Clear this string (set to '') to send to real recruiter contacts.
const DEBUG_EMAIL = 'fredrickodondi95@gmail.com';
// ─────────────────────────────────────────────────────────────────────────────

// ── Session-level cache ───────────────────────────────────────────────────────
// Persists across component unmount/remount within the same extension session.
// TTL of 5 minutes — after that, a background refresh is triggered automatically.
const CACHE_TTL_MS = 5 * 60 * 1000;
let _cachedMatches: MatchedRecruiter[] | null = null;
let _cachedContacts: any[] | null = null;
let _cacheTimestamp = 0;

function isCacheFresh(): boolean {
  return _cachedMatches !== null && Date.now() - _cacheTimestamp < CACHE_TTL_MS;
}
function bustCache() {
  _cachedMatches = null;
  _cachedContacts = null;
  _cacheTimestamp = 0;
}
// ─────────────────────────────────────────────────────────────────────────────

export default function LeadsFlowTab({ sendMessage }: LeadsFlowTabProps) {
  const [loading, setLoading] = useState(true);
  const [groupedMatches, setGroupedMatches] = useState<MatchedRecruiter[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState<MatchedRecruiter | null>(null);
  const [filterByContact, setFilterByContact] = useState(false);
  const [recruiterContacts, setRecruiterContacts] = useState<any[]>([]);
  
  // Maps recruiter ID to bundled drafted email
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Send modal state
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sendToEmail, setSendToEmail] = useState('');

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Schedule state
  const [scheduleConfig, setScheduleConfig] = useState<EmailScheduleConfig>({
    enabled: false,
    startTime: '09:00',
    endTime: '11:00',
    intervalMinutes: 2,
    maxDailyEmails: 50,
    daysOfWeek: [1, 2, 3, 4, 5],
  });
  const [scheduleState, setScheduleState] = useState<EmailScheduleState>({
    sentTodayCount: 0,
    lastResetDate: new Date().toISOString().split('T')[0],
    logs: [],
  });
  const [isScheduleDrawerOpen, setIsScheduleDrawerOpen] = useState(false);
  const [scheduleDrawerTab, setScheduleDrawerTab] = useState<'queue' | 'settings' | 'logs'>('queue');
  const [isSendingScheduled, setIsSendingScheduled] = useState(false);
  const [activeSendingRecruiterId, setActiveSendingRecruiterId] = useState<string | null>(null);
  const [nextSendCountdown, setNextSendCountdown] = useState<string | null>(null);
  const [queueSearchQuery, setQueueSearchQuery] = useState('');
  const [tempStartTime, setTempStartTime] = useState('09:00');
  const [tempEndTime, setTempEndTime] = useState('11:00');
  const [tempInterval, setTempInterval] = useState(2);
  const [tempMaxEmails, setTempMaxEmails] = useState(50);
  const [tempDaysOfWeek, setTempDaysOfWeek] = useState<number[]>([1, 2, 3, 4, 5]);

  // All matched recruiters that have at least one valid contact email
  const matchedWithContacts = groupedMatches.filter(g => {
    const raw = (
      g.recruiter['Associated contacts'] ||
      g.recruiter['contact'] ||
      g.recruiter['Contact'] ||
      g.recruiter['Email'] ||
      g.recruiter['email'] ||
      ''
    ).toString().trim();
    return raw.length > 0;
  });

  // Load schedule config & state from storage
  useEffect(() => {
    async function loadSchedule() {
      try {
        const [savedConfig, savedState] = await Promise.all([
          storage.getEmailScheduleConfig(),
          storage.getEmailScheduleState()
        ]);
        if (savedConfig) {
          setScheduleConfig(savedConfig);
          setTempStartTime(savedConfig.startTime || '09:00');
          setTempEndTime(savedConfig.endTime || '11:00');
          setTempInterval(savedConfig.intervalMinutes || 2);
          setTempMaxEmails(savedConfig.maxDailyEmails || 50);
          setTempDaysOfWeek(savedConfig.daysOfWeek || [1, 2, 3, 4, 5]);
        }
        if (savedState) {
          setScheduleState(savedState);
        }
      } catch (e) {
        console.error('Failed to load email schedule from storage:', e);
      }
    }
    loadSchedule();
  }, []);

  const isTimeInWindow = (start: string, end: string): boolean => {
    if (!start || !end) return false;
    const now = new Date();
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return false;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return nowMinutes >= startMinutes && nowMinutes < endMinutes;
    } else {
      return nowMinutes >= startMinutes || nowMinutes < endMinutes;
    }
  };

  const getScheduleStatus = () => {
    if (!scheduleConfig.enabled) {
      return { status: 'disabled', label: 'Schedule Off / Paused', color: 'slate' };
    }
    const today = new Date().toISOString().split('T')[0];
    const currentDay = new Date().getDay();
    if (scheduleConfig.daysOfWeek && !scheduleConfig.daysOfWeek.includes(currentDay)) {
      return { status: 'off_day', label: 'Not Scheduled Today', color: 'amber' };
    }
    const sentToday = scheduleState.lastResetDate === today ? scheduleState.sentTodayCount : 0;
    if (sentToday >= scheduleConfig.maxDailyEmails) {
      return { status: 'limit_reached', label: `Daily Cap Reached (${sentToday}/${scheduleConfig.maxDailyEmails})`, color: 'blue' };
    }

    const inWindow = isTimeInWindow(scheduleConfig.startTime, scheduleConfig.endTime);
    if (inWindow) {
      return { status: 'active', label: `Sending Window Active (${scheduleConfig.startTime} - ${scheduleConfig.endTime})`, color: 'emerald' };
    }

    const now = new Date();
    const [startH, startM] = scheduleConfig.startTime.split(':').map(Number);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;

    if (nowMinutes < startMinutes) {
      return { status: 'waiting', label: `Starts today at ${scheduleConfig.startTime}`, color: 'amber' };
    } else {
      return { status: 'completed_window', label: `Window Closed for Today (${scheduleConfig.startTime} - ${scheduleConfig.endTime})`, color: 'indigo' };
    }
  };

  const sendEmailToMatchedRecruiter = async (
    recruiterGroup: MatchedRecruiter,
    overrideEmail?: string
  ): Promise<{ success: boolean; error?: string }> => {
    const rec = recruiterGroup.recruiter;
    const jobs = recruiterGroup.jobs;
    const recId = getRecruiterId(rec);
    const recName = rec['Name'] || rec['Agency Name'] || 'Unknown Recruiter';

    const rawContact = (
      overrideEmail ||
      rec['Associated contacts'] ||
      rec['contact'] ||
      rec['Contact'] ||
      rec['Email'] ||
      rec['email'] ||
      ''
    ).toString().trim();

    if (!rawContact) {
      return { success: false, error: 'No contact email found' };
    }

    const realEmail = rawContact.split(/[,;\s\n]+/)[0].trim();
    const targetEmail = DEBUG_EMAIL ? DEBUG_EMAIL : realEmail;
    if (DEBUG_EMAIL) {
      console.warn(`[RecruitScout DEBUG] Email intercepted → sending to ${DEBUG_EMAIL} instead of ${realEmail}`);
    }
    const firstName = getSalutationFirstName(rec, recruiterContacts, realEmail);

    try {
      setActiveSendingRecruiterId(recId);
      const { subject, bodyHtml } = generateTemplateForRecruiter(rec, jobs, targetEmail);

      const res = await sendMessage<{ success: boolean; error?: string }>({
        type: MessageType.SEND_GMAIL_MESSAGE,
        payload: {
          to: targetEmail,
          subject: subject,
          bodyHtml: bodyHtml
        }
      });

      const today = new Date().toISOString().split('T')[0];

      if (res && res.success) {
        // Log to Supabase
        const matchedJobsLog = jobs.map(j => ({ id: j.id, title: j.title, company: j.company }));
        await supabaseClient.logEmailSent({
          recruiter_id: recId,
          recruiter_name: recName,
          matched_jobs: matchedJobsLog,
          email_content: bodyHtml,
          email_address: targetEmail
        });

        // Increment total leads sent
        const newTotal = (rec['Total leads sent'] || 0) + 1;
        rec['Total leads sent'] = newTotal;
        await supabaseClient.updateRecruiter(recName, { 'Total leads sent': newTotal });

        const newLog: EmailScheduleLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recruiterId: recId,
          recruiterName: recName,
          recipientEmail: targetEmail,
          recipientFirstName: firstName,
          jobCount: jobs.length,
          timestamp: new Date().toISOString(),
          status: 'success'
        };

        setScheduleState(prev => {
          const count = (prev.lastResetDate === today ? prev.sentTodayCount : 0) + 1;
          const nextState: EmailScheduleState = {
            lastSentAt: Date.now(),
            sentTodayCount: count,
            lastResetDate: today,
            logs: [newLog, ...(prev.logs || [])].slice(0, 100)
          };
          storage.setEmailScheduleState(nextState).catch(console.error);
          return nextState;
        });

        // Remove from matches so it is marked sent; keep cache in sync
        setGroupedMatches(prev => {
          const updated = prev.filter(g => getRecruiterId(g.recruiter) !== recId);
          _cachedMatches = updated;
          return updated;
        });
        showToast(`Email sent to ${firstName} (${targetEmail}) ✓`, 'success');
        return { success: true };
      } else {
        const errMsg = res?.error || 'Plunk send failed';
        const newLog: EmailScheduleLog = {
          id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          recruiterId: recId,
          recruiterName: recName,
          recipientEmail: targetEmail,
          recipientFirstName: firstName,
          jobCount: jobs.length,
          timestamp: new Date().toISOString(),
          status: 'failed',
          error: errMsg
        };

        setScheduleState(prev => {
          const nextState: EmailScheduleState = {
            ...prev,
            lastResetDate: today,
            logs: [newLog, ...(prev.logs || [])].slice(0, 100)
          };
          storage.setEmailScheduleState(nextState).catch(console.error);
          return nextState;
        });

        showToast(`Failed sending to ${targetEmail}: ${errMsg}`, 'error');
        return { success: false, error: errMsg };
      }
    } catch (err: any) {
      showToast(`Error sending to ${recName}: ${err.message}`, 'error');
      return { success: false, error: err.message };
    } finally {
      setActiveSendingRecruiterId(null);
    }
  };

  const handleSendNextScheduledNow = async () => {
    const today = new Date().toISOString().split('T')[0];
    const candidate = matchedWithContacts.find(g => {
      const rId = getRecruiterId(g.recruiter);
      const alreadyLogged = scheduleState.logs?.some(
        l => l.recruiterId === rId && l.status === 'success' && l.timestamp.startsWith(today)
      );
      return !alreadyLogged;
    });

    if (!candidate) {
      showToast('All matched recruiters with contacts have already been emailed today!', 'error');
      return;
    }

    setIsSendingScheduled(true);
    try {
      await sendEmailToMatchedRecruiter(candidate);
    } finally {
      setIsSendingScheduled(false);
    }
  };

  const handleToggleSchedule = async () => {
    const nextEnabled = !scheduleConfig.enabled;
    const newConfig = { ...scheduleConfig, enabled: nextEnabled };
    setScheduleConfig(newConfig);
    await storage.setEmailScheduleConfig({ enabled: nextEnabled });
    showToast(nextEnabled ? 'Automated emailing schedule enabled ✓' : 'Schedule paused', nextEnabled ? 'success' : 'error');
  };

  const handleSaveScheduleConfig = async () => {
    const updated: EmailScheduleConfig = {
      ...scheduleConfig,
      startTime: tempStartTime,
      endTime: tempEndTime,
      intervalMinutes: Number(tempInterval) || 2,
      maxDailyEmails: Number(tempMaxEmails) || 50,
      daysOfWeek: tempDaysOfWeek,
    };
    setScheduleConfig(updated);
    await storage.setEmailScheduleConfig(updated);
    showToast('Schedule configuration saved successfully ✓', 'success');
  };

  const handleClearScheduleLogs = async () => {
    const cleared: EmailScheduleState = {
      ...scheduleState,
      logs: []
    };
    setScheduleState(cleared);
    await storage.setEmailScheduleState(cleared);
    showToast('Activity logs cleared ✓', 'success');
  };

  // Automated ticker for schedule execution
  useEffect(() => {
    const timer = setInterval(async () => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      if (!scheduleConfig.enabled) {
        setNextSendCountdown(null);
        return;
      }

      const currentDay = now.getDay();
      if (scheduleConfig.daysOfWeek && !scheduleConfig.daysOfWeek.includes(currentDay)) {
        setNextSendCountdown('Not scheduled today');
        return;
      }

      // Check daily cap
      const sentCount = scheduleState.lastResetDate === today ? scheduleState.sentTodayCount : 0;
      if (sentCount >= scheduleConfig.maxDailyEmails) {
        setNextSendCountdown(`Daily limit reached (${sentCount}/${scheduleConfig.maxDailyEmails})`);
        return;
      }

      // Check time window
      const inWindow = isTimeInWindow(scheduleConfig.startTime, scheduleConfig.endTime);
      if (!inWindow) {
        setNextSendCountdown(`Window: ${scheduleConfig.startTime} - ${scheduleConfig.endTime}`);
        return;
      }

      // Check interval
      const intervalMs = (scheduleConfig.intervalMinutes || 2) * 60 * 1000;
      const lastSent = scheduleState.lastSentAt || 0;
      const elapsed = Date.now() - lastSent;

      if (elapsed < intervalMs) {
        const remainingSec = Math.ceil((intervalMs - elapsed) / 1000);
        const mins = Math.floor(remainingSec / 60);
        const secs = remainingSec % 60;
        setNextSendCountdown(`${mins}m ${secs < 10 ? '0' : ''}${secs}s`);
        return;
      }

      // Ready to send
      setNextSendCountdown('Sending next email...');

      if (isSendingScheduled) return;

      const candidate = matchedWithContacts.find(g => {
        const rId = getRecruiterId(g.recruiter);
        const alreadyLogged = scheduleState.logs?.some(
          l => l.recruiterId === rId && l.status === 'success' && l.timestamp.startsWith(today)
        );
        return !alreadyLogged;
      });

      if (!candidate) {
        setNextSendCountdown('All matched contacts emailed today');
        return;
      }

      setIsSendingScheduled(true);
      try {
        await sendEmailToMatchedRecruiter(candidate);
      } finally {
        setIsSendingScheduled(false);
      }
    }, 4000);

    return () => clearInterval(timer);
  }, [scheduleConfig, scheduleState, matchedWithContacts, isSendingScheduled, recruiterContacts]);

  useEffect(() => {
    if (isCacheFresh()) {
      // Hydrate instantly from cache — no spinner
      setGroupedMatches(_cachedMatches!);
      if (_cachedContacts) setRecruiterContacts(_cachedContacts);
      setLoading(false);
      // Background refresh if cache is older than half TTL
      if (Date.now() - _cacheTimestamp > CACHE_TTL_MS / 2) {
        fetchMatches(/* silent */ true);
      }
    } else {
      fetchMatches();
    }
  }, []);

  const fetchMatches = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Fetch jobs, recruiters, email logs and recruiter contacts in parallel
      const [jobsRes, recruitersRes, logsRes, contactsRes] = await Promise.all([
        supabaseClient.getCategorizedJobs(),
        supabaseClient.getRecruiters(),
        supabaseClient.getAllEmailLogs(),
        supabaseClient.getRecruiterContacts(),
      ]);

      if (jobsRes.error) throw new Error(jobsRes.error);
      const jobs = jobsRes.data || [];
      const recruiters = Array.isArray(recruitersRes.data) ? recruitersRes.data : [];
      const contacts = (contactsRes?.data && Array.isArray(contactsRes.data)) ? contactsRes.data : [];
      if (contacts.length > 0) setRecruiterContacts(contacts);

      // Build map: recruiter_id (string) → Set of already-sent job IDs
      const sentJobsMap = new Map<string, Set<string>>();
      (logsRes.data || []).forEach((log) => {
        const rid = String(log.recruiter_id);
        if (!sentJobsMap.has(rid)) sentJobsMap.set(rid, new Set());
        (log.matched_jobs || []).forEach((j: any) => {
          if (j.id) sentJobsMap.get(rid)!.add(String(j.id));
        });
      });

      const grouped = new Map<string, MatchedRecruiter>();

      recruiters.forEach((rec: any) => {
        // Skip non-active recruiters
        const status = (rec.status || '').toLowerCase();
        if (status === 'suspended' || status === 'blacklisted' || status === 'pending') return;

        const recCat = rec['Primary Specialty']?.trim();
        const recCountry = rec['Country']?.trim().toLowerCase();
        const recLocation = rec['Location']?.trim().toLowerCase();
        if (!recCat) return;

        // Cap: min 3 / max 5 (Daily Sending Limit, capped at 5)
        const dailyLimit: number = Math.min(rec['Daily Sending Limit'] ?? 5, 5);
        const MIN_VACANCIES = 3;

        // Already-sent job IDs for this recruiter
        const recKey = String(rec.id || rec['Agency Name'] || rec['Name']);
        const alreadySent = sentJobsMap.get(recKey) || new Set<string>();

        const matchedJobs = jobs.filter(job => {
          // Never re-send a vacancy to the same recruiter
          if (alreadySent.has(String(job.id))) return false;

          const cat = job.category?.trim() || '';
          const jobLoc = job.location?.trim().toLowerCase() || '';

          // Fuzzy specialty match
          if (!specialtyMatches(recCat, cat)) return false;

          // Location filter (skip if recruiter has no location)
          if (!recCountry && !recLocation) return true;
          const inSameCountry = recCountry ? jobLoc.includes(recCountry) : false;
          const inSameCity    = recLocation ? jobLoc.includes(recLocation) : false;
          return inSameCountry || inSameCity;
        });

        // Enforce min 3 vacancies — skip recruiter if not enough fresh jobs
        if (matchedJobs.length < MIN_VACANCIES) return;

        // Cap at Daily Sending Limit (max 5)
        const cappedJobs = matchedJobs.slice(0, dailyLimit);

        grouped.set(recKey, { recruiter: rec, jobs: cappedJobs });
      });

      const result = Array.from(grouped.values());

      // ── Write to session cache ───────────────────────────────────────────
      _cachedMatches = result;
      _cachedContacts = contacts.length > 0 ? contacts : _cachedContacts;
      _cacheTimestamp = Date.now();
      // ────────────────────────────────────────────────────────────────────

      setGroupedMatches(result);
    } catch (err) {
      console.error('Error fetching matches:', err);
      if (!silent) alert('Failed to load matches: ' + (err as Error).message);
    } finally {
      if (!silent) setLoading(false);
    }
  };


  /**
   * Helper to get the first name for the email template salutation:
   * If the matched recruiter has a contact, and that contact matches an email
   * in the RecruiterContact table, grab the first name from the first name column
   * in the RecruiterContact table; else fall back to the current system.
   */
  const getSalutationFirstName = (
    recruiter: any,
    contactsList: any[] = recruiterContacts,
    targetEmail?: string
  ): string => {
    // Current fallback
    const fallbackFirstName = recruiter['Name']?.split(' ')[0] ||
                              recruiter['Agency Name'] || 'there';

    // 1. Collect candidate emails associated with this recruiter / target
    const candidateEmails = new Set<string>();

    if (targetEmail && targetEmail.trim()) {
      candidateEmails.add(targetEmail.trim().toLowerCase());
    }

    const rawContactFields = [
      recruiter['Associated contacts'],
      recruiter['contact'],
      recruiter['Contact'],
      recruiter['Email'],
      recruiter['email']
    ];

    for (const raw of rawContactFields) {
      if (typeof raw === 'string' && raw.trim()) {
        const parts = raw.split(/[,;\n\s]+/);
        for (const p of parts) {
          const cleaned = p.trim().toLowerCase();
          if (cleaned) {
            candidateEmails.add(cleaned);
          }
        }
      }
    }

    if (candidateEmails.size === 0 || !contactsList || contactsList.length === 0) {
      return fallbackFirstName;
    }

    // 2. Check if any contact matches the email in RecruiterContact table
    for (const contact of contactsList) {
      const contactEmail = (contact['Email'] || contact['email'] || contact['EMAIL'] || '').toString().trim().toLowerCase();
      if (contactEmail && candidateEmails.has(contactEmail)) {
        // Grab first name from first name column
        const rawFirstName = (
          contact['First Name'] ||
          contact['first name'] ||
          contact['First name'] ||
          contact['FirstName'] ||
          contact['first_name'] ||
          contact['firstName'] ||
          ''
        ).toString().trim();

        if (rawFirstName) {
          const fn = rawFirstName.split(' ')[0].trim();
          if (fn) {
            return fn;
          }
        }
      }
    }

    return fallbackFirstName;
  };

  /**
   * Returns { subject, bodyHtml } for the correct template based on recruiter history.
   *
   * Template 1 — Introduction  (first email ever)
   * Template 2 — Standard Lead (default)
   * Template 3 — Reminder      (every 5 sends)
   *
   * Teaser mode: vacancy links/details hidden after Leads Sent before Teaser Mode
   * free leads, restored after Teaser Threshold additional sends.
   */
  const generateTemplateForRecruiter = (
    recruiter: any,
    jobs: SupabaseJob[],
    targetEmail?: string,
    contactsList: any[] = recruiterContacts
  ): { subject: string; bodyHtml: string } => {
    const totalSent: number          = recruiter['Total leads sent'] ?? 0;
    const beforeTeaser: number       = recruiter['Leads Sent before Teaser Mode'] ?? 5;
    const teaserThreshold: number    = recruiter['Teaser Threshold'] ?? 5;

    const isFirst    = totalSent === 0;
    const isReminder = !isFirst && totalSent > 0 && totalSent % 5 === 0;
    const isTeaser   = !isFirst && totalSent >= beforeTeaser && totalSent < (beforeTeaser + teaserThreshold);

    // First name — grab from matched RecruiterContact by email, else fall back to current system
    const firstName = getSalutationFirstName(recruiter, contactsList, targetEmail);

    const STYLE = `font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:14px;color:#334155;line-height:1.8;max-width:580px;`;
    const LINK  = `color:#4F46E5;`;
    // Embed the recruiter's real email so PreferencesPage can look them up
    const recruiterEmail = (
      recruiter['Associated contacts'] ||
      recruiter['contact'] ||
      recruiter['Contact'] ||
      recruiter['Email'] ||
      recruiter['email'] ||
      targetEmail ||
      ''
    ).toString().trim().split(/[,;\s\n]+/)[0].trim();
    const PREFS = `https://www.recruitscout.tech/preferences${recruiterEmail ? `?email=${encodeURIComponent(recruiterEmail)}` : ''}`;
    const CTA   = `https://www.recruitscout.tech/reserve-demo`;

    // ── Vacancy items ────────────────────────────────────────────────────────
    const vacancyItems = jobs.map(job => {
      if (isTeaser) {
        return `<li style="margin-bottom:16px;line-height:1.4;">
          <strong>${job.title}</strong> (${job.location || '██████'})<br/>
          <span style="display:inline-block;margin-top:8px;padding:8px 14px;background:#94a3b8;color:#fff;border-radius:6px;font-weight:bold;font-size:12px;cursor:not-allowed;">🔒 Dettagli riservati ai clienti</span>
        </li>`;
      }
      return `<li style="margin-bottom:16px;line-height:1.4;">
        <strong>${job.title}</strong> (${job.location || 'Remote'})<br/>
        <a href="${job.url}" style="display:inline-block;margin-top:8px;padding:8px 14px;background:#4F46E5;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:12px;">Vedi Ricerca →</a>
      </li>`;
    }).join('');

    const vacancyOl = `<ol style="padding-left:24px;">${vacancyItems}</ol>`;
    const signature = `<p style="margin-bottom:4px;">Diana Papa</p><p style="margin-top:0;color:#64748b;font-size:13px;">Associate @ RecruitScout.tech</p>`;
    const ps        = `<p style="font-size:12px;color:#94a3b8;">PS: le ricerche non sono corrette? <a href="${PREFS}" style="${LINK}">Aggiorna le tue preferenze</a></p>`;
    const teaserBanner = isTeaser
      ? `<p style="font-size:12px;color:#64748b;background:#f1f5f9;padding:12px;border-radius:8px;border-left:3px solid #4F46E5;">🔒 Alcuni dettagli sono nascosti. <a href="${CTA}" style="${LINK}">Parla con noi</a> per accedere a tutte le ricerche.</p>`
      : '';

    // ── Template 1 — Introduction ────────────────────────────────────────────
    if (isFirst) {
      return {
        subject: `regalo per ${firstName}`,
        bodyHtml: `<div style="${STYLE}">
          <p>Ciao ${firstName},</p>
          <p>Abbiamo trovato alcune ricerche che potrebbero essere interessanti:</p>
          ${vacancyOl}
          <p>A nessuno dei nostri clienti interessano, quindi ho pensato di girartele.</p>
          <p>Ma c'è un problema. A tempo che te le vedi, trovi la persona giusta ed ottieni una risposta, un altro recruiter potrebbe aver già vinto il mandato.</p>
          <p>Questa è la <strong>Tassa del Ritardo</strong>: migliaia di euro in success fee "regalati" ai tuoi concorrenti semplicemente perché sono arrivati prima.</p>
          <p>Con RecruitScout eviti di pagare la Tassa del Ritardo e di sentirti rispondere "Ho appena affidato la ricerca a un altro recruiter" oppure "Riscrivimi tra 3 mesi".</p>
          <p>Non ti mandiamo notifiche di ricerche o liste di lead. Ricevi direttamente la risposta dal prospect.</p>
          <p><a href="https://www.recruitscout.tech/recruitscout-reviews-staffing-agencies-headhunters" style="${LINK}">I risultati dei nostri clienti ci mettono (quasi) in imbarazzo.</a> Alcuni recuperano l'equivalente di 5–10 anni di abbonamento a RecruitScout nei primi 3 mesi.</p>
          <p>Odi pagare le tasse, soprattutto quando non dovresti pagarle? <a href="${CTA}" style="${LINK}">Prenota una call con il nostro founder</a>.</p>
          ${signature}${ps}
        </div>`.replace(/\s{2,}/g, ' ').trim()
      };
    }

    // ── Template 3 — Reminder (every 5 sends) ────────────────────────────────
    if (isReminder) {
      return {
        subject: `promemoria ${firstName}`,
        bodyHtml: `<div style="${STYLE}">
          <p>Ciao ${firstName},</p>
          <p>Qualche opportunita&#39; in piu&#39;:</p>
          ${vacancyOl}
          ${teaserBanner}
          <p>Siamo RecruitScout e, per essere trasparenti, questi alert gratuiti non sono il nostro prodotto.</p>
          <p>I nostri clienti recuperano l'equivalente di 5–10 anni della membership RecruitScout nei primi 3 mesi:</p>
          <ul style="padding-left:20px;color:#475569;">
            <li><em>"Abbiamo iniziato a lavorare con una scaleup AI da $2 miliardi che ci ha affidato subito 8 ricerche."</em></li>
            <li><em>"Ora possiamo permetterci di essere molto più selettivi sui clienti con cui lavoriamo."</em></li>
            <li><em>"Ci dà un timing migliore, una copertura più ampia del mercato e una pipeline costante."</em></li>
            <li><em>"In 2 mesi abbiamo già avviato diverse collaborazioni con nuovi clienti."</em></li>
          </ul>
          <p>Con RecruitScout non ti affidi alla fortuna. Ti fa diventare il primo recruiter a contattare il giusto decision-maker appena si apre una ricerca rilevante. Nel 100% dei casi.</p>
          <p>Vuoi vedere come funziona? <a href="${CTA}" style="${LINK}">Prenota una call con il nostro founder</a>.</p>
          ${signature}${ps}
        </div>`.replace(/\s{2,}/g, ' ').trim()
      };
    }

    // ── Template 2 — Standard Lead (default) ─────────────────────────────────
    return {
      subject: `Hai visto queste?`,
      bodyHtml: `<div style="${STYLE}">
        <p>Ciao ${firstName},</p>
        <p>RecruitScout ha trovato alcune ricerche che potrebbero essere interessanti. A nessuno dei nostri clienti interessano, quindi te le giriamo:</p>
        ${vacancyOl}
        ${teaserBanner}
        <p>I clienti RecruitScout saltano completamente questo passaggio. Niente alert, niente ritardi, nessuna lista di lead. Ricevono direttamente la risposta del decision maker.</p>
        <p>Preferisci ricevere meeting invece di job alert col contagocce? <a href="${CTA}" style="${LINK}">Prenota una call con il nostro founder</a>.</p>
        ${signature}
      </div>`.replace(/\s{2,}/g, ' ').trim()
    };
  };

  const getRecruiterId = (recruiter: any) => {
    return recruiter.id || recruiter['Agency Name'] || recruiter['Name'] || 'unknown';
  };

  const handleGenerateBundledDraft = () => {
    if (!selectedRecruiter) return;
    const recId = getRecruiterId(selectedRecruiter.recruiter);
    const { bodyHtml } = generateTemplateForRecruiter(
      selectedRecruiter.recruiter,
      selectedRecruiter.jobs,
      selectedRecruiter.recruiter['Associated contacts']
    );
    setDrafts(prev => ({ ...prev, [recId]: bodyHtml }));
  };

  const updateDraft = (text: string) => {
    if (!selectedRecruiter) return;
    const recId = getRecruiterId(selectedRecruiter.recruiter);
    setDrafts(prev => ({
      ...prev,
      [recId]: text
    }));
  };

  const selectedRecId = selectedRecruiter ? getRecruiterId(selectedRecruiter.recruiter) : null;
  const currentDraft = selectedRecId ? drafts[selectedRecId] : '';

  // Apply contact filter
  const filteredMatches = filterByContact
    ? groupedMatches.filter(g => !!g.recruiter['Associated contacts']?.trim())
    : groupedMatches;
  const contactCount = groupedMatches.filter(g => !!g.recruiter['Associated contacts']?.trim()).length;

  const handleCopy = async () => {
    if (!currentDraft) return;
    try {
      const clipboardItem = new ClipboardItem({
        'text/html': new Blob([currentDraft], { type: 'text/html' }),
        'text/plain': new Blob([currentDraft.replace(/<[^>]*>?/gm, '')], { type: 'text/plain' })
      });
      await navigator.clipboard.write([clipboardItem]);
    } catch (err) {
      // Fallback
      const el = document.createElement('div');
      el.innerHTML = currentDraft;
      document.body.appendChild(el);
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(el);
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand('copy');
      document.body.removeChild(el);
    }
  };

  const handleSendEmail = () => {
    if (!currentDraft) return;
    // Grab email directly from the recruiter's "Associated contacts" column
    const contactEmail = selectedRecruiter?.recruiter['Associated contacts']?.trim() || '';
    if (contactEmail) {
      // Email found — send directly without prompting
      setSendToEmail(contactEmail);
      doSend(contactEmail);
    } else {
      // No email on record — open modal as fallback
      setSendToEmail('');
      setSendModalOpen(true);
    }
  };

  const confirmSend = () => {
    if (!sendToEmail.trim()) return;
    setSendModalOpen(false);
    doSend(sendToEmail.trim());
  };

  const doSend = async (email: string) => {
    setIsSendingEmail(true);
    
    try {
      const { subject } = selectedRecruiter
        ? generateTemplateForRecruiter(selectedRecruiter.recruiter, selectedRecruiter.jobs, email)
        : { subject: 'Hai visto queste?' };
      
      const res = await sendMessage<{ success: boolean; error?: string }>({
        type: MessageType.SEND_GMAIL_MESSAGE,
        payload: {
          to: email,
          subject: subject,
          bodyHtml: currentDraft
        }
      });

      if (res && res.success) {
        showToast(`Email sent to ${email} via Plunk ✓`, 'success');
        
        // Log the sent email
        if (selectedRecruiter) {
          const recName = selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name'] || 'Unknown';
          const recId = getRecruiterId(selectedRecruiter.recruiter);
          const matchedJobsLog = selectedRecruiter.jobs.map(j => ({ id: j.id, title: j.title, company: j.company }));
          
          await supabaseClient.logEmailSent({
            recruiter_id: recId,
            recruiter_name: recName,
            matched_jobs: matchedJobsLog,
            email_content: currentDraft,
            email_address: email
          });
        }
      } else {
        showToast('Send failed: ' + (res?.error || 'Unknown error'), 'error');
      }
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleRejectJob = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!confirm('Are you sure you want to reject this job? It will be removed from matches.')) return;
    
    try {
      const res = await supabaseClient.deleteJobs([jobId]);
      if (res.error) throw new Error(res.error);
      
      setGroupedMatches(prev => prev.map(group => {
        if (group.jobs.some(j => j.id === jobId)) {
          return {
            ...group,
            jobs: group.jobs.filter(j => j.id !== jobId)
          };
        }
        return group;
      }).filter(group => group.jobs.length > 0));

      if (selectedRecruiter && selectedRecruiter.jobs.some(j => j.id === jobId)) {
        if (selectedRecruiter.jobs.length === 1) {
           setSelectedRecruiter(null);
        } else {
           setSelectedRecruiter(prev => prev ? {
             ...prev,
             jobs: prev.jobs.filter(j => j.id !== jobId)
           } : null);
        }
      }
      
      // Update draft if it was already generated
      if (currentDraft && selectedRecruiter && selectedRecruiter.jobs.length > 1) {
        const recId = getRecruiterId(selectedRecruiter.recruiter);
        const remainingJobs = selectedRecruiter.jobs.filter(j => j.id !== jobId);
        setDrafts(prev => ({
          ...prev,
          [recId]: generateTemplateForRecruiter(
            selectedRecruiter.recruiter,
            remainingJobs,
            selectedRecruiter.recruiter['Associated contacts']
          ).bodyHtml
        }));
      }
    } catch (err) {
      alert('Failed to reject job: ' + (err as Error).message);
    }
  };

  return (
    <div className="flex flex-col h-full p-4 lg:p-6 gap-4 bg-slate-50 dark:bg-[#141416] text-slate-800 dark:text-zinc-100 font-sans relative overflow-hidden transition-colors">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl text-white text-[9px] font-semibold transition-all duration-300 shadow-lg ${
          toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
        }`}>
          {toast.type === 'success' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Send Email Modal */}
      {sendModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setSendModalOpen(false)}>
          <div className="bg-white dark:bg-[#18181b] rounded-2xl w-[420px] p-6 border border-slate-200 dark:border-zinc-800 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-primary-600 dark:text-emerald-400" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-zinc-100">Send via Plunk</h3>
                <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">from hi@www.recruitscout.tech</p>
              </div>
            </div>

            <div className="mb-3">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Recipient Email</label>
              <input
                type="email"
                value={sendToEmail}
                onChange={e => setSendToEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmSend()}
                placeholder="recruiter@agency.com"
                autoFocus
                className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2.5 text-xs text-slate-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-400 dark:focus:ring-emerald-500 transition-all"
              />
            </div>

            <div className="mb-5">
              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Subject</label>
              <div className="border border-slate-200 dark:border-zinc-800 rounded-lg px-3 py-2.5 text-xs text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-900/60">
                Candidate matches for {selectedRecruiter?.recruiter['Primary Specialty'] || 'roles'}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSendModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmSend}
                disabled={!sendToEmail.trim()}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary-600 dark:bg-emerald-600 text-white text-xs font-bold hover:bg-primary-700 dark:hover:bg-emerald-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                Send Email
              </button>
            </div>
          </div>
        </div>
      )}

      
      {/* ── TOP BAR: Email Schedule Banner ── */}
      <div className="bg-white dark:bg-[#18181b] rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 transition-all shrink-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Left: Icon, Title, and Live Status Badge */}
          <div className="flex items-center gap-3.5">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border transition-all ${
              scheduleConfig.enabled 
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' 
                : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-500 dark:text-zinc-400'
            }`}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm tracking-tight">
                  Automated Emailing Schedule
                </h3>
                
                {/* Live Status Badge */}
                {(() => {
                  const status = getScheduleStatus();
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wide border ${
                      status.color === 'emerald'
                        ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                        : status.color === 'amber'
                        ? 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-300'
                        : status.color === 'blue'
                        ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/30 text-blue-700 dark:text-blue-300'
                        : status.color === 'indigo'
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 dark:border-indigo-500/30 text-indigo-700 dark:text-indigo-300'
                        : 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        status.color === 'emerald' ? 'bg-emerald-500 animate-pulse' :
                        status.color === 'amber' ? 'bg-amber-500' :
                        status.color === 'blue' ? 'bg-blue-500' :
                        status.color === 'indigo' ? 'bg-indigo-500' : 'bg-slate-400'
                      }`}></span>
                      {status.label}
                    </span>
                  );
                })()}

                {scheduleConfig.enabled && nextSendCountdown && (
                  <span className="text-[10px] font-medium text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded-md">
                    ⏱️ Next: <span className="font-semibold text-slate-700 dark:text-zinc-200">{nextSendCountdown}</span>
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                Automatically send leads to <span className="font-semibold text-slate-700 dark:text-zinc-200">{matchedWithContacts.length} matched recruiters</span> with contacts between <span className="font-medium text-primary-600 dark:text-emerald-400">{scheduleConfig.startTime} and {scheduleConfig.endTime}</span> (every {scheduleConfig.intervalMinutes}m).
              </p>
            </div>
          </div>

          {/* Right: Quick Stats & Action Controls */}
          <div className="flex items-center gap-3 self-end md:self-auto flex-wrap">
            {/* Quick Stat: Sent Today */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500">Sent Today</span>
              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200">
                {scheduleState.lastResetDate === new Date().toISOString().split('T')[0] ? scheduleState.sentTodayCount : 0}
                <span className="text-slate-400 dark:text-zinc-500 font-normal"> / {scheduleConfig.maxDailyEmails}</span>
              </span>
            </div>

            {/* Quick Stat: Queue Size */}
            <button 
              onClick={() => { setScheduleDrawerTab('queue'); setIsScheduleDrawerOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 hover:border-primary-300 dark:hover:border-zinc-700 text-xs font-semibold text-slate-700 dark:text-zinc-300 transition-colors"
              title="Click to view recruiter queue"
            >
              <span>🎯 Queue:</span>
              <span className="font-bold text-primary-600 dark:text-emerald-400">{matchedWithContacts.length}</span>
            </button>

            {/* Manual Send Next Button */}
            <button
              onClick={handleSendNextScheduledNow}
              disabled={isSendingScheduled || matchedWithContacts.length === 0}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                isSendingScheduled || matchedWithContacts.length === 0
                  ? 'bg-slate-100 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-800 text-slate-400 cursor-not-allowed'
                  : 'bg-primary-50 dark:bg-emerald-500/15 border-primary-200 dark:border-emerald-500/30 text-primary-700 dark:text-emerald-400 hover:bg-primary-100 dark:hover:bg-emerald-500/25 shadow-sm'
              }`}
              title="Send an email to the next matched recruiter immediately"
            >
              {isSendingScheduled ? (
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              )}
              Send Next
            </button>

            {/* Schedule Settings & Queue Modal Trigger */}
            <button
              onClick={() => { setScheduleDrawerTab('settings'); setIsScheduleDrawerOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-700 dark:text-zinc-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              Configure
            </button>

            {/* Refresh — busts cache and re-fetches from Supabase */}
            <button
              onClick={() => { bustCache(); fetchMatches(); }}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              title="Force-refresh matches from Supabase"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
              Refresh
            </button>

            {/* Toggle Enable / Disable Switch */}
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleToggleSchedule}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  scheduleConfig.enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-zinc-700'
                }`}
                role="switch"
                aria-checked={scheduleConfig.enabled}
                title={scheduleConfig.enabled ? 'Click to pause automated schedule' : 'Click to enable automated schedule'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    scheduleConfig.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className={`text-[11px] font-bold ${scheduleConfig.enabled ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-zinc-500'}`}>
                {scheduleConfig.enabled ? 'ON' : 'OFF'}
              </span>
            </div>

          </div>
        </div>
      </div>

      {/* ── SCHEDULE MODAL / DRAWER OVERLAY ── */}
      {isScheduleDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setIsScheduleDrawerOpen(false)}>
          <div className="bg-white dark:bg-[#18181b] rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col border border-slate-200 dark:border-zinc-800 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-[#18181b] shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-zinc-100">Emailing Schedule & Recruiter Queue</h3>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Automate your outreach pipeline to matched recruiters with verified contacts</p>
                </div>
              </div>

              <button 
                onClick={() => setIsScheduleDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800 px-6 bg-slate-50/60 dark:bg-zinc-900/40 shrink-0">
              <button
                onClick={() => setScheduleDrawerTab('queue')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                  scheduleDrawerTab === 'queue'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#18181b]'
                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                Recruiter Queue ({matchedWithContacts.length})
              </button>

              <button
                onClick={() => setScheduleDrawerTab('settings')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                  scheduleDrawerTab === 'settings'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#18181b]'
                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                Schedule Configuration
              </button>

              <button
                onClick={() => setScheduleDrawerTab('logs')}
                className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 ${
                  scheduleDrawerTab === 'logs'
                    ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-white dark:bg-[#18181b]'
                    : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Activity Log ({scheduleState.logs?.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 min-h-0 bg-white dark:bg-[#18181b]">
              
              {/* TAB 1: RECRUITER QUEUE */}
              {scheduleDrawerTab === 'queue' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <p className="text-xs text-slate-600 dark:text-zinc-300 font-medium">
                        These <span className="font-bold text-slate-900 dark:text-zinc-100">{matchedWithContacts.length} recruiters</span> have matched open roles and verified email contacts. During the active window ({scheduleConfig.startTime} – {scheduleConfig.endTime}), they are processed sequentially.
                      </p>
                    </div>

                    <input
                      type="text"
                      placeholder="Filter recruiters or emails..."
                      value={queueSearchQuery}
                      onChange={e => setQueueSearchQuery(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-primary-500 w-full sm:w-64"
                    />
                  </div>

                  {matchedWithContacts.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500 text-xs border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                      No matched recruiters with contacts found. Add contacts to recruiters in the Leads Management tab to populate this queue.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-zinc-900/80 text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">Recruiter / Agency</th>
                            <th className="py-2.5 px-3">Contact Name</th>
                            <th className="py-2.5 px-3">Recipient Email</th>
                            <th className="py-2.5 px-3">Matched Roles</th>
                            <th className="py-2.5 px-3">Status</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                          {matchedWithContacts
                            .filter(g => {
                              if (!queueSearchQuery.trim()) return true;
                              const q = queueSearchQuery.toLowerCase();
                              const name = (g.recruiter['Name'] || '').toLowerCase();
                              const agency = (g.recruiter['Agency Name'] || '').toLowerCase();
                              const email = (g.recruiter['Associated contacts'] || '').toLowerCase();
                              return name.includes(q) || agency.includes(q) || email.includes(q);
                            })
                            .map((g, idx) => {
                              const r = g.recruiter;
                              const recId = getRecruiterId(r);
                              const email = (r['Associated contacts'] || r['contact'] || r['Email'] || '').split(/[,;\s]+/)[0].trim();
                              const firstName = getSalutationFirstName(r, recruiterContacts, email);
                              const isSendingThis = activeSendingRecruiterId === recId;
                              const today = new Date().toISOString().split('T')[0];
                              const sentToday = scheduleState.logs?.some(l => l.recruiterId === recId && l.status === 'success' && l.timestamp.startsWith(today));

                              return (
                                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40 transition-colors">
                                  <td className="py-2.5 px-3">
                                    <div className="font-semibold text-slate-900 dark:text-zinc-100">{r['Name'] || 'Unknown'}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-zinc-400">{r['Agency Name']}</div>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded text-[11px] border border-emerald-200 dark:border-emerald-500/20">
                                      {firstName}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 dark:text-zinc-300">
                                    {email}
                                  </td>
                                  <td className="py-2.5 px-3">
                                    <span className="font-semibold text-slate-700 dark:text-zinc-300">{g.jobs.length} jobs</span>
                                  </td>
                                  <td className="py-2.5 px-3">
                                    {sentToday ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                        ✓ Sent Today
                                      </span>
                                    ) : isSendingThis ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 animate-pulse">
                                        Sending...
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-semibold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                                        In Queue
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2.5 px-3 text-right">
                                    <button
                                      onClick={() => sendEmailToMatchedRecruiter(g, email)}
                                      disabled={isSendingScheduled || isSendingThis}
                                      className="px-2.5 py-1 text-[10px] font-bold rounded-lg border border-primary-200 dark:border-emerald-500/30 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 hover:bg-primary-100 dark:hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                                      title="Send now to this recruiter"
                                    >
                                      Send Now
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: SCHEDULE CONFIGURATION */}
              {scheduleDrawerTab === 'settings' && (
                <div className="max-w-xl mx-auto space-y-6 py-2">
                  <div className="border-b border-slate-200 dark:border-zinc-800 pb-4">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-zinc-100">Emailing Time Window & Frequency</h4>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">Define during what hours RecruitScout automatically emails matched recruiters</p>
                  </div>

                  {/* Preset quick buttons */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Window Presets</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => { setTempStartTime('09:00'); setTempEndTime('11:00'); }}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                          tempStartTime === '09:00' && tempEndTime === '11:00'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                        }`}
                      >
                        ☀️ Morning Window<br/><span className="text-[10px] opacity-75">09:00 - 11:00</span>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => { setTempStartTime('14:00'); setTempEndTime('16:00'); }}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                          tempStartTime === '14:00' && tempEndTime === '16:00'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                        }`}
                      >
                        ☕ Afternoon Window<br/><span className="text-[10px] opacity-75">14:00 - 16:00</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => { setTempStartTime('09:00'); setTempEndTime('17:00'); }}
                        className={`px-3 py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                          tempStartTime === '09:00' && tempEndTime === '17:00'
                            ? 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500 text-emerald-800 dark:text-emerald-300 shadow-sm'
                            : 'bg-slate-50 dark:bg-zinc-800/60 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-300'
                        }`}
                      >
                        🏢 Full Work Day<br/><span className="text-[10px] opacity-75">09:00 - 17:00</span>
                      </button>
                    </div>
                  </div>

                  {/* Start & End Time Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Start Time</label>
                      <input
                        type="time"
                        value={tempStartTime}
                        onChange={e => setTempStartTime(e.target.value)}
                        className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">End Time</label>
                      <input
                        type="time"
                        value={tempEndTime}
                        onChange={e => setTempEndTime(e.target.value)}
                        className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  {/* Interval & Daily Cap */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Sending Interval</label>
                      <select
                        value={tempInterval}
                        onChange={e => setTempInterval(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-zinc-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value={1}>Every 1 minute</option>
                        <option value={2}>Every 2 minutes (Recommended)</option>
                        <option value={3}>Every 3 minutes</option>
                        <option value={5}>Every 5 minutes</option>
                        <option value={10}>Every 10 minutes</option>
                      </select>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Pacing sends prevents spam filters and Plunk rate issues.</p>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-1.5">Max Daily Emails Limit</label>
                      <input
                        type="number"
                        min={1}
                        max={500}
                        value={tempMaxEmails}
                        onChange={e => setTempMaxEmails(Number(e.target.value))}
                        className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 dark:text-zinc-100 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1">Safety stop once this threshold is met in a single day.</p>
                    </div>
                  </div>

                  {/* Days of week */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">Active Schedule Days</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { day: 1, label: 'Mon' },
                        { day: 2, label: 'Tue' },
                        { day: 3, label: 'Wed' },
                        { day: 4, label: 'Thu' },
                        { day: 5, label: 'Fri' },
                        { day: 6, label: 'Sat' },
                        { day: 0, label: 'Sun' },
                      ].map(({ day, label }) => {
                        const active = tempDaysOfWeek.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => {
                              if (active) {
                                setTempDaysOfWeek(prev => prev.filter(d => d !== day));
                              } else {
                                setTempDaysOfWeek(prev => [...prev, day]);
                              }
                            }}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                              active
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-400 hover:border-slate-300'
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => setIsScheduleDrawerOpen(false)}
                      className="px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800"
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveScheduleConfig}
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: ACTIVITY LOG */}
              {scheduleDrawerTab === 'logs' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Recent emails sent by the automated schedule today.
                    </p>
                    {scheduleState.logs && scheduleState.logs.length > 0 && (
                      <button
                        onClick={handleClearScheduleLogs}
                        className="text-[11px] text-red-600 dark:text-red-400 hover:underline font-semibold"
                      >
                        Clear Activity Log
                      </button>
                    )}
                  </div>

                  {!scheduleState.logs || scheduleState.logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 dark:text-zinc-500 text-xs border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-2xl">
                      No automated emails sent yet today. Once the schedule runs or you click "Send Next", logs will appear here.
                    </div>
                  ) : (
                    <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 dark:bg-zinc-900/80 text-[10px] uppercase font-bold text-slate-500 dark:text-zinc-400 border-b border-slate-200 dark:border-zinc-800">
                          <tr>
                            <th className="py-2.5 px-3">Time</th>
                            <th className="py-2.5 px-3">Recipient</th>
                            <th className="py-2.5 px-3">Recruiter</th>
                            <th className="py-2.5 px-3">Jobs Sent</th>
                            <th className="py-2.5 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60">
                          {scheduleState.logs.map((log, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-zinc-800/40">
                              <td className="py-2 px-3 text-slate-500 dark:text-zinc-400 text-[11px]">
                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900 dark:text-zinc-100">{log.recipientFirstName || 'Contact'}</div>
                                <div className="font-mono text-[10px] text-slate-500 dark:text-zinc-400">{log.recipientEmail}</div>
                              </td>
                              <td className="py-2 px-3 text-slate-700 dark:text-zinc-300 font-medium">
                                {log.recruiterName}
                              </td>
                              <td className="py-2 px-3 text-slate-600 dark:text-zinc-400">
                                {log.jobCount} roles
                              </td>
                              <td className="py-2 px-3">
                                {log.status === 'success' ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                                    ✓ Sent via Plunk
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200 dark:border-red-800" title={log.error}>
                                    ✕ Failed
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* ── SPLIT VIEW: LEFT PANE & RIGHT PANE ── */}
      <div className="flex-1 flex gap-6 overflow-hidden min-h-0">
        
        {/* LEFT PANE: Recruiters List */}
        <div className="w-[340px] bg-white dark:bg-[#18181b] rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden transition-colors shrink-0 min-h-0">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] flex justify-between items-center z-10 sticky top-0 transition-colors">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 dark:text-zinc-200 text-[10px] tracking-wide">MATCHED RECRUITERS</h3>
            <span className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 text-[10px] px-2 py-0.5 rounded-full font-medium">{filteredMatches.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilterByContact(f => !f)}
              title={filterByContact ? 'Show all recruiters' : 'Show only recruiters with contact email'}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-bold border transition-all ${
                filterByContact
                  ? 'bg-primary-600 dark:bg-emerald-600 text-white border-primary-600 dark:border-emerald-600 shadow-sm'
                  : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200 dark:border-zinc-700 hover:border-primary-300 dark:hover:border-emerald-500 hover:text-primary-600 dark:hover:text-emerald-400'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              {filterByContact ? `${filteredMatches.length} with contact` : `Has Contact (${contactCount})`}
            </button>
            <button 
              onClick={() => fetchMatches()}
              className="text-slate-400 dark:text-zinc-400 hover:text-primary-600 dark:hover:text-emerald-400 transition-colors p-1.5 rounded-md hover:bg-primary-50 dark:hover:bg-zinc-800"
              title="Refresh Matches"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            </button>
          </div>
        </div>
        
        {/* Recruiter List */}
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#141416] p-2 space-y-2 min-h-0">
          {loading ? (
            <div className="p-8 flex justify-center items-center h-full">
              <div className="w-6 h-6 border-2 border-primary-200 border-t-emerald-600 rounded-full animate-spin"></div>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 dark:text-zinc-400 text-xs">
              {filterByContact ? 'No recruiters with a contact email found.' : 'No matching recruiters found.'}
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {filteredMatches.map((group, i) => {
                const isSelected = selectedRecruiter === group;
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedRecruiter(group);
                    }}
                    className={`p-3.5 cursor-pointer rounded-xl border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group
                      ${isSelected 
                        ? 'bg-primary-50/80 dark:bg-emerald-500/15 border-primary-300 dark:border-emerald-500/40 shadow-sm' 
                        : 'bg-white dark:bg-[#1c1c20] border-slate-200 dark:border-zinc-800/80 hover:border-primary-300 dark:hover:border-zinc-700 hover:shadow-sm'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 dark:bg-emerald-400 rounded-l-md"></div>
                    )}
                    
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                        ${isSelected ? 'bg-primary-600 dark:bg-emerald-500 text-white shadow-sm' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border border-slate-200/50 dark:border-zinc-700/50'}`}>
                        {(group.recruiter['Name'] || group.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`text-[11px] font-semibold truncate leading-tight ${isSelected ? 'text-primary-950 dark:text-emerald-300' : 'text-slate-900 dark:text-zinc-100'}`}>
                          {group.recruiter['Name'] || 'Unknown Name'}
                        </div>
                        <div className={`text-[10px] truncate mt-0.5 ${isSelected ? 'text-primary-700 dark:text-zinc-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                          {group.recruiter['Agency Name']}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-zinc-800/60">
                      <div className="flex items-center gap-1.5">
                        <div className={`flex items-center justify-center text-[9px] font-bold px-1.5 py-0.5 rounded
                          ${isSelected ? 'bg-primary-100 dark:bg-emerald-500/25 text-primary-800 dark:text-emerald-300' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300'}`}>
                          {group.jobs.length} Job{group.jobs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-[9px] font-medium text-slate-500 dark:text-zinc-400 uppercase truncate max-w-[120px]" title={group.recruiter['Primary Specialty']}>
                        {group.recruiter['Primary Specialty']}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* RIGHT PANE: Matched Jobs & Bundled Draft */}
      <div className="flex-1 bg-white dark:bg-[#18181b] rounded-xl shadow-sm border border-slate-200 dark:border-zinc-800 flex flex-col overflow-hidden relative transition-colors">
        {selectedRecruiter ? (
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] flex justify-between items-center z-10 transition-colors">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                  {selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name']}
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">
                    <span className="font-semibold text-slate-700 dark:text-zinc-200">{selectedRecruiter.jobs.length}</span> matched open roles based on <span className="font-medium text-slate-800 dark:text-zinc-200 px-1.5 py-0.5 bg-slate-100 dark:bg-zinc-800 rounded">{selectedRecruiter.recruiter['Primary Specialty']}</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Split View */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5 bg-slate-50 dark:bg-[#141416] min-h-0">
              
              {/* Left Side: Matched Jobs List (2/5) */}
              <div className="lg:col-span-2 border-r border-slate-200 dark:border-zinc-800 flex flex-col h-full bg-slate-50 dark:bg-[#141416] min-h-0">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161618] flex justify-between items-center">
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Matched Jobs</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
                  {selectedRecruiter.jobs.map((job) => (
                    <div key={job.id} className="bg-white dark:bg-[#1c1c20] rounded-xl border border-slate-200 dark:border-zinc-800/80 p-3.5 shadow-sm hover:border-primary-300 dark:hover:border-zinc-700 transition-colors">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="text-[11px] font-bold text-slate-900 dark:text-zinc-100 leading-tight pr-4">{job.title}</div>
                        <button 
                          onClick={(e) => handleRejectJob(job.id, e)}
                          className="text-slate-400 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-950/30 shrink-0"
                          title="Reject Job"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                      </div>
                      <div className="text-xs font-medium text-slate-500 dark:text-zinc-400 flex items-center gap-1.5 mb-2.5">
                        <span className="text-slate-800 dark:text-zinc-200 font-semibold">{job.company}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-zinc-600"></span>
                        <span className="truncate">{job.location || 'Remote'}</span>
                      </div>
                      <a href={job.url} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-primary-600 dark:text-emerald-400 hover:text-primary-800 dark:hover:text-emerald-300 transition-colors flex items-center gap-1 bg-primary-50 dark:bg-emerald-500/15 border border-primary-200/60 dark:border-emerald-500/30 w-fit px-2 py-0.5 rounded-md">
                        View Posting
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Bundled Email Draft (3/5) */}
              <div className="lg:col-span-3 flex flex-col h-full bg-slate-50 dark:bg-[#141416] min-h-0">
                <div className="px-4 py-2.5 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#161618] flex justify-between items-center shrink-0">
                  <h4 className="text-[10px] font-bold text-slate-600 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                    Bundled Email Draft
                    {currentDraft && <span className="bg-primary-100 dark:bg-emerald-500/20 text-primary-700 dark:text-emerald-300 border border-primary-200 dark:border-emerald-500/30 text-[9px] px-1.5 py-0.5 rounded-full font-bold">READY</span>}
                  </h4>
                  
                  {!currentDraft && (
                    <button
                      onClick={handleGenerateBundledDraft}
                      className="bg-primary-600 hover:bg-primary-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white px-3 py-1 rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      Generate Draft
                    </button>
                  )}
                </div>
                
                <div className="flex-1 p-4 overflow-hidden flex flex-col min-h-0">
                  {currentDraft ? (
                    <div className="relative flex-1 flex flex-col group/textarea min-h-0">
                      <div 
                        contentEditable
                        suppressContentEditableWarning={true}
                        dangerouslySetInnerHTML={{ __html: currentDraft }}
                        onBlur={(e) => updateDraft(e.currentTarget.innerHTML)}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          if (target.tagName === 'A') {
                            e.preventDefault();
                            window.open((target as HTMLAnchorElement).href, '_blank');
                          }
                        }}
                        className="flex-1 w-full bg-white dark:bg-[#18181b] border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 rounded-xl p-4 text-xs focus:outline-none focus:ring-1 focus:ring-primary-500/40 focus:border-primary-400 shadow-inner overflow-y-auto transition-all"
                      />
                      <div className="absolute top-2 right-2 flex gap-2">
                        <button 
                          onClick={handleSendEmail}
                          disabled={isSendingEmail}
                          className={`flex items-center gap-1.5 px-3 py-1.5 shadow text-white rounded-lg transition-all text-xs font-bold ${
                            isSendingEmail 
                              ? 'bg-slate-400 cursor-not-allowed' 
                              : 'bg-primary-600 hover:bg-primary-700 dark:bg-emerald-600 dark:hover:bg-emerald-700'
                          }`}
                          title="Send Email via Plunk"
                        >
                          {isSendingEmail ? (
                            <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                          )}
                          {isSendingEmail ? 'Sending...' : 'Send Email'}
                        </button>
                        <button 
                          onClick={handleCopy}
                          className="p-1.5 bg-white dark:bg-zinc-800 shadow text-slate-500 dark:text-zinc-300 hover:text-primary-600 dark:hover:text-emerald-400 rounded-lg transition-all border border-slate-200 dark:border-zinc-700"
                          title="Copy to clipboard"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-[#18181b]">
                      <div className="w-12 h-12 bg-slate-50 dark:bg-zinc-900 text-slate-400 dark:text-zinc-500 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      </div>
                      <p className="text-xs font-medium text-slate-500 dark:text-zinc-400 text-center px-6 max-w-[280px]">
                        Create a single, beautifully bundled email containing all {selectedRecruiter.jobs.length} matched roles for this recruiter.
                      </p>
                      <button 
                        onClick={handleGenerateBundledDraft}
                        className="mt-4 px-4 py-2 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 border border-primary-200 dark:border-emerald-500/30 text-xs font-bold rounded-lg hover:bg-primary-100 dark:hover:bg-emerald-500/25 transition-colors shadow-sm"
                      >
                        Generate Bundled Draft
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50 dark:bg-[#141416]">
            <div className="w-20 h-20 bg-white dark:bg-zinc-900 shadow-sm border border-slate-200 dark:border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-5 text-primary-500 dark:text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-zinc-100 mb-2 tracking-tight">Select a Recruiter</h2>
            <p className="text-slate-500 dark:text-zinc-400 font-medium max-w-xs mx-auto text-xs leading-relaxed">
              Click on a recruiter from the left pane to view their matched jobs and instantly generate professional outreach emails.
            </p>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
