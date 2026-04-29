import React, { useState, useEffect, useRef } from 'react';
import { supabaseClient } from '../shared/supabase';

// ── Animated Grid Background ──────────────────────────────────────────────────
function AnimatedGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, #60a5fa 1px, transparent 1px),
            linear-gradient(to bottom, #60a5fa 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
        }}
      />
      {/* Radial gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(99,102,241,0.12) 0%, transparent 70%)',
        }}
      />
      {/* Bottom fade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 100%, rgba(6,182,212,0.08) 0%, transparent 60%)',
        }}
      />
      {/* Floating orbs */}
      <div
        className="absolute w-96 h-96 rounded-full opacity-10 blur-3xl animate-pulse"
        style={{
          background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)',
          top: '-10%',
          left: '15%',
          animationDuration: '4s',
        }}
      />
      <div
        className="absolute w-80 h-80 rounded-full opacity-10 blur-3xl animate-pulse"
        style={{
          background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
          bottom: '0%',
          right: '10%',
          animationDuration: '6s',
          animationDelay: '2s',
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
interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [showPass, setShowPass]   = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [shake, setShake]         = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;

    setLoading(true);
    setError(null);

    const { error: authError } = await supabaseClient.signIn(email.trim(), password);

    if (authError) {
      setError(authError);
      setLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 600);
      return;
    }

    onLoginSuccess();
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-[#080C14] overflow-hidden font-sans">
      <AnimatedGrid />

      {/* Card */}
      <div
        className={`relative z-10 w-full max-w-md mx-4 transition-transform ${shake ? 'animate-[shake_0.5s_ease]' : ''}`}
        style={{
          animation: shake ? 'shake 0.5s ease' : undefined,
        }}
      >
        {/* Glow border effect */}
        <div
          className="absolute inset-0 rounded-2xl blur-sm opacity-30"
          style={{ background: 'linear-gradient(135deg, #6366f1 0%, #06b6d4 100%)' }}
        />

        <div
          className="relative rounded-2xl border border-white/10 overflow-hidden"
          style={{ background: 'rgba(13, 19, 33, 0.85)', backdropFilter: 'blur(24px)' }}
        >
          {/* Top gradient bar */}
          <div
            className="h-0.5 w-full"
            style={{ background: 'linear-gradient(90deg, #6366f1, #06b6d4, #6366f1)' }}
          />

          <div className="px-8 py-10">
            {/* Logo */}
            <div className="flex flex-col items-center mb-8">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.2) 0%, rgba(6,182,212,0.2) 100%)',
                  border: '1px solid rgba(99,102,241,0.3)',
                }}
              >
                <span className="text-indigo-400">
                  <ServerIcon />
                </span>
              </div>
              <h1 className="text-2xl font-bold text-white tracking-tight">RecruitScout</h1>
              <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold">
                Command Center
              </p>
            </div>

            {/* Error banner */}
            {error && (
              <div className="mb-5 flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">
                <span className="mt-0.5 shrink-0">⚠</span>
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Email address
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
                    <MailIcon />
                  </span>
                  <input
                    ref={emailRef}
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#0B0F19] border border-gray-700 rounded-xl pl-10 pr-4 py-3 text-sm text-gray-200 placeholder-gray-600
                      focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Password
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600">
                    <LockIcon />
                  </span>
                  <input
                    id="login-password"
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0B0F19] border border-gray-700 rounded-xl pl-10 pr-11 py-3 text-sm text-gray-200 placeholder-gray-600
                      focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400 transition-colors"
                    tabIndex={-1}
                  >
                    <EyeIcon show={showPass} />
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                id="login-submit"
                type="submit"
                disabled={loading || !email.trim() || !password}
                className="w-full relative flex items-center justify-center gap-2.5 py-3 rounded-xl font-semibold text-sm transition-all
                  disabled:opacity-50 disabled:cursor-not-allowed
                  focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-2 focus:ring-offset-[#0d1321]
                  overflow-hidden group"
                style={{
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 50%, #06b6d4 100%)',
                  boxShadow: loading ? 'none' : '0 0 24px rgba(99,102,241,0.4)',
                }}
              >
                {/* Shimmer overlay on hover */}
                <span
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
                  }}
                />
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Signing in…</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            {/* Footer note */}
            <p className="mt-6 text-center text-xs text-gray-600">
              Access is restricted to authorised users.
            </p>
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
