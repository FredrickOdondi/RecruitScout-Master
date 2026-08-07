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

interface LeadsManagementTabProps {
  sendMessage: (msg: any) => Promise<any>;
}

export default function LeadsManagementTab({ sendMessage }: LeadsManagementTabProps) {
  const [recruiters, setRecruiters] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedAgency, setSelectedAgency] = useState<string | null>(null);
  const [isUpdatingSingle, setIsUpdatingSingle] = useState(false);
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

  const updateSingleStatus = async (status: string) => {
    if (!selectedAgency) return;
    setIsUpdatingSingle(true);
    setError(null);
    try {
      const res = await sendMessage({ 
        type: 'SUPABASE_UPDATE_RECRUITER_STATUS',
        payload: { agencyName: selectedAgency, status }
      });
      if (res && res.error) {
        setError(res.error);
      } else {
        await fetchRecruiters(true);
        setSelectedAgency(null);
      }
    } catch (e: any) {
      setError(e.message || 'Error updating status');
    } finally {
      setIsUpdatingSingle(false);
    }
  };

  useEffect(() => {
    fetchRecruiters();
  }, []);

  const filteredRecruiters = recruiters.filter(r => {
    if (!searchQuery) return true;
    const name = r['Name'] || r['Agency Name'] || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const totalPages = Math.ceil(filteredRecruiters.length / itemsPerPage) || 1;
  const paginatedRecruiters = filteredRecruiters.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc]">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
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

      <div className="px-6 py-4 bg-white border-b border-gray-200">
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

      <div className="flex-1 overflow-auto p-6">
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
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Location</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Size</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Industry</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Specialty</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">LinkedIn</th>
                  <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading && recruiters.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                        <p className="text-sm">Loading recruiters...</p>
                      </div>
                    </td>
                  </tr>
                ) : filteredRecruiters.length === 0 && !error ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      <p className="text-sm">No agencies found matching your search.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedRecruiters.map((r, i) => (
                    <tr 
                      key={i} 
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedAgency(r['Name'] || r['Agency Name'])}
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

      {/* Status Update Modal */}
      {selectedAgency && (
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Update Status</h3>
            <p className="text-sm text-gray-500 mb-6">Select a new status for <span className="font-semibold text-gray-700">{selectedAgency}</span>.</p>
            
            <div className="flex flex-col gap-3 mb-6">
              <button
                onClick={() => updateSingleStatus('Active')}
                disabled={isUpdatingSingle}
                className="w-full px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-md hover:bg-green-100 font-medium transition-colors"
              >
                Active
              </button>
              <button
                onClick={() => updateSingleStatus('Suspended')}
                disabled={isUpdatingSingle}
                className="w-full px-4 py-2 bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-md hover:bg-yellow-100 font-medium transition-colors"
              >
                Suspended
              </button>
              <button
                onClick={() => updateSingleStatus('Blacklisted')}
                disabled={isUpdatingSingle}
                className="w-full px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-md hover:bg-red-100 font-medium transition-colors"
              >
                Blacklisted
              </button>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setSelectedAgency(null)}
                disabled={isUpdatingSingle}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
