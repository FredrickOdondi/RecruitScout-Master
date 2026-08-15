import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import { supabaseClient } from '../shared/supabase';
import { EmailLogRecord } from '../shared/types';

// Custom icons inline for independence
const ArrowLeft = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const Building = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path></svg>;
const Globe = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>;
const MapPin = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const Users = () => <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>;
const CloseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>;

interface RecruiterDashboardProps {
  recruiter: any;
  onBack: () => void;
}

export default function RecruiterDashboard({ recruiter, onBack }: RecruiterDashboardProps) {
  const [emailLogs, setEmailLogs] = useState<EmailLogRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [selectedEmailLog, setSelectedEmailLog] = useState<EmailLogRecord | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      if (!recruiter) return;
      setLoadingLogs(true);
      const recId = recruiter.id || recruiter['Name'] || recruiter['Agency Name'] || 'Unknown';
      const res = await supabaseClient.getEmailLogsByRecruiter(recId);
      if (res && res.data) {
        setEmailLogs(res.data);
      }
      setLoadingLogs(false);
    };
    fetchLogs();
  }, [recruiter]);

  if (!recruiter) return null;

  const name = recruiter['Name'] || recruiter['Agency Name'] || 'Unknown Agency';
  const domain = recruiter['Domain'] || 'N/A';
  const location = recruiter['Location'] || recruiter['Country'] || 'N/A';
  const industry = recruiter['Industry vertical'] || 'N/A';
  const associatedContacts = recruiter['Associated contacts'] != null ? recruiter['Associated contacts'] : 'N/A';
  
  // Metrics
  const leads7d = parseInt(recruiter['Number of leads sent in the last 7 days'] || '0', 10);
  const leads30d = parseInt(recruiter['Number of leads sent in the last 30 days'] || '0', 10);
  const leadsTotal = parseInt(recruiter['Total leads sent'] || '0', 10);
  
  const dailyLimit = parseInt(recruiter['Daily Sending Limit'] || '50', 10);
  const teaserThreshold = parseInt(recruiter['Teaser Threshold'] || '5', 10);
  const leadsBeforeTeaser = parseInt(recruiter['Leads Sent before Teaser Mode'] || '0', 10);

  // Chart Data
  // 1. Leads Progression (Fake timeline based on 7d, 30d, Total)
  const progressionData = [
    { name: 'Last 7 Days', leads: leads7d },
    { name: 'Last 30 Days', leads: leads30d },
    { name: 'Total All Time', leads: leadsTotal }
  ];

  // 2. Capacity vs Limit
  const dailyData = [
    { name: 'Current Output', sent: Math.round(leads30d / 30), limit: dailyLimit }
  ];

  // 3. Teaser Status
  const teaserData = [
    { name: 'Leads Sent', value: leadsBeforeTeaser, color: '#0284c7' }, // sky-600
    { name: 'Remaining to Teaser', value: Math.max(0, teaserThreshold - leadsBeforeTeaser), color: '#e0f2fe' } // sky-100
  ];

  return (
    <div className="flex flex-col h-full bg-white overflow-y-auto w-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-5 flex items-center gap-4 sticky top-0 z-20 shadow-lg ">
        <button 
          onClick={onBack}
          className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
          title="Back to Leads Management"
        >
          <ArrowLeft />
        </button>
        <div>
          <h1 className="text-xl font-semibold text-gray-900 tracking-tight flex items-center gap-3">
            {name}
            {recruiter.status && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                recruiter.status.toLowerCase() === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                recruiter.status.toLowerCase() === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                'bg-slate-50 text-slate-700 border-slate-200'
              }`}>
                {recruiter.status.toUpperCase()}
              </span>
            )}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Recruiter Performance Dashboard</p>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto w-full space-y-6">
        
        {/* Top Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg  flex items-start gap-4 overflow-hidden">
            <div className="bg-cyan-500/10 text-cyan-400 p-2.5 rounded-lg flex-shrink-0"><Building /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Industry</p>
              <p className="text-sm font-semibold text-gray-900 mt-1 truncate" title={industry}>{industry}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg  flex items-start gap-4 overflow-hidden">
            <div className="bg-cyan-500/10 text-cyan-400 p-2.5 rounded-lg flex-shrink-0"><Globe /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Domain</p>
              <a href={domain.startsWith('http') ? domain : `https://${domain}`} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-sky-600 hover:underline mt-1 block truncate" title={domain}>
                {domain}
              </a>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg  flex items-start gap-4 overflow-hidden">
            <div className="bg-indigo-500/10 text-indigo-400 p-2.5 rounded-lg flex-shrink-0"><MapPin /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Location</p>
              <p className="text-sm font-semibold text-gray-900 mt-1 truncate" title={location}>{location}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg  flex flex-col justify-center gap-1 overflow-hidden">
            <div className="flex items-center gap-2 mb-1">
              <div className="bg-fuchsia-500/10 text-fuchsia-400 p-1.5 rounded-md flex-shrink-0"><Users /></div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Contacts</p>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900 truncate" title={String(associatedContacts)}>{associatedContacts}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-lg  flex flex-col justify-center gap-1 overflow-hidden">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider truncate">Total Leads Sent</p>
            <p className="text-3xl font-bold font-mono tracking-tight text-gray-900 truncate">{leadsTotal}</p>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Trend Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg  lg:col-span-2">
            <h3 className="text-sm font-semibold text-gray-800 mb-6">Leads Output Progression</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={progressionData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}
                  />
                  <Bar dataKey="leads" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Teaser Threshold Donut */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg  flex flex-col items-center">
            <h3 className="text-sm font-semibold text-gray-800 self-start mb-2">Teaser Threshold Progress</h3>
            <p className="text-xs text-gray-400 self-start mb-4">Leads sent towards teaser mode activation</p>
            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={teaserData}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {teaserData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-gray-900">{leadsBeforeTeaser}</span>
                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">/ {teaserThreshold}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-xs font-medium text-gray-500">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-600"></span>Sent</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-100"></span>Remaining</div>
            </div>
          </div>

          {/* Daily Limit Utilization */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg  lg:col-span-3">
             <h3 className="text-sm font-semibold text-gray-800 mb-6">Daily Capacity vs Limit (Est. 30d Avg)</h3>
             <div className="h-40 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={dailyData} layout="vertical" margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} width={100} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} />
                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="sent" name="Estimated Daily Sent" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={24} />
                    <Bar dataKey="limit" name="Daily Sending Limit" fill="#e0e7ff" radius={[0, 4, 4, 0]} barSize={24} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

        </div>

        {/* Email Logs Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-lg mt-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Email Logs</h3>
          {loadingLogs ? (
            <div className="text-sm text-gray-500 py-4">Loading logs...</div>
          ) : emailLogs.length === 0 ? (
            <div className="text-sm text-gray-500 py-4">No email logs found for this recruiter.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date Sent</th>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recipient</th>
                    <th className="px-4 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Jobs Included</th>
                    <th className="px-4 py-3 bg-gray-50 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {emailLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {log.sent_at ? new Date(log.sent_at).toLocaleString() : 'N/A'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {log.email_address}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <ul className="list-disc pl-4">
                          {log.matched_jobs && log.matched_jobs.map((j: any) => (
                            <li key={j.id} className="truncate max-w-md" title={j.title}>{j.title} at {j.company}</li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setSelectedEmailLog(log)}
                          className="text-sky-600 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-md transition-colors"
                        >
                          View Email
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>

      {/* Email Modal */}
      {selectedEmailLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity" 
            onClick={() => setSelectedEmailLog(null)}
          ></div>
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50 rounded-t-xl">
              <h2 className="text-lg font-bold text-slate-800">
                Email Content
              </h2>
              <button 
                onClick={() => setSelectedEmailLog(null)}
                className="text-gray-400 hover:text-gray-700 transition-colors p-1.5 rounded-full hover:bg-white hover:shadow-sm"
              >
                <CloseIcon />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white rounded-b-xl text-sm text-gray-800">
              <div 
                dangerouslySetInnerHTML={{ __html: selectedEmailLog.email_content }}
                className="prose prose-sm max-w-none prose-a:text-sky-600 hover:prose-a:text-sky-800"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
