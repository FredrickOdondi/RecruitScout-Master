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

  // ── Styles (inline — no bundled CSS needed for this standalone page) ─────────
  const styles: Record<string, React.CSSProperties> = {
    body: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: '24px',
      margin: 0,
    },
    card: {
      background: 'rgba(30, 41, 59, 0.8)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(99, 102, 241, 0.2)',
      borderRadius: '20px',
      padding: '40px 48px',
      maxWidth: '520px',
      width: '100%',
      boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    },
    logo: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      marginBottom: '32px',
    },
    logoIcon: {
      width: '36px',
      height: '36px',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      borderRadius: '10px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '18px',
    },
    logoText: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#f1f5f9',
      letterSpacing: '-0.3px',
    },
    heading: {
      fontSize: '24px',
      fontWeight: 700,
      color: '#f1f5f9',
      margin: '0 0 6px',
      letterSpacing: '-0.5px',
    },
    subheading: {
      fontSize: '14px',
      color: '#94a3b8',
      margin: '0 0 32px',
      lineHeight: 1.6,
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: 600,
      color: '#cbd5e1',
      marginBottom: '6px',
      letterSpacing: '0.3px',
      textTransform: 'uppercase' as const,
    },
    fieldGroup: {
      marginBottom: '20px',
    },
    input: {
      width: '100%',
      padding: '12px 14px',
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '10px',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
    },
    select: {
      width: '100%',
      padding: '12px 14px',
      background: 'rgba(15, 23, 42, 0.6)',
      border: '1px solid rgba(99, 102, 241, 0.25)',
      borderRadius: '10px',
      color: '#f1f5f9',
      fontSize: '14px',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box' as const,
      appearance: 'none' as const,
      cursor: 'pointer',
    },
    btn: {
      width: '100%',
      padding: '14px',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      border: 'none',
      borderRadius: '12px',
      color: '#fff',
      fontSize: '15px',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'opacity 0.2s, transform 0.15s',
      marginTop: '8px',
    },
    savedBanner: {
      padding: '14px 18px',
      background: 'rgba(16, 185, 129, 0.15)',
      border: '1px solid rgba(16, 185, 129, 0.3)',
      borderRadius: '12px',
      color: '#34d399',
      fontSize: '14px',
      fontWeight: 500,
      textAlign: 'center' as const,
      marginTop: '20px',
    },
    errorBanner: {
      padding: '14px 18px',
      background: 'rgba(239, 68, 68, 0.12)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      color: '#f87171',
      fontSize: '13px',
      marginTop: '16px',
    },
    spinner: {
      display: 'inline-block',
      width: '20px',
      height: '20px',
      border: '2px solid rgba(255,255,255,0.2)',
      borderTopColor: '#fff',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      marginRight: '8px',
      verticalAlign: 'middle',
    },
    notFound: {
      textAlign: 'center' as const,
      color: '#94a3b8',
      fontSize: '15px',
      lineHeight: 1.7,
    },
    recruiterBadge: {
      display: 'inline-block',
      padding: '4px 12px',
      background: 'rgba(99, 102, 241, 0.15)',
      border: '1px solid rgba(99, 102, 241, 0.3)',
      borderRadius: '20px',
      fontSize: '12px',
      color: '#a5b4fc',
      marginBottom: '24px',
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
        input:focus, select:focus {
          border-color: rgba(99, 102, 241, 0.6) !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        button:hover:not(:disabled) { opacity: 0.88; transform: translateY(-1px); }
        button:active:not(:disabled) { transform: translateY(0); }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        select option { background: #1e293b; color: #f1f5f9; }
      `}</style>

      <div style={styles.body}>
        <div style={styles.card}>
          {/* Logo */}
          <div style={styles.logo}>
            <div style={styles.logoIcon}>🎯</div>
            <span style={styles.logoText}>RecruitScout</span>
          </div>

          {/* Loading */}
          {status === 'loading' && (
            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
              <span style={styles.spinner} />
              Caricamento in corso…
            </div>
          )}

          {/* Not found */}
          {status === 'not_found' && (
            <div style={styles.notFound}>
              <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔍</div>
              <p style={{ color: '#f1f5f9', fontWeight: 600, fontSize: '18px', margin: '0 0 8px' }}>
                Profilo non trovato
              </p>
              <p>
                Non riusciamo a trovare il tuo profilo. Controlla il link nell'email
                o contattaci a{' '}
                <a href="mailto:support@recruitscout.tech" style={{ color: '#818cf8' }}>
                  support@recruitscout.tech
                </a>
                .
              </p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && (
            <div>
              <p style={{ color: '#f87171', fontWeight: 600 }}>Si è verificato un errore</p>
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
              <div style={styles.recruiterBadge}>👤 {recName}</div>

              {/* Location */}
              <div style={styles.fieldGroup}>
                <label style={styles.label}>📍 Posizione geografica</label>
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
                <label style={styles.label}>🏢 Dimensione agenzia</label>
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
                <label style={styles.label}>🎯 Specializzazione principale</label>
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
                    '✓ Salva preferenze'
                  )}
                </button>
              )}

              {/* Success */}
              {status === 'saved' && (
                <div style={styles.savedBanner}>
                  ✅ Preferenze aggiornate con successo!
                  <br />
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>
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
