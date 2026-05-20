import React, { useState, useEffect } from 'react';
import { MessageType, ExtensionMessage } from '../shared/types';
import JobsTab from '../popup/components/JobsTab';
import ExportTab from '../popup/components/ExportTab';
import SupabaseTab from './SupabaseTab';
import ClientEnrollmentTab from './ClientEnrollmentTab';

// Icons 
const ServerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>;
const DatabaseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;
const DownloadIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>;
const CloudDbIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>;
const BriefcasePlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>;

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('search');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Inputs matching old extension
  const [bulkTitles, setBulkTitles] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  
  // State
  const [settings, setSettings] = useState<any>({});
  const [jobs, setJobs] = useState<any[]>([]);
  const [queue, setQueue] = useState<any[]>([]);
  const [activeAgents, setActiveAgents] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskDraft, setEditTaskDraft] = useState<any>({});

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

    bridgeSendMessage<any>({ type: 'SUPABASE_GET_CLIENTS' as any })
       .then(res => {
         if (Array.isArray(res)) setClients(res);
         else if (res && res.data) setClients(res.data);
       })
       .catch(err => console.log('Init Clients Fetch Warning:', err));
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

        bridgeSendMessage<any>({ type: 'SUPABASE_GET_CLIENTS' as any })
           .then(res => {
             if (Array.isArray(res)) setClients(res);
             else if (res && res.data) setClients(res.data);
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
      const payload = { 
        titles: tasksToEnqueue, 
        assigned_to: assignedTo.trim() || undefined, 
        location: location || undefined,
        client_id: selectedClient || undefined
      };
      const res = await bridgeSendMessage<any>({ type: 'SUPABASE_ENQUEUE_TASKS' as any, payload });
      if (res && !res.error) {
        const modeLabel = titles.length > 0 ? `${titles.length} title(s)` : `location-only (${location})`;
        alert(`✅ Enqueued ${modeLabel} to the remote queue!`);
        setBulkTitles('');
        setSelectedClient('');
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

  const handleEditClick = (task: any) => {
    setEditingTaskId(task.id);
    setEditTaskDraft({
      job_title: task.job_title,
      client_id: task.client_id || '',
      location: task.location || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditTaskDraft({});
  };

  const handleSaveEdit = async () => {
    if (!editingTaskId) return;
    try {
      const payload = {
        id: editingTaskId,
        updates: {
          job_title: editTaskDraft.job_title,
          client_id: editTaskDraft.client_id || null,
          location: editTaskDraft.location || null,
        }
      };
      const res = await bridgeSendMessage<any>({ type: 'SUPABASE_UPDATE_QUEUE_TASK' as any, payload });
      if (res && !res.error) {
        setEditingTaskId(null);
        setEditTaskDraft({});
        // Refresh queue
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
    <div className="flex h-screen bg-gray-50 text-gray-900 overflow-hidden font-sans min-w-0">
      
      {/* Mobile overlay backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-gray-900/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 z-50 border-r border-gray-200 bg-white flex flex-col flex-shrink-0 ${isSidebarCollapsed ? 'md:w-20 w-64' : 'w-64 xl:w-72'}`}>
        <button 
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          className="hidden md:flex absolute -right-3 top-8 bg-white rounded-full p-1 border border-gray-200 text-gray-600 hover:text-gray-900 z-30 shadow-sm"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isSidebarCollapsed ? 'rotate-180' : ''}`}>
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>

        <div className={`p-6 flex items-center ${isSidebarCollapsed ? 'justify-center px-0' : ''}`}>
          <div className={`flex flex-col ${isSidebarCollapsed ? 'items-center' : ''}`}>
            <h1 className="text-xl font-medium text-gray-900 flex items-center gap-2 overflow-hidden whitespace-nowrap">
              <ServerIcon />
              {!isSidebarCollapsed && <span>RecruitScout</span>}
            </h1>
            {!isSidebarCollapsed && <p className="text-xs text-gray-600 mt-1 uppercase tracking-wider font-semibold whitespace-nowrap">Command Center</p>}
          </div>
        </div>
        
        <nav className="flex-1 px-4 py-4 space-y-2 relative overflow-x-hidden">
          
          <div className={`text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 mt-4 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'text-center opacity-0 h-0 my-0' : 'pl-4 opacity-100'}`}>
            Agent Control
          </div>
          
          <button 
            onClick={() => { setActiveTab('search'); setIsMobileMenuOpen(false); }}
            title="Bulk Priority Queue"
            className={`w-full flex items-center gap-3 py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'} ${activeTab === 'search' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="shrink-0"><SearchIcon /></div>
            {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Bulk Priority Queue</span>}
          </button>
          
          <button 
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
            title="Engine Settings"
            className={`w-full flex items-center gap-3 py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'} ${activeTab === 'settings' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="shrink-0"><SettingsIcon /></div>
            {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Engine Settings</span>}
          </button>

          <div className={`text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 mt-8 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'text-center opacity-0 h-0 my-0' : 'pl-4 opacity-100'}`}>
            Database
          </div>
          
          <button 
            onClick={() => { setActiveTab('jobs'); setIsMobileMenuOpen(false); }}
            title="Extracted Jobs"
            className={`w-full flex items-center py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0 justify-between md:justify-center' : 'px-3 justify-between'} ${activeTab === 'jobs' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-3 shrink-0">
              <div className="shrink-0 relative">
                <DatabaseIcon />
                {isSidebarCollapsed && jobs.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-gray-900 text-white text-[9px] font-bold px-1 rounded-full">{jobs.length}</span>
                )}
              </div>
              {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Extracted Jobs</span>}
            </div>
            {!isSidebarCollapsed && jobs.length > 0 && (
              <span className="bg-gray-200 text-gray-700 text-xs px-2 py-0.5 rounded-full shrink-0">{jobs.length}</span>
            )}
          </button>

          <button 
            onClick={() => { setActiveTab('export'); setIsMobileMenuOpen(false); }}
            title="Export & Sync"
            className={`w-full flex items-center gap-3 py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'} ${activeTab === 'export' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="shrink-0"><DownloadIcon /></div>
            {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Export & Sync</span>}
          </button>

          <div className={`text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 mt-8 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'text-center opacity-0 h-0 my-0' : 'pl-4 opacity-100'}`}>
            Cloud
          </div>
          
          <button 
            onClick={() => { setActiveTab('supabase'); setIsMobileMenuOpen(false); }}
            title="Supabase Viewer"
            className={`w-full flex items-center gap-3 py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'} ${activeTab === 'supabase' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="shrink-0"><CloudDbIcon /></div>
            {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Supabase Viewer</span>}
          </button>

          <div className={`text-xs font-bold text-gray-700 uppercase tracking-widest mb-2 mt-8 whitespace-nowrap overflow-hidden transition-all duration-300 ${isSidebarCollapsed ? 'text-center opacity-0 h-0 my-0' : 'pl-4 opacity-100'}`}>
            Clients
          </div>
          
          <button 
            onClick={() => { setActiveTab('clients'); setIsMobileMenuOpen(false); }}
            title="Client Enrollment"
            className={`w-full flex items-center gap-3 py-2 rounded-md transition-all ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'} ${activeTab === 'clients' ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-700 hover:text-gray-900 hover:bg-gray-50'}`}
          >
            <div className="shrink-0"><BriefcasePlusIcon /></div>
            {!isSidebarCollapsed && <span className="font-medium text-sm whitespace-nowrap">Client Enrollment</span>}
          </button>

        </nav>

        {/* Logout */}
        <div className={`p-4 border-t border-gray-200 flex items-center justify-center`}>
          <button
            onClick={onLogout}
            title="Sign Out"
            className={`flex items-center justify-center gap-3 py-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all text-sm font-medium group ${isSidebarCollapsed ? 'md:w-10 md:h-10 md:px-0 w-full px-4' : 'w-full px-4'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="transition-colors group-hover:text-gray-900 shrink-0">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {!isSidebarCollapsed && <span className="whitespace-nowrap">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gray-50 min-w-0">
        <header className="h-16 border-b border-gray-200 flex items-center px-4 md:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-10 transition-colors gap-3 w-full">
          <button 
            className="md:hidden p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <h2 className="text-lg font-semibold text-gray-900 capitalize font-mono tracking-tight truncate">
            / {activeTab.replace('-', ' ')}
          </h2>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 xl:p-10 2xl:p-12">
          
          {/* BULK SEARCH MODE */}
          {activeTab === 'search' && (
            <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto space-y-6">
              <div className="bg-white rounded-xl p-1 border border-gray-200 shadow-sm transition-all">
                <div className="bg-white rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center gap-2">
                    <span>🚀</span> Bulk Job Priority Queue
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Paste job titles below (one per line). The remote extension agents will pick these up automatically when their engines start.
                  </p>
                  
                  <textarea 
                    value={bulkTitles}
                    onChange={(e) => setBulkTitles(e.target.value)}
                    placeholder={`Software Engineer\nProduct Manager\nData Scientist\n\n(or leave blank and set a Location to scrape all jobs in that area)`}
                    className="w-full h-40 bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all resize-none shadow-sm"
                  />
                  
                  <div className="mt-4 md:grid md:grid-cols-12 md:gap-4 md:items-end">
                    <div className="col-span-12 md:col-span-3">
                      <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                        Associated Client
                      </label>
                      <select 
                        value={selectedClient} 
                        onChange={(e) => setSelectedClient(e.target.value)} 
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 appearance-none shadow-sm" 
                      >
                        <option value="">Leave blank (No Client)...</option>
                        {clients.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 block">
                        Location Filter
                      </label>
                      <input 
                        type="text"
                        placeholder="e.g. Remote, New York..."
                        value={locationFilter}
                        onChange={(e) => setLocationFilter(e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-[13px] text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-400 transition-all shadow-sm"
                      />
                    </div>
                    <div className="col-span-12 md:col-span-3">
                      <label className="text-[11px] text-gray-600 font-bold uppercase tracking-widest mb-1.5 flex justify-between items-center">
                        <span>Assigned Worker</span> 
                        <span className="text-green-600 font-medium">{activeAgents.length} Online</span>
                      </label>
                      <select 
                        value={assignedTo} 
                        onChange={(e) => setAssignedTo(e.target.value)} 
                        className="w-full bg-white border border-gray-300 rounded-md p-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 appearance-none shadow-sm" 
                      >
                        <option value="">Leave blank for any available node...</option>
                        {activeAgents.map(agent => (
                          <option key={agent.worker_id} value={agent.worker_id}>
                            {agent.worker_name} ({agent.worker_id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-12 md:col-span-3 flex gap-2 justify-end">
                      <button 
                        onClick={handleUpdateLocations}
                        disabled={!locationFilter.trim()}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 px-3 py-2 rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-[12px] shadow-sm flex-1"
                        title="Update location for all existing queue tasks"
                      >
                        Apply Location
                      </button>
                      <button 
                        onClick={handleSaveBulkSearch}
                        disabled={!bulkTitles.trim() && !locationFilter.trim()}
                        className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap text-[12px] shadow-sm flex-1 text-center"
                      >
                        {bulkTitles.trim() ? 'Enqueue' : 'Scrape'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-xl p-1 border border-gray-200 shadow-sm mt-6">
                <div className="bg-white rounded-lg p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
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
                          className="text-gray-600 hover:text-gray-800 text-[12px] px-2"
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
                          className="bg-amber-50 text-amber-700 hover:bg-amber-100 px-2 py-1 rounded text-[11px] font-medium border border-amber-200 transition-all"
                          title="Reset all completed tasks back to pending so they run again today"
                        >
                          ↺ Reset to Pending
                        </button>
                      </h3>
                      <div className="flex gap-3 mt-2 text-[12px]">
                        <span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-medium border border-gray-200">
                          Total: {queue.length}
                        </span>
                        <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium border border-blue-200">
                          Pending: {queue.filter(q => q.status === 'pending').length}
                        </span>
                        <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded font-medium border border-green-200">
                          Completed: {queue.filter(q => q.status === 'completed').length}
                        </span>
                      </div>
                    </div>
                    <button 
                      onClick={() => {
                        bridgeSendMessage({ type: 'STOP_EXTRACTION' as any }).then(() => {
                           alert('🚨 Abort signal sent! Scraping Engine has been gracefully killed.');
                           updateSetting('pollingEnabled', false);
                           bridgeSendMessage<any>({ type: 'SUPABASE_GET_QUEUE' as any }).then(r => r?.data && setQueue(r.data));
                        });
                      }}
                      className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-md uppercase font-bold text-[11px] border border-red-200 transition-all shadow-sm"
                    >
                      STOP / KILL ENGINE
                    </button>
                  </div>
                  
                  <div className="overflow-x-auto overflow-y-auto max-h-[500px] lg:max-h-[600px] xl:max-h-[700px] 2xl:max-h-[800px] rounded-md border border-gray-200 w-full relative">
                    <table className="w-full text-left text-[13px] text-gray-700 min-w-[800px]">
                      <thead className="text-[11px] font-bold text-gray-600 uppercase tracking-widest bg-gray-50 border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                        <tr>
                          <th className="px-3 py-2 bg-gray-50">Task</th>
                          <th className="px-3 py-2 bg-gray-50">Client</th>
                          <th className="px-3 py-2 bg-gray-50">Location</th>
                          <th className="px-3 py-2 bg-gray-50">Status</th>
                          <th className="px-3 py-2 bg-gray-50">Worker ID</th>
                          <th className="px-3 py-2 bg-gray-50">Created</th>
                          <th className="px-3 py-2 bg-gray-50 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {queue.map((q, i) => {
                          const clientRecord = clients.find(c => c.id === q.client_id);
                          const isEditing = q.id === editingTaskId;
                          
                          return (
                            <tr key={q.id} className={`border-b border-gray-200 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-gray-100`}>
                              {isEditing ? (
                                <>
                                  <td className="px-3 py-1.5">
                                    <input 
                                      type="text" 
                                      value={editTaskDraft.job_title} 
                                      onChange={e => setEditTaskDraft({...editTaskDraft, job_title: e.target.value})}
                                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-[13px] text-gray-900 shadow-sm"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <select 
                                      value={editTaskDraft.client_id} 
                                      onChange={e => setEditTaskDraft({...editTaskDraft, client_id: e.target.value})}
                                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-[13px] text-gray-900 shadow-sm"
                                    >
                                      <option value="">(No Client)</option>
                                      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input 
                                      type="text" 
                                      value={editTaskDraft.location} 
                                      onChange={e => setEditTaskDraft({...editTaskDraft, location: e.target.value})}
                                      className="w-full bg-white border border-gray-300 rounded px-2 py-1 text-[13px] text-gray-900 shadow-sm"
                                      placeholder="-"
                                    />
                                  </td>
                                  <td className="px-3 py-1.5" colSpan={3}>
                                    <span className="text-[11px] text-gray-500 italic">Editing task...</span>
                                  </td>
                                  <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                    <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700 font-medium px-2 py-1 text-[12px]">Save</button>
                                    <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-700 font-medium px-2 py-1 text-[12px]">Cancel</button>
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-1.5 font-medium text-gray-900 truncate max-w-[200px]">{q.job_title}</td>
                                  <td className="px-3 py-1.5 text-gray-700 font-semibold">{clientRecord ? clientRecord.name : <span className="text-gray-400 italic font-normal">—</span>}</td>
                                  <td className="px-3 py-1.5 text-gray-700">{q.location || '-'}</td>
                                  <td className="px-3 py-1.5">
                                    <span className={`px-2 py-0.5 rounded border text-[11px] uppercase tracking-wider ${q.status === 'pending' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : q.status === 'running' ? 'bg-blue-50 text-blue-700 border-blue-200' : q.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                      {q.status}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3">{q.assigned_to || <span className="text-gray-700 italic">Unassigned</span>}</td>
                                  <td className="px-4 py-3">{new Date(q.created_at).toLocaleString()}</td>
                                  <td className="px-3 py-1.5 text-right">
                                    <button 
                                      onClick={() => handleEditClick(q)}
                                      className="text-blue-600 hover:text-blue-800 font-medium text-[12px] px-2 py-1"
                                      disabled={q.status === 'running'}
                                      title={q.status === 'running' ? 'Cannot edit running tasks' : 'Edit task'}
                                    >
                                      Edit
                                    </button>
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                        {queue.length === 0 && (
                          <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-600 italic">Queue is currently empty</td></tr>
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
             <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* General Settings */}
                <div className="bg-white rounded-md p-5 border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">General Settings</h3>
                  
                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-[13px] font-medium text-gray-900 group-hover:text-gray-700 transition-colors">Auto Extract</div>
                      <div className="text-[12px] text-gray-600 mt-0.5">Automatically extract jobs when visiting job boards</div>
                    </div>
                    <input type="checkbox" checked={settings.autoExtract || false} onChange={e => updateSetting('autoExtract', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer" />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-[13px] font-medium text-gray-900 group-hover:text-gray-700 transition-colors">Notifications</div>
                      <div className="text-[12px] text-gray-600 mt-0.5">Show notifications when extraction completes</div>
                    </div>
                    <input type="checkbox" checked={settings.notificationEnabled !== false} onChange={e => updateSetting('notificationEnabled', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer" />
                  </label>

                  <div className="space-y-3 pt-4 border-t border-gray-200 mt-2">
                    <h4 className="text-[12px] font-semibold text-gray-700 flex items-center gap-2">
                      <span>📡</span> Distributed Worker Mode
                    </h4>

                    <label className="flex items-center justify-between cursor-pointer group">
                      <div>
                        <div className="text-[13px] font-medium text-gray-900 group-hover:text-gray-700 transition-colors">Enable Remote Polling</div>
                        <div className="text-[12px] text-gray-600 mt-0.5">Automatically pull and execute jobs pushed to Supabase queue</div>
                      </div>
                      <input type="checkbox" checked={settings.pollingEnabled || false} onChange={e => updateSetting('pollingEnabled', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer" />
                    </label>

                    <div className="space-y-1.5">
                      <label className="text-[13px] font-medium text-gray-900">Worker ID / Agent Name (assigned_to)</label>
                      <input
                        type="text"
                        placeholder="e.g. Node-A"
                        value={settings.friendName || ''}
                        onChange={e => updateSetting('friendName', e.target.value)}
                        className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Extraction Settings */}
                <div className="bg-white rounded-md p-5 border border-gray-200 shadow-sm space-y-4">
                  <h3 className="text-[11px] font-bold text-gray-600 uppercase tracking-widest border-b border-gray-200 pb-2 mb-3">Extraction Settings</h3>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-gray-900">Max Jobs per Page</label>
                    <input
                      type="number"
                      min="10"
                      max="500"
                      value={settings.maxJobsPerPage || 100}
                      onChange={e => updateSetting('maxJobsPerPage', parseInt(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-gray-900">Pagination Limit</label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={settings.paginationLimit || 10}
                      onChange={e => updateSetting('paginationLimit', parseInt(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[13px] font-medium text-gray-900">Crawl Delay (ms)</label>
                    <input
                      type="number"
                      min="100"
                      max="10000"
                      step="100"
                      value={settings.crawlDelay || 1000}
                      onChange={e => updateSetting('crawlDelay', parseInt(e.target.value))}
                      className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-[13px] text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
                    />
                  </div>

                  <label className="flex items-center justify-between cursor-pointer group">
                    <div>
                      <div className="text-[13px] font-medium text-gray-900 group-hover:text-gray-700 transition-colors">Respect robots.txt</div>
                      <div className="text-[12px] text-gray-600 mt-0.5">Respect guidelines when crawling</div>
                    </div>
                    <input type="checkbox" checked={settings.respectRobotsTxt !== false} onChange={e => updateSetting('respectRobotsTxt', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer" />
                  </label>
                </div>

             </div>
          )}

          {/* JOBS VIEWER */}
          {activeTab === 'jobs' && (
             <div className="w-full max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto bg-white p-6 rounded-md border border-gray-200 shadow-sm mt-4">
               <JobsTab 
                 jobs={jobs} 
                 onJobsUpdate={setJobs} 
                 sendMessage={bridgeSendMessage} 
               />
             </div>
          )}

          {/* DATA EXPORT & SYNC */}
          {activeTab === 'export' && (
             <div className="w-full max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto bg-white p-6 rounded-md border border-gray-200 shadow-sm mt-4">
               <ExportTab 
                 jobs={jobs} 
                 settings={settings} 
                 sendMessage={bridgeSendMessage} 
               />
             </div>
          )}

          {/* SUPABASE VIEWER */}
          {activeTab === 'supabase' && (
            <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto">
              <SupabaseTab />
            </div>
          )}

          {/* CLIENT ENROLLMENT */}
          {activeTab === 'clients' && (
            <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto">
              <ClientEnrollmentTab sendMessage={bridgeSendMessage} />
            </div>
          )}

        </div>
      </main>

    </div>
  );
}
