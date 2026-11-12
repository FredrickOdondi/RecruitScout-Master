import React, { useState, useEffect } from'react';
import { MessageType, ExtensionMessage } from'../shared/types';
import'./styles/globals.css';

export default function App() {
 const [state, setState] = useState<any>({ status:'idle' });
 const [settings, setSettings] = useState<any>({});
 const [isLoading, setIsLoading] = useState(true);
 const [indeedSession, setIndeedSession] = useState<{ active: boolean; label: string | null }>({ active: false, label: null });

 // Load initial data
 useEffect(() => {
 loadData();
 loadSettings();
 loadIndeedSession();
 }, []);

 // Listen for state and setting changes
 useEffect(() => {
 const handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>) => {
 if (changes.recruitscout_state?.newValue) {
 setState(changes.recruitscout_state.newValue);
 }
 if (changes.recruitscout_settings?.newValue) {
 setSettings(changes.recruitscout_settings.newValue);
 }
 if (changes.recruitscout_indeed_lease) {
 loadIndeedSession();
 }
 };

 if (chrome.storage && chrome.storage.onChanged) {
 chrome.storage.onChanged.addListener(handleStorageChange);
 }
 return () => {
 if (chrome.storage && chrome.storage.onChanged) {
 chrome.storage.onChanged.removeListener(handleStorageChange);
 }
 };
 }, []);

 async function loadData() {
 try {
 setIsLoading(true);
 const stateResponse = await sendMessage<any>({ type: MessageType.GET_STATE });
 setState(stateResponse || { status:'idle' });
 } catch {
 setState({ status:'idle' });
 } finally {
 setIsLoading(false);
 }
 }

 async function loadSettings() {
 try {
 const res = await sendMessage<any>({ type: MessageType.GET_SETTINGS });
 if (res) setSettings(res);
 } catch {
 // Graceful fallback
 }
 }

 async function loadIndeedSession() {
 const res = await sendMessage<any>({ type: MessageType.INDEED_SESSION_STATUS });
 if (res) setIndeedSession(res);
 }

 async function updateSetting(key: string, value: any) {
 const newSettings = { ...settings, [key]: value };
 setSettings(newSettings);
 await sendMessage({
 type: MessageType.UPDATE_SETTINGS,
 payload: { [key]: value },
 });
 }

 function sendMessage<T>(message: ExtensionMessage, timeoutMs: number = 7000): Promise<T> {
 return new Promise((resolve) => {
 if (!chrome.runtime || !chrome.runtime.sendMessage) {
 resolve(null as unknown as T);
 return;
 }
 let completed = false;
 const timer = setTimeout(() => {
 if (!completed) {
 completed = true;
 resolve(null as unknown as T);
 }
 }, timeoutMs);

 try {
 chrome.runtime.sendMessage(message, (response) => {
 if (completed) return;
 completed = true;
 clearTimeout(timer);
 if (chrome.runtime.lastError) {
 resolve(null as unknown as T);
 } else {
 resolve(response as T);
 }
 });
 } catch {
 if (!completed) {
 completed = true;
 clearTimeout(timer);
 resolve(null as unknown as T);
 }
 }
 });
 }

  /** Says why a queue check didn't start a task. */
  function explainPoll(res: any) {
    if (!res || res.foundTask) return;
    const running = res.counts?.running ?? 0;
    switch (res.reason) {
      case 'busy':
        alert('This agent is already running a task. It picks up the next one when it finishes.');
        break;
      case 'already-polling':
        alert('This agent is already checking the queue. Give it a moment.');
        break;
      case 'polling-off':
        alert('Swarm connect is off. Turn it on to pull tasks from the queue.');
        break;
      case 'error':
        alert(`Couldn't read the queue. ${res.error || 'Check your connection and try again.'}`);
        break;
      default:
        alert(running > 0
          ? `No pending tasks. ${running} task${running === 1 ? ' is' : 's are'} running on other agents. Tasks stuck for over 3 hours are released automatically.`
          : 'No pending tasks in the queue. The agent keeps listening in the background.');
    }
  }

  const handleStart = async () => {
    // 1. If remote mode is active, poll remote queue
    if (settings.pollingEnabled) {
      explainPoll(await sendMessage<any>({ type: 'FORCE_POLL_QUEUE' as any }, 60000));
      return;
    }

    // 2. Check local queue
    let localTitles: string[] = [];
    if (chrome.storage && chrome.storage.local) {
      const res = await chrome.storage.local.get('recruitscout_pending_bulk');
      localTitles = res.recruitscout_pending_bulk || [];
    }

    if (localTitles.length > 0) {
      sendMessage({
        type: MessageType.START_BULK_EXTRACTION,
        payload: { 
          titles: localTitles, 
          options: { 
            client_name: settings.activeClientName || undefined 
          } 
        }
      });
      setState({ ...state, status: 'running' });
      return;
    }

    // 3. Fallback: local queue is empty, so automatically switch to Remote Swarm Mode and poll Supabase!
    await updateSetting('pollingEnabled', true);
    explainPoll(await sendMessage<any>({ type: 'FORCE_POLL_QUEUE' as any }, 60000));
  };

 const handleStop = () => {
 sendMessage({ type: MessageType.STOP_EXTRACTION });
 setState({ ...state, status:'idle' });
 };

 const isRunning = state.status ==='running' || state.status ==='crawling';

 const statusLabel = isRunning ? 'Running' : settings.pollingEnabled ? 'Listening to queue' : state.status === 'error' ? 'Error' : 'Idle';
 const statusDot = isRunning ? 'bg-accent' : settings.pollingEnabled ? 'bg-success-500' : state.status === 'error' ? 'bg-danger-solid' : 'bg-stroke-accessible';

 return (
 <div className="w-[360px] min-h-[480px] glacier-canvas text-fg font-sans flex flex-col">
 {/* Header: Glacier app icon, product name, engine status (word + dot) */}
 <header className="flex items-center gap-3 px-4 h-14 border-b border-stroke-card glacier-chrome">
 <div className="relative w-8 h-8 rounded-[9px] bg-gradient-to-br from-app-icon-1 to-app-icon-2 flex items-center justify-center shrink-0 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
 <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="relative text-white" aria-hidden="true">
 <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
 <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
 <line x1="6" y1="6" x2="6.01" y2="6" />
 <line x1="6" y1="18" x2="6.01" y2="18" />
 </svg>
 </div>
 <div className="min-w-0 flex-1">
 <h1 className="text-base font-semibold leading-tight">RecruitScout agent</h1>
 <p className="text-xs text-fg-muted flex items-center gap-1.5 mt-0.5">
 <span className={`w-2 h-2 rounded-full ${statusDot}`} aria-hidden="true" />
 {statusLabel}
 </p>
 </div>
 </header>

 <div className="flex-1 p-4 space-y-3">
 {/* Swarm card */}
 <section className="card p-4 space-y-4">
 <div className="flex items-center justify-between gap-3">
 <div>
 <h2 className="text-sm font-semibold">Swarm connect</h2>
 <p className="text-xs text-fg-muted mt-0.5">Pull tasks from the command center queue</p>
 </div>
 {/* Glacier switch: accessible outline when off, accent when on */}
 <label className="relative inline-flex items-center cursor-pointer shrink-0">
 <input
 type="checkbox"
 className="sr-only peer"
 aria-label="Remote polling"
 checked={settings.pollingEnabled || false}
 onChange={e => updateSetting('pollingEnabled', e.target.checked)}
 />
 <span className="w-10 h-5 rounded-full border border-stroke-accessible bg-surface peer-checked:bg-accent peer-checked:border-accent transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-focus-outer peer-focus-visible:outline-offset-1" />
 <span className="absolute left-[3px] top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-fg-muted peer-checked:bg-on-accent peer-checked:translate-x-5 transition-all" />
 </label>
 </div>

 <div className="space-y-1.5">
 <label htmlFor="worker-id" className="text-sm font-medium block">Worker ID</label>
 <input
 id="worker-id"
 type="text"
 className="input mono-id"
 placeholder="Name this agent, for example agent-01"
 value={settings.friendName || ''}
 onChange={(e) => updateSetting('friendName', e.target.value)}
 />
 </div>

 {/* How Indeed tasks sign in: this browser's own account, or a stored account from the table */}
 <div className="pt-4 border-t border-stroke-divider space-y-2">
 <div className="flex items-center justify-between gap-2">
 <h3 className="text-sm font-medium" id="indeed-mode-label">Indeed sign-in</h3>
 {settings.indeedCookieMode !== 'browser' && (
 <span className={`badge ${indeedSession.active ? 'badge-success' : 'bg-neutral-badge text-fg-muted'}`}>
 <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
 {indeedSession.active ? (indeedSession.label || 'In use') : 'None loaded'}
 </span>
 )}
 </div>
 <div role="radiogroup" aria-labelledby="indeed-mode-label" className="grid grid-cols-2 gap-1 p-0.5 rounded-md bg-subtle">
 {([['browser', 'This browser'], ['stored', 'Stored accounts']] as const).map(([mode, label]) => {
 const selected = (settings.indeedCookieMode ?? 'stored') === mode;
 return (
 <button
 key={mode}
 type="button"
 role="radio"
 aria-checked={selected}
 onClick={() => updateSetting('indeedCookieMode', mode)}
 className={`tab justify-center ${selected ? 'tab-active' : 'tab-inactive'}`}
 >
 {label}
 </button>
 );
 })}
 </div>
 <p className="text-xs text-fg-subtle">
 {settings.indeedCookieMode === 'browser'
 ? 'Indeed tasks use the account signed in to this Chrome profile.'
 : 'Indeed queue and bulk tasks load one of your saved accounts. While they run, it replaces the Indeed sign-in in this Chrome profile.'}
 </p>
 </div>
 </section>

 {/* Sheets sync card */}
 <section className="card px-4 py-3 flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-accent-subtle-2 text-accent-text flex items-center justify-center shrink-0">
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
 <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
 <polyline points="14 2 14 8 20 8"></polyline>
 <line x1="16" y1="13" x2="8" y2="13"></line>
 <line x1="16" y1="17" x2="8" y2="17"></line>
 </svg>
 </div>
 <div className="min-w-0 flex-1">
 <div className="text-xs text-fg-muted">Sheets sync</div>
 <div className="text-sm font-medium truncate">
 {settings.activeClientName || (settings.googleSheetsConfig?.spreadsheetId ? 'Connected sheet' : 'Automatic')}
 </div>
 </div>
 <span className="badge badge-success shrink-0">
 <span className="w-1.5 h-1.5 rounded-full bg-success-fg" aria-hidden="true" />
 Live
 </span>
 </section>
 </div>

 {/* Primary action */}
 <footer className="p-4 pt-0 space-y-3">
 {!isRunning ? (
 <button onClick={handleStart} className="btn-primary w-full h-10">
 Start engine
 </button>
 ) : (
 <button onClick={handleStop} className="btn-danger w-full h-10">
 Stop engine
 </button>
 )}
 <button
 onClick={() => chrome.runtime.openOptionsPage()}
 className="btn-ghost w-full"
 >
 Open command center
 </button>
 </footer>
 </div>
 );
}
