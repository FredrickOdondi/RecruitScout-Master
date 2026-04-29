import React from 'react';

interface JobCardProps {
  job: any;
  isSelected: boolean;
  isExpanded: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
}

export default function JobCard({ job, isSelected, isExpanded, onToggleSelect, onToggleExpand }: JobCardProps) {
  function openJob() {
    window.open(job.url, '_blank');
  }

  return (
    <div className={`bg-[#0d1321] border ${isSelected ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-800/80'} rounded-xl p-4 hover:border-gray-700 hover:shadow-lg transition-all group`}>
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="form-checkbox h-5 w-5 text-emerald-500 rounded bg-gray-900 border-gray-700 hover:border-emerald-500 transition-colors cursor-pointer cursor-pointer"
          />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-semibold text-gray-100 text-lg truncate group-hover:text-emerald-400 transition-colors">{job.title}</h3>
            <button
              onClick={onToggleExpand}
              className="flex-shrink-0 p-1.5 hover:bg-gray-800 rounded-lg transition-colors border border-transparent hover:border-gray-700 text-gray-500 hover:text-gray-300"
            >
              <svg
                className={`w-4 h-4 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          <div className="mt-1.5 space-y-1.5">
            <p className="text-sm font-medium text-gray-400">{job.company}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </p>
          </div>

          {/* Badges */}
          <div className="mt-3 flex flex-wrap gap-2">
            {job.employmentType && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-400/10 border border-blue-400/20 rounded-full">
                {job.employmentType}
              </span>
            )}
            {job.salary && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full">
                {job.salary.min && job.salary.max
                  ? `$${job.salary.min.toLocaleString()} - $${job.salary.max.toLocaleString()}`
                  : job.salary.min
                    ? `$${job.salary.min.toLocaleString()}+`
                    : 'Salary info'
                }
              </span>
            )}
            {job.postedAgo && (
              <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full">
                {job.postedAgo}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button
              onClick={openJob}
              className="text-xs text-emerald-500 hover:text-emerald-400 font-semibold group flex items-center gap-1"
            >
              Open Original Job <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded description */}
      {isExpanded && job.description && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="text-sm text-gray-400 leading-relaxed max-h-64 overflow-y-auto custom-scrollbar font-mono text-[11px] bg-gray-900/50 p-4 rounded-lg">
            {job.description}
          </div>
          <div className="mt-3 flex items-center justify-between text-[10px] text-gray-500 uppercase tracking-widest font-semibold">
            <span>Source: {job.source}</span>
            <span>Extracted: {new Date(job.extractedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
