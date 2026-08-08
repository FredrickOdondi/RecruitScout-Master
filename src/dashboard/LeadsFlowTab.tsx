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
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const jobsRes = await supabaseClient.getCategorizedJobs();
      if (jobsRes.error) throw new Error(jobsRes.error);
      const jobs = jobsRes.data || [];

      const recruitersRes = await sendMessage<any>({ type: 'SUPABASE_GET_RECRUITERS' });
      const recruiters = Array.isArray(recruitersRes) ? recruitersRes : (recruitersRes?.data || []);

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
    <div className="flex h-[calc(100vh-100px)] gap-8 font-light text-gray-700 p-2">
      
      {/* LEFT PANE: Recruiters List */}
      <div className="w-1/3 bg-white/70 backdrop-blur-md rounded-2xl border border-gray-100/50 shadow-sm flex flex-col overflow-hidden transition-all">
        <div className="p-6 border-b border-gray-100/50 flex justify-between items-center bg-gradient-to-r from-gray-50/50 to-transparent">
          <h3 className="font-light text-gray-600 tracking-[0.2em] text-xs uppercase">Matched Recruiters <span className="opacity-60 ml-1">({groupedMatches.length})</span></h3>
          <button 
            onClick={fetchMatches}
            className="text-gray-400 hover:text-gray-800 text-xs flex items-center gap-2 transition-colors font-light tracking-wide"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            Refresh
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm font-light tracking-wide flex flex-col items-center gap-4">
              <div className="w-6 h-6 border-[1.5px] border-gray-200 border-t-gray-500 rounded-full animate-spin"></div>
              Loading matches...
            </div>
          ) : groupedMatches.length === 0 ? (
            <div className="p-12 text-center text-gray-400 text-sm italic font-light tracking-wide">
              No matching recruiters found.
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {groupedMatches.map((group, i) => {
                const isSelected = selectedRecruiter === group;
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedRecruiter(group);
                      setExpandedJobId(null);
                    }}
                    className={`p-5 cursor-pointer transition-all duration-300 relative group
                      ${isSelected ? 'bg-gradient-to-r from-blue-50/50 to-transparent' : 'hover:bg-gray-50/50'}`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-300 rounded-r-full"></div>
                    )}
                    
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-extralight shrink-0 transition-colors duration-300
                        ${isSelected ? 'bg-blue-100/50 text-blue-600' : 'bg-gray-100/50 text-gray-500 group-hover:bg-gray-200/50'}`}>
                        {(group.recruiter['Name'] || group.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                      </div>
                      <div className="overflow-hidden flex-1">
                        <div className={`text-base truncate transition-colors duration-300 ${isSelected ? 'text-gray-900 font-normal' : 'text-gray-700 font-light'}`}>
                          {group.recruiter['Name'] || 'Unknown Name'}
                        </div>
                        <div className="text-sm text-gray-400 truncate font-light tracking-wide mt-0.5">{group.recruiter['Agency Name']}</div>
                      </div>
                    </div>
                    
                    <div className="mt-4 flex justify-between items-center text-xs">
                      <span className={`px-3 py-1 rounded-full font-light tracking-wide transition-colors duration-300
                        ${isSelected ? 'bg-blue-100/50 text-blue-600' : 'bg-gray-100/50 text-gray-500'}`}>
                        {group.jobs.length} Job Match{group.jobs.length !== 1 ? 'es' : ''}
                      </span>
                      <span className="text-gray-400 block text-[10px] uppercase tracking-widest truncate ml-3 font-light">
                        {group.recruiter['Primary Specialty']}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Matched Jobs & Drafts */}
      <div className="w-2/3 bg-white/70 backdrop-blur-md rounded-2xl border border-gray-100/50 shadow-sm flex flex-col overflow-hidden">
        {selectedRecruiter ? (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-500">
            
            {/* Header */}
            <div className="p-8 border-b border-gray-100/50 bg-gradient-to-b from-gray-50/50 to-transparent flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-extralight text-gray-800 tracking-tight mb-2">
                  {selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name']}
                </h2>
                <p className="text-sm text-gray-400 font-light tracking-wide flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-300"></span>
                  {selectedRecruiter.jobs.length} matched roles based on <span className="text-gray-600 font-normal">{selectedRecruiter.recruiter['Primary Specialty']}</span>
                </p>
              </div>
              
              <button
                onClick={handleGenerateAllDrafts}
                className="bg-gray-800 hover:bg-gray-900 text-white/90 hover:text-white px-6 py-2.5 rounded-full text-sm font-light tracking-wide transition-all duration-300 shadow-sm flex items-center gap-3 hover:shadow-md active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                Generate Drafts for All
              </button>
            </div>
            
            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
              {selectedRecruiter.jobs.map((job) => {
                const isExpanded = expandedJobId === job.id;
                const draftText = drafts[job.id];
                
                return (
                  <div key={job.id} className="bg-white rounded-xl border border-gray-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden transition-all duration-300 hover:shadow-[0_8px_30px_-4px_rgba(0,0,0,0.05)]">
                    
                    {/* Job Header (Click to expand) */}
                    <div 
                      className="p-5 cursor-pointer flex justify-between items-center transition-colors"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-lg font-light text-gray-800 truncate mb-1">{job.title}</div>
                        <div className="text-sm text-gray-400 font-light tracking-wide truncate">
                          {job.company} <span className="mx-2 opacity-50">•</span> {job.location || 'Remote'}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-5 shrink-0">
                        {draftText && !isExpanded && (
                          <span className="text-xs font-light tracking-wider uppercase text-blue-500 bg-blue-50/50 px-3 py-1 rounded-full border border-blue-100/50">
                            Draft Ready
                          </span>
                        )}
                        <div className={`w-8 h-8 rounded-full border border-gray-100 flex items-center justify-center transition-all duration-300 ${isExpanded ? 'bg-gray-50 rotate-180' : 'text-gray-300'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </div>

                    {/* Job Details & Draft (Expanded) */}
                    <div className={`grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 border-t border-gray-50' : 'max-h-0 opacity-0'}`}>
                      
                        {/* Left side: Job details */}
                        <div className="p-6 border-r border-gray-50">
                          <h4 className="text-[10px] font-light text-gray-400 uppercase tracking-[0.2em] mb-4">Job Description</h4>
                          <div className="text-sm text-gray-600 font-light leading-relaxed bg-gray-50/50 p-5 rounded-xl border border-gray-100/50 max-h-72 overflow-y-auto whitespace-pre-wrap">
                            {job.description ? (
                              job.description.length > 500 
                                ? job.description.substring(0, 500) + '...'
                                : job.description
                            ) : 'No description available.'}
                          </div>
                          <a href={job.url} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-600 transition-colors mt-4 flex items-center gap-1 font-light tracking-wide w-fit">
                            View original posting
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                          </a>
                        </div>
                        
                        {/* Right side: Email Template */}
                        <div className="p-6 flex flex-col h-full bg-gray-50/30">
                          <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-light text-gray-400 uppercase tracking-[0.2em]">Email Draft</h4>
                            
                            {!draftText && (
                              <button 
                                onClick={() => {
                                  updateDraft(job.id, generateTemplateForJob(job, selectedRecruiter.recruiter));
                                }}
                                className="text-xs text-blue-400 hover:text-blue-600 transition-colors font-light tracking-wide"
                              >
                                Generate for this job
                              </button>
                            )}
                          </div>
                          
                          {draftText ? (
                            <div className="relative flex-1 flex flex-col group/textarea">
                              <textarea 
                                value={draftText}
                                onChange={(e) => updateDraft(job.id, e.target.value)}
                                className="flex-1 w-full min-h-[250px] bg-white border border-gray-200/60 rounded-xl p-5 text-sm text-gray-600 font-light focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-blue-200 shadow-inner resize-none leading-relaxed transition-all"
                              />
                              <button 
                                onClick={() => navigator.clipboard.writeText(draftText)}
                                className="absolute top-3 right-3 p-2 bg-white/80 backdrop-blur shadow-sm hover:bg-white text-gray-400 hover:text-gray-700 rounded-lg transition-all opacity-0 group-hover/textarea:opacity-100 border border-gray-100"
                                title="Copy to clipboard"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-h-[250px] flex items-center justify-center border border-dashed border-gray-200 rounded-xl bg-white/50">
                              <p className="text-sm text-gray-300 font-light italic text-center px-6 tracking-wide">
                                Draft not generated yet.<br/>
                                <span className="text-xs mt-2 block opacity-70">Click "Generate Drafts for All" above.</span>
                              </p>
                            </div>
                          )}
                        </div>
                        
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-gray-50/30">
            <div className="w-24 h-24 bg-white shadow-sm border border-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-extralight text-gray-800 mb-3 tracking-tight">Select a Recruiter</h2>
            <p className="text-gray-400 font-light max-w-sm mx-auto text-sm leading-relaxed tracking-wide">
              Click on a recruiter from the left pane to view their matched jobs and instantly generate beautiful outreach emails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
