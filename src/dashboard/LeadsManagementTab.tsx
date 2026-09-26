import React, { useState, useEffect } from 'react';
import RecruiterDashboard from './RecruiterDashboard';
import { supabaseClient } from '../shared/supabase';
import CountryFilterDropdown from './CountryFilterDropdown';

// Icons
const RefreshIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
 <polyline points="23 4 23 10 17 10"></polyline>
 <polyline points="1 20 1 14 7 14"></polyline>
 <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
 </svg>
);
const AlertTriangleIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
 <line x1="12" y1="9" x2="12" y2="13"></line>
 <line x1="12" y1="17" x2="12.01" y2="17"></line>
 </svg>
);

const UsersIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
 <circle cx="9" cy="7" r="4"></circle>
 <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
 <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
 </svg>
);

const SearchIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
 <circle cx="11" cy="11" r="8"></circle>
 <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
 </svg>
);

const CloseIcon = () => (
 <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
 <line x1="18" y1="6" x2="6" y2="18"></line>
 <line x1="6" y1="6" x2="18" y2="18"></line>
 </svg>
);

interface LeadsManagementTabProps {
 sendMessage: (msg: any) => Promise<any>;
}

const ALL_FIELDS = [
'Name','Domain','Country','Location','Size','Industry vertical',
'Primary Specialty','LinkedIn URL','Teaser Threshold','Leads Sent before Teaser Mode',
'Minimum leads per email','Maximum leads per email','max-job-age','suspension end date','Number of leads sent in the last 7 days',
'Number of leads sent in the last 30 days','Total leads sent','Date of the most recent lead',
'Associated contacts','status'
];

