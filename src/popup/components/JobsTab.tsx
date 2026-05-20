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
          className="w-full bg-white border border-gray-300 rounded-md p-2.5 pl-10 text-[13px] text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:ring-1 focus:ring-gray-400 transition-all outline-none shadow-sm"
        />
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-gray-700 transition-colors"
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
          <label className="flex items-center gap-2.5 text-[13px] text-gray-700 cursor-pointer group hover:text-gray-900 transition-colors">
            <input
              type="checkbox"
              checked={selectedJobs.size === filteredJobs.length && filteredJobs.length > 0}
              onChange={toggleSelectAll}
              className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
            />
            <span className="font-medium">Select all ({filteredJobs.length})</span>
          </label>
        )}

        {/* Bulk actions */}
        {selectedJobs.size > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-[13px] font-medium text-gray-700 bg-gray-100 px-2.5 py-0.5 rounded-md border border-gray-200">
              {selectedJobs.size} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={deleteSelected}
                className="px-3 py-1.5 text-[13px] font-medium text-red-600 bg-white hover:bg-red-50 rounded-md transition-colors border border-red-200 shadow-sm"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedJobs(new Set())}
                className="px-3 py-1.5 text-[13px] font-medium text-gray-700 hover:text-gray-900 bg-white hover:bg-gray-50 rounded-md transition-colors border border-gray-200 shadow-sm"
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
          <div className="text-center py-12 bg-gray-50 rounded-md border border-gray-200 border-dashed">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-700 text-[13px] font-medium">No jobs found</p>
            <p className="text-[12px] text-gray-600 mt-1">Start your agents or change your search query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
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
