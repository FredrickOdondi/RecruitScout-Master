import React, { useState } from 'react';
import { MessageType, ExtensionMessage } from '../../shared/types';
import JobCard from './JobCard';

interface JobsTabProps {
  jobs: any[];
  onJobsUpdate: (jobs: any[]) => void;
  sendMessage: <T>(message: ExtensionMessage) => Promise<T>;
}

export default function JobsTab({ jobs, onJobsUpdate, sendMessage }: JobsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const filteredJobs = jobs.filter(job => {
    const searchLower = searchQuery.toLowerCase();
    return (
      job.title?.toLowerCase().includes(searchLower) ||
      job.company?.toLowerCase().includes(searchLower) ||
      job.location?.toLowerCase().includes(searchLower)
    );
  });

  function toggleJobSelection(jobId: string) {
    setSelectedJobs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(jobId)) {
        newSet.delete(jobId);
      } else {
        newSet.add(jobId);
      }
      return newSet;
    });
  }

  function toggleSelectAll() {
    if (selectedJobs.size === filteredJobs.length) {
      setSelectedJobs(new Set());
    } else {
      setSelectedJobs(new Set(filteredJobs.map(j => j.id)));
    }
  }

  async function deleteSelected() {
    if (selectedJobs.size === 0) return;
    try {
      await sendMessage({
        type: MessageType.DELETE_JOBS,
        payload: Array.from(selectedJobs),
      });

      const updatedJobs = jobs.filter(job => !selectedJobs.has(job.id));
      onJobsUpdate(updatedJobs);
      setSelectedJobs(new Set());
    } catch (error) {
      console.error('Error deleting jobs:', error);
    }
  }

  return (
    <div className="space-y-6">
      
      {/* Search bar */}
      <div className="relative group">
        <input
          type="text"
          placeholder="Search extracted jobs by title, company, or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3.5 pl-12 text-sm text-gray-200 placeholder-gray-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all outline-none shadow-inner"
        />
        <svg
          className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-emerald-500 transition-colors"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>

      <div className="flex items-center justify-between px-2">
        {/* Select all */}
        {filteredJobs.length > 0 && (
          <label className="flex items-center gap-3 text-sm text-gray-400 cursor-pointer group hover:text-gray-200 transition-colors">
            <input
              type="checkbox"
              checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
              onChange={toggleSelectAll}
              className="form-checkbox h-5 w-5 text-emerald-500 rounded bg-gray-900 border-gray-700 hover:border-emerald-500 transition-colors cursor-pointer"
            />
            <span className="font-medium">Select all ({filteredJobs.length})</span>
          </label>
        )}

        {/* Bulk actions */}
        {selectedJobs.size > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
              {selectedJobs.size} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={deleteSelected}
                className="px-4 py-1.5 text-sm font-medium text-white bg-red-600/80 hover:bg-red-500 rounded-lg transition-colors shadow-lg shadow-red-500/20"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedJobs(new Set())}
                className="px-4 py-1.5 text-sm font-medium text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors border border-gray-700"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Job list */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <div className="text-center py-16 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-400 font-medium">No jobs found</p>
            <p className="text-xs text-gray-600 mt-1">Start your agents or change your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredJobs.map(job => (
              <JobCard
                key={job.id}
                job={job}
                isSelected={selectedJobs.has(job.id)}
                isExpanded={expandedJob === job.id}
                onToggleSelect={() => toggleJobSelection(job.id)}
                onToggleExpand={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
