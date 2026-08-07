import React, { useState, useEffect } from 'react';
import { supabaseClient, SupabaseJob } from '../shared/supabase';
import OpenAI from 'openai';

interface LeadsFlowTabProps {
  sendMessage: <T>(message: any) => Promise<T>;
}

interface Match {
  job: SupabaseJob;
  recruiter: any;
}

export default function LeadsFlowTab({ sendMessage }: LeadsFlowTabProps) {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  
  const [drafting, setDrafting] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<string>('');

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

      // 3. Match them
      const newMatches: Match[] = [];
      jobs.forEach(job => {
        const cat = job.category?.trim().toLowerCase();
        const ind = job['industry vertical']?.trim().toLowerCase();
        
        if (!cat || !ind) return;

        recruiters.forEach((rec: any) => {
          const recCat = rec['Primary Specialty']?.trim().toLowerCase();
          const recInd = rec['Industry vertical']?.trim().toLowerCase();

          if (cat === recCat && ind === recInd) {
            newMatches.push({ job, recruiter: rec });
          }
        });
      });

      setMatches(newMatches);
    } catch (err) {
      console.error('Error fetching matches:', err);
      alert('Failed to load matches: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleDraftEmail = async () => {
    if (!selectedMatch) return;
    setDrafting(true);
    setDraftedEmail('');

    try {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error('VITE_OPENAI_API_KEY is not defined in environment variables.');
      }

      const openai = new OpenAI({
        apiKey,
        dangerouslyAllowBrowser: true
      });

      const prompt = `You are an expert partnership manager at RecruitScout. 
Your goal is to reach out to a specialized recruiter and pitch them an open job that perfectly matches their specialty.

Recruiter Details:
- Name: ${selectedMatch.recruiter['Name'] || 'Recruiter'}
- Agency: ${selectedMatch.recruiter['Agency Name'] || 'their agency'}
- Primary Specialty: ${selectedMatch.recruiter['Primary Specialty']}
- Industry Vertical: ${selectedMatch.recruiter['Industry vertical']}

Job Details:
- Title: ${selectedMatch.job.title}
- Company: ${selectedMatch.job.company}
- Location: ${selectedMatch.job.location || 'Remote/Unspecified'}
- Job Link: ${selectedMatch.job.url}

Draft a highly personalized, concise cold email to the recruiter. The goal is to ask if they have candidates for this role or if they'd like to partner with us to fill it. 
Keep it professional, friendly, and under 150 words. Do not include placeholders like "[Your Name]", just end with "The RecruitScout Team".`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
      });

      const text = completion.choices[0]?.message?.content || 'No content generated.';
      setDraftedEmail(text.trim());
    } catch (err) {
      console.error('Error drafting email:', err);
      alert('Failed to draft email: ' + (err as Error).message);
    } finally {
      setDrafting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6">
      
      {/* LEFT PANE: Matches List */}
      <div className="w-1/3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <h3 className="font-bold text-gray-700 uppercase tracking-widest text-xs">Matches ({matches.length})</h3>
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
          ) : matches.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm italic">
              No matching jobs and recruiters found. 
              <br/><br/>Make sure you have categorized jobs and recruiters with matching specialties.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {matches.map((match, i) => (
                <div 
                  key={i} 
                  onClick={() => setSelectedMatch(match)}
                  className={`p-4 cursor-pointer hover:bg-blue-50 transition-colors ${selectedMatch === match ? 'bg-blue-50 border-l-4 border-blue-500' : 'border-l-4 border-transparent'}`}
                >
                  <div className="font-medium text-sm text-gray-900 truncate">{match.job.title}</div>
                  <div className="text-xs text-gray-500 mb-2 truncate">{match.job.company}</div>
                  
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100 border-dashed">
                    <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(match.recruiter['Name'] || match.recruiter['Agency Name'] || '?')[0].toUpperCase()}
                    </div>
                    <div className="text-xs font-medium text-gray-700 truncate">
                      {match.recruiter['Name'] || match.recruiter['Agency Name']}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Details & AI Draft */}
      <div className="w-2/3 bg-white rounded-md border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        {selectedMatch ? (
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="p-5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xl font-bold text-gray-900">{selectedMatch.job.title}</h2>
              <p className="text-sm text-gray-600">{selectedMatch.job.company} • {selectedMatch.job.location || 'Remote'}</p>
              
              <div className="flex gap-2 mt-3">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 text-[11px] font-semibold rounded border border-blue-200 uppercase tracking-wide">
                  {selectedMatch.job.category}
                </span>
                <span className="px-2 py-1 bg-amber-100 text-amber-700 text-[11px] font-semibold rounded border border-amber-200 uppercase tracking-wide">
                  {selectedMatch.job['industry vertical']}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Job Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Job Details</h4>
                  <div className="text-sm text-gray-800 bg-gray-50 p-3 rounded border border-gray-100 max-h-48 overflow-y-auto whitespace-pre-wrap">
                    {selectedMatch.job.description ? (
                      selectedMatch.job.description.length > 300 
                        ? selectedMatch.job.description.substring(0, 300) + '...'
                        : selectedMatch.job.description
                    ) : 'No description available.'}
                  </div>
                  <a href={selectedMatch.job.url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
                    View original job posting ↗
                  </a>
                </div>
              </div>

              {/* Recruiter Info */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-1">Matched Recruiter</h4>
                  <div className="bg-purple-50 p-4 rounded border border-purple-100">
                    <div className="font-semibold text-gray-900">{selectedMatch.recruiter['Name'] || 'Unknown Name'}</div>
                    <div className="text-sm text-purple-700 font-medium">{selectedMatch.recruiter['Agency Name']}</div>
                    
                    <div className="mt-3 text-xs text-gray-600 grid grid-cols-2 gap-y-2">
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Specialty</span>
                        {selectedMatch.recruiter['Primary Specialty']}
                      </div>
                      <div>
                        <span className="text-gray-400 block text-[10px] uppercase">Vertical</span>
                        {selectedMatch.recruiter['Industry vertical']}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* AI Drafting Section */}
            <div className="border-t border-gray-200 p-5 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <span>✨</span> AI Outreach Pitch
                </h4>
                <button
                  onClick={handleDraftEmail}
                  disabled={drafting}
                  className="bg-gray-900 hover:bg-gray-800 text-white px-4 py-2 rounded-md text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                >
                  {drafting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      Drafting...
                    </>
                  ) : 'Draft Email'}
                </button>
              </div>
              
              {draftedEmail && (
                <div className="relative">
                  <textarea 
                    value={draftedEmail}
                    onChange={(e) => setDraftedEmail(e.target.value)}
                    className="w-full h-48 bg-white border border-gray-300 rounded-md p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 shadow-inner resize-none leading-relaxed"
                  />
                  <button 
                    onClick={() => navigator.clipboard.writeText(draftedEmail)}
                    className="absolute top-3 right-3 p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                    title="Copy to clipboard"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  </button>
                </div>
              )}
              
              {!draftedEmail && !drafting && (
                <div className="h-32 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-md bg-white">
                  <p className="text-sm text-gray-500 italic">Click "Draft Email" to generate a personalized pitch.</p>
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Select a Match</h2>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">
              Click on any matched pair from the left list to view job details, recruiter profile, and draft a personalized outreach email using AI.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
