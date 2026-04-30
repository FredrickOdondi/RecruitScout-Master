import React, { useState, useEffect } from 'react';
import { MessageType, ExtensionMessage } from '../shared/types';
import JobsTab from '../popup/components/JobsTab';
import ExportTab from '../popup/components/ExportTab';
import SupabaseTab from './SupabaseTab';

// Icons 
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const CloudDbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>;

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('search');
  
  // Inputs matching old extension
  const [bulkTitles, setBulkTitles] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // State
  const [settings, setSettings] = useState<any>({});
  const [jobs, setJobs] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);

  // Bridge implementation for extension messages
  function bridgeSendMessage<T>(message: ExtensionMessage): Promise<T> {
    return new Promise((resolve, reject) => {
      // Automatically detect if we are opening natively as an extension options page
      if (chrome.runtime && chrome.runtime.sendMessage && window.location.protocol.includes('chrome-extension')) {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve(response as T);
        });
        return;
      }

      // We are in Localhost web-mode, use the Content Script Relayer!
      const messageId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      
      // Auto timeout after 5 seconds if no extension picks it up
      const timeout = setTimeout(() => {
        window.removeEventListener('message', listener);
        reject(new Error(`Bridge timeout: ${message.type}. Is the extension fully reloaded?`));
      }, 5000);

      const listener = (event: MessageEvent) => {
        if (event.data?.source === 'recruitscout-extension' && event.data?._id === messageId) {
          clearTimeout(timeout);
          window.removeEventListener('message', listener);
          if (event.data.error) reject(new Error(event.data.error));
          else {
            // Unwrap the payload from the MessageRouter since it artificially wraps it if _id is present
            const responseData = event.data.response;
            const finalData = (responseData && typeof responseData === 'object' && 'data' in responseData)
              ? responseData.data 
              : responseData;
            resolve(finalData as T);
          }
        }
      };

      window.addEventListener('message', listener);
      window.postMessage({
        source: 'recruitscout-dashboard',
        ...message,
        _id: messageId
      }, '*');
    });
  }
  
  useEffect(() => {
    // Initial fetch of settings and jobs
    bridgeSendMessage<any>({ type: MessageType.GET_SETTINGS })
       .then(res => res && setSettings(res))
       .catch(err => console.log('Init Settings Fetch Warning:', err));
       
    bridgeSendMessage<any[]>({ type: MessageType.GET_JOBS })
       .then(res => res && setJobs(res))
       .catch(err => console.log('Init Jobs Fetch Warning:', err));
  }, []);

  // Dynamically re-fetch jobs and queue when relevant
  useEffect(() => {
    if (activeTab === 'jobs' || activeTab === 'export') {
      bridgeSendMessage<any[]>({ type: MessageType.GET_JOBS })
         .then(res => res && setJobs(res))
         .catch(err => console.log('Dynamic Jobs Fetch Warning:', err));
    }
    if (activeTab === 'search') {
      const fetchDashboardData = () => {
        bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any })
           .then(res => {
             if (Array.isArray(res)) setQueue(res);
             else if (res && res.data) setQueue(res.data);
           })
           .catch(console.error);
        
        bridgeSendMessage<any>({ type: 'SUPABASE_GET_AGENTS' as any })
           .then(res => {
             if (Array.isArray(res)) setActiveAgents(res);
             else if (res && res.data) setActiveAgents(res.data);
           })
           .catch(console.error);
      };

      // Fetch immediately on mount
      fetchDashboardData();

      // Launch an aggressive poller to keep the UI feeling "live" and real-time
      const intervalId = setInterval(fetchDashboardData, 4000);
      return () => clearInterval(intervalId);
    }
  }, [activeTab]);

  const updateSetting = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    bridgeSendMessage({
      type: MessageType.UPDATE_SETTINGS,
      payload: { [key]: value }
    }).catch(console.error);
  };

  const handleSaveBulkSearch = async () => {
    const titles = bulkTitles.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    const location = locationFilter.trim();

    // Location-only mode: enqueue a single task with no title
    const tasksToEnqueue = titles.length > 0 ? titles : (location ? [''] : []);
    if (tasksToEnqueue.length === 0) return;

    try {
      const payload = { titles: tasksToEnqueue, assigned_to: assignedTo.trim() || undefined, location: location || undefined };
      const res = await bridgeSendMessage<any>({ type: 'SUPABASE_ENQUEUE_TASKS' as any, payload });
      if (res && !res.error) {
        const modeLabel = titles.length > 0 ? `${titles.length} title(s)` : `location-only (${location})`;
        alert(`✅ Enqueued ${modeLabel} to the remote queue!`);
        setBulkTitles('');
        // Refresh queue
        bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any }).then(r => r?.data && setQueue(r.data));
      } else {
        alert("⚠️ DB Write failed: " + res?.error);
      }
    } catch (err) {
      alert("⚠️ CRITICAL ERROR:\n" + (err as Error).message);
    }
  };

  const handleUpdateLocations = async () => {
    if (!locationFilter.trim()) return;
    if (!confirm(`Are you sure you want to update the location of ALL tasks in the queue to "${locationFilter.trim()}"?`)) return;

    try {
      const res = await bridgeSendMessage<any>({ 
        type: 'SUPABASE_UPDATE_QUEUE_LOCATION' as any, 
        payload: { location: locationFilter.trim() } 
      });
      if (res && !res.error) {
        alert('✅ Successfully updated locations!');
        bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any }).then(r => {
          if (Array.isArray(r)) setQueue(r);
          else if (r?.data) setQueue(r.data);
        });
      } else {
        alert("⚠️ Update failed: " + res?.error);
      }
    } catch (err) {
      alert("⚠️ CRITICAL ERROR:\n" + (err as Error).message);
    }
  };

  return (
    <div className="flex h-screen bg-[#0B0F19] text-gray-100 overflow-hidden font-sans">
      
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 bg-[#0d1321] flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-blue-600 bg-clip-text text-transparent flex items-center gap-2">
            <ServerIcon />
            RecruitScout
          </h1>
          <p className="text-xs text-gray-500 mt-1 uppercase tracking-wider font-semibold">Command Center</p>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 relative">
          
          <div className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-4 mb-2 mt-4">Agent Control</div>
          <button 
            onClick={() => setActiveTab('search')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'search' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-500/5' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
          >
            <SearchIcon />
            <span className="font-medium text-sm">Bulk Priority Queue</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'settings' ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20 shadow-lg shadow-primary-500/5' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
          >
            <SettingsIcon />
            <span className="font-medium text-sm">Engine Settings</span>
          </button>

          <div className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-4 mb-2 mt-8">Database</div>
          <button 
            onClick={() => setActiveTab('jobs')}
            className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all ${activeTab === 'jobs' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/5' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
          >
            <div className="flex items-center gap-3">
              <DatabaseIcon />
              <span className="font-medium text-sm">Extracted Jobs</span>
            </div>
            {jobs.length > 0 && (
              <span className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded-full">{jobs.length}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab('export')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'export' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-lg shadow-purple-500/5' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
          >
            <DownloadIcon />
            <span className="font-medium text-sm">Export & Sync</span>
          </button>

          <div className="text-xs font-bold text-gray-600 uppercase tracking-widest pl-4 mb-2 mt-8">Cloud</div>
          <button 
            onClick={() => setActiveTab('supabase')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${activeTab === 'supabase' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-lg shadow-cyan-500/5' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
          >
            <CloudDbIcon />
            <span className="font-medium text-sm">Supabase Viewer</span>
          </button>

        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-800/70">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all text-sm font-medium group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="transition-colors group-hover:text-red-400">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-[#111827] via-[#0B0F19] to-[#0B0F19]">
        <header className="h-16 border-b border-gray-800 flex items-center px-8 bg-[#0d1321]/50 backdrop-blur-md sticky top-0 z-10 transition-colors">
          <h2 className="text-lg font-semibold text-gray-100 capitalize font-mono tracking-tight">
            / {activeTab.replace('-', ' ')}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          
          {/* BULK SEARCH MODE */}
          {activeTab === 'search' && (
            <div className="max-w-3xl space-y-6">
              <div className="bg-gray-800/40 rounded-xl p-1 border border-gray-700/50 shadow-2xl backdrop-blur-xl transition-all">
                <div className="bg-[#0B0F19] rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-100 mb-2 flex items-center gap-2">
                    <span>🚀</span> Bulk Job Priority Queue
                  </h3>
                  <p className="text-sm text-gray-400 mb-4">
                    Paste job titles below (one per line). The remote extension agents will pick these up automatically when their engines start.
                  </p>
                  
                  <textarea 
                    value={bulkTitles}
                    onChange={(e) => setBulkTitles(e.target.value)}
                    placeholder={`Software Engineer\nProduct Manager\nData Scientist\n\n(or leave blank and set a Location to scrape all jobs in that area)`}
                    className="w-full h-40 bg-gray-900 border border-gray-700 rounded-lg p-4 text-sm font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all resize-none shadow-inner"
                  />
                  
                  <div className="mt-4 md:flex md:items-end justify-between">
                    <div className="flex-1 md:w-1/3 mr-4">
                      <label className="text-xs text-gray-400 font-semibold uppercase mb-1 flex justify-between items-center">
                        <span>Location Filter</span>
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. Remote, New York..."
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-primary-500 transition-all shadow-inner"
                      />
                    </div>
                    <div className="flex-1 md:w-1/3 mr-4">
                      <label className="text-xs text-gray-400 font-semibold uppercase mb-1 flex justify-between items-center">
                        <span>Assigned Worker</span> 
                        <span className="text-emerald-500 font-normal">{activeAgents.length} Online</span>
                      </label>
                      <select 
                        value={assignedTo} 
                        onChange={(e) => setAssignedTo(e.target.value)} 
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:outline-none focus:border-primary-500 appearance-none" 
                      >
                        <option value="">Leave blank for any available node...</option>
                        {activeAgents.map(agent => (
                          <option key={agent.worker_id} value={agent.worker_id}>
                            {agent.worker_name} ({agent.worker_id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-2">
                      <button 
                        onClick={handleUpdateLocations}
                        disabled={!locationFilter.trim()}
                        className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2.5 rounded-lg font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        title="Update location for all existing queue tasks"
                      >
                        Apply Location to Queue
                      </button>
                      <button 
                        onClick={handleSaveBulkSearch}
                        disabled={!bulkTitles.trim() && !locationFilter.trim()}
                        className="bg-primary-600 hover:bg-primary-500 text-white px-6 py-2.5 rounded-lg font-medium shadow-lg shadow-primary-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0 whitespace-nowrap"
                      >
                        {bulkTitles.trim() ? 'Enqueue Tasks' : 'Scrape by Location'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-800/40 rounded-xl p-1 border border-gray-700/50 shadow-2xl backdrop-blur-xl">
                <div className="bg-[#0B0F19] rounded-lg p-6">
                  <h3 className="text-sm font-medium text-gray-100 mb-4 flex items-center gap-2">
                    Queue Status
                    <button 
                      onClick={() => {
                        bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any }).then(r => {
                          if (Array.isArray(r)) setQueue(r);
                          else if (r?.data) setQueue(r.data);
                        });
                        bridgeSendMessage<any>({ type: 'SUPABASE_GET_AGENTS' as any }).then(r => {
                          if (Array.isArray(r)) setActiveAgents(r);
                          else if (r?.data) setActiveAgents(r.data);
                        });
                      }} 
                      className="text-primary-500 hover:text-primary-400 text-xs px-2"
                    >
                      ↻ Refresh
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('↺ Reset all completed/failed tasks back to pending?\n\nThis will re-queue every job title for today\'s run.')) return;
                        try {
                          const res = await bridgeSendMessage<any>({ type: 'SUPABASE_RESET_QUEUE' as any });
                          if (res?.error) {
                            alert('⚠️ Reset failed: ' + res.error);
                          } else {
                            const q = await bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any });
                            if (Array.isArray(q)) setQueue(q);
                            else if (q?.data) setQueue(q.data);
                          }
                        } catch (err) {
                          alert('⚠️ Error: ' + (err as Error).message);
                        }
                      }}
                      className="bg-amber-600/20 text-amber-400 hover:bg-amber-500/30 hover:text-amber-300 px-3 py-1.5 rounded text-xs font-semibold border border-amber-600/40 transition-all"
                      title="Reset all completed tasks back to pending so they run again today"
                    >
                      ↺ Reset to Pending
                    </button>

                    <button 
                      onClick={() => {
                        bridgeSendMessage({ type: 'STOP_EXTRACTION' as any }).then(() => {
                           alert('🚨 Abort signal sent! Scraping Engine has been gracefully killed.');
                           updateSetting('pollingEnabled', false);
                           bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any }).then(r => r?.data && setQueue(r.data));
                        });
                      }}
                      className="ml-auto bg-red-600/20 text-red-500 hover:bg-red-600 hover:text-white px-4 py-1.5 rounded uppercase font-bold text-xs border border-red-600/50 transition-all shadow-[0_0_15px_rgba(220,38,38,0.3)] animate-pulse hover:animate-none"
                    >
                      STOP / KILL ENGINE
                    </button>
                  </h3>
                  
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-gray-400">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-800/50 rounded-t-lg border-b border-gray-700">
                        <tr>
                          <th className="px-4 py-3">Task</th>
                          <th className="px-4 py-3">Location</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Worker ID</th>
                          <th className="px-4 py-3">Created</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map(q => (
                          <tr key={q.id} className="border-b border-gray-800 hover:bg-gray-800/20">
                            <td className="px-4 py-3 font-medium text-gray-200">{q.job_title}</td>
                            <td className="px-4 py-3 text-gray-400">{q.location || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs ${q.status === 'pending' ? 'bg-amber-900/40 text-amber-500' : q.status === 'running' ? 'bg-sky-900/40 text-sky-400' : q.status === 'completed' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                                {q.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">{q.assigned_to || <span className="text-gray-600 italic">Unassigned</span>}</td>
                            <td className="px-4 py-3">{new Date(q.created_at).toLocaleString()}</td>
                          </tr>
                        ))}
                        {queue.length === 0 && (
                          <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 italic">Queue is currently empty</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {activeTab === 'settings' && (
             <div className="max-w-4xl grid grid-cols-2 gap-8">
                
                {/* General Settings */}
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-700/50 shadow-xl backdrop-blur-xl space-y-6">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-700 pb-2">General Settings</h3>
                  
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-gray-200 group-hover:text-primary-400 transition-colors">Auto Extract</div>
                      <div className="text-xs text-gray-500">Automatically extract jobs when visiting job boards</div>
                    </div>
                    <input type="checkbox" checked={settings.autoExtract || false} onChange={e => updateSetting('autoExtract', e.target.checked)} className="form-checkbox h-5 w-5 text-primary-500 rounded bg-gray-900 border-gray-700 hover:border-primary-500 transition-colors cursor-pointer" />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-gray-200 group-hover:text-primary-400 transition-colors">Notifications</div>
                      <div className="text-xs text-gray-500">Show notifications when extraction completes</div>
                    </div>
                    <input type="checkbox" checked={settings.notificationEnabled !== false} onChange={e => updateSetting('notificationEnabled', e.target.checked)} className="form-checkbox h-5 w-5 text-primary-500 rounded bg-gray-900 border-gray-700 hover:border-primary-500 transition-colors cursor-pointer" />
                  </label>

                  <div className="space-y-4 pt-4 border-t border-gray-700 mt-4">
                    <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                      <span>📡</span> Distributed Worker Mode
                    </h4>

                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <div className="text-sm font-medium text-gray-200 group-hover:text-primary-400 transition-colors">Enable Remote Polling</div>
                        <div className="text-xs text-gray-500">Automatically pull and execute jobs pushed to Supabase queue</div>
                      </div>
                      <input type="checkbox" checked={settings.pollingEnabled || false} onChange={e => updateSetting('pollingEnabled', e.target.checked)} className="form-checkbox h-5 w-5 text-primary-500 rounded bg-gray-900 border-gray-700 hover:border-primary-500 transition-colors cursor-pointer" />
                    </label>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-200">Worker ID / Agent Name (assigned_to)</label>
                      <input
                        type="text"
                        placeholder="e.g. Node-A"
                        value={settings.friendName || ''}
                        onChange={e => updateSetting('friendName', e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 placeholder-gray-600 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Extraction Settings */}
                <div className="bg-gray-800/40 rounded-xl p-6 border border-gray-700/50 shadow-xl backdrop-blur-xl space-y-6">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-700 pb-2">Extraction Settings</h3>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">Max Jobs per Page</label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      value={settings.maxJobsPerPage || 100}
                      onChange={e => updateSetting('maxJobsPerPage', parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">Pagination Limit</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.paginationLimit || 10}
                      onChange={e => updateSetting('paginationLimit', parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-200">Crawl Delay (ms)</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={settings.crawlDelay || 1000}
                      onChange={e => updateSetting('crawlDelay', parseInt(e.target.value))}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg p-2.5 text-sm text-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all outline-none"
                    />
                  </div>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-sm font-medium text-gray-200 group-hover:text-primary-400 transition-colors">Respect robots.txt</div>
                      <div className="text-xs text-gray-500">Respect guidelines when crawling</div>
                    </div>
                    <input type="checkbox" checked={settings.respectRobotsTxt !== false} onChange={e => updateSetting('respectRobotsTxt', e.target.checked)} className="form-checkbox h-5 w-5 text-primary-500 rounded bg-gray-900 border-gray-700 hover:border-primary-500 transition-colors cursor-pointer" />
                  </label>
                </div>

             </div>
          )}

          {/* JOBS VIEWER */}
          {activeTab === 'jobs' && (
            <div className="max-w-4xl bg-gray-800/20 p-8 rounded-2xl border border-gray-800/50 shadow-2xl backdrop-blur-xl">
               <JobsTab 
                 jobs={jobs} 
                 onJobsUpdate={setJobs} 
                 sendMessage={bridgeSendMessage} 
               />
            </div>
          )}

          {/* DATA EXPORT & SYNC */}
          {activeTab === 'export' && (
            <div className="max-w-4xl bg-gray-800/20 p-8 rounded-2xl border border-gray-800/50 shadow-2xl backdrop-blur-xl">
               <ExportTab 
                 jobs={jobs} 
                 settings={settings} 
                 sendMessage={bridgeSendMessage} 
               />
            </div>
          )}

          {/* SUPABASE VIEWER */}
          {activeTab === 'supabase' && (
            <div className="max-w-6xl">
              <SupabaseTab />
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
