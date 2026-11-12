import React, { useState, useEffect } from'react';
import { MessageType, ExtensionMessage } from'../shared/types';
import JobsTab from'../popup/components/JobsTab';
import ExportTab from'../popup/components/ExportTab';
import SupabaseTab from'./SupabaseTab';
import ClientEnrollmentTab from'./ClientEnrollmentTab';
import LeadsManagementTab from'./LeadsManagementTab';
import LeadsFlowTab from'./LeadsFlowTab';
import BlueApp from'../blue/App';
import { OverviewTab } from './OverviewTab';
import { GraphTab } from './GraphTab';
import AssistantTab from './assistant/AssistantTab';
import { supabaseClient } from'../shared/supabase';
import { BlueCcClient } from'../shared/bluecc';

// Icons 
import { Server, Settings, Search, Database, Download, Cloud, Briefcase, Users, Activity, ChevronLeft, LogOut, Menu, Hexagon, LayoutDashboard, Network, Sun, Moon, Cookie, MonitorDown, X, MessageSquare } from 'lucide-react';
import IndeedSessionsTab from './IndeedSessionsTab';
import { setThemeColor, useInstallPrompt } from './pwa';

const ServerIcon = () => <Server size={20} />;
const SettingsIcon = () => <Settings size={20} />;
const SearchIcon = () => <Search size={20} />;
const DatabaseIcon = () => <Database size={20} />;
const DownloadIcon = () => <Download size={20} />;
const CloudDbIcon = () => <Cloud size={20} />;
const BriefcasePlusIcon = () => <Briefcase size={20} />;
const UsersIcon = () => <Users size={20} />;
const ActivityIcon = () => <Activity size={20} />;
const LayoutDashboardIcon = () => <LayoutDashboard size={20} />;
const NetworkIcon = () => <Network size={20} />;

interface DashboardProps {
 onLogout: () => void;
}

interface MultiSelectProps {
 label: string;
 options: { id: string; name: string }[];
 selectedIds: string[];
 onChange: (ids: string[]) => void;
 placeholder?: string;
 allowEmpty?: boolean;
}

const MultiSelectChecklist: React.FC<MultiSelectProps> = ({
 label,
 options,
 selectedIds,
 onChange,
 placeholder ="Select...",
 allowEmpty = true,
}) => {
 const [isOpen, setIsOpen] = useState(false);
 const dropdownRef = React.useRef<HTMLDivElement>(null);

 useEffect(() => {
 const handleClickOutside = (event: MouseEvent) => {
 if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
 setIsOpen(false);
 }
 };
 document.addEventListener('mousedown', handleClickOutside);
 return () => document.removeEventListener('mousedown', handleClickOutside);
 }, []);

 const toggleOption = (id: string) => {
 if (selectedIds.includes(id)) {
 const next = selectedIds.filter(item => item !== id);
 if (next.length === 0 && !allowEmpty) {
 return;
 }
 onChange(next);
 } else {
 onChange([...selectedIds, id]);
 }
 };

 const handleSelectAll = () => {
 onChange(options.map(o => o.id));
 };

 const handleClear = () => {
 if (!allowEmpty && options.length > 0) {
 onChange([options[0].id]);
 } else {
 onChange([]);
 }
 };

 let displayText = placeholder;
 if (selectedIds.length === 1) {
 if (selectedIds[0] ==="") {
 displayText ="(No Client / General)";
 } else {
 const found = options.find(o => o.id === selectedIds[0]);
 displayText = found ? found.name : selectedIds[0];
 }
 } else if (selectedIds.length > 1) {
 displayText =`${selectedIds.length} selected`;
 } else if (selectedIds.length === 0) {
 displayText = allowEmpty ?"(No Client / General)" : placeholder;
 }

 return (
 <div className="relative w-full" ref={dropdownRef}>
 <label className="text-xs text-gray-500 font-semibold mb-1.5 block">
 {label}
 </label>
 <button
 type="button"
 onClick={() => setIsOpen(!isOpen)}
 className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-800 focus:border-primary-500 text-xs text-gray-900 focus:border-slate-600/50 flex justify-between items-center text-left min-h-[38px]"
 >
 <span className="truncate pr-2 font-medium text-gray-800">{displayText}</span>
 <span className="text-gray-500 text-xs">▼</span>
 </button>

 {isOpen && (
 <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-md py-1 max-h-64 overflow-y-auto left-0">
 <div className="px-2 py-1.5 border-b border-gray-200 flex justify-between text-xs font-semibold text-primary-600">
 <button type="button" onClick={handleSelectAll} className="hover:underline">Select all</button>
 <button type="button" onClick={handleClear} className="hover:underline text-gray-500">{allowEmpty ?"Clear" :"Reset"}</button>
 </div>
 {allowEmpty && (
 <label className="flex items-center px-3 py-1.5 hover:bg-white cursor-pointer text-xs text-gray-600 border-b border-gray-200">
 <input
 type="checkbox"
 checked={selectedIds.length === 0 || (selectedIds.length === 1 && selectedIds[0] ==='')}
 onChange={() => onChange([])}
 className="mr-2.5 h-3.5 w-3.5 text-primary-600 rounded border-gray-200"
 />
 <span className="italic text-gray-500">(No client / general)</span>
 </label>
 )}
 {options.map((opt) => {
 const isChecked = selectedIds.includes(opt.id);
 return (
 <label
 key={opt.id}
 className="flex items-center px-3 py-1.5 hover:bg-white cursor-pointer text-xs text-gray-800"
 >
 <input
 type="checkbox"
 checked={isChecked}
 onChange={() => toggleOption(opt.id)}
 className="mr-2.5 h-3.5 w-3.5 text-primary-600 rounded border-gray-200"
 />
 <span className="truncate">{opt.name}</span>
 </label>
 );
 })}
 </div>
 )}
 </div>
 );
};

