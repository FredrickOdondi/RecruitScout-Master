import React, { useState, useEffect } from 'react';
import { supabaseClient, SupabaseJob } from '../shared/supabase';

interface LeadsFlowTabProps {
  sendMessage: <T>(message: any) => Promise<T>;
}

interface MatchedRecruiter {
  recruiter: any;
  jobs: SupabaseJob[];
}

export default function LeadsFlowTab({ sendMessage }: LeadsFlowTabProps) {
  const [loading, setLoading] = useState(true);
  const [groupedMatches, setGroupedMatches] = useState<MatchedRecruiter[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState<MatchedRecruiter | null>(null);
  
  // Maps recruiter ID to bundled drafted email
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const jobsRes = await supabaseClient.getCategorizedJobs();
      if (jobsRes.error) throw new Error(jobsRes.error);
      const jobs = jobsRes.data || [];

      const recruitersRes = await sendMessage<any>({ type: 'SUPABASE_GET_RECRUITERS' });
      const recruiters = Array.isArray(recruitersRes) ? recruitersRes : (recruitersRes?.data || []);

      const grouped = new Map<string, MatchedRecruiter>();

      recruiters.forEach((rec: any) => {
        const recCat = rec['Primary Specialty']?.trim().toLowerCase();
        const recInd = rec['Industry vertical']?.trim().toLowerCase();
        
        if (!recCat || !recInd) return;

        const matchedJobs = jobs.filter(job => {
          const cat = job.category?.trim().toLowerCase();
          const ind = job['industry vertical']?.trim().toLowerCase();
          return cat === recCat && ind === recInd;
        });

        if (matchedJobs.length > 0) {
          const key = rec.id || rec['Agency Name'] || rec['Name'] || Math.random().toString();
          grouped.set(key, { recruiter: rec, jobs: matchedJobs });
        }
      });

      setGroupedMatches(Array.from(grouped.values()));
    } catch (err) {
      console.error('Error fetching matches:', err);
      alert('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateTemplateForRecruiter = (recruiter: any, jobs: SupabaseJob[]) => {
    let recName = recruiter['Name'] ? recruiter['Name'].split(' ')[0] : '';
    if (!recName && recruiter['Agency Name']) recName = 'team at ' + recruiter['Agency Name'];
    if (!recName) recName = 'there';

    const salutations = ["Hi", "Hello", "Hey", "Greetings"];
    const salutation = salutations[Math.floor(Math.random() * salutations.length)];
    
    const introOptions = [
      `I noticed you specialize in ${recruiter['Primary Specialty']} roles within the ${recruiter['Industry vertical']} sector.`,
      `Given your expertise in the ${recruiter['Industry vertical']} sector, specifically for ${recruiter['Primary Specialty']} roles, I thought I'd reach out.`,
      `We see that you focus on ${recruiter['Primary Specialty']} placements in the ${recruiter['Industry vertical']} industry.`,
      `Your background in recruiting for ${recruiter['Primary Specialty']} within ${recruiter['Industry vertical']} caught our eye.`
    ];
    const intro = introOptions[Math.floor(Math.random() * introOptions.length)];

    const roleIntroOptions = [
      `We recently came across some exciting new openings that align perfectly with your focus:`,
      `I'm writing to share a few roles that just opened up and look like a great match for your network:`,
      `We have several open positions right now that could be a great fit for your candidate pool:`
    ];
    const roleIntro = roleIntroOptions[Math.floor(Math.random() * roleIntroOptions.length)];

    const jobListings = jobs.map((job) => {
      return `
        <li style="margin-bottom: 16px; line-height: 1.4;">
          <strong>${job.title}</strong> at ${job.company} (${job.location || 'Remote'})<br/>
          <a href="${job.url}" style="display: inline-block; margin-top: 8px; padding: 8px 14px; background-color: #4F46E5; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 12px; font-family: sans-serif;">View Job Posting</a>
        </li>`;
    }).join('');

    return `
      <div style="font-family: sans-serif; font-size: 14px; color: #334155; line-height: 1.6; max-width: 600px;">
        <p>${salutation} ${recName === 'there' ? 'there' : recName},</p>
        <p>${intro}</p>
        <p>${roleIntro}</p>
        <ol style="padding-left: 24px;">
          ${jobListings}
        </ol>
        <p>Let me know if you have any candidates that might be a fit for these, or if you'd like to partner up!</p>
        <p style="margin-bottom: 0;">Best,</p>
        <p style="margin-top: 4px; font-weight: bold;">The RecruitScout Team</p>
      </div>
    `.trim();
  };

  const getRecruiterId = (recruiter: any) => {
    return recruiter.id || recruiter['Agency Name'] || recruiter['Name'] || 'unknown';
  };

  const handleGenerateBundledDraft = () => {
    if (!selectedRecruiter) return;
    const recId = getRecruiterId(selectedRecruiter.recruiter);
    
    const draftText = generateTemplateForRecruiter(selectedRecruiter.recruiter, selectedRecruiter.jobs);
    setDrafts(prev => ({
      ...prev,
      [recId]: draftText
    }));
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

  return (
    <div className="flex h-[calc(100vh-100px)] gap-4 bg-[#F8FAFC] text-slate-800 font-sans">
      
      {/* LEFT PANE: Recruiters List */}
      <div className="w-[340px] bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-100 bg-white flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-[13px] tracking-wide">MATCHED RECRUITERS</h3>
            <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-medium">{groupedMatches.length}</span>
          </div>
          <button 
            onClick={fetchMatches}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-md hover:bg-indigo-50"
            title="Refresh Matches"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          </button>
        </div>
        
        {/* Recruiter List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {loading ? (
            <div className="p-8 flex justify-center items-center h-full">
              <div className="w-6 h-6 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : groupedMatches.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              No matching recruiters found.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5 p-2">
              {groupedMatches.map((group, i) => {
                const isSelected = selectedRecruiter === group;
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedRecruiter(group);
                    }}
                    className={`p-3 cursor-pointer rounded-md border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group
                      ${isSelected 
                        ? 'bg-indigo-50/80 border-indigo-200 shadow-[0_2px_8px_-3px_rgba(99,102,241,0.15)]' 
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-md"></div>
                    )}
                    
                    <div className="flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0
                        ${isSelected ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
                        {(group.recruiter['Name'] || group.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className={`text-[14px] font-semibold truncate leading-tight ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {group.recruiter['Name'] || 'Unknown Name'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {group.recruiter['Agency Name']}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
                      <div className="flex items-center gap-1.5">
                        <div className={`flex items-center justify-center text-[10px] font-bold px-1.5 py-0.5 rounded
                          ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {group.jobs.length} Job{group.jobs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-[10px] font-medium text-slate-400 uppercase truncate max-w-[120px]" title={group.recruiter['Primary Specialty']}>
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
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        {selectedRecruiter ? (
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shadow-[0_2px_10px_-10px_rgba(0,0,0,0.05)] z-10">
              <div>
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  {selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name']}
                </h2>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  <p className="text-[13px] text-slate-500">
                    <span className="font-semibold text-slate-700">{selectedRecruiter.jobs.length}</span> matched open roles based on <span className="font-medium text-slate-800 px-1.5 py-0.5 bg-slate-100 rounded">{selectedRecruiter.recruiter['Primary Specialty']}</span>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Split View */}
            <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5">
              
              {/* Left Side: Matched Jobs List (2/5) */}
              <div className="lg:col-span-2 border-r border-slate-200 flex flex-col h-full bg-slate-50/30">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Matched Jobs</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {selectedRecruiter.jobs.map((job) => (
                    <div key={job.id} className="bg-white rounded-md border border-slate-200 p-3 shadow-sm hover:border-indigo-200 transition-colors">
                      <div className="flex justify-between items-start mb-1.5">
                        <div className="text-[13px] font-bold text-slate-800 leading-tight">{job.title}</div>
                      </div>
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-1.5 mb-2">
                        <span className="text-slate-700">{job.company}</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                        <span className="truncate">{job.location || 'Remote'}</span>
                      </div>
                      <a href={job.url} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 w-fit px-1.5 py-0.5 rounded">
                        View Posting
                        <svg xmlns="http://www.w3.org/2000/svg" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                      </a>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Bundled Email Draft (3/5) */}
              <div className="lg:col-span-3 flex flex-col h-full bg-slate-50/50">
                <div className="px-4 py-2.5 border-b border-slate-100 bg-white flex justify-between items-center">
                  <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    Bundled Email Draft
                    {currentDraft && <span className="bg-emerald-100 text-emerald-700 text-[9px] px-1.5 py-0.5 rounded-full font-bold">READY</span>}
                  </h4>
                  
                  {!currentDraft && (
                    <button
                      onClick={handleGenerateBundledDraft}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md text-[11px] font-bold transition-all shadow-sm flex items-center gap-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      Generate Draft
                    </button>
                  )}
                </div>
                
                <div className="flex-1 p-4 overflow-hidden flex flex-col">
                  {currentDraft ? (
                    <div className="relative flex-1 flex flex-col group/textarea">
                      <div 
                        contentEditable
                        suppressContentEditableWarning={true}
                        dangerouslySetInnerHTML={{ __html: currentDraft }}
                        onBlur={(e) => updateDraft(e.currentTarget.innerHTML)}
                        className="flex-1 w-full h-full bg-white border border-slate-200 rounded-md p-4 text-[13px] focus:outline-none focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-400 shadow-inner overflow-y-auto transition-all"
                      />
                      <button 
                        onClick={handleCopy}
                        className="absolute top-2 right-2 p-1.5 bg-white shadow hover:shadow-md text-slate-500 hover:text-indigo-600 rounded-md transition-all border border-slate-200"
                        title="Copy to clipboard"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                      </button>
                    </div>
                  ) : (
                    <div className="flex-1 h-full flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-md bg-white">
                      <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                      </div>
                      <p className="text-[13px] font-medium text-slate-500 text-center px-6 max-w-[280px]">
                        Create a single, beautifully bundled email containing all {selectedRecruiter.jobs.length} matched roles for this recruiter.
                      </p>
                      <button 
                        onClick={handleGenerateBundledDraft}
                        className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-700 text-[13px] font-bold rounded-md hover:bg-indigo-100 transition-colors shadow-sm"
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
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/50">
            <div className="w-20 h-20 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-5">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">Select a Recruiter</h2>
            <p className="text-slate-500 font-medium max-w-xs mx-auto text-[13px] leading-relaxed">
              Click on a recruiter from the left pane to view their matched jobs and instantly generate professional outreach emails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
