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
  const itemsPerPage = 15;

  const fetchRecruiters = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await sendMessage({ type: 'SUPABASE_GET_RECRUITERS' });
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
    fetchRecruiters();
  }, []);

  const filteredRecruiters = recruiters.filter(r => {
    if (!searchQuery) return true;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    
    // Safely cast to string to prevent crashes on numeric/null values
    const name = String(r['Name'] || r['Agency Name'] || '').toLowerCase();
    const domain = String(r['Domain'] || '').toLowerCase();
    
    return name.includes(query) || domain.includes(query);
  });

  const totalPages = Math.ceil(filteredRecruiters.length / itemsPerPage) || 1;
  const paginatedRecruiters = filteredRecruiters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <UsersIcon />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">Leads Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage recruitment leads and contacts stored in Supabase.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={updateAllStatus}
            disabled={isUpdating || loading || recruiters.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors shadow-sm"
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
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 disabled:opacity-50 text-sm font-medium transition-colors"
          >
            <div className={loading ? 'animate-spin' : ''}>
              <RefreshIcon />
            </div>
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 py-4 bg-white border-b border-gray-200 z-10">
        <div className="relative w-full max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            placeholder="Search agencies..."
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
        <div className={`flex-1 overflow-auto p-6 transition-all duration-300 ${selectedRecruiter ? 'pr-2' : ''}`}>
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md flex gap-3 text-red-800">
              <AlertTriangleIcon />
              <div>
                <h3 className="font-semibold text-sm">Failed to load recruiters</h3>
                <p className="text-sm mt-1 opacity-90">{error}</p>
              </div>
            </div>
          )}

          <div className="w-full bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Name</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Domain</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Country</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Size</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Industry</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Specialty</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">LinkedIn</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Teaser Threshold</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Leads Sent (pre-teaser)</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Daily Limit</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Suspension End Date</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Leads (7d)</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Leads (30d)</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Total Leads</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Most Recent Lead</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Associated Contacts</th>
                    <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading && recruiters.length === 0 ? (
                    <tr>
                      <td colSpan={18} className="px-4 py-8 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
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
                        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                          selectedRecruiter && (selectedRecruiter['Name'] || selectedRecruiter['Agency Name']) === (r['Name'] || r['Agency Name']) 
                            ? 'bg-indigo-50/50' 
                            : ''
                        }`}
                        onClick={() => handleRowClick(r)}
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 font-medium whitespace-nowrap">
                          {r['Name'] || r['Agency Name'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Domain'] ? (
                            <a href={r['Domain'].startsWith('http') ? r['Domain'] : `https://${r['Domain']}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              {r['Domain']}
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Country'] || ''}>
                          {r['Country'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Location'] || ''}>
                          {r['Location'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Size'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Industry vertical'] || ''}>
                          {r['Industry vertical'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap truncate max-w-xs" title={r['Primary Specialty'] || ''}>
                          {r['Primary Specialty'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['LinkedIn URL'] ? (
                            <a href={r['LinkedIn URL']} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline" onClick={(e) => e.stopPropagation()}>
                              LinkedIn
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Teaser Threshold'] != null ? r['Teaser Threshold'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Leads Sent before Teaser Mode'] != null ? r['Leads Sent before Teaser Mode'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Daily Sending Limit'] != null ? r['Daily Sending Limit'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['suspension end date'] || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Number of leads sent in the last 7 days'] != null ? r['Number of leads sent in the last 7 days'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Number of leads sent in the last 30 days'] != null ? r['Number of leads sent in the last 30 days'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Total leads sent'] != null ? r['Total leads sent'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Date of the most recent lead'] ? new Date(r['Date of the most recent lead']).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r['Associated contacts'] != null ? r['Associated contacts'] : 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {r.status ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              r.status.toLowerCase() === 'active' ? 'bg-green-100 text-green-800' :
                              r.status.toLowerCase() === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-gray-100 text-gray-800'
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
                  <p className="text-sm text-gray-700">
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

        {/* Side Panel for Editing */}
        {selectedRecruiter && (
          <div className="w-96 bg-white border-l border-gray-200 flex flex-col h-full shadow-lg overflow-hidden animate-in slide-in-from-right duration-300 shrink-0">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-900 truncate pr-4">
                Edit {selectedRecruiter['Name'] || selectedRecruiter['Agency Name'] || 'Recruiter'}
              </h2>
              <button 
                onClick={() => setSelectedRecruiter(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
              >
                <CloseIcon />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {ALL_FIELDS.map(field => (
                <div key={field}>
                  <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                    {field}
                  </label>
                  {field === 'status' ? (
                    <select
                      value={editFormData[field] || ''}
                      onChange={(e) => handleInputChange(field, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={`Enter ${field}...`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex gap-3 justify-end">
              <button
                onClick={() => setSelectedRecruiter(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : null}
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
