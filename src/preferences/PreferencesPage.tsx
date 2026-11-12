import React, { useEffect, useState } from 'react';

// ── Supabase config (same as service-worker) ─────────────────────────────────
const SUPABASE_URL = 'http://72.60.215.34:8000';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE';

const HEADERS = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
  Accept: 'application/json',
};

// Primary specialty options (matches what's used in the extension)
const SPECIALTY_OPTIONS = [
  'Technology & IT',
  'Finance & Accounting',
  'Healthcare & Medical',
  'Sales & Business Development',
  'Marketing & Communications',
  'Human Resources',
  'Legal & Compliance',
  'Engineering & Manufacturing',
  'Supply Chain & Logistics',
  'Executive & C-Suite',
  'Operations & Management',
  'Design & Creative',
  'Education & Training',
  'Construction & Real Estate',
  'Hospitality & Tourism',
  'Retail & Consumer Goods',
  'Energy & Utilities',
  'Life Sciences & Biotech',
  'Media & Entertainment',
  'Non-profit & Social Services',
];

const SIZE_OPTIONS = [
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '501-1000',
  '1001-5000',
  '5001+',
];

type Status = 'loading' | 'not_found' | 'ready' | 'saving' | 'saved' | 'error';

export default function PreferencesPage() {
  const [status, setStatus] = useState<Status>('loading');
  const [recruiter, setRecruiter] = useState<any>(null);
  const [recruiterId, setRecruiterId] = useState<string | null>(null);

  // Editable fields
  const [location, setLocation] = useState('');
  const [size, setSize] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // ── Resolve recruiter from URL param ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const email = params.get('email') || params.get('e');
    const id = params.get('id');

    if (!email && !id) {
      setStatus('not_found');
      return;
    }

    (async () => {
      try {
        let url: string;
        if (id) {
          url = `${SUPABASE_URL}/rest/v1/Recruiters?id=eq.${encodeURIComponent(id)}&limit=1`;
        } else {
          // Try matching on Associated contacts or email columns
          url =
            `${SUPABASE_URL}/rest/v1/Recruiters` +
            `?or=(Associated%20contacts.ilike.*${encodeURIComponent(email!)}*,email.ilike.*${encodeURIComponent(email!)}*,Email.ilike.*${encodeURIComponent(email!)}*)` +
            `&limit=1`;
        }

        const res = await fetch(url, { headers: HEADERS });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (!Array.isArray(data) || data.length === 0) {
          setStatus('not_found');
          return;
        }

        const rec = data[0];
        setRecruiter(rec);
        setRecruiterId(String(rec.id));
        setLocation(rec['Location'] || '');
        setSize(rec['Size'] || rec['size'] || '');
        setSpecialty(rec['Primary Specialty'] || '');
        setStatus('ready');
      } catch (e: any) {
        setErrorMsg(e.message);
        setStatus('error');
      }
    })();
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!recruiterId) return;
    setStatus('saving');
    try {
      const updates: Record<string, string> = {
        Location: location,
        Size: size,
        'Primary Specialty': specialty,
      };

      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/Recruiters?id=eq.${encodeURIComponent(recruiterId)}`,
        {
          method: 'PATCH',
          headers: { ...HEADERS, Prefer: 'return=minimal' },
          body: JSON.stringify(updates),
        }
      );

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }

      setStatus('saved');
    } catch (e: any) {
      setErrorMsg(e.message);
      setStatus('error');
    }
  };

  // ── Styles (inline — this page ships standalone). Values are Glacier tokens. ──
  const G = {
    canvas: '#F3F7F8', surface: '#FFFFFF', subtle: '#E6EEF1', strokeCard: '#DBE5E9', strokeControl: '#C8D6DC',
    strokeAccessible: '#6E848F', fg: '#0E1A1F', fgMuted: '#4E6470', fgSubtle: '#576D78',
    accent: '#1E70A7', accentHover: '#0E5A8A', onAccent: '#FFFFFF', accentText: '#1E70A7',
    accentSubtle: '#F0F8FE', accentSubtle2: '#DEF0FF', accentSubtleFg: '#0E5A8A',
    appIcon1: '#4590C8', appIcon2: '#0E5A8A',
    dangerFg: '#B42A26', dangerBg: '#FCEDEB', successFg: '#1F6B3A', successBg: '#E6F6EA',
  };
  const styles: Record<string, React.CSSProperties> = {
    body: {
      minHeight: '100vh',
      backgroundColor: G.canvas,
      backgroundImage: `radial-gradient(120% 80% at 0% 0%, ${G.accentSubtle} 0%, transparent 55%)`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Onest", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
      color: G.fg,
      padding: '24px',
      margin: 0,
    },
    card: {
      background: G.surface,
      border: `1px solid ${G.strokeCard}`,
      borderRadius: '12px',
      padding: '32px',
      maxWidth: '480px',
      width: '100%',
      boxShadow: '0 4px 8px rgba(30,50,60,0.04), 0 24px 56px rgba(30,50,60,0.12)',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '24px',
    },
    logoIcon: {
      width: '32px',
      height: '32px',
      background: `linear-gradient(160deg, ${G.appIcon1}, ${G.appIcon2})`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      borderRadius: '9px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#FFFFFF',
    },
    logoText: {
      fontSize: '16px',
      fontWeight: 600,
      color: G.fg,
    },
    heading: {
      fontSize: '24px',
      lineHeight: '32px',
      fontWeight: 600,
      color: G.fg,
      margin: '0 0 4px',
      letterSpacing: '-0.016em',
    },
    subheading: {
      fontSize: '14px',
      lineHeight: '20px',
      color: G.fgMuted,
      margin: '0 0 20px',
    },
    label: {
      display: 'block',
      fontSize: '14px',
      lineHeight: '20px',
      fontWeight: 500,
      color: G.fg,
      marginBottom: '6px',
    },
    fieldGroup: {
      marginBottom: '16px',
    },
    input: {
      width: '100%',
      height: '32px',
      padding: '0 12px',
      background: G.surface,
      border: `1px solid ${G.strokeControl}`,
      borderBottomColor: G.strokeAccessible,
      borderRadius: '6px',
      color: G.fg,
      fontFamily: 'inherit',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%',
      height: '32px',
      padding: '0 12px',
      background: G.surface,
      border: `1px solid ${G.strokeControl}`,
      borderBottomColor: G.strokeAccessible,
      borderRadius: '6px',
      color: G.fg,
      fontFamily: 'inherit',
      fontSize: '14px',
      outline: 'none',
      boxSizing: 'border-box' as const,
      cursor: 'pointer',
    },
    btn: {
      width: '100%',
      height: '40px',
      background: G.accent,
      border: 'none',
      borderRadius: '6px',
      color: G.onAccent,
      fontFamily: 'inherit',
      fontSize: '14px',
      fontWeight: 500,
      cursor: 'pointer',
      marginTop: '8px',
    },
    savedBanner: {
      padding: '12px 14px',
      background: G.successBg,
      borderRadius: '8px',
      color: G.successFg,
      fontSize: '14px',
      fontWeight: 500,
      marginTop: '16px',
    },
    errorBanner: {
      padding: '12px 14px',
      background: G.dangerBg,
      borderRadius: '8px',
      color: G.dangerFg,
      fontSize: '14px',
      marginTop: '12px',
    },
    spinner: {
      display: 'inline-block',
      width: '16px',
      height: '16px',
      border: '2px solid currentColor',
      borderRightColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      marginRight: '8px',
      verticalAlign: 'middle',
    },
    notFound: {
      color: G.fgMuted,
      fontSize: '14px',
      lineHeight: '20px',
    },
    recruiterBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '2px 10px',
      background: G.accentSubtle2,
      borderRadius: '9999px',
      fontSize: '12px',
      lineHeight: '20px',
      color: G.accentSubtleFg,
      marginBottom: '20px',
      fontWeight: 500,
    },
  };

  const recName =
    recruiter?.['Name'] || recruiter?.['Agency Name'] || 'your account';

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus { border-bottom-color: #1E70A7 !important; box-shadow: inset 0 -1px 0 #1E70A7; }
        :focus-visible { outline: 2px solid #0E1A1F; outline-offset: 1px; box-shadow: 0 0 0 1px #FFFFFF; }
        button:hover:not(:disabled) { background: #0E5A8A !important; }
        button:disabled { background: #E6EEF1 !important; color: #576D78 !important; cursor: not-allowed; }
        input:disabled, select:disabled { background: #E6EEF1 !important; color: #576D78; }
        ::placeholder { color: #576D78; }
      `}</style>

      <div style={styles.body}>
        <div style={styles.card}>
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="2" width="20" height="8" rx="2" /><rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
            </div>
            <span style={styles.logoText}>RecruitScout</span>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ color: G.fgMuted, fontSize: '14px' }}>
              <span style={styles.spinner} />
              Caricamento in corso…
            </div>
          )}

          {/* Not found */}
          {status === 'not_found' && (
            <div style={styles.notFound}>
              <p style={{ color: G.fg, fontWeight: 600, fontSize: '20px', lineHeight: '28px', margin: '0 0 8px' }}>
                Profilo non trovato
              </p>
              <p>
                Non riusciamo a trovare il tuo profilo. Controlla il link nell'email
                o contattaci a{' '}
                <a href="mailto:support@recruitscout.tech" style={{ color: G.accentText }}>
                  support@recruitscout.tech
                </a>
                .
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div>
              <p style={{ color: G.dangerFg, fontWeight: 600, margin: 0 }}>Si è verificato un errore</p>
              <div style={styles.errorBanner}>{errorMsg}</div>
            </div>
          )}

          {/* Form */}
          {(status === 'ready' || status === 'saving' || status === 'saved') && (
            <>
              <h1 style={styles.heading}>Aggiorna le tue preferenze</h1>
              <p style={styles.subheading}>
                Aggiorna i tuoi dati per ricevere lead più pertinenti.
              </p>

              {/* Recruiter badge */}
              <div style={styles.recruiterBadge}>{recName}</div>

              {/* Location */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Posizione geografica</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="es. Milano, Italia"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  disabled={status === 'saving' || status === 'saved'}
                />
              </div>

              {/* Size */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Dimensione agenzia</label>
                <select
                  style={styles.select}
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  disabled={status === 'saving' || status === 'saved'}
                >
                  <option value="">Seleziona dimensione…</option>
                  {SIZE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s} dipendenti</option>
                  ))}
                </select>
              </div>

              {/* Primary Specialty */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>Specializzazione principale</label>
                <select
                  style={styles.select}
                  value={specialty}
                  onChange={e => setSpecialty(e.target.value)}
                  disabled={status === 'saving' || status === 'saved'}
                >
                  <option value="">Seleziona specializzazione…</option>
                  {SPECIALTY_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Save button */}
              {status !== 'saved' && (
                <button
                  style={styles.btn}
                  onClick={handleSave}
                  disabled={status === 'saving'}
                >
                  {status === 'saving' ? (
                    <><span style={styles.spinner} />Salvataggio…</>
                  ) : (
                    'Salva preferenze'
                  )}
                </button>
              )}

              {/* Success */}
              {status === 'saved' && (
                <div style={styles.savedBanner}>
                  Preferenze aggiornate.
                  <br />
                  <span style={{ fontSize: '12px', fontWeight: 400 }}>
                    Le tue informazioni sono state salvate. Puoi chiudere questa pagina.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