export default function Dashboard({ onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [assistantFocusNonce, setAssistantFocusNonce] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveTab('assistant');
        setAssistantFocusNonce((n) => n + 1);
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Global dashboard theme: 'dark' or 'light'
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('rs_dashboard_theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('rs_dashboard_theme', theme);
    setThemeColor(theme === 'dark');
  }, [theme]);

  const { canInstall, install } = useInstallPrompt();

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Glacier web nav: selected item is a surface pill with a card-stroke inset and an accent-text icon
  const getNavButtonClass = (tab: string) => {
    const isActive = activeTab === tab;
    const base = `w-full flex items-center gap-3 h-9 rounded-md text-sm transition-colors ${
      isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'
    }`;
    return `${base} ${
      isActive
        ? 'bg-surface text-fg font-medium shadow-[inset_0_0_0_1px_rgb(var(--g-stroke-card))] [&_svg]:text-accent-text'
        : 'text-fg-muted hover:text-fg hover:bg-hover'
    }`;
  };

  // Built at render time because it reads the jobs count declared further down
  const getNavItems = (): { group: string; items: { id: string; label: string; icon: React.ReactNode; badge?: number }[] }[] => [
    { group: 'Agent control', items: [
      { id: 'assistant', label: 'Assistant', icon: <MessageSquare size={20} /> },
      { id: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
      { id: 'search', label: 'Queue', icon: <Search size={20} /> },
      { id: 'indeed-sessions', label: 'Indeed accounts', icon: <Cookie size={20} /> },
    ]},
    { group: 'Data', items: [
      { id: 'jobs', label: 'Jobs', icon: <Database size={20} />, badge: jobs.length },
      { id: 'export', label: 'Export and sync', icon: <Download size={20} /> },
      { id: 'graph', label: 'Knowledge graph', icon: <Network size={20} /> },
      { id: 'supabase', label: 'Database', icon: <Cloud size={20} /> },
    ]},
    { group: 'Clients', items: [
      { id: 'clients', label: 'Clients', icon: <Briefcase size={20} /> },
      { id: 'leads', label: 'Leads', icon: <Users size={20} /> },
      { id: 'leads-flow', label: 'Leads flow', icon: <Activity size={20} /> },
      { id: 'blue', label: 'Blue.cc workspaces', icon: <Hexagon size={20} /> },
    ]},
  ];

  const tabTitles: Record<string, string> = {
    assistant: 'Assistant', overview: 'Overview', search: 'Queue', 'indeed-sessions': 'Indeed accounts', settings: 'Settings', jobs: 'Jobs', export: 'Export and sync',
    graph: 'Knowledge graph', supabase: 'Database', clients: 'Clients', leads: 'Leads',
    'leads-flow': 'Leads flow', blue: 'Blue.cc workspaces',
  };
 
 // Inputs matching old extension
 const [bulkTitles, setBulkTitles] = useState('');
 const [assignedTo, setAssignedTo] = useState('');
 const [locationFilter, setLocationFilter] = useState('');
 const [selectedTargetSites, setSelectedTargetSites] = useState<string[]>(['indeed']);
 const [dateFilter, setDateFilter] = useState('');
 
 // State
 const [settings, setSettings] = useState<any>({});
 const [jobs, setJobs] = useState<any[]>([]);
 const [queue, setQueue] = useState<any[]>([]);
 const [activeAgents, setActiveAgents] = useState<any[]>([]);
 const [clients, setClients] = useState<any[]>([]);
 const [selectedClients, setSelectedClients] = useState<string[]>([]);
 const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
 const [editTaskDraft, setEditTaskDraft] = useState<any>({});
 const [userEmail, setUserEmail] = useState<string>('');
 const [userAvatar, setUserAvatar] = useState<string>('');
 const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
 const [isBulkEditing, setIsBulkEditing] = useState<boolean>(false);
 const [isBulkLoadOpen, setIsBulkLoadOpen] = useState<boolean>(false);
 const [showBulkQueueBanner, setShowBulkQueueBanner] = useState<boolean>(true);
 const [qClientFilter, setQClientFilter] = useState<string>('');
 const [qSiteFilter, setQSiteFilter] = useState<string>('');
 const [qWorkerFilter, setQWorkerFilter] = useState<string>('');

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
 
 // Auto timeout after 60 seconds if no extension picks it up
 const timeout = setTimeout(() => {
 window.removeEventListener('message', listener);
 reject(new Error(`Bridge timeout: ${message.type}. Is the extension fully reloaded?`));
 }, 60000);

 const listener = (event: MessageEvent) => {
 if (event.data?.source ==='recruitscout-extension' && event.data?._id === messageId) {
 clearTimeout(timeout);
 window.removeEventListener('message', listener);
 if (event.data.error) reject(new Error(event.data.error));
 else {
 // Unwrap the payload from the MessageRouter since it artificially wraps it if _id is present
 const responseData = event.data.response;
 const finalData = (responseData && typeof responseData ==='object' &&'data' in responseData)
 ? responseData.data 
 : responseData;
 resolve(finalData as T);
 }
 }
 };

 window.addEventListener('message', listener);
 window.postMessage({
 source:'recruitscout-dashboard',
 ...message,
 _id: messageId
 },'*');
 });
 }
 
 useEffect(() => {
 const session = supabaseClient.getSession();
 if (session?.user) {
 if (session.user.email) setUserEmail(session.user.email);
 // Fallback to Supabase avatar initially
 if (session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture) {
 setUserAvatar(session.user.user_metadata.avatar_url || session.user.user_metadata.picture);
 }

 // Try fetching Blue.cc profile
 supabaseClient.getUserIntegration(session.user.id).then(res => {
 if (res.data?.bluecc_token_id && res.data?.bluecc_secret_id) {
 const blueClient = new BlueCcClient(
 res.data.bluecc_token_id, 
 res.data.bluecc_secret_id, 
 res.data.bluecc_company_id || undefined
 );
 blueClient.getMe().then(me => {
 if (me) {
 const name = [me.firstName, me.lastName].filter(Boolean).join('');
 if (name) setUserEmail(name);
 if (me.image?.small || me.image?.thumbnail || me.image?.original) {
 setUserAvatar(me.image.small || me.image.thumbnail || me.image.original);
 }
 }
 }).catch(console.error);
 }
 });
 }

 // Initial fetch of settings and jobs
 bridgeSendMessage<any>({ type: MessageType.GET_SETTINGS })
 .then(res => res && setSettings(res))
 .catch(err => console.log('Init Settings Fetch Warning:', err));
 
 bridgeSendMessage<any[]>({ type: MessageType.GET_JOBS })
 .then(res => res && setJobs(res))
 .catch(err => console.log('Init Jobs Fetch Warning:', err));

 bridgeSendMessage<any>({ type:'SUPABASE_GET_CLIENTS' as any })
 .then(res => {
 if (Array.isArray(res)) setClients(res);
 else if (res && res.data) setClients(res.data);
 })
 .catch(err => console.log('Init Clients Fetch Warning:', err));
 }, []);

 // Dynamically re-fetch jobs and queue when relevant
 useEffect(() => {
 if (activeTab ==='jobs' || activeTab ==='export') {
 bridgeSendMessage<any[]>({ type: MessageType.GET_JOBS })
 .then(res => res && setJobs(res))
 .catch(err => console.log('Dynamic Jobs Fetch Warning:', err));
 }
 if (activeTab ==='search') {
 const fetchDashboardData = () => {
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any })
 .then(res => {
 if (Array.isArray(res)) setQueue(res);
 else if (res && res.data) setQueue(res.data);
 })
 .catch(console.error);
 
 bridgeSendMessage<any>({ type:'SUPABASE_GET_AGENTS' as any })
 .then(res => {
 if (Array.isArray(res)) setActiveAgents(res);
 else if (res && res.data) setActiveAgents(res.data);
 })
 .catch(console.error);

 bridgeSendMessage<any>({ type:'SUPABASE_GET_CLIENTS' as any })
 .then(res => {
 if (Array.isArray(res)) setClients(res);
 else if (res && res.data) setClients(res.data);
 })
 .catch(console.error);
 };

 // Fetch immediately on mount
 fetchDashboardData();

 // Launch an aggressive poller to keep the UI feeling"live" and real-time
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
 client_id: selectedClients.length > 0 ? selectedClients : undefined,
 target_site: selectedTargetSites.length > 0 ? selectedTargetSites : ['indeed'],
 date_filter: dateFilter || undefined
 };
 const res = await bridgeSendMessage<any>({ type:'SUPABASE_ENQUEUE_TASKS' as any, payload });
 if (res && !res.error) {
 const modeLabel = titles.length > 0 ? `${titles.length} title(s)` : `location-only (${location})`;
 alert(`Queued ${modeLabel} for ${selectedClients.length || 1} client(s) on ${selectedTargetSites.length} site(s).`);
 setBulkTitles('');
 setSelectedClients([]);
 // Refresh queue
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => r?.data && setQueue(r.data));
 } else {
 alert("Couldn't save the tasks. " + res?.error);
 }
 } catch (err) {
 alert("Something went wrong. Try again.\n" + (err as Error).message);
 }
 };

 const handleUpdateLocations = async () => {
 if (!locationFilter.trim()) return;
 if (!confirm(`Change the location of every queued task to "${locationFilter.trim()}"?\n\nThis replaces the location on all tasks.`)) return;

 try {
 const res = await bridgeSendMessage<any>({ 
 type:'SUPABASE_UPDATE_QUEUE_LOCATION' as any, 
 payload: { location: locationFilter.trim() } 
 });
 if (res && !res.error) {
 alert('Locations updated.');
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } else {
 alert("Couldn't save the change. " + res?.error);
 }
 } catch (err) {
 alert("Something went wrong. Try again.\n" + (err as Error).message);
 }
 };

 const handleEditClick = (task: any) => {
 setEditingTaskId(task.id);
 setEditTaskDraft({...task});
 };

 const handleDeleteTask = async (id: string) => {
 if (!confirm('Delete 1 queued task?\n\nThis can\'t be undone.')) return;
 try {
 const res = await bridgeSendMessage<any>({ type:'SUPABASE_DELETE_QUEUE_TASK', id } as any);
 if (res?.error) alert('Error deleting task:' + res.error);
 else {
 // Refresh queue
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 }
 } catch (err) {
 alert('Error:' + (err as Error).message);
 }
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
 target_site: editTaskDraft.target_site ||'indeed',
 date_filter: editTaskDraft.date_filter || null,
 }
 };
 const res = await bridgeSendMessage<any>({ type:'SUPABASE_UPDATE_QUEUE_TASK' as any, payload });
 if (res && !res.error) {
 setEditingTaskId(null);
 setEditTaskDraft({});
 // Refresh queue
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } else {
 alert("Couldn't save the change. " + res?.error);
 }
 } catch (err) {
 alert("Something went wrong. Try again.\n" + (err as Error).message);
 }
 };

 const handleBulkStatusChange = async (newStatus: string) => {
 if (selectedJobIds.length === 0) return;
 if (!confirm(`Mark ${selectedJobIds.length} tasks as ${newStatus}?`)) return;
 try {
 await Promise.all(selectedJobIds.map(id => {
 const payload = { id, updates: { status: newStatus } };
 return bridgeSendMessage<any>({ type:'SUPABASE_UPDATE_QUEUE_TASK' as any, payload });
 }));
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } catch (err) {
 alert("Couldn't update the tasks. " + (err as Error).message);
 }
 };

 const handleBulkDelete = async () => {
 if (selectedJobIds.length === 0) return;
 if (!confirm(`Delete ${selectedJobIds.length} tasks?\n\nThis can't be undone.`)) return;
 try {
 await Promise.all(selectedJobIds.map(id => 
 bridgeSendMessage<any>({ type:'SUPABASE_DELETE_QUEUE_TASK', id } as any)
 ));
 setSelectedJobIds([]);
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } catch (err) {
 alert("Couldn't delete the tasks. " + (err as Error).message);
 }
 };

 const handleBulkEditSave = async () => {
 try {
 const updates: any = {};
 if (editTaskDraft.job_title) updates.job_title = editTaskDraft.job_title;
 if (editTaskDraft.client_id) updates.client_id = editTaskDraft.client_id;
 if (editTaskDraft.location !== undefined) updates.location = editTaskDraft.location;
 if (editTaskDraft.target_site) updates.target_site = editTaskDraft.target_site;
 if (editTaskDraft.date_filter) updates.date_filter = editTaskDraft.date_filter;

 if (Object.keys(updates).length === 0) {
 alert("No fields to update.");
 return;
 }

 await Promise.all(selectedJobIds.map(id => {
 const payload = { id, updates };
 return bridgeSendMessage<any>({ type:'SUPABASE_UPDATE_QUEUE_TASK' as any, payload });
 }));
 
 setIsBulkEditing(false);
 setEditTaskDraft({});
 setSelectedJobIds([]);
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } catch (err) {
 alert("Couldn't update the tasks. " + (err as Error).message);
 }
 };
  const filteredQueue = queue.filter(q => {
    if (qClientFilter === 'null' && q.client_id !== null) return false;
    if (qClientFilter && qClientFilter !== 'null' && q.client_id !== qClientFilter) return false;
    if (qSiteFilter && q.target_site !== qSiteFilter) return false;
    if (qWorkerFilter && q.worker_id !== qWorkerFilter) return false;
    return true;
  });

  const uniqueQueueSites = Array.from(new Set(queue.map(q => q.target_site))).filter(Boolean) as string[];
  const uniqueQueueWorkers = Array.from(new Set(queue.map(q => q.worker_id))).filter(Boolean) as string[];
  const uniqueQueueClients = Array.from(new Set(queue.map(q => q.client_id))).filter(Boolean) as string[];

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedJobIds(filteredQueue.map(q => q.id));
    } else {
      setSelectedJobIds([]);
    }
  };

 const handleSelectJob = (id: string) => {
 setSelectedJobIds(prev => 
 prev.includes(id) ? prev.filter(jobId => jobId !== id) : [...prev, id]
 );
 };

 const handleChangeStatus = async (id: string, newStatus: string) => {
 try {
 const payload = {
 id,
 updates: { status: newStatus }
 };
 const res = await bridgeSendMessage<any>({ type:'SUPABASE_UPDATE_QUEUE_TASK' as any, payload });
 if (res && !res.error) {
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 } else {
 alert("Couldn't change the status. " + res?.error);
 }
 } catch (err) {
 alert("Something went wrong. Try again.\n" + (err as Error).message);
 }
 };

 return (
  <div className="flex h-screen overflow-hidden font-sans min-w-0 glacier-canvas text-fg">

  {/* Mobile overlay backdrop */}
  {isMobileMenuOpen && (
  <div
  className="fixed inset-0 bg-black/40 z-40 md:hidden"
  onClick={() => setIsMobileMenuOpen(false)}
  />
  )}

  {/* Sidebar: 240px Glacier chrome over the canvas wash */}
  <aside className={`fixed inset-y-0 left-0 transform ${isMobileMenuOpen ? 'translate-x-0 bg-surface' : '-translate-x-full'} md:relative md:translate-x-0 md:bg-transparent transition-[width,transform] duration-200 z-50 flex flex-col flex-shrink-0 border-r border-stroke-card glacier-chrome ${isSidebarCollapsed ? 'md:w-[72px] w-sidebar' : 'w-sidebar'}`}>
  <button
  onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
  aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
  className="hidden md:flex absolute -right-3 top-6 w-6 h-6 items-center justify-center rounded-full border border-stroke-control bg-surface text-fg-muted hover:text-fg shadow-raised z-30"
  >
  <ChevronLeft size={14} className={`transition-transform duration-200 ${isSidebarCollapsed ? 'rotate-180' : ''}`} />
  </button>

  {/* App identity: Glacier app icon + product name in Onest 600 */}
  <div className={`h-16 flex items-center gap-3 shrink-0 ${isSidebarCollapsed ? 'md:justify-center px-4 md:px-0' : 'px-4'}`}>
  <div className="relative w-8 h-8 rounded-[9px] bg-gradient-to-br from-app-icon-1 to-app-icon-2 flex items-center justify-center shrink-0 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
  <span className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(255,255,255,0.35),transparent_55%)]" />
  <Server size={16} strokeWidth={1.75} className="relative text-white" />
  </div>
  {!isSidebarCollapsed && (
  <div className="min-w-0">
  <div className="text-base font-semibold text-fg leading-tight truncate">RecruitScout</div>
  <div className="text-xs text-fg-subtle truncate">Command center</div>
  </div>
  )}
  </div>

  <nav className="flex-1 px-3 pb-4 overflow-y-auto overflow-x-hidden custom-scrollbar" aria-label="Main">
  {getNavItems().map(section => (
  <div key={section.group} className="mt-4 first:mt-1">
  {!isSidebarCollapsed && (
  <div className="px-3 mb-1 text-xs font-medium text-fg-subtle">{section.group}</div>
  )}
  <div className="space-y-0.5">
  {section.items.map(item => (
  <button
  key={item.id}
  onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
  title={isSidebarCollapsed ? item.label : undefined}
  aria-current={activeTab === item.id ? 'page' : undefined}
  className={getNavButtonClass(item.id)}
 >
  <span className="relative shrink-0 flex">
  {item.icon}
  {isSidebarCollapsed && !!item.badge && (
  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
  )}
  </span>
  {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
  {!isSidebarCollapsed && !!item.badge && (
  <span className="ml-auto text-xs font-medium tabular px-1.5 rounded-full bg-neutral-badge text-fg-muted">{item.badge.toLocaleString()}</span>
  )}
  </button>
  ))}
  </div>
  </div>
  ))}
  </nav>

  {/* Settings last and separated, then the signed-in user */}
  <div className="px-3 pt-2 pb-3 border-t border-stroke-divider space-y-0.5">
  <button
  onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
  title={isSidebarCollapsed ? 'Settings' : undefined}
  aria-current={activeTab === 'settings' ? 'page' : undefined}
  className={getNavButtonClass('settings')}
  >
  <Settings size={20} className="shrink-0" />
  {!isSidebarCollapsed && <span>Settings</span>}
  </button>

  {userEmail && (
  <div className={`flex items-center gap-2.5 h-10 ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'}`}>
  {userAvatar ? (
  <img src={userAvatar} alt="" className="w-6 h-6 rounded-full shrink-0 object-cover" title={isSidebarCollapsed ? userEmail : undefined} />
  ) : (
  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 bg-accent-subtle-2 text-accent-subtle-fg" title={isSidebarCollapsed ? userEmail : undefined}>
  {userEmail[0].toUpperCase()}
  </div>
  )}
  {!isSidebarCollapsed && (
  <div className="text-sm text-fg-muted truncate flex-1" title={userEmail}>{userEmail}</div>
  )}
  </div>
  )}
  <button
  onClick={onLogout}
  title={isSidebarCollapsed ? 'Sign out' : undefined}
  className={`w-full flex items-center gap-3 h-9 rounded-md text-sm text-fg-muted hover:text-fg hover:bg-hover transition-colors ${isSidebarCollapsed ? 'md:justify-center px-3 md:px-0' : 'px-3'}`}
  >
  <LogOut size={20} className="shrink-0" />
  {!isSidebarCollapsed && <span>Sign out</span>}
  </button>
  </div>
  </aside>

  {/* Main content */}
  <main className="flex-1 flex flex-col relative overflow-hidden min-w-0">
  <header className="h-16 flex items-center px-4 md:px-6 shrink-0 gap-3 border-b border-stroke-card glacier-chrome">
  <button
  className="md:hidden p-2 -ml-2 rounded-md text-fg-muted hover:text-fg hover:bg-hover"
  onClick={() => setIsMobileMenuOpen(true)}
  aria-label="Open navigation"
  >
  <Menu size={20} />
  </button>
  <h1 className="text-2xl font-semibold text-fg truncate">
  {tabTitles[activeTab] || activeTab}
  </h1>
  {activeTab !== 'assistant' && (
    <button
      type="button"
      onClick={() => { setActiveTab('assistant'); setAssistantFocusNonce((n) => n + 1); }}
      className="hidden md:inline-flex items-center gap-1.5 text-xs text-fg-subtle hover:text-fg px-2 py-1 rounded-md hover:bg-hover"
      title="Open Assistant (⌘K)"
    >
      <MessageSquare size={12} />
      <span>⌘K</span>
    </button>
  )}

  <div className="ml-auto flex items-center gap-2">
    {canInstall && (
      <button onClick={install} className="btn-secondary" aria-label="Install RecruitScout as an app">
        <MonitorDown size={16} />
        <span className="hidden sm:inline">Install app</span>
      </button>
    )}
    <button
      onClick={toggleTheme}
      className="btn-ghost"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      <span className="hidden sm:inline">{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>
    </button>
  </div>
  </header>

  <div className={`flex-1 min-h-0 ${activeTab === 'assistant' || activeTab === 'graph' || activeTab === 'leads' || activeTab === 'leads-flow' || activeTab === 'supabase' || activeTab === 'blue' ? 'overflow-hidden p-0 flex flex-col' : 'overflow-y-auto p-4 md:p-6 lg:p-8'}`}>

 {activeTab === 'assistant' && (
  <AssistantTab sendMessage={bridgeSendMessage} focusNonce={assistantFocusNonce} />
 )}
 
 {/* OVERVIEW MODE */}
 {activeTab ==='overview' && (
 <OverviewTab />
 )}

 {activeTab === 'indeed-sessions' && (
  <IndeedSessionsTab />
 )}

 {activeTab === 'graph' && (
  <GraphTab />
 )}

 {/* BULK SEARCH MODE */}
 {activeTab ==='search' && (
 <div className="w-full mx-auto space-y-6">
 {isBulkLoadOpen && (
 <div className="bg-white rounded-xl p-1 border border-gray-200 transition-all relative">
 <button 
 onClick={() => setIsBulkLoadOpen(false)}
 className="absolute top-4 right-4 text-gray-500 hover:text-gray-600 transition-colors text-base w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 z-10"
 title="Close"
 aria-label="Close"
 >
 <X size={16} />
 </button>
 <div className="bg-white rounded-lg p-6">
 <h3 className="text-base font-medium text-gray-900 mb-2 flex items-center gap-2">
 Load a bulk job
 </h3>
 <p className="text-xs text-gray-500 mb-4">
 Paste job titles below (one per line). The remote extension agents will pick these up automatically when their engines start.
 </p>
 
 <textarea 
 value={bulkTitles}
 onChange={(e) => setBulkTitles(e.target.value)}
 placeholder={`Software Engineer\nProduct Manager\nData Scientist\n\n(or leave blank and set a Location to scrape all jobs in that area)`}
 className="w-full h-40 bg-white border border-gray-200 rounded-lg p-4 text-xs font-mono text-gray-900 placeholder-gray-400 focus:border-primary-500 transition-all resize-none"
 />
 
 <div className="mt-4 md:grid md:grid-cols-12 md:gap-4 md:items-end">
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <MultiSelectChecklist
 label="Associated client"
 options={clients.map(c => ({ id: c.id, name: c.name }))}
 selectedIds={selectedClients}
 onChange={setSelectedClients}
 placeholder="(No client)"
 allowEmpty={true}
 />
 </div>
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <MultiSelectChecklist
 label="Target site"
 options={[
 { id:'indeed', name:'Indeed' },
 { id:'spanish-indeed', name:'Spanish Indeed' },
 { id:'trovolavoro', name:'TrovoLavoro' }
 ]}
 selectedIds={selectedTargetSites}
 onChange={setSelectedTargetSites}
 placeholder="Select sites"
 allowEmpty={false}
 />
 </div>
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <label className="text-xs text-gray-500 font-semibold mb-1.5 block">
 Date posted
 </label>
 <select 
 value={dateFilter} 
 onChange={(e) => setDateFilter(e.target.value)} 
 className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-800 focus:border-primary-500 text-xs text-gray-900 focus:border-slate-600/50 appearance-none min-h-[38px]"
 disabled={selectedTargetSites.length === 1 && selectedTargetSites[0] ==='trovolavoro'}
 >
 <option value="">All dates</option>
 <option value="last">Ads not displayed</option>
 <option value="1">Last 24 hours</option>
 <option value="3">Last 3 days</option>
 <option value="7">Last 7 days</option>
 <option value="14">Last 14 days</option>
 </select>
 </div>
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <label className="text-xs text-gray-500 font-semibold mb-1.5 block">
 Location filter
 </label>
 <input 
 type="text"
 placeholder="e.g. Remote, New York..."
 value={locationFilter}
 onChange={(e) => setLocationFilter(e.target.value)}
 className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-800 focus:border-primary-500 text-xs text-gray-900 placeholder-gray-400 focus:border-slate-600/50 transition-all"
 />
 </div>
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <label className="text-xs text-gray-500 font-semibold mb-1.5 flex justify-between items-center">
 <span>Assigned worker</span> 
 <span className="text-primary-600 font-medium">{activeAgents.length} Online</span>
 </label>
 <select 
 value={assignedTo} 
 onChange={(e) => setAssignedTo(e.target.value)} 
 className="w-full bg-gray-50 border border-gray-200 rounded-md p-2 text-gray-800 focus:border-primary-500 text-xs text-gray-900 focus:border-slate-600/50 appearance-none" 
 >
 <option value="">Leave blank for any available node...</option>
 {activeAgents.map(agent => (
 <option key={agent.worker_id} value={agent.worker_id}>
 {agent.worker_name} ({agent.worker_id})
 </option>
 ))}
 </select>
 </div>
 <div className="col-span-12 sm:col-span-6 md:col-span-2">
 <label className="text-xs text-gray-500 font-semibold mb-1.5 block">
 Sheets sync
 </label>
 <button
 onClick={() => updateSetting('filterRecruitersEnabled', !settings.filterRecruitersEnabled)}
 className={`w-full text-left px-3 py-2 rounded-md text-xs font-medium border transition-all min-h-[38px] flex items-center justify-between ${
 settings.filterRecruitersEnabled 
 ?'bg-primary-50 text-primary-700 border-primary-200' 
 :'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
 }`}
 title="If enabled, jobs from companies in the recruiters table will not be synced to Google Sheets"
 >
 <span className="truncate">Filter recruiters</span>
 <span className="text-xs">{settings.filterRecruitersEnabled ?'On' :'Off'}</span>
 </button>
 </div>
 <div className="col-span-12 flex gap-2 justify-end md:mt-2">
 <button 
 onClick={handleUpdateLocations}
 disabled={!locationFilter.trim()}
 className="bg-gray-100 hover:bg-slate-700 text-gray-600 border border-gray-200 px-4 py-2 rounded-md font-medium transition-all disabled:bg-subtle disabled:text-fg-subtle disabled:cursor-not-allowed whitespace-nowrap text-xs"
 title="Update location for all existing queue tasks"
 >
 Apply location
 </button>
 <button 
 onClick={handleSaveBulkSearch}
 disabled={!bulkTitles.trim() && !locationFilter.trim()}
 className="bg-accent hover:bg-primary-400 text-slate-950 font-semibold shadow-card  text-on-accent px-6 py-2 rounded-md font-medium transition-all disabled:bg-subtle disabled:text-fg-subtle disabled:cursor-not-allowed whitespace-nowrap text-xs text-center min-w-[120px]"
 >
 {bulkTitles.trim() ?'Enqueue' :'Scrape'}
 </button>
 </div>
 </div>
 </div>
 </div>
 )}
 
 <div className="bg-white rounded-xl p-1 border border-gray-200 mt-6">
 <div className="bg-white rounded-lg p-6">
 {showBulkQueueBanner && (
    <div className="bg-blue-50 border border-blue-200 text-blue-900 px-4 py-3 rounded-xl mb-6 flex items-start justify-between shadow-sm">
      <div className="text-xs leading-relaxed">
        Select <strong>Load bulk job</strong> to add search tasks to the queue.
        <span className="ml-1 font-medium text-blue-700">Tip: switch between light and dark themes with the button in the top bar.</span>
      </div>
      <button onClick={() => setShowBulkQueueBanner(false)} className="text-blue-500 hover:text-blue-700 font-semibold ml-4 text-sm" aria-label="Dismiss"><X size={16} /></button>
    </div>
  )}
 <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
 <div>
 <h3 className="text-xs font-medium text-gray-900 flex items-center gap-2">
 Queue status
 <button 
 onClick={() => {
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => {
 if (Array.isArray(r)) setQueue(r);
 else if (r?.data) setQueue(r.data);
 });
 bridgeSendMessage<any>({ type:'SUPABASE_GET_AGENTS' as any }).then(r => {
 if (Array.isArray(r)) setActiveAgents(r);
 else if (r?.data) setActiveAgents(r.data);
 });
 }} 
 className="text-gray-500 hover:text-gray-800 text-xs px-2"
 >
 Refresh
 </button>
 <button
 onClick={async () => {
 if (!confirm('Reset finished and stuck tasks to pending?\n\nEvery completed and failed task runs again, and so does any task stuck running for over 3 hours.')) return;
 try {
 const res = await bridgeSendMessage<any>({ type:'SUPABASE_RESET_QUEUE' as any });
 if (res?.error) {
 alert('Couldn\'t reset the queue. ' + res.error);
 } else {
 const q = await bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any });
 if (Array.isArray(q)) setQueue(q);
 else if (q?.data) setQueue(q.data);
 }
 } catch (err) {
 alert('Something went wrong. Try again. ' + (err as Error).message);
 }
 }}
 className="bg-slate-50 text-slate-700 hover:bg-slate-100 px-2 py-1 rounded text-xs font-medium border border-slate-200 transition-all"
 title="Reset all completed tasks back to pending so they run again today"
 >
 Reset to pending
 </button>
 </h3>
 <div className="flex gap-3 mt-2 text-xs">
  <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-medium border border-gray-200">
  Total: {filteredQueue.length}
  </span>
  <span className="bg-primary-50 text-primary-700 border border-primary-200 px-2 py-0.5 rounded font-medium border border-primary-200">
  Pending: {filteredQueue.filter(q => q.status ==='pending').length}
  </span>
  <span className="bg-primary-50 text-primary-700 px-2 py-0.5 rounded font-medium border border-primary-200">
  Completed: {filteredQueue.filter(q => q.status ==='completed').length}
  </span>
  </div>
  <div className="flex gap-2 mt-3 mb-1">
    <select value={qClientFilter} onChange={e => setQClientFilter(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 shadow-sm max-w-[150px]">
      <option value="">All clients</option>
      <option value="null">(No client)</option>
      {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
    <select value={qSiteFilter} onChange={e => setQSiteFilter(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 shadow-sm">
      <option value="">All sites</option>
      {Array.from(new Set(['indeed', 'spanish-indeed', 'trovolavoro', ...uniqueQueueSites])).map(s => <option key={s} value={s}>{({ indeed: 'Indeed (Italy)', 'spanish-indeed': 'Indeed (Spain)', trovolavoro: 'Trovolavoro' } as Record<string, string>)[s] || s}</option>)}
    </select>
    <select value={qWorkerFilter} onChange={e => setQWorkerFilter(e.target.value)} className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-700 shadow-sm max-w-[150px]">
      <option value="">All workers</option>
      {activeAgents.map(a => <option key={a.worker_id} value={a.worker_id}>{a.worker_name} ({a.worker_id})</option>)}
    </select>
  </div>
 </div>
 <div className="flex items-center gap-3">
 <button 
 onClick={() => setIsBulkLoadOpen(!isBulkLoadOpen)}
 className={`${isBulkLoadOpen ?'bg-primary-100 text-primary-700 hover:bg-primary-200 border-primary-200' :'bg-accent text-on-accent hover:bg-accent-700 border-transparent'} px-4 py-1.5 rounded-md font-medium text-xs transition-all shadow-sm flex items-center gap-1.5 border`}
 >
 {isBulkLoadOpen ?'Hide bulk loader' :'Load bulk job'}
 </button>
 <button 
 onClick={() => {
 bridgeSendMessage({ type:'STOP_EXTRACTION' as any }).then(() => {
 alert('Stopped the scraping engine.');
 updateSetting('pollingEnabled', false);
 bridgeSendMessage<any>({ type:'SUPABASE_GET_QUEUE' as any }).then(r => r?.data && setQueue(r.data));
 });
 }}
 className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 px-3 py-1.5 rounded-md font-semibold text-xs border border-red-200 transition-all"
 >
 Stop engine
 </button>
 </div>
 </div>
 
 <div className="overflow-x-auto overflow-y-auto max-h-[500px] lg:max-h-[600px] xl:max-h-[700px] 2xl:max-h-[800px] rounded-md border border-gray-200 w-full relative">
 {selectedJobIds.length > 0 && (
 <div className="bg-primary-50 border-b border-primary-100 px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm">
 <div className="text-xs font-semibold text-primary-700">
 {selectedJobIds.length} job(s) selected
 </div>
 {isBulkEditing ? (
 <div className="flex items-center gap-2">
 <select 
 value={editTaskDraft.target_site ||''} 
 onChange={e => setEditTaskDraft({...editTaskDraft, target_site: e.target.value})}
 className="bg-white border border-primary-200 rounded px-2 py-1 text-xs text-gray-900 shadow-sm"
 >
 <option value="">Leave site as is</option>
 <option value="indeed">Indeed</option>
 <option value="spanish-indeed">Spanish Indeed</option>
 <option value="trovolavoro">TrovoLavoro</option>
 </select>
 <select 
 value={editTaskDraft.client_id ||''} 
 onChange={e => setEditTaskDraft({...editTaskDraft, client_id: e.target.value})}
 className="bg-white border border-primary-200 rounded px-2 py-1 text-xs text-gray-900 shadow-sm max-w-[150px]"
 >
 <option value="">Leave client as is</option>
 <option value="null">(No client)</option>
 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 <input 
 type="text" 
 value={editTaskDraft.location ||''} 
 onChange={e => setEditTaskDraft({...editTaskDraft, location: e.target.value})}
 className="bg-white border border-primary-200 rounded px-2 py-1 text-xs text-gray-900 shadow-sm w-[100px]"
 placeholder="Location"
 />
 <button onClick={handleBulkEditSave} className="bg-accent hover:bg-primary-400 text-on-accent font-semibold px-3 py-1 rounded text-xs shadow-sm ml-2">Apply edit</button>
 <button onClick={() => { setIsBulkEditing(false); setEditTaskDraft({}); }} className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold px-3 py-1 rounded text-xs shadow-sm">Cancel</button>
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <button onClick={() => handleBulkStatusChange('pending')} className="bg-slate-100 text-slate-700 hover:bg-slate-200 font-semibold px-3 py-1 rounded text-xs border border-slate-200 shadow-sm">Mark pending</button>
 <button onClick={() => handleBulkStatusChange('completed')} className="bg-primary-100 text-primary-700 hover:bg-primary-200 font-semibold px-3 py-1 rounded text-xs border border-primary-200 shadow-sm">Mark complete</button>
 <button onClick={() => setIsBulkEditing(true)} className="bg-primary-100 text-primary-700 hover:bg-primary-200 font-semibold px-3 py-1 rounded text-xs border border-primary-200 shadow-sm ml-2">Edit</button>
 <button onClick={handleBulkDelete} className="bg-red-100 text-red-700 hover:bg-red-200 font-semibold px-3 py-1 rounded text-xs border border-red-200 shadow-sm">Delete</button>
 </div>
 )}
 </div>
 )}
 <table className="w-full text-left text-xs text-gray-600 min-w-[800px]">
 <thead className={`text-xs font-semibold text-gray-500 bg-white border-b border-gray-200 sticky ${selectedJobIds.length > 0 ?'top-[44px]' :'top-0'} z-10 `}>
 <tr>
 <th className="px-3 py-2 bg-white w-[40px]">
 <input 
 type="checkbox" 
 checked={filteredQueue.length > 0 && selectedJobIds.length === filteredQueue.length}
 onChange={handleSelectAll}
 className="rounded border-gray-300 text-primary-500"
 />
 </th>
 <th className="px-3 py-2 bg-white">Task</th>
 <th className="px-3 py-2 bg-white">Site</th>
 <th className="px-3 py-2 bg-white">Date</th>
 <th className="px-3 py-2 bg-white">Client</th>
 <th className="px-3 py-2 bg-white">Location</th>
 <th className="px-3 py-2 bg-white">Status</th>
 <th className="px-3 py-2 bg-white">Worker ID</th>
 <th className="px-3 py-2 bg-white">Created</th>
 <th className="px-3 py-2 bg-white text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredQueue.map((q, i) => {
 const clientRecord = clients.find(c => c.id === q.client_id);
 const isEditing = q.id === editingTaskId;
 
 return (
 <tr key={q.id} className={`border-b border-gray-200 ${selectedJobIds.includes(q.id) ?'bg-primary-50' : i % 2 === 0 ?'bg-white' :'bg-gray-50'} hover:bg-gray-100`}>
 <td className="px-3 py-1.5">
 <input 
 type="checkbox" 
 checked={selectedJobIds.includes(q.id)}
 onChange={() => handleSelectJob(q.id)}
 className="rounded border-gray-300 text-primary-500"
 />
 </td>
 {isEditing ? (
 <>
 <td className="px-3 py-1.5">
 <input 
 type="text" 
 value={editTaskDraft.job_title} 
 onChange={e => setEditTaskDraft({...editTaskDraft, job_title: e.target.value})}
 className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
 />
 </td>
 <td className="px-3 py-1.5">
 <select 
 value={editTaskDraft.target_site} 
 onChange={e => setEditTaskDraft({...editTaskDraft, target_site: e.target.value})}
 className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
 >
 <option value="indeed">Indeed</option>
 <option value="spanish-indeed">Spanish Indeed</option>
 <option value="trovolavoro">TrovoLavoro</option>
 </select>
 </td>
 <td className="px-3 py-1.5">
 <select 
 value={editTaskDraft.date_filter ||''} 
 onChange={e => setEditTaskDraft({...editTaskDraft, date_filter: e.target.value || undefined})}
 className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
 >
 <option value="">All</option>
 <option value="last">No ads</option>
 <option value="1">24h</option>
 <option value="3">3d</option>
 <option value="7">7d</option>
 <option value="14">14d</option>
 </select>
 </td>
 <td className="px-3 py-1.5">
 <select 
 value={editTaskDraft.client_id} 
 onChange={e => setEditTaskDraft({...editTaskDraft, client_id: e.target.value})}
 className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
 >
 <option value="">(No client)</option>
 {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
 </select>
 </td>
 <td className="px-3 py-1.5">
 <input 
 type="text" 
 value={editTaskDraft.location} 
 onChange={e => setEditTaskDraft({...editTaskDraft, location: e.target.value})}
 className="w-full bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-900"
 placeholder="-"
 />
 </td>
 <td className="px-3 py-1.5" colSpan={3}>
 <span className="text-xs text-gray-500 italic">Editing task...</span>
 </td>
 <td className="px-3 py-1.5 text-right whitespace-nowrap">
 <button onClick={handleSaveEdit} className="text-primary-600 hover:text-primary-600 font-medium px-2 py-1 text-xs">Save</button>
 <button onClick={handleCancelEdit} className="text-gray-500 hover:text-gray-600 font-medium px-2 py-1 text-xs">Cancel</button>
 </td>
 </>
 ) : (
 <>
 <td className="px-3 py-1.5 font-medium text-gray-900 truncate max-w-[150px] lg:max-w-[250px] xl:max-w-[400px]" title={q.job_title}>{q.job_title}</td>
 <td className="px-3 py-1.5"><span className="px-2 py-0.5 rounded border text-xs font-semibold bg-slate-50 text-slate-700 border-slate-200 whitespace-nowrap">{q.target_site ||'indeed'}</span></td>
 <td className="px-3 py-1.5 whitespace-nowrap">
 {q.date_filter ? (
 <span className={`px-2 py-0.5 rounded border text-xs font-medium ${q.date_filter ==='last' ?'bg-slate-50 text-slate-700 border-slate-200' :'bg-primary-50 text-primary-700 border border-primary-200 border-primary-200'}`}>
 {q.date_filter ==='last' ?'No ads' : q.date_filter ==='1' ?'24h' : `${q.date_filter}d`}
 </span>
 ) : (
 <span className="text-gray-500 italic text-xs">Any</span>
 )}
 </td>
 <td className="px-3 py-1.5 text-gray-600 font-semibold truncate max-w-[120px] lg:max-w-[180px] xl:max-w-[250px]" title={clientRecord?.name}>{clientRecord ? clientRecord.name : <span className="text-gray-500 italic font-normal">—</span>}</td>
 <td className="px-3 py-1.5 text-gray-600 truncate max-w-[100px] lg:max-w-[150px]" title={q.location}>{q.location ||'-'}</td>
 <td className="px-3 py-1.5 whitespace-nowrap">
 <span className={`badge ${q.status ==='pending' ?'bg-neutral-badge text-fg-muted' : q.status ==='running' ?'badge-warning' : q.status ==='completed' ?'badge-success' :'badge-error'}`}>
 <span className="w-1.5 h-1.5 rounded-full bg-current" aria-hidden="true" />
 {q.status ==='pending' ?'Pending' : q.status ==='running' ?'Running' : q.status ==='completed' ?'Completed' : q.status ==='failed' ?'Failed' : q.status}
 </span>
 </td>
 <td className="px-3 py-1.5 whitespace-nowrap">{q.assigned_to || <span className="text-gray-600 italic">Unassigned</span>}</td>
 <td className="px-3 py-1.5 whitespace-nowrap">{new Date(q.created_at).toLocaleString()}</td>
 <td className="px-3 py-1.5">
 <div className="flex items-center justify-end gap-3 whitespace-nowrap">
 {q.status ==='running' && (
 <>
 <button 
 onClick={() => handleChangeStatus(q.id,'pending')}
 className="text-slate-500 hover:text-slate-700 font-medium text-xs"
 title="Mark as pending"
 >
 Mark pending
 </button>
 <button 
 onClick={() => handleChangeStatus(q.id,'completed')}
 className="text-primary-500 hover:text-primary-700 font-medium text-xs"
 title="Mark as complete"
 >
 Mark complete
 </button>
 </>
 )}
 <button 
 onClick={() => handleEditClick(q)}
 className="text-primary-600 hover:text-blue-800 font-medium text-xs"
 disabled={q.status ==='running'}
 title={q.status ==='running' ?'Cannot edit running tasks' :'Edit task'}
 >
 Edit
 </button>
 <button 
 onClick={() => handleDeleteTask(q.id)}
 className="text-red-600 hover:text-red-800 font-medium text-xs"
 disabled={q.status ==='running'}
 title={q.status ==='running' ?'Cannot delete running tasks' :'Delete task'}
 >
 Delete
 </button>
 </div>
 </td>
 </>
 )}
 </tr>
 );
 })}
 {queue.length === 0 && (
 <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500 ">No tasks in the queue. Select Load bulk job to add some.</td></tr>
 )}
 </tbody>
 </table>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* SETTINGS */}
 {activeTab ==='settings' && (
 <div className="w-full max-w-5xl xl:max-w-6xl 2xl:max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
 
 {/* General Settings */}
 <div className="bg-white rounded-md p-5 border border-gray-200 space-y-4">
 <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2 mb-3">General settings</h3>
 
 <label className="flex items-center justify-between cursor-pointer group">
 <div>
 <div className="text-xs font-medium text-gray-900 group-hover:text-gray-600 transition-colors">Auto extract</div>
 <div className="text-xs text-gray-500 mt-0.5">Automatically extract jobs when visiting job boards</div>
 </div>
 <input type="checkbox" checked={settings.autoExtract || false} onChange={e => updateSetting('autoExtract', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-200 bg-white cursor-pointer" />
 </label>

 <label className="flex items-center justify-between cursor-pointer group">
 <div>
 <div className="text-xs font-medium text-gray-900 group-hover:text-gray-600 transition-colors">Notifications</div>
 <div className="text-xs text-gray-500 mt-0.5">Show notifications when extraction completes</div>
 </div>
 <input type="checkbox" checked={settings.notificationEnabled !== false} onChange={e => updateSetting('notificationEnabled', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-200 bg-white cursor-pointer" />
 </label>

 <div className="space-y-3 pt-4 border-t border-gray-200 mt-2">
 <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-2">
 Distributed worker mode
 </h4>

 <label className="flex items-center justify-between cursor-pointer group">
 <div>
 <div className="text-xs font-medium text-gray-900 group-hover:text-gray-600 transition-colors">Enable remote polling</div>
 <div className="text-xs text-gray-500 mt-0.5">Automatically pull and execute jobs pushed to Supabase queue</div>
 </div>
 <input type="checkbox" checked={settings.pollingEnabled || false} onChange={e => updateSetting('pollingEnabled', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-200 bg-white cursor-pointer" />
 </label>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-gray-900">Worker ID / agent name (assigned_to)</label>
 <input
 type="text"
 placeholder="e.g. Node-A"
 value={settings.friendName ||''}
 onChange={e => updateSetting('friendName', e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-900 focus:border-slate-600/50"
 />
 </div>

 <div className="space-y-1.5">
 <label htmlFor="indeed-cookie-mode" className="text-xs font-medium text-gray-900">Indeed sign-in</label>
 <select
 id="indeed-cookie-mode"
 value={settings.indeedCookieMode ?? 'stored'}
 onChange={e => updateSetting('indeedCookieMode', e.target.value)}
 className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-900"
 >
 <option value="stored">Stored accounts (cookies from indeed_scraper_sessions)</option>
 <option value="browser">This browser's own Indeed sign-in</option>
 </select>
 <p className="text-xs text-gray-500">Applies to Indeed queue and bulk tasks on this agent. Trovolavoro always uses the browser.</p>
 </div>
 </div>

 <div className="space-y-3 pt-4 border-t border-gray-200 mt-2">
 <h4 className="text-xs font-semibold text-gray-600 flex items-center gap-2">
 Spanish Indeed
 </h4>

 <label className="flex items-center justify-between cursor-pointer group">
 <div>
 <div className="text-xs font-medium text-gray-900 group-hover:text-gray-600 transition-colors">Spanish companies whitelist</div>
 <div className="text-xs text-gray-500 mt-0.5">
 {settings.spanishWhitelistEnabled !== false
 ?'ON — only companies in Spanish_Companies table sync to sheet'
 :'OFF — all extracted Spanish Indeed jobs sync to sheet'}
 </div>
 </div>
 <input
 type="checkbox"
 id="spanish-whitelist-toggle"
 checked={settings.spanishWhitelistEnabled !== false}
 onChange={e => updateSetting('spanishWhitelistEnabled', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-200 bg-white cursor-pointer"
 />
 </label>
 </div>
 </div>

 {/* Extraction Settings */}
 <div className="bg-white rounded-md p-5 border border-gray-200 space-y-4">
 <h3 className="text-xs font-semibold text-gray-500 border-b border-gray-200 pb-2 mb-3">Extraction settings</h3>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-gray-900">Max jobs per page</label>
 <input
 type="number"
 min="10"
 max="500"
 value={settings.maxJobsPerPage || 100}
 onChange={e => updateSetting('maxJobsPerPage', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-900 focus:border-slate-600/50"
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-gray-900">Pagination limit</label>
 <input
 type="number"
 min="1"
 max="100"
 value={settings.paginationLimit || 10}
 onChange={e => updateSetting('paginationLimit', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-900 focus:border-slate-600/50"
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-xs font-medium text-gray-900">Crawl delay (ms)</label>
 <input
 type="number"
 min="100"
 max="10000"
 step="100"
 value={settings.crawlDelay || 1000}
 onChange={e => updateSetting('crawlDelay', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-xs text-gray-900 focus:border-slate-600/50"
 />
 </div>

 <label className="flex items-center justify-between cursor-pointer group">
 <div>
 <div className="text-xs font-medium text-gray-900 group-hover:text-gray-600 transition-colors">Respect robots.txt</div>
 <div className="text-xs text-gray-500 mt-0.5">Respect guidelines when crawling</div>
 </div>
 <input type="checkbox" checked={settings.respectRobotsTxt !== false} onChange={e => updateSetting('respectRobotsTxt', e.target.checked)} className="form-checkbox h-4 w-4 rounded border-gray-200 bg-white cursor-pointer" />
 </label>
 </div>

 </div>
 )}

 {/* JOBS VIEWER */}
 {activeTab ==='jobs' && (
 <div className="w-full max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto bg-white p-6 rounded-md border border-gray-200 mt-4">
 <JobsTab 
 jobs={jobs} 
 onJobsUpdate={setJobs} 
 sendMessage={bridgeSendMessage} 
 />
 </div>
 )}

 {/* DATA EXPORT & SYNC */}
 {activeTab ==='export' && (
 <div className="w-full max-w-[1400px] xl:max-w-[1600px] 2xl:max-w-[1800px] mx-auto bg-white p-6 rounded-md border border-gray-200 mt-4">
 <ExportTab 
 jobs={jobs} 
 settings={settings} 
 sendMessage={bridgeSendMessage} 
 />
 </div>
 )}

 {/* SUPABASE VIEWER */}
 {activeTab ==='supabase' && (
 <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto flex-1 flex flex-col min-h-0">
 <SupabaseTab />
 </div>
 )}

 {/* CLIENT ENROLLMENT */}
 {activeTab ==='clients' && (
 <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto">
 <ClientEnrollmentTab sendMessage={bridgeSendMessage} />
 </div>
 )}

 {/* LEADS MANAGEMENT */}
 {activeTab ==='leads' && (
 <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto flex-1 flex flex-col min-h-0">
 <LeadsManagementTab sendMessage={bridgeSendMessage} />
 </div>
 )}

 {/* LEADS FLOW */}
 {activeTab ==='leads-flow' && (
 <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto flex-1 flex flex-col min-h-0">
 <LeadsFlowTab sendMessage={bridgeSendMessage} />
 </div>
 )}

 {/* BLUE.CC WORKSPACES */}
 {activeTab ==='blue' && (
 <div className="w-full max-w-[1600px] 2xl:max-w-[1920px] mx-auto flex-1 flex flex-col min-h-0">
 <BlueApp />
 </div>
 )}

 </div>
 </main>
 </div>
 );
}
