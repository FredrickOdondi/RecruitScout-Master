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
    <div className={`bg-white border ${isSelected ? 'border-green-500/50 bg-green-50/50' : 'border-gray-200'} rounded-md p-4 hover:border-gray-300 hover:shadow-sm transition-all group`}>
      <div className="flex items-start gap-4">
        {/* Checkbox */}
        <div className="pt-1">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
          />
        </div>

        {/* Job info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-medium text-gray-900 text-[15px] truncate group-hover:text-gray-700 transition-colors">{job.title}</h3>
            <button
              onClick={onToggleExpand}
              className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-md transition-colors border border-transparent hover:border-gray-200 text-gray-500 hover:text-gray-700"
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

          <div className="mt-1 space-y-1">
            <p className="text-[13px] text-gray-700">{job.company}</p>
            <p className="text-[12px] text-gray-600 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {job.location}
            </p>
          </div>

          {/* Badges */}
          <div className="mt-2.5 flex flex-wrap gap-2">
            {job.employmentType && (
              <span className="px-2 py-0.5 text-[11px] uppercase text-gray-700 bg-gray-100 border border-gray-200 rounded-md">
                {job.employmentType}
              </span>
            )}
            {job.salary && (
              <span className="px-2 py-0.5 text-[11px] uppercase text-gray-700 bg-gray-100 border border-gray-200 rounded-md">
                {job.salary.min && job.salary.max
                  ? `$${job.salary.min.toLocaleString()} - $${job.salary.max.toLocaleString()}`
                  : job.salary.min
                    ? `$${job.salary.min.toLocaleString()}+`
                    : 'Salary info'
                }
              </span>
            )}
            {job.postedAgo && (
              <span className="px-2 py-0.5 text-[11px] uppercase text-gray-700 bg-gray-100 border border-gray-200 rounded-md">
                {job.postedAgo}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={openJob}
              className="text-[12px] text-green-600 hover:text-green-700 font-medium group flex items-center gap-1"
            >
              Open Original Job <span className="transition-transform group-hover:translate-x-1">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Expanded description */}
      {isExpanded && job.description && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="text-[12px] text-gray-700 leading-relaxed max-h-64 overflow-y-auto custom-scrollbar font-mono bg-gray-50 border border-gray-200 p-3 rounded-md">
            {job.description}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-gray-600">
            <span>Source: {job.source}</span>
            <span>Extracted: {new Date(job.extractedAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  );
}
