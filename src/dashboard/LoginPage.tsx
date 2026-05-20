import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../shared/supabase';

// ── Animated Background ──────────────────────────────────────────────────
function SubtleGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none bg-gray-50">
      {/* Subtle grid lines */}
      <div
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage: `
            linear-gradient(to right, #e5e7eb 1px, transparent 1px),
            linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const LockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const MailIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <polyline points="22,6 12,13 2,6" />
  </svg>
);

const EyeIcon = ({ show }: { show: boolean }) =>
  show ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );

const ServerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────
type ViewState = 'login' | 'forgot-password' | 'update-password' | 'invite';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [view, setView]           = useState<ViewState>('login');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [shake, setShake]         = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Parse URL hash on mount for password recovery tokens or user invites
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      const type = params.get('type');
      
      if (token) {
        if (type === 'recovery') {
          setAccessToken(token);
          setView('update-password');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } else if (type === 'invite') {
          // It's an invitation! Let's get the email associated with this token
          setAccessToken(token);
          supabaseClient.getUserByToken(token).then(({ user, error: fetchErr }) => {
            if (user && user.email) {
              setEmail(user.email);
            } else if (fetchErr) {
              setError('Failed to securely fetch invitation details: ' + fetchErr);
            }
          });
          setView('invite');
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }
  }, []);

  useEffect(() => { 
    // Don't focus email on invite view since it's locked, focus password instead
    if (view === 'invite') {
      document.getElementById('login-password')?.focus();
    } else {
      emailRef.current?.focus(); 
    }
  }, [view]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (view === 'login') {
      if (!email.trim() || !password) { setLoading(false); return; }
      const { error: authError } = await supabaseClient.signIn(email.trim(), password);
      if (authError) {
        setError(authError);
        setLoading(false);
        setShake(true);
        setTimeout(() => setShake(false), 600);
        return;
      }
      onLoginSuccess();
    } 
    else if (view === 'forgot-password') {
      if (!email.trim()) { setLoading(false); return; }
      const { error: resetError } = await supabaseClient.resetPasswordForEmail(email.trim(), window.location.origin);
      setLoading(false);
      if (resetError) {
        setError(resetError);
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } else {
        setSuccess('Password reset link sent! Please check your email.');
      }
    }
    else if (view === 'update-password' || view === 'invite') {
      if (!password || !accessToken) { setLoading(false); return; }
      const { error: updateError } = await supabaseClient.updateUserPassword(password, accessToken);
      setLoading(false);
      if (updateError) {
        setError(updateError);
        setShake(true);
        setTimeout(() => setShake(false), 600);
      } else {
        setSuccess(view === 'invite' ? 'Account created! You can now sign in.' : 'Password updated successfully! You can now sign in.');
        setView('login');
        setPassword('');
        setAccessToken(null);
      }
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-gray-50 overflow-hidden font-sans">
      <SubtleGrid />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 transition-transform ${shake ? 'animate-[shake_0.5s_ease]' : ''}`}
        style={{ animation: shake ? 'shake 0.5s ease' : undefined }}
      >
        <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-white shadow-sm">

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-3 border border-gray-200 bg-gray-50 shadow-sm">
                <span className="text-gray-700">
                  <ServerIcon />
                </span>
              </div>
              <h1 className="text-xl font-medium text-gray-900 tracking-tight">RecruitScout</h1>
              <p className="text-[11px] text-gray-500 mt-1 uppercase tracking-widest font-bold text-center">
                {view === 'login' ? 'Command Center' : view === 'forgot-password' ? 'Password Recovery' : view === 'invite' ? 'Accept Invitation' : 'Set New Password'}
              </p>
            </div>

            {error && (
              <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-md px-4 py-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="mb-5 flex items-start gap-2.5 bg-green-50 border border-green-200 text-green-700 text-[13px] rounded-md px-4 py-3">
                <span className="mt-0.5 shrink-0">✓</span>
                <span>{success}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* Email (Login, Forgot Password & Invite) */}
              {(view === 'login' || view === 'forgot-password' || view === 'invite') && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
                    Email address
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <MailIcon />
                    </span>
                    <input
                      ref={emailRef}
                      id="login-email"
                      type="email"
                      autoComplete="email"
                      required
                      disabled={view === 'invite'}
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full bg-white border border-gray-300 rounded-md pl-10 pr-4 py-2.5 text-[13px] text-gray-900 placeholder-gray-400
                        focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all shadow-sm
                        disabled:bg-gray-100 disabled:text-gray-500 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )}

              {/* Password (Login, Update Password & Invite) */}
              {(view === 'login' || view === 'update-password' || view === 'invite') && (
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[11px] font-bold text-gray-600 uppercase tracking-widest">
                      {view === 'update-password' || view === 'invite' ? 'Create Password' : 'Password'}
                    </label>
                    {view === 'login' && (
                      <button
                        type="button"
                        onClick={() => { setView('forgot-password'); setError(null); setSuccess(null); }}
                        className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        Forgot Password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      <LockIcon />
                    </span>
                    <input
                      id="login-password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete={view === 'update-password' || view === 'invite' ? 'new-password' : 'current-password'}
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white border border-gray-300 rounded-md pl-10 pr-11 py-2.5 text-[13px] text-gray-900 placeholder-gray-400
                        focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all shadow-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      tabIndex={-1}
                    >
                      <EyeIcon show={showPass} />
                    </button>
                  </div>
                </div>
              )}

              <button
                id="login-submit"
                type="submit"
                disabled={loading || (view === 'login' && (!email.trim() || !password)) || (view === 'forgot-password' && !email.trim()) || ((view === 'update-password' || view === 'invite') && !password)}
                className="w-full relative flex items-center justify-center gap-2 py-2.5 rounded-md font-medium text-[13px] transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  bg-gray-900 text-white hover:bg-gray-800 shadow-sm border border-transparent"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Processing…</span>
                  </>
                ) : (
                  <span>
                    {view === 'login' ? 'Sign In' : view === 'forgot-password' ? 'Send Reset Link' : view === 'invite' ? 'Accept Invitation' : 'Update Password'}
                  </span>
                )}
              </button>
            </form>
            
            {view !== 'login' && (
              <div className="mt-5 text-center">
                <button
                  type="button"
                  onClick={() => { setView('login'); setError(null); setSuccess(null); }}
                  className="text-[12px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
                >
                  &larr; Back to Login
                </button>
              </div>
            )}

            {view === 'login' && (
              <p className="mt-5 text-center text-[12px] text-gray-500">
                Access is restricted to authorised users.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Shake keyframe injected inline */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-3px); }
          90%       { transform: translateX(3px); }
        }
      `}</style>
    </div>
  );
}
