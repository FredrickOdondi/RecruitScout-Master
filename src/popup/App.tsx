import React, { useState, useEffect } from 'react';
import { MessageType, ExtensionMessage } from '../shared/types';
import './styles/globals.css';

export default function App() {
  const [state, setState] = useState<any>({ status: 'idle' });
  const [settings, setSettings] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadData();
    loadSettings();
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
      let stateResponse: any;
      try {
        stateResponse = await Promise.race([
          sendMessage({ type: MessageType.GET_STATE }),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
        ]);
      } catch (e) {
        stateResponse = { status: 'idle' };
      }
      setState(stateResponse || { status: 'idle' });
    } catch (error) {
      setState({ status: 'idle' });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const res = await sendMessage<any>({ type: MessageType.GET_SETTINGS });
      if (res) setSettings(res);
    } catch (e) {
      console.error(e);
    }
  }

  async function updateSetting(key: string, value: any) {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await sendMessage({
      type: MessageType.UPDATE_SETTINGS,
      payload: { [key]: value },
    });
  }

  function sendMessage<T>(message: ExtensionMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!chrome.runtime || !chrome.runtime.sendMessage) {
        reject(new Error('Chrome runtime not available'));
        return;
      }
      const timeout = setTimeout(() => reject(new Error('Message timeout')), 5000);
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(response as T);
      });
    });
  }

  const handleStart = () => {
    // If we are in Swarm Connect Remote Mode, force queue polling instantly!
    if (settings.pollingEnabled) {
      sendMessage({ type: 'FORCE_POLL_QUEUE' as any });
      return; 
    }

    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.get('recruitscout_pending_bulk', (res) => {
        const titles = res.recruitscout_pending_bulk || [];
        if (titles.length === 0) {
          alert('No jobs in local queue. Please push titles from the Command Center or enable Remote Swarm Mode!');
          return;
        }
        sendMessage({ 
          type: MessageType.START_BULK_EXTRACTION, 
          payload: { titles, options: {} } 
        });
        setState({ ...state, status: 'running' });
      });
    }
  };

  const handleStop = () => {
    sendMessage({ type: MessageType.STOP_EXTRACTION });
    setState({ ...state, status: 'idle' });
  };

  const isRunning = state.status === 'running' || state.status === 'crawling';

  return (
    <div className="w-[320px] min-h-[440px] bg-[#0B0F19] flex flex-col items-center justify-start text-gray-100 p-6 font-sans relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-[-50px] right-[-50px] w-32 h-32 bg-primary-600/30 rounded-full blur-[60px]" />
      
      {/* Header */}
      <div className="mb-6 text-center relative z-10 w-full pt-4">
        <div className="w-16 h-16 mx-auto bg-gray-800 rounded-2xl flex items-center justify-center mb-4 shadow-xl border border-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-400">
             <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
             <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
             <line x1="6" y1="6" x2="6.01" y2="6" />
             <line x1="6" y1="18" x2="6.01" y2="18" />
          </svg>
        </div>
        <h1 className="text-xl font-bold bg-gradient-to-br from-white to-gray-400 bg-clip-text text-transparent">RecruitScout Agent</h1>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-widest font-semibold flex items-center justify-center gap-2">
          Engine: <span className={isRunning ? 'text-primary-400' : 'text-gray-400'}>{state.status}</span>
        </p>
      </div>

      {/* Distributed Worker Card */}
      <div className="w-full bg-gray-800/40 rounded-xl p-4 border border-gray-700/50 mb-6 relative z-10 shadow-lg backdrop-blur-md">
        
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-700/50">
          <div>
            <div className="text-sm font-semibold text-gray-200">Swarm Connect</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">Remote Polling</div>
          </div>
          
          {/* iOS Style Toggle Switch */}
          <label className="relative inline-flex items-center cursor-pointer group">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={settings.pollingEnabled || false} 
              onChange={e => updateSetting('pollingEnabled', e.target.checked)} 
            />
            <div className="w-10 h-5 bg-gray-700/80 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500 shadow-inner group-hover:bg-gray-600 transition-colors"></div>
          </label>
        </div>

        <div>
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1.5 block">Worker ID Definition</label>
          <input
            type="text"
            className="w-full bg-gray-900 border border-gray-700/70 rounded-lg p-2.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all font-mono shadow-inner"
            placeholder="Assign this agent a name..."
            value={settings.friendName || ''}
            onChange={(e) => updateSetting('friendName', e.target.value)}
          />
        </div>
      </div>

      {/* Primary Action Button */}
      <div className="flex flex-col w-full gap-4 relative z-10 mt-auto">
        {!isRunning ? (
          <button 
            onClick={handleStart}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-500 hover:to-primary-400 text-white font-semibold transition-all shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:-translate-y-0.5 transform active:scale-[0.98]"
          >
            Start Engine
          </button>
        ) : (
          <button 
            onClick={handleStop}
            className="w-full py-4 rounded-xl bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 font-semibold transition-all shadow-[0_4px_14px_0_rgba(220,38,38,0.1)] hover:-translate-y-0.5 transform active:scale-[0.98]"
          >
           🛑 Stop Engine
          </button>
        )}
      </div>

      {/* Animated Pulse Dot if Running */}
      {isRunning && (
        <div className="absolute top-4 right-4" title="Agent is working...">
           <span className="flex h-3 w-3 relative">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
             <span className="relative inline-flex rounded-full h-3 w-3 bg-primary-500"></span>
           </span>
        </div>
      )}
      
      {/* Remote Polling Active Indicator Dot */}
      {settings.pollingEnabled && !isRunning && (
        <div className="absolute top-4 right-4" title="Listening to Command Center Queue...">
           <span className="flex h-3 w-3 relative">
             <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"></span>
           </span>
        </div>
      )}

      {/* Access Native Command Center */}
      <div className="w-full relative z-10 mt-6 pt-4 border-t border-gray-700/50 flex justify-center">
        <button 
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-xs text-primary-400 hover:text-white transition-colors flex items-center gap-2 uppercase tracking-widest font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
          Open Command Center
        </button>
      </div>
    </div>
  );
}
