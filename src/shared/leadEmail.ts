/**
 * Lead email helpers shared by the Leads flow tab and the Assistant.
 * Moved verbatim from LeadsFlowTab.tsx so both send identical emails.
 */

/** The job fields the matching and email templates read. */
export interface LeadJob {
  id: string;
  title: string;
  company?: string;
  location?: string | null;
  url?: string;
  category?: string | null;
}

/**
 * Extract meaningful keywords from a category/specialty string.
 * Strips punctuation, splits on "/" and " ", filters short/stop words.
 */
export function extractKeywords(str: string): Set<string> {
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
export function specialtyMatches(recSpecialty: string, jobCategory: string): boolean {
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

export function getSalutationFirstName(
  recruiter: any,
  contactsList: any[] = [],
  targetEmail?: string
): string {
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
}

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
export function generateLeadEmail(
  recruiter: any,
  jobs: LeadJob[],
  targetEmail?: string,
  contactsList: any[] = []
): { subject: string; bodyHtml: string } {
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
}
