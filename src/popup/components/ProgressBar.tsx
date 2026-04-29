import React from 'react';

interface ProgressBarProps {
  state: any;
}

export default function ProgressBar({ state }: ProgressBarProps) {
  const progress = state.totalJobs > 0
    ? Math.round((state.extractedJobs / state.totalJobs) * 100)
    : 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-blue-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running':
        return 'Extracting...';
      case 'paused':
        return 'Paused';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Idle';
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Extraction Progress</h2>
        <span className={`text-xs font-medium ${state.status === 'running' ? 'text-blue-600' : 'text-gray-600'}`}>
          {getStatusText(state.status)}
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>{state.extractedJobs || 0} jobs extracted</span>
          <span>{progress}%</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-bar-fill ${getStatusColor(state.status)}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {state.currentPhase && (
        <div className="text-xs text-gray-500">
          Phase: {state.currentPhase}
        </div>
      )}

      {state.errors > 0 && (
        <div className="text-xs text-red-600">
          {state.errors} error(s) encountered
        </div>
      )}
    </div>
  );
}
