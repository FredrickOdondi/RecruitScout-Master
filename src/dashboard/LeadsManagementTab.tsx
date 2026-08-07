import React, { useState, useEffect } from 'react';

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
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
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
  'Name', 'Domain', 'Country', 'Location', 'Size', 'Industry vertical',
  'Primary Specialty', 'LinkedIn URL', 'Teaser Threshold', 'Leads Sent before Teaser Mode',
  'Daily Sending Limit', 'suspension end date', 'Number of leads sent in the last 7 days',
  'Number of leads sent in the last 30 days', 'Total leads sent', 'Date of the most recent lead',
  'Associated contacts', 'status'
];

export default function LeadsManagementTab({ sendMessage }: LeadsManagementTabProps) {
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedRecruiter, setSelectedRecruiter] = useState<any | null>(null);
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [leadsSentBeforeTeaser, setLeadsSentBeforeTeaser] = useState<number>(5);
  const [isUpdatingLeadsSent, setIsUpdatingLeadsSent] = useState(false);
  const [teaserThreshold, setTeaserThreshold] = useState<number>(5);
  const [isUpdatingTeaser, setIsUpdatingTeaser] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number>(50);
  const [isUpdatingDailyLimit, setIsUpdatingDailyLimit] = useState(false);
  const itemsPerPage = 15;

  const fetchRecruiters = async (silent = false, customQuery?: string) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const q = customQuery !== undefined ? customQuery : searchQuery;
      const res = await sendMessage({ 
        type: 'SUPABASE_GET_RECRUITERS',
        payload: { query: q.trim() }
      });
      if (res && res.error) {
        setError(res.error);
      } else if (res && Array.isArray(res.data)) {
        setRecruiters(res.data);
      } else if (Array.isArray(res)) {
        setRecruiters(res);
      } else {
        setRecruiters([]);
      }
    } catch (e: any) {
      setError(e.message || 'Error fetching recruiters');
    } finally {
      setLoading(false);
    }
  };

  const updateAllStatus = async () => {
    setIsUpdating(true);
    setError(null);
    try {
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_ALL_RECRUITERS_STATUS',
        payload: { status: 'Active' }
      });
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
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_ALL_RECRUITERS_LEADS_SENT',
        payload: { leadsSent: leadsSentBeforeTeaser }
      });
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
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_ALL_RECRUITERS_TEASER_THRESHOLD',
        payload: { threshold: teaserThreshold }
      });
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

  const updateAllDailyLimitValues = async () => {
    setIsUpdatingDailyLimit(true);
    setError(null);
    try {
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_ALL_RECRUITERS_DAILY_LIMIT',
        payload: { limit: dailyLimit }
      });
      if (res && res.error) {
        setError(res.error);
      } else {
        await fetchRecruiters();
      }
    } catch (e: any) {
      setError(e.message || 'Error updating daily limit values');
    } finally {
      setIsUpdatingDailyLimit(false);
    }
  };

  const handleRowClick = (recruiter: any) => {
    setSelectedRecruiter(recruiter);
    setEditFormData({ ...recruiter });
  };

  const handleInputChange = (field: string, value: string) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!selectedRecruiter) return;
    setIsSaving(true);
    setError(null);
    try {
      const originalName = selectedRecruiter['Name'] || selectedRecruiter['Agency Name'];
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_RECRUITER',
        payload: { originalName, updates: editFormData }
      });
      if (res && res.error) {
        setError(res.error);
      } else {
        await fetchRecruiters(true);
        setSelectedRecruiter(null);
      }
    } catch (e: any) {
      setError(e.message || 'Error updating recruiter');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchRecruiters(false, searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Using server-side search now
  const filteredRecruiters = recruiters;

  const totalPages = Math.ceil(filteredRecruiters.length / itemsPerPage) || 1;
  const paginatedRecruiters = filteredRecruiters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white border-b border-gray-100 px-8 py-6 flex items-center justify-between z-20 shadow-sm relative">
        <div className="flex items-center gap-4">
          <div className="bg-sky-50 p-2.5 rounded-xl text-sky-600 shadow-sm border border-sky-100/50">
            <UsersIcon />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">Leads Management</h1>
            <p className="text-xs text-gray-500 mt-1">Manage recruitment leads and contacts stored in Supabase.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={updateAllStatus}
            disabled={isUpdating || loading || recruiters.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 hover:shadow-md disabled:opacity-50 text-xs font-medium transition-all duration-200 shadow-sm"
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
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:shadow-sm disabled:opacity-50 text-xs font-medium transition-all duration-200"
          >
            <div className={loading ? 'animate-spin' : ''}>
              <RefreshIcon />
            </div>
            Refresh
          </button>
        </div>
      </div>

      {/* Bulk Config Bar */}
      <div className="bg-slate-50 border-b border-gray-100 px-8 py-3 flex items-center gap-6 z-10 overflow-x-auto">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap">Bulk Update Configurations</span>
        
        <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <label className="text-xs font-medium text-gray-700 px-3 whitespace-nowrap">Leads Sent (Pre-teaser):</label>
          <input
            type="number"
            min="0"
            value={leadsSentBeforeTeaser}
            onChange={(e) => setLeadsSentBeforeTeaser(Number(e.target.value))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
          />
          <button
            onClick={updateAllLeadsSentValues}
            disabled={isUpdatingLeadsSent || loading || recruiters.length === 0}
            className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100 disabled:opacity-50 text-xs font-semibold transition-colors"
          >
            {isUpdatingLeadsSent ? (
              <div className="w-3 h-3 border-2 border-sky-700 border-t-transparent rounded-full animate-spin"></div>
            ) : 'Apply'}
          </button>
        </div>

        <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <label className="text-xs font-medium text-gray-700 px-3 whitespace-nowrap">Teaser Threshold:</label>
          <input
            type="number"
            min="0"
            value={teaserThreshold}
            onChange={(e) => setTeaserThreshold(Number(e.target.value))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
          />
          <button
            onClick={updateAllTeaserThresholdValues}
            disabled={isUpdatingTeaser || loading || recruiters.length === 0}
            className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100 disabled:opacity-50 text-xs font-semibold transition-colors"
          >
            {isUpdatingTeaser ? (
              <div className="w-3 h-3 border-2 border-sky-700 border-t-transparent rounded-full animate-spin"></div>
            ) : 'Apply'}
          </button>
        </div>

        <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
          <label className="text-xs font-medium text-gray-700 px-3 whitespace-nowrap">Daily Limit:</label>
          <input
            type="number"
            min="0"
            value={dailyLimit}
            onChange={(e) => setDailyLimit(Number(e.target.value))}
            className="w-16 px-2 py-1 border border-gray-300 rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500"
          />
          <button
            onClick={updateAllDailyLimitValues}
            disabled={isUpdatingDailyLimit || loading || recruiters.length === 0}
            className="ml-2 flex items-center gap-1.5 px-3 py-1 bg-sky-50 text-sky-700 rounded-md hover:bg-sky-100 disabled:opacity-50 text-xs font-semibold transition-colors"
          >
            {isUpdatingDailyLimit ? (
              <div className="w-3 h-3 border-2 border-sky-700 border-t-transparent rounded-full animate-spin"></div>
            ) : 'Apply'}
          </button>
        </div>
      </div>

      <div className="px-8 py-5 bg-white/80 backdrop-blur-md border-b border-gray-100 z-10 sticky top-0 shadow-sm">
        <div className="relative w-full max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <SearchIcon />
          </div>
          <input
            type="text"
            className="block w-full pl-11 pr-4 py-2 border border-gray-200 rounded-lg leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 text-xs font-normal transition-all duration-200 ease-in-out shadow-inner"
            placeholder="Search agencies, domains, or locations..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Table Area */}
        <div className="flex-1 overflow-auto p-8 transition-all duration-300">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex gap-3 text-red-800">
              <AlertTriangleIcon />
              <div>
                <h3 className="font-semibold text-sm">Failed to load recruiters</h3>
                <p className="text-sm mt-1 opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div className="w-full bg-white border border-gray-100 rounded-xl shadow-md overflow-hidden ring-1 ring-black ring-opacity-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-100">
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Domain</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Country</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Size</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Industry</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Specialty</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">LinkedIn</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Teaser Threshold</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Leads Sent (pre-teaser)</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Daily Limit</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Suspension End Date</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Leads (7d)</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Leads (30d)</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Total Leads</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Most Recent Lead</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Associated Contacts</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading && recruiters.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-6 h-6 border-2 border-sky-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                          <p className="text-sm">Loading recruiters...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredRecruiters.length === 0 && !error ? (
                    <tr>
                      <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                        <p className="text-sm">No agencies found matching your search.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedRecruiters.map((r, i) => (
                      <tr 
                        key={i} 
                        className={`hover:bg-slate-50 transition-colors duration-150 cursor-pointer border-l-2 ${
                          selectedRecruiter && (selectedRecruiter['Name'] || selectedRecruiter['Agency Name']) === (r['Name'] || r['Agency Name']) 
                            ? 'bg-sky-50 border-sky-400' 
                            : 'border-transparent'
                        }`}
                        onClick={() => handleRowClick(r)}
                      >
                        <td className="px-3 py-2 text-xs text-gray-900 font-normal whitespace-nowrap">
                          {r['Name'] || r['Agency Name'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Domain'] ? (
                            <a href={r['Domain'].startsWith('http') ? r['Domain'] : `https://${r['Domain']}`} target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {r['Domain']}
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Country'] || ''}>
                          {r['Country'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Location'] || ''}>
                          {r['Location'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Size'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Industry vertical'] || ''}>
                          {r['Industry vertical'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Primary Specialty'] || ''}>
                          {r['Primary Specialty'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['LinkedIn URL'] ? (
                            <a href={r['LinkedIn URL']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              LinkedIn
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Teaser Threshold'] != null ? r['Teaser Threshold'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Leads Sent before Teaser Mode'] != null ? r['Leads Sent before Teaser Mode'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Daily Sending Limit'] != null ? r['Daily Sending Limit'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['suspension end date'] || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Number of leads sent in the last 7 days'] != null ? r['Number of leads sent in the last 7 days'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Number of leads sent in the last 30 days'] != null ? r['Number of leads sent in the last 30 days'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Total leads sent'] != null ? r['Total leads sent'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Date of the most recent lead'] ? new Date(r['Date of the most recent lead']).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r['Associated contacts'] != null ? r['Associated contacts'] : 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                          {r.status ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium shadow-sm border ${
                              r.status.toLowerCase() === 'active' ? 'bg-green-50 text-green-700 border-green-200' :
                              r.status.toLowerCase() === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-slate-50 text-slate-700 border-slate-200'
                            }`}>
                              {r.status}
                            </span>
                          ) : 'N/A'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="w-full mt-4 flex items-center justify-between bg-white px-4 py-3 border border-gray-200 rounded-lg sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredRecruiters.length)}</span> of{' '}
                    <span className="font-medium">{filteredRecruiters.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-3 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-3 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Panel for Editing (Fixed Modal Overlay) */}
        {selectedRecruiter && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div 
              className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
              onClick={() => setSelectedRecruiter(null)}
            ></div>
            <div className="relative w-[400px] max-w-full bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300 border-l border-gray-200">
              <div className="flex items-center justify-between px-8 py-5 border-b border-gray-100 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-800 truncate pr-4">
                  Edit {selectedRecruiter['Name'] || selectedRecruiter['Agency Name'] || 'Recruiter'}
                </h2>
                <button 
                  onClick={() => setSelectedRecruiter(null)}
                  className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-full hover:bg-white hover:shadow-sm"
                >
                  <CloseIcon />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {ALL_FIELDS.map(field => (
                  <div key={field}>
                    <label className="block text-[13px] font-semibold text-slate-700 mb-1.5 capitalize tracking-wide">
                      {field}
                    </label>
                    {field === 'status' ? (
                      <select
                        value={editFormData[field] || ''}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all shadow-sm"
                      >
                        <option value="">Select status...</option>
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Suspended">Suspended</option>
                        <option value="Blacklisted">Blacklisted</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={editFormData[field] === null || editFormData[field] === undefined ? '' : editFormData[field]}
                        onChange={(e) => handleInputChange(field, e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all shadow-sm"
                        placeholder={`Enter ${field}...`}
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex gap-3 justify-end z-10">
                <button
                  onClick={() => setSelectedRecruiter(null)}
                  className="px-5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-gray-200 rounded-lg hover:bg-slate-50 transition-all shadow-sm"
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 text-white rounded-lg hover:bg-sky-700 hover:shadow-md transition-all text-xs font-medium disabled:opacity-50 shadow-sm"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : null}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
