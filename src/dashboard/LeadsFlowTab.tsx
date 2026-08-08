import React, { useState, useEffect } from 'react';
import { supabaseClient, SupabaseJob } from '../shared/supabase';

interface LeadsFlowTabProps {
  sendMessage: <T>(message: any) => Promise<T>;
}

interface MatchedRecruiter {
  recruiter: any;
  jobs: SupabaseJob[];
}

export default function LeadsFlowTab({ sendMessage }: LeadsFlowTabProps) {
  const [loading, setLoading] = useState(true);
  const [groupedMatches, setGroupedMatches] = useState<MatchedRecruiter[]>([]);
  const [selectedRecruiter, setSelectedRecruiter] = useState<MatchedRecruiter | null>(null);
  
  // State for expanded job in the right pane
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  
  // State for email drafts: mapping jobId -> drafted email text
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      // 1. Fetch categorized jobs
      const jobsRes = await supabaseClient.getCategorizedJobs();
      if (jobsRes.error) throw new Error(jobsRes.error);
      const jobs = jobsRes.data || [];

      // 2. Fetch recruiters via bridge message (or direct Supabase client call)
      const recruitersRes = await sendMessage<any>({ type: 'SUPABASE_GET_RECRUITERS' });
      const recruiters = Array.isArray(recruitersRes) ? recruitersRes : (recruitersRes?.data || []);

      // 3. Match them and group by Recruiter
      const grouped = new Map<string, MatchedRecruiter>();

      recruiters.forEach((rec: any) => {
        const recCat = rec['Primary Specialty']?.trim().toLowerCase();
        const recInd = rec['Industry vertical']?.trim().toLowerCase();
        
        if (!recCat || !recInd) return;

        const matchedJobs = jobs.filter(job => {
          const cat = job.category?.trim().toLowerCase();
          const ind = job['industry vertical']?.trim().toLowerCase();
          return cat === recCat && ind === recInd;
        });

        if (matchedJobs.length > 0) {
          const key = rec.id || rec['Agency Name'] || rec['Name'] || Math.random().toString();
          grouped.set(key, { recruiter: rec, jobs: matchedJobs });
        }
      });

      setGroupedMatches(Array.from(grouped.values()));
    } catch (err) {
      console.error('Error fetching matches:', err);
      alert('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const generateTemplateForJob = (job: SupabaseJob, recruiter: any) => {
    const recName = recruiter['Name'] ? recruiter['Name'].split(' ')[0] : 'there';
    
    return `Hi ${recName},

I noticed you specialize in ${recruiter['Primary Specialty']} roles within the ${recruiter['Industry vertical']} sector.

We recently came across a new opening for a ${job.title} position at ${job.company} based in ${job.location || 'a remote/flexible location'}.

Here is the link to the original posting:
${job.url}

Let me know if you have any candidates that might be a fit for this, or if you'd like to partner up!

Best,
The RecruitScout Team`;
  };

  const handleGenerateAllDrafts = () => {
    if (!selectedRecruiter) return;
    
    const newDrafts = { ...drafts };
    selectedRecruiter.jobs.forEach(job => {
      newDrafts[job.id] = generateTemplateForJob(job, selectedRecruiter.recruiter);
    });
    
    setDrafts(newDrafts);
    
    // Automatically expand the first job if none is expanded
    if (!expandedJobId && selectedRecruiter.jobs.length > 0) {
      setExpandedJobId(selectedRecruiter.jobs[0].id);
    }
  };

  const updateDraft = (jobId: string, text: string) => {
    setDrafts(prev => ({
      ...prev,
      [jobId]: text
    }));
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      
      {/* LEFT PANE: Recruiters List */}
      <div className="w-1/3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 uppercase tracking-widest text-xs">Matched Recruiters ({groupedMatches.length})</h3>
          <button 
            onClick={fetchMatches}
            className="text-gray-500 hover:text-gray-900 text-xs flex items-center gap-1"
          >
            ↻ Refresh
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading matches...</div>
          ) : groupedMatches.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm italic">
              No matching recruiters found.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {groupedMatches.map((group, i) => (
                <div 
                  key={i} 
                  onClick={() => {
                    setSelectedRecruiter(group);
                    setExpandedJobId(null); // reset expansion when switching recruiters
                  }}
                  className={`p-4 cursor-pointer hover:bg-purple-50 transition-colors ${selectedRecruiter === group ? 'bg-purple-50 border-l-4 border-purple-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold shrink-0">
                      {(group.recruiter['Name'] || group.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                    </div>
                    <div className="overflow-hidden">
                      <div className="font-medium text-sm text-gray-900 truncate">
                        {group.recruiter['Name'] || 'Unknown Name'}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{group.recruiter['Agency Name']}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex justify-between items-center text-xs">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded">
                      {group.jobs.length} Job Match{group.jobs.length !== 1 ? 'es' : ''}
                    </span>
                    <span className="text-gray-400 block text-[10px] uppercase truncate ml-2">
                      {group.recruiter['Primary Specialty']}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Matched Jobs & Drafts */}
      <div className="w-2/3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {selectedRecruiter ? (
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name']}
                </h2>
                <p className="text-sm text-gray-600">
                  {selectedRecruiter.jobs.length} matched open roles based on Specialty: <strong>{selectedRecruiter.recruiter['Primary Specialty']}</strong>
                </p>
              </div>
              
              <button
                onClick={handleGenerateAllDrafts}
                className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-all shadow-sm flex items-center gap-2"
              >
                <span>📝</span> Generate Drafts for All Jobs
              </button>
            </div>
            
            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 p-5 space-y-4">
              {selectedRecruiter.jobs.map((job) => {
                const isExpanded = expandedJobId === job.id;
                const draftText = drafts[job.id];
                
                return (
                  <div key={job.id} className="bg-white rounded-md border border-gray-200 shadow-sm overflow-hidden">
                    
                    {/* Job Header (Click to expand) */}
                    <div 
                      className="p-4 cursor-pointer hover:bg-gray-50 flex justify-between items-center transition-colors"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                    >
                      <div>
                        <div className="font-semibold text-gray-900">{job.title}</div>
                        <div className="text-sm text-gray-500">{job.company} • {job.location || 'Remote'}</div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {draftText && !isExpanded && (
                          <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">
                            Draft Ready
                          </span>
                        )}
                        <svg 
                          xmlns="http://www.w3.org/2000/svg" 
                          width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </div>
                    </div>

                    {/* Job Details & Draft (Expanded) */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-white grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Left side: Job details */}
                        <div>
                          <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-2">Job Description</h4>
                          <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-100 max-h-64 overflow-y-auto whitespace-pre-wrap">
                            {job.description ? (
                              job.description.length > 500 
                                ? job.description.substring(0, 500) + '...'
                                : job.description
                            ) : 'No description available.'}
                          </div>
                          <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-3 inline-block">
                            View original job posting ↗
                          </a>
                        </div>
                        
                        {/* Right side: Email Template */}
                        <div className="flex flex-col h-full">
                          <div className="flex justify-between items-end mb-2">
                            <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest">Email Draft</h4>
                            
                            {!draftText && (
                              <button 
                                onClick={() => {
                                  updateDraft(job.id, generateTemplateForJob(job, selectedRecruiter.recruiter));
                                }}
                                className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                              >
                                Generate for this job only
                              </button>
                            )}
                          </div>
                          
                          {draftText ? (
                            <div className="relative flex-1 flex flex-col">
                              <textarea 
                                value={draftText}
                                onChange={(e) => updateDraft(job.id, e.target.value)}
                                className="flex-1 w-full min-h-[250px] bg-white border border-gray-300 rounded-md p-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-inner resize-none leading-relaxed"
                              />
                              <button 
                                onClick={() => navigator.clipboard.writeText(draftText)}
                                className="absolute top-2 right-2 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                                title="Copy to clipboard"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-h-[250px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md bg-gray-50">
                              <p className="text-sm text-gray-400 italic text-center px-6">
                                Draft not generated yet.<br/>
                                Click "Generate Drafts for All Jobs" above.
                              </p>
                            </div>
                          )}
                        </div>
                        
                      </div>
                    )}

                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-purple-50 text-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Recruiter</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">
              Click on a recruiter from the left pane to view all of their matched jobs and generate tailored outreach emails instantly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
