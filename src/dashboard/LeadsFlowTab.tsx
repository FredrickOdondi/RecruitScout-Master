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
    let recName = recruiter['Name'] ? recruiter['Name'].split(' ')[0] : '';
    if (!recName && recruiter['Agency Name']) recName = 'team at ' + recruiter['Agency Name'];
    if (!recName) recName = 'there';

    const salutations = ["Hi", "Hello", "Hey", "Greetings"];
    const salutation = salutations[Math.floor(Math.random() * salutations.length)];
    
    const introOptions = [
      `I noticed you specialize in ${recruiter['Primary Specialty']} roles within the ${recruiter['Industry vertical']} sector.`,
      `Given your expertise in the ${recruiter['Industry vertical']} sector, specifically for ${recruiter['Primary Specialty']} roles, I thought I'd reach out.`,
      `We see that you focus on ${recruiter['Primary Specialty']} placements in the ${recruiter['Industry vertical']} industry.`,
      `Your background in recruiting for ${recruiter['Primary Specialty']} within ${recruiter['Industry vertical']} caught our eye.`
    ];
    const intro = introOptions[Math.floor(Math.random() * introOptions.length)];

    const roleOptions = [
      `We recently came across a new opening for a ${job.title} position at ${job.company} based in ${job.location || 'a remote/flexible location'}.`,
      `There is an exciting ${job.title} opportunity currently open at ${job.company} (${job.location || 'Remote'}).`,
      `${job.company} is currently looking for a ${job.title} in ${job.location || 'a remote setup'}.`,
      `I'm writing to share a ${job.title} role at ${job.company} (${job.location || 'Remote'}) that just opened up.`
    ];
    const roleText = roleOptions[Math.floor(Math.random() * roleOptions.length)];

    return `${salutation} ${recName === 'there' ? 'there' : recName},

${intro}

${roleText}

Here is the link to the original posting:
${job.url}

Let me know if you have any candidates that might be a fit for this, or if you'd like to partner up!

Best,
The RecruitScout Team`;
  };

  const getDraftKey = (recruiter: any, jobId: string) => {
    const recId = recruiter.id || recruiter['Agency Name'] || recruiter['Name'] || 'unknown';
    return `${recId}_${jobId}`;
  };

  const handleGenerateAllDrafts = () => {
    if (!selectedRecruiter) return;
    
    const newDrafts = { ...drafts };
    selectedRecruiter.jobs.forEach(job => {
      const key = getDraftKey(selectedRecruiter.recruiter, job.id);
      newDrafts[key] = generateTemplateForJob(job, selectedRecruiter.recruiter);
    });
    
    setDrafts(newDrafts);
    
    if (!expandedJobId && selectedRecruiter.jobs.length > 0) {
      setExpandedJobId(selectedRecruiter.jobs[0].id);
    }
  };

  const updateDraft = (jobId: string, text: string) => {
    if (!selectedRecruiter) return;
    const key = getDraftKey(selectedRecruiter.recruiter, jobId);
    setDrafts(prev => ({
      ...prev,
      [key]: text
    }));
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6 bg-[#F8FAFC] p-4 text-slate-800 font-sans">
      
      {/* LEFT PANE: Recruiters List */}
      <div className="w-[380px] bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex justify-between items-center z-10 sticky top-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-sm tracking-wide">MATCHED RECRUITERS</h3>
            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-medium">{groupedMatches.length}</span>
          </div>
          <button 
            onClick={fetchMatches}
            className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 rounded-md hover:bg-indigo-50"
            title="Refresh Matches"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
          </button>
        </div>
        
        {/* Recruiter List */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {loading ? (
            <div className="p-10 flex justify-center items-center h-full">
              <div className="w-8 h-8 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
            </div>
          ) : groupedMatches.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">
              No matching recruiters found.
            </div>
          ) : (
            <div className="flex flex-col gap-2 p-3">
              {groupedMatches.map((group, i) => {
                const isSelected = selectedRecruiter === group;
                return (
                  <div 
                    key={i} 
                    onClick={() => {
                      setSelectedRecruiter(group);
                      setExpandedJobId(null);
                    }}
                    className={`p-4 cursor-pointer rounded-lg border transition-all duration-200 flex flex-col gap-3 relative overflow-hidden group
                      ${isSelected 
                        ? 'bg-indigo-50/80 border-indigo-200 shadow-[0_2px_10px_-3px_rgba(99,102,241,0.15)]' 
                        : 'bg-white border-slate-200 hover:border-indigo-200 hover:shadow-sm'
                      }`}
                  >
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-l-lg"></div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0
                        ${isSelected ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'bg-slate-100 text-slate-600'}`}>
                        {(group.recruiter['Name'] || group.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0 pt-0.5">
                        <div className={`text-[15px] font-semibold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                          {group.recruiter['Name'] || 'Unknown Name'}
                        </div>
                        <div className="text-xs text-slate-500 truncate mt-0.5">
                          {group.recruiter['Agency Name']}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100/80">
                      <div className="flex items-center gap-1.5">
                        <div className={`flex items-center justify-center text-[10px] font-bold px-2 py-0.5 rounded
                          ${isSelected ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {group.jobs.length} Job{group.jobs.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div className="text-[11px] font-medium text-slate-400 uppercase truncate max-w-[140px]" title={group.recruiter['Primary Specialty']}>
                        {group.recruiter['Primary Specialty']}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Matched Jobs & Drafts */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden relative">
        {selectedRecruiter ? (
          <div className="flex flex-col h-full bg-slate-50/30">
            
            {/* Header */}
            <div className="px-8 py-6 border-b border-slate-200 bg-white flex justify-between items-center shadow-[0_4px_20px_-15px_rgba(0,0,0,0.05)] z-10">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                  {selectedRecruiter.recruiter['Name'] || selectedRecruiter.recruiter['Agency Name']}
                </h2>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  <p className="text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">{selectedRecruiter.jobs.length}</span> matched open roles based on <span className="font-medium text-slate-800 px-1.5 py-0.5 bg-slate-100 rounded">{selectedRecruiter.recruiter['Primary Specialty']}</span>
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleGenerateAllDrafts}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-[0_4px_12px_-4px_rgba(79,70,229,0.5)] hover:shadow-[0_6px_16px_-4px_rgba(79,70,229,0.6)] hover:-translate-y-0.5 flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                Generate Drafts For All
              </button>
            </div>
            
            {/* Jobs List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {selectedRecruiter.jobs.map((job) => {
                const isExpanded = expandedJobId === job.id;
                const draftKey = getDraftKey(selectedRecruiter.recruiter, job.id);
                const draftText = drafts[draftKey];
                
                return (
                  <div key={job.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 hover:border-slate-300">
                    
                    {/* Job Header (Click to expand) */}
                    <div 
                      className={`p-5 cursor-pointer flex justify-between items-center transition-colors ${isExpanded ? 'bg-slate-50/80 border-b border-slate-100' : 'hover:bg-slate-50'}`}
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                    >
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="text-lg font-bold text-slate-800 truncate mb-1">{job.title}</div>
                        <div className="text-sm font-medium text-slate-500 flex items-center gap-2">
                          <span className="text-slate-700">{job.company}</span>
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          <span>{job.location || 'Remote'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        {draftText && !isExpanded && (
                          <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-3 py-1 rounded border border-emerald-200">
                            Draft Ready
                          </span>
                        )}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-slate-200 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </div>
                      </div>
                    </div>

                    {/* Job Details & Draft (Expanded) */}
                    {isExpanded && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                        
                        {/* Left side: Job details */}
                        <div className="p-6 bg-white">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Job Description</h4>
                            <a href={job.url} target="_blank" rel="noreferrer" className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded">
                              Original Posting
                              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </a>
                          </div>
                          
                          <div className="text-[13px] text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-72 overflow-y-auto whitespace-pre-wrap font-medium">
                            {job.description ? (
                              job.description.length > 500 
                                ? job.description.substring(0, 500) + '...'
                                : job.description
                            ) : 'No description available.'}
                          </div>
                        </div>
                        
                        {/* Right side: Email Template */}
                        <div className="p-6 flex flex-col h-full bg-slate-50/50">
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email Draft</h4>
                            
                            {!draftText && (
                              <button 
                                onClick={() => {
                                  updateDraft(job.id, generateTemplateForJob(job, selectedRecruiter.recruiter));
                                }}
                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                              >
                                Generate For This Job
                              </button>
                            )}
                          </div>
                          
                          {draftText ? (
                            <div className="relative flex-1 flex flex-col group/textarea">
                              <textarea 
                                value={draftText}
                                onChange={(e) => updateDraft(job.id, e.target.value)}
                                className="flex-1 w-full min-h-[250px] bg-white border border-slate-200 rounded-lg p-4 text-[13px] text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-inner resize-none leading-relaxed transition-all"
                              />
                              <button 
                                onClick={() => navigator.clipboard.writeText(draftText)}
                                className="absolute top-2 right-2 p-2 bg-white shadow hover:shadow-md text-slate-500 hover:text-indigo-600 rounded-md transition-all border border-slate-200"
                                title="Copy to clipboard"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex-1 min-h-[250px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-lg bg-white">
                              <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-full flex items-center justify-center mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                              </div>
                              <p className="text-sm font-medium text-slate-500 text-center px-6">
                                Draft not generated yet.
                              </p>
                              <button 
                                onClick={() => updateDraft(job.id, generateTemplateForJob(job, selectedRecruiter.recruiter))}
                                className="mt-4 px-4 py-1.5 bg-indigo-50 text-indigo-700 text-xs font-bold rounded-md hover:bg-indigo-100 transition-colors"
                              >
                                Generate Now
                              </button>
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
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center bg-slate-50/50">
            <div className="w-24 h-24 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-300">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">Select a Recruiter</h2>
            <p className="text-slate-500 font-medium max-w-sm mx-auto text-sm leading-relaxed">
              Click on a recruiter from the left pane to view their matched jobs and instantly generate professional outreach emails.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
