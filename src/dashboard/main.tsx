import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './Dashboard';
import LoginPage from './LoginPage';
import { supabaseClient } from '../shared/supabase';
import '../popup/styles/globals.css';

function App() {
  // null = still checking, false = not logged in, true = logged in
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    // Synchronous check — no flicker for users who are already authenticated
    const session = supabaseClient.getSession();
    setAuthed(!!session);
  }, []);

  const handleLogout = () => {
    supabaseClient.signOut();
    setAuthed(false);
  };

  // Checking session — show a minimal splash to avoid layout flicker
  if (authed === null) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080C14]">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!authed) {
    return <LoginPage onLoginSuccess={() => setAuthed(true)} />;
  }

  return <Dashboard onLogout={handleLogout} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