export default function LeadsManagementTab({ sendMessage }: LeadsManagementTabProps) {
 const [recruiters, setRecruiters] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterCountry, setFilterCountry] = useState('');
 const [filterLocation, setFilterLocation] = useState('');
 const [filterSpecialty, setFilterSpecialty] = useState('');
 const [filterIndustry, setFilterIndustry] = useState('');
 const [currentPage, setCurrentPage] = useState(1);
 const [isUpdating, setIsUpdating] = useState(false);
 const [isSyncingContacts, setIsSyncingContacts] = useState(false);
 const [syncContactsResult, setSyncContactsResult] = useState<string | null>(null);
 const [selectedRecruiter, setSelectedRecruiter] = useState<any | null>(null);
 const [viewingDashboardFor, setViewingDashboardFor] = useState<any | null>(null);
 const [editFormData, setEditFormData] = useState<Record<string, any>>({});
 const [isSaving, setIsSaving] = useState(false);
 const [leadsSentBeforeTeaser, setLeadsSentBeforeTeaser] = useState<number>(5);
 const [isUpdatingLeadsSent, setIsUpdatingLeadsSent] = useState(false);
 const [teaserThreshold, setTeaserThreshold] = useState<number>(5);
 const [isUpdatingTeaser, setIsUpdatingTeaser] = useState(false);
  const [minLeads, setMinLeads] = useState<number>(10);
  const [isUpdatingMinLeads, setIsUpdatingMinLeads] = useState(false);
  const [maxLeads, setMaxLeads] = useState<number>(50);
  const [isUpdatingMaxLeads, setIsUpdatingMaxLeads] = useState(false);
 const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
 const [isBulkEditing, setIsBulkEditing] = useState(false);
 const [existingCountries, setExistingCountries] = useState<string[]>([]);
 const [isSelectingAll, setIsSelectingAll] = useState(false);
 const itemsPerPage = 15;

 const getRecruiterKey = (r: any) => r['Name'] || r['Agency Name'] || '';

  const [totalRecruiters, setTotalRecruiters] = useState(0);

  const fetchRecruiters = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filters = {
        country: filterCountry.trim(),
        location: filterLocation.trim(),
        specialty: filterSpecialty.trim(),
        industry: filterIndustry.trim()
      };
      const res = await supabaseClient.getRecruitersPaginated(currentPage, itemsPerPage, searchQuery.trim(), filters);
      if (res && res.error) {
        setError(res.error);
      } else if (res && Array.isArray(res.data)) {
        setRecruiters(res.data);
        setTotalRecruiters(res.totalCount);
      } else {
        setRecruiters([]);
        setTotalRecruiters(0);
      }
    } catch (e: any) {
      setError(e.message || 'Error fetching recruiters');
    } finally {
      setLoading(false);
    }
  };

  const syncContactEmails = async () => {
  setIsSyncingContacts(true);
  setSyncContactsResult(null);
  setError(null);
  try {
  const res = await supabaseClient.syncRecruiterContactEmails();
  if (res && res.error && !res.data) {
  setError(res.error);
  } else if (res && res.data) {
  const { updated, skipped, errors } = res.data;
  setSyncContactsResult(`\u2713 Synced: ${updated} updated, ${skipped} skipped, ${errors} errors`);
  await fetchRecruiters(true);
  } else {
  setSyncContactsResult('Sync complete.');
  await fetchRecruiters(true);
  }
  } catch (e: any) {
  setError(e.message || 'Error syncing contacts');
  } finally {
  setIsSyncingContacts(false);
  }
  };

  const updateAllStatus = async () => {
  setIsUpdating(true);
  setError(null);
  try {
  const res = await supabaseClient.updateAllRecruitersStatus('Active');
  if (res && res.error) {
  setError(res.error);
  } else {
  await fetchRecruiters();
  }
  } catch (e: any) {
  setError(e.message || 'Error updating status');
  } finally {
  setIsUpdating(false);
  }
  };

  const updateAllLeadsSentValues = async () => {
  setIsUpdatingLeadsSent(true);
  setError(null);
  try {
  const res = await supabaseClient.updateAllRecruitersLeadsSent(leadsSentBeforeTeaser);
  if (res && res.error) {
  setError(res.error);
  } else {
  await fetchRecruiters();
  }
  } catch (e: any) {
  setError(e.message || 'Error updating leads sent values');
  } finally {
  setIsUpdatingLeadsSent(false);
  }
  };

  const updateAllTeaserThresholdValues = async () => {
  setIsUpdatingTeaser(true);
  setError(null);
  try {
  const res = await supabaseClient.updateAllRecruitersTeaserThreshold(teaserThreshold);
  if (res && res.error) {
  setError(res.error);
  } else {
  await fetchRecruiters();
  }
  } catch (e: any) {
  setError(e.message || 'Error updating teaser threshold values');
  } finally {
  setIsUpdatingTeaser(false);
  }
  };

  const updateAllMinLeadsValues = async () => {
    setIsUpdatingMinLeads(true);
    setError(null);
    try {
      const res = await supabaseClient.updateAllRecruitersMinLeads(minLeads);
      if (res && res.error) {
        setError(res.error);
      } else {
        await fetchRecruiters();
      }
    } catch (e: any) {
      setError(e.message || 'Error updating minimum leads values');
    } finally {
      setIsUpdatingMinLeads(false);
    }
  };

  const updateAllMaxLeadsValues = async () => {
    setIsUpdatingMaxLeads(true);
    setError(null);
    try {
      const res = await supabaseClient.updateAllRecruitersMaxLeads(maxLeads);
      if (res && res.error) {
        setError(res.error);
      } else {
        await fetchRecruiters();
      }
    } catch (e: any) {
      setError(e.message || 'Error updating maximum leads values');
    } finally {
      setIsUpdatingMaxLeads(false);
    }
  };

 const handleEditClick = (recruiter: any, e: React.MouseEvent) => {
 e.stopPropagation();
 setSelectedRecruiter(recruiter);
 setEditFormData({ ...recruiter });
 };

 const handleDashboardClick = (recruiter: any, e: React.MouseEvent) => {
 e.stopPropagation();
 setViewingDashboardFor(recruiter);
 };

 const handleInputChange = (field: string, value: string) => {
 setEditFormData(prev => ({ ...prev, [field]: value }));
 };

  const handleSave = async () => {
   if (!selectedRecruiter && !isBulkEditing) return;
   setIsSaving(true);
   setError(null);
   try {
   if (isBulkEditing) {
   const updates = { ...editFormData };
   if (Object.keys(updates).length > 0) {
   const results = await Promise.all(selectedRowKeys.map(key =>
   supabaseClient.updateRecruiter(key, updates)
   ));
   const errors = results.filter((res: any) => res && res.error);
   if (errors.length > 0) {
   setError(`Failed to update ${errors.length} recruiters.`);
   } else {
   setIsBulkEditing(false);
   setSelectedRowKeys([]);
   }
   } else {
   setIsBulkEditing(false);
   setSelectedRowKeys([]);
   }
   } else {
   const originalName = selectedRecruiter['Name'] || selectedRecruiter['Agency Name'];
   const res = await supabaseClient.updateRecruiter(originalName, editFormData);
   if (res && res.error) {
   setError(res.error);
   } else {
   setSelectedRecruiter(null);
   }
   }
   await fetchRecruiters(true);
   } catch (e: any) {
   setError(e.message || 'Error updating recruiter(s)');
   } finally {
   setIsSaving(false);
   }
   };

  useEffect(() => {
  const handler = setTimeout(() => {
  fetchRecruiters(false);
  }, 400);
  return () => clearTimeout(handler);
  }, [searchQuery, filterCountry, filterLocation, filterSpecialty, filterIndustry, currentPage]);

  // Fetch unique countries from the database once on mount to enrich the smart country dropdown
  useEffect(() => {
    supabaseClient.getUniqueRecruiterCountries().then(countries => {
      if (countries && countries.length > 0) setExistingCountries(countries);
    }).catch(() => {});
  }, []);

  const totalPages = Math.ceil(totalRecruiters / itemsPerPage) || 1;
  const paginatedRecruiters = recruiters;

  const handleSelectAll = async () => {
    setIsSelectingAll(true);
    try {
      const filters = {
        country: filterCountry.trim(),
        location: filterLocation.trim(),
        specialty: filterSpecialty.trim(),
        industry: filterIndustry.trim(),
      };
      const allNames = await supabaseClient.getAllRecruiterNames(searchQuery.trim(), filters);
      setSelectedRowKeys(allNames);
    } catch {
      // fallback: select current page only
      setSelectedRowKeys(paginatedRecruiters.map(getRecruiterKey).filter(Boolean));
    } finally {
      setIsSelectingAll(false);
    }
  };

 if (viewingDashboardFor) {
 return <RecruiterDashboard recruiter={viewingDashboardFor} onBack={() => setViewingDashboardFor(null)} />;
 }

 return (
  <div className="flex flex-col h-full bg-slate-50 dark:bg-[#141416] text-gray-900 dark:text-zinc-100 transition-colors">
  <div className="bg-white dark:bg-[#161618] border-b border-gray-200 dark:border-zinc-800 px-4 md:px-6 lg:px-8 py-3 md:py-4 flex items-center justify-between z-20 shadow-sm relative transition-colors shrink-0">
  <div className="flex items-center gap-4">
  <div className="bg-primary-50 dark:bg-emerald-500/10 p-2.5 rounded-xl text-primary-600 dark:text-emerald-400 shadow-sm border border-primary-100/50 dark:border-emerald-500/20">
  <UsersIcon />
  </div>
  <div>
  <h1 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 tracking-tight">Leads Management</h1>
  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-1 hidden sm:block">Manage recruitment leads and contacts stored in Supabase.</p>
  </div>
  </div>
  <div className="flex items-center gap-3">
  {syncContactsResult && (
  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium hidden sm:inline">{syncContactsResult}</span>
  )}
  <button
  onClick={syncContactEmails}
  disabled={isSyncingContacts || loading}
  className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-xs font-medium transition-all duration-200 shadow-sm"
  title="Match emails from RecruiterContact table into Associated contacts column"
  >
  {isSyncingContacts ? (
  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  ) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
  )}
  {isSyncingContacts ? 'Syncing...' : 'Sync Contacts'}
  </button>
  <button
  onClick={updateAllStatus}
  disabled={isUpdating || loading || recruiters.length === 0}
  className="flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-xs font-medium transition-all duration-200 shadow-sm"
  >
  {isUpdating ? (
  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
  ) : (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
  )}
  Set All Active
  </button>
  <button
  onClick={() => fetchRecruiters()}
  disabled={loading || isUpdating}
  className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 hover:shadow-sm disabled:opacity-50 text-xs font-medium transition-all duration-200"
  >
  <div className={loading ?'animate-spin' :''}>
  <RefreshIcon />
  </div>
  Refresh
  </button>
  </div>
  </div>

  {/* Bulk Config Bar */}
  <div className="bg-slate-100/70 dark:bg-[#18181b] border-b border-gray-200 dark:border-zinc-800 px-4 md:px-6 lg:px-8 py-2 md:py-3 flex items-center gap-4 md:gap-6 z-10 overflow-x-auto transition-colors shrink-0">
  <span className="text-[10px] md:text-xs font-bold text-gray-500 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap hidden lg:inline">Bulk Update Configurations</span>
  
  <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg p-1 border border-gray-200 dark:border-zinc-700/80 shadow-sm">
  <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 px-3 whitespace-nowrap">Leads Sent (Pre-teaser):</label>
  <input
  type="number"
  min="0"
  value={leadsSentBeforeTeaser}
  onChange={(e) => setLeadsSentBeforeTeaser(Number(e.target.value))}
  className="w-16 px-2 py-1 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-md text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
  />
  <button
  onClick={updateAllLeadsSentValues}
  disabled={isUpdatingLeadsSent || loading || recruiters.length === 0}
  className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 rounded-md hover:bg-primary-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-semibold transition-colors"
  >
  {isUpdatingLeadsSent ? (
  <div className="w-3 h-3 border-2 border-primary-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
  ) :'Apply'}
  </button>
  </div>

  <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg p-1 border border-gray-200 dark:border-zinc-700/80 shadow-sm">
  <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 px-3 whitespace-nowrap">Teaser Threshold:</label>
  <input
  type="number"
  min="0"
  value={teaserThreshold}
  onChange={(e) => setTeaserThreshold(Number(e.target.value))}
  className="w-16 px-2 py-1 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-md text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
  />
  <button
  onClick={updateAllTeaserThresholdValues}
  disabled={isUpdatingTeaser || loading || recruiters.length === 0}
  className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 rounded-md hover:bg-primary-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-semibold transition-colors"
  >
  {isUpdatingTeaser ? (
  <div className="w-3 h-3 border-2 border-primary-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
  ) :'Apply'}
  </button>
  </div>

  <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg p-1 border border-gray-200 dark:border-zinc-700/80 shadow-sm">
  <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 px-3 whitespace-nowrap">Min Leads/Email:</label>
  <input
  type="number"
  min="0"
  value={minLeads}
  onChange={(e) => setMinLeads(Number(e.target.value))}
  className="w-16 px-2 py-1 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-md text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
  />
  <button
  onClick={updateAllMinLeadsValues}
  disabled={isUpdatingMinLeads || loading || recruiters.length === 0}
  className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 rounded-md hover:bg-primary-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-semibold transition-colors"
  >
  {isUpdatingMinLeads ? (
  <div className="w-3 h-3 border-2 border-primary-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
  ) :'Apply'}
  </button>
  </div>

  <div className="flex items-center bg-white dark:bg-zinc-900 rounded-lg p-1 border border-gray-200 dark:border-zinc-700/80 shadow-sm">
  <label className="text-xs font-medium text-gray-700 dark:text-zinc-300 px-3 whitespace-nowrap">Max Leads/Email:</label>
  <input
  type="number"
  min="0"
  value={maxLeads}
  onChange={(e) => setMaxLeads(Number(e.target.value))}
  className="w-16 px-2 py-1 border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 rounded-md text-[12px] text-center focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
  />
  <button
  onClick={updateAllMaxLeadsValues}
  disabled={isUpdatingMaxLeads || loading || recruiters.length === 0}
  className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-primary-50 dark:bg-emerald-500/15 text-primary-700 dark:text-emerald-400 rounded-md hover:bg-primary-100 dark:hover:bg-emerald-500/25 disabled:opacity-50 text-xs font-semibold transition-colors"
  >
  {isUpdatingMaxLeads ? (
  <div className="w-3 h-3 border-2 border-primary-700 dark:border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
  ) :'Apply'}
  </button>
  </div>
  </div>

  <div className="px-4 md:px-6 lg:px-8 py-3 bg-white dark:bg-[#161618] border-b border-gray-200 dark:border-zinc-800 z-30 sticky top-0 shadow-sm transition-colors shrink-0">
  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
  <div className="relative w-full lg:max-w-sm shrink-0">
  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400 dark:text-zinc-500">
  <SearchIcon />
  </div>
  <input
  type="text"
  className="block w-full pl-11 pr-4 py-1.5 md:py-2 border border-gray-200 dark:border-zinc-700 rounded-lg leading-5 bg-gray-50 dark:bg-zinc-900/90 placeholder-gray-400 dark:placeholder-zinc-500 focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 text-xs font-normal text-gray-900 dark:text-zinc-100 transition-all duration-200 ease-in-out shadow-inner"
  placeholder="Search agencies, domains, locations..."
  value={searchQuery}
  onChange={(e) => {
  setSearchQuery(e.target.value);
  setCurrentPage(1);
  }}
  />
  </div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 flex-1 w-full max-w-full">
    <CountryFilterDropdown
      value={filterCountry}
      onChange={(val) => { setFilterCountry(val); setCurrentPage(1); }}
      existingCountries={existingCountries}
      placeholder="Filter Country..."
    />
    <input 
      type="text" 
      placeholder="Filter Location..." 
      value={filterLocation} 
      onChange={e => { setFilterLocation(e.target.value); setCurrentPage(1); }}
      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all placeholder-gray-400 dark:placeholder-zinc-500 shadow-sm"
    />
    <input 
      type="text" 
      placeholder="Filter Specialty..." 
      value={filterSpecialty} 
      onChange={e => { setFilterSpecialty(e.target.value); setCurrentPage(1); }}
      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all placeholder-gray-400 dark:placeholder-zinc-500 shadow-sm"
    />
    <input 
      type="text" 
      placeholder="Filter Industry..." 
      value={filterIndustry} 
      onChange={e => { setFilterIndustry(e.target.value); setCurrentPage(1); }}
      className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-md px-3 py-1.5 text-[11px] text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all placeholder-gray-400 dark:placeholder-zinc-500 shadow-sm"
    />
  </div>
  </div>
  </div>

  <div className="flex flex-1 overflow-hidden">
  {/* Main Table Area */}
  <div className="flex-1 overflow-auto p-4 lg:p-6 transition-all duration-300">
  {error && (
  <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 rounded-md flex gap-3 text-red-800 dark:text-red-300">
  <AlertTriangleIcon />
  <div>
  <h3 className="font-semibold text-[12px]">Failed to load recruiters</h3>
  <p className="text-[12px] mt-1 opacity-90">{error}</p>
  </div>
  </div>
  )}

  <div className="w-full bg-white dark:bg-[#1c1c20] border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
  
  {selectedRowKeys.length > 0 && (
  <div className="bg-primary-50 dark:bg-emerald-500/10 border-b border-primary-100 dark:border-emerald-500/20 px-4 py-2 flex items-center justify-between sticky top-0 z-20 shadow-sm transition-colors">
  <div className="flex items-center gap-3">
    <span className="text-[10px] font-bold text-primary-700 dark:text-emerald-400">
      {selectedRowKeys.length} recruiter(s) selected
    </span>
    {selectedRowKeys.length < totalRecruiters && (
      <button
        onClick={handleSelectAll}
        disabled={isSelectingAll}
        className="flex items-center gap-1.5 text-[9px] font-semibold text-primary-600 dark:text-emerald-400 hover:text-primary-800 dark:hover:text-emerald-300 underline underline-offset-2 disabled:opacity-60 transition-colors"
      >
        {isSelectingAll ? (
          <><div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />Selecting...</>
        ) : (
          <>Select all {totalRecruiters.toLocaleString()} recruiters</>
        )}
      </button>
    )}
    {selectedRowKeys.length === totalRecruiters && totalRecruiters > 0 && (
      <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-500/30">
        ✓ All {totalRecruiters.toLocaleString()} selected
      </span>
    )}
  </div>
  <div className="flex items-center gap-2">
  <button onClick={() => {
    setIsBulkEditing(true);
    setEditFormData({});
  }} className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-3 py-1.5 rounded-lg text-[9px] shadow-sm transition-colors">
  Bulk Edit Selected
  </button>
  <button onClick={() => setSelectedRowKeys([])} className="bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700 font-bold px-3 py-1.5 rounded-lg text-[9px] shadow-sm transition-colors">
  Clear Selection
  </button>
  </div>
  </div>
  )}

  <div className="overflow-x-auto">
  <table className="w-full text-left border-collapse">
  <thead className={`sticky ${selectedRowKeys.length > 0 ? 'top-[44px]' : 'top-0'} z-10 transition-colors`}>
  <tr className="bg-slate-50 dark:bg-zinc-900/90 border-b border-gray-200 dark:border-zinc-800">
  <th className="px-3 py-2.5 w-[30px] bg-slate-50 dark:bg-zinc-900/90">
  <input 
    type="checkbox" 
    checked={paginatedRecruiters.length > 0 && paginatedRecruiters.every(r => selectedRowKeys.includes(getRecruiterKey(r)))}
    onChange={(e) => {
      if (e.target.checked) {
        const visibleKeys = paginatedRecruiters.map(getRecruiterKey).filter(Boolean);
        const newKeys = Array.from(new Set([...selectedRowKeys, ...visibleKeys]));
        setSelectedRowKeys(newKeys);
      } else {
        const visibleKeys = paginatedRecruiters.map(getRecruiterKey).filter(Boolean);
        setSelectedRowKeys(prev => prev.filter(k => !visibleKeys.includes(k)));
      }
    }}
    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 bg-white"
  />
  </th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap bg-slate-50 dark:bg-zinc-900/90">Actions</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap bg-slate-50 dark:bg-zinc-900/90">Name</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Domain</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Country</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Location</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Size</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Industry</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Specialty</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">LinkedIn</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Teaser Threshold</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Leads Sent (pre-teaser)</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Min Leads/Email</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Max Leads/Email</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Max Job Age (days)</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Suspension End Date</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Leads (7d)</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Leads (30d)</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Total Leads</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Most Recent Lead</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Associated Contacts</th>
  <th className="px-3 py-2.5 text-[10px] font-semibold text-gray-600 dark:text-zinc-400 uppercase tracking-wider whitespace-nowrap">Status</th>
  </tr>
  </thead>
  <tbody className="divide-y divide-gray-100 dark:divide-zinc-800/60">
  {loading && recruiters.length === 0 ? (
  <tr>
  <td colSpan={20} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
  <div className="flex flex-col items-center justify-center">
  <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mb-3"></div>
  <p className="text-[12px]">Loading recruiters...</p>
  </div>
  </td>
  </tr>
  ) : recruiters.length === 0 && !error ? (
  <tr>
  <td colSpan={20} className="px-4 py-8 text-center text-gray-500 dark:text-zinc-400">
  <p className="text-[12px]">No agencies found matching your search.</p>
  </td>
  </tr>
  ) : (
  paginatedRecruiters.map((r, i) => (
  <tr 
  key={i} 
  className={`hover:bg-slate-50 dark:hover:bg-zinc-800/40 transition-colors duration-150 border-l-2 ${
  ((selectedRecruiter && getRecruiterKey(selectedRecruiter) === getRecruiterKey(r)) || selectedRowKeys.includes(getRecruiterKey(r))) 
  ?'bg-primary-50 dark:bg-emerald-500/10 border-primary-400 dark:border-emerald-400' 
  :'border-transparent'
  }`}
  >
  <td className="px-3 py-2 w-[30px]">
  <input 
    type="checkbox"
    checked={selectedRowKeys.includes(getRecruiterKey(r))}
    onChange={(e) => {
      const key = getRecruiterKey(r);
      if (!key) return;
      if (e.target.checked) {
        setSelectedRowKeys(prev => [...prev, key]);
      } else {
        setSelectedRowKeys(prev => prev.filter(k => k !== key));
      }
    }}
    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500 bg-white"
  />
  </td>
  <td className="px-3 py-2 whitespace-nowrap text-xs">
  <div className="flex items-center gap-2">
  <button
  onClick={(e) => handleDashboardClick(r, e)}
  className="px-2.5 py-1 text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15 hover:bg-emerald-100 dark:hover:bg-emerald-500/25 border border-emerald-200/60 dark:border-emerald-500/30 rounded text-[9px] font-semibold transition-colors"
  >
  Dashboard
  </button>
  <button
  onClick={(e) => handleEditClick(r, e)}
  className="px-2.5 py-1 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 border border-slate-200/80 dark:border-zinc-700/80 rounded text-[9px] font-medium transition-colors"
  >
  Edit
  </button>
  </div>
  </td>
  <td className="px-3 py-2 text-xs text-gray-900 dark:text-zinc-100 font-medium whitespace-nowrap">
  {r['Name'] || r['Agency Name'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Domain'] ? (
  <a href={r['Domain'].startsWith('http') ? r['Domain'] :`https://${r['Domain']}`} target="_blank" rel="noopener noreferrer" className="text-primary-600 dark:text-emerald-400 hover:underline" onClick={(e) => e.stopPropagation()}>
  {r['Domain']}
  </a>
  ) :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap truncate max-w-xs" title={r['Country'] ||''}>
  {r['Country'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap truncate max-w-xs" title={r['Location'] ||''}>
  {r['Location'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Size'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap truncate max-w-xs" title={r['Industry vertical'] ||''}>
  {r['Industry vertical'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap truncate max-w-xs" title={r['Primary Specialty'] ||''}>
  {r['Primary Specialty'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['LinkedIn URL'] ? (
  <a href={r['LinkedIn URL']} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline" onClick={(e) => e.stopPropagation()}>
  LinkedIn
  </a>
  ) :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Teaser Threshold'] != null ? r['Teaser Threshold'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Leads Sent before Teaser Mode'] != null ? r['Leads Sent before Teaser Mode'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Minimum leads per email'] != null ? r['Minimum leads per email'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Maximum leads per email'] != null ? r['Maximum leads per email'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-center text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['max-job-age'] != null ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/30 text-[10px] font-semibold">
      {r['max-job-age']}<span className="font-normal opacity-70">d</span>
    </span>
  ) : <span className="text-gray-400 dark:text-zinc-500">—</span>}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['suspension end date'] ||'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Number of leads sent in the last 7 days'] != null ? r['Number of leads sent in the last 7 days'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Number of leads sent in the last 30 days'] != null ? r['Number of leads sent in the last 30 days'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Total leads sent'] != null ? r['Total leads sent'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Date of the most recent lead'] ? new Date(r['Date of the most recent lead']).toLocaleDateString() :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r['Associated contacts'] != null ? r['Associated contacts'] :'N/A'}
  </td>
  <td className="px-3 py-2 text-xs text-gray-600 dark:text-zinc-300 whitespace-nowrap">
  {r.status ? (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-medium shadow-sm border ${
  r.status.toLowerCase() ==='active' ?'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30' :
  'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
  }`}>
  {r.status}
  </span>
  ) :'N/A'}
  </td>
  </tr>
  ))
  )}
  </tbody>
  </table>
  </div>
  </div>

  {totalPages >= 1 && (
  <div className="w-full mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white dark:bg-[#1c1c20] px-4 py-3 border border-gray-200 dark:border-zinc-800 rounded-xl">
  <p className="text-xs text-gray-500 dark:text-zinc-400 shrink-0">
    Showing{' '}
    <span className="font-semibold text-gray-800 dark:text-zinc-200">{totalRecruiters === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1}</span>
    {' – '}
    <span className="font-semibold text-gray-800 dark:text-zinc-200">{Math.min(currentPage * itemsPerPage, totalRecruiters)}</span>
    {' of '}
    <span className="font-semibold text-gray-800 dark:text-zinc-200">{totalRecruiters.toLocaleString()}</span>
    {' recruiters'}
  </p>
  <nav className="inline-flex items-center gap-1" aria-label="Pagination">
    {/* First */}
    <button
      onClick={() => setCurrentPage(1)}
      disabled={currentPage === 1}
      className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
      title="First page"
    >«</button>
    {/* Previous */}
    <button
      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
      disabled={currentPage === 1}
      className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
    >‹ Prev</button>
    {/* Page numbers */}
    {(() => {
      const pages: (number | 'ellipsis-start' | 'ellipsis-end')[] = [];
      const delta = 2;
      const left = Math.max(2, currentPage - delta);
      const right = Math.min(totalPages - 1, currentPage + delta);
      pages.push(1);
      if (left > 2) pages.push('ellipsis-start');
      for (let p = left; p <= right; p++) pages.push(p);
      if (right < totalPages - 1) pages.push('ellipsis-end');
      if (totalPages > 1) pages.push(totalPages);
      return pages.map((p, idx) =>
        p === 'ellipsis-start' || p === 'ellipsis-end' ? (
          <span key={`${p}-${idx}`} className="px-1.5 py-1.5 text-[11px] text-gray-400 dark:text-zinc-500 select-none">…</span>
        ) : (
          <button
            key={p}
            onClick={() => setCurrentPage(p as number)}
            className={`min-w-[30px] px-2 py-1.5 rounded-md border text-[11px] font-medium transition-colors ${
              currentPage === p
                ? 'bg-primary-600 border-primary-600 text-white shadow-sm'
                : 'bg-white dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-700'
            }`}
          >{p}</button>
        )
      );
    })()}
    {/* Next */}
    <button
      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
      disabled={currentPage === totalPages}
      className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
    >Next ›</button>
    {/* Last */}
    <button
      onClick={() => setCurrentPage(totalPages)}
      disabled={currentPage === totalPages}
      className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-[11px] font-medium text-gray-500 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
      title="Last page"
    >»</button>
  </nav>
  </div>
  )}
  </div>


 {/* Side Panel for Editing (Fixed Modal Overlay) */}
 {(selectedRecruiter || isBulkEditing) && (
 <div className="fixed inset-0 z-50 flex justify-end">
 <div 
 className="absolute inset-0 bg-slate-900 transition-opacity" 
 onClick={() => { setSelectedRecruiter(null); setIsBulkEditing(false); }}
 ></div>
 <div className="relative w-[400px] max-w-full bg-white dark:bg-[#18181b] flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-gray-200 dark:border-zinc-800 shadow-2xl">
 <div className="flex items-center justify-between px-8 py-5 border-b border-gray-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#161618]">
 <h2 className="text-base font-bold text-slate-800 dark:text-zinc-100 truncate pr-4">
 {isBulkEditing ? `Bulk Edit ${selectedRowKeys.length} Recruiters` : `Edit ${selectedRecruiter?.['Name'] || selectedRecruiter?.['Agency Name'] || 'Recruiter'}`}
 </h2>
 <button 
 onClick={() => { setSelectedRecruiter(null); setIsBulkEditing(false); }}
 className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors p-1.5 rounded-full hover:bg-white dark:hover:bg-zinc-800"
 >
 <CloseIcon />
 </button>
 </div>
 
 <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white dark:bg-[#18181b]">
 {ALL_FIELDS.map(field => (
 <div key={field}>
 <label className="block text-[9px] font-semibold text-slate-700 dark:text-zinc-300 mb-1.5 capitalize tracking-wide">
 {field}
 </label>
 {field ==='status' ? (
 <select
 value={editFormData[field] !== undefined ? editFormData[field] : ''}
 onChange={(e) => handleInputChange(field, e.target.value)}
 className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 rounded-xl text-[12px] focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all shadow-sm"
 >
 <option value="">{isBulkEditing ? "Leave unchanged" : "Select status..."}</option>
 <option value="Active">Active</option>
 <option value="Pending">Pending</option>
 <option value="Suspended">Suspended</option>
 <option value="Blacklisted">Blacklisted</option>
 </select>
 ) : field === 'max-job-age' ? (
 <div className="space-y-1.5">
   <div className="relative">
     <input
       type="number"
       min={1}
       step={1}
       value={editFormData[field] === null || editFormData[field] === undefined ? '' : editFormData[field]}
       onChange={(e) => handleInputChange(field, e.target.value)}
       className="w-full px-4 py-2.5 pr-14 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl text-[12px] focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 transition-all shadow-sm"
       placeholder={isBulkEditing ? 'Leave blank to keep unchanged' : 'e.g. 30'}
     />
     <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-violet-500 dark:text-violet-400 pointer-events-none select-none">days</span>
   </div>
   <p className="text-[10px] text-gray-400 dark:text-zinc-500 leading-relaxed">Maximum age of a job posting (in days) that will be considered eligible to be sent to this recruiter.</p>
 </div>
 ) : (
 <input
 type="text"
 value={editFormData[field] === null || editFormData[field] === undefined ?'' : editFormData[field]}
 onChange={(e) => handleInputChange(field, e.target.value)}
 className="w-full px-4 py-2.5 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-500 rounded-xl text-[12px] focus:outline-none focus:bg-white dark:focus:bg-zinc-900 focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-all shadow-sm"
 placeholder={isBulkEditing ? `Enter ${field} (leave blank to keep unchanged)` : `Enter ${field}...`}
 />
 )}
 </div>
 ))}
 </div>

 <div className="p-6 border-t border-gray-200 dark:border-zinc-800 bg-white dark:bg-[#161618] shadow-lg flex gap-3 justify-end z-10">
 <button
 onClick={() => { setSelectedRecruiter(null); setIsBulkEditing(false); }}
 className="px-5 py-2.5 text-xs font-medium text-slate-700 dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-700 transition-all shadow-sm"
 disabled={isSaving}
 >
 Cancel
 </button>
 <button
 onClick={handleSave}
 disabled={isSaving}
 className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all text-xs font-medium disabled:opacity-50 shadow-sm"
 >
 {isSaving ? (
 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
 ) : null}
 {isSaving ?'Saving...' :'Save Changes'}
 </button>
 </div>
 </div>
 </div>
 )}
 </div>
 </div>
 );
}
