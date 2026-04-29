import React, { useState, useEffect } from 'react';
import { MessageType, ExtensionMessage, ExtractionMode } from '../../shared/types';
import ProgressBar from './ProgressBar';

interface ExtractTabProps {
  state: any;
  onStateUpdate: (state: any) => void;
  onJobsUpdate: (jobs: any[]) => void;
  sendMessage: <T>(message: ExtensionMessage) => Promise<T>;
}

export default function ExtractTab({ state, onStateUpdate, onJobsUpdate, sendMessage }: ExtractTabProps) {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [bulkTitles, setBulkTitles] = useState<string>('');

  useEffect(() => {
    getCurrentTabInfo();
  }, []);

  async function getCurrentTabInfo() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab.url) {
        setCurrentUrl(tab.url);
        setPlatform(detectPlatform(tab.url));
      }
      if (tab.id) {
        setCurrentTabId(tab.id);
      }
    } catch (error) {
      console.error('Error getting tab info:', error);
    }
  }

  function detectPlatform(url: string): string {
    const platforms: Record<string, RegExp> = {
      LinkedIn: /linkedin\.com/,
      Indeed: /indeed\.com/,
      Glassdoor: /glassdoor\.com/,
      Monster: /monster\.com/,
      ZipRecruiter: /ziprecruiter\.com/,
    };

    for (const [name, pattern] of Object.entries(platforms)) {
      if (pattern.test(url)) {
        return name;
      }
    }

    return 'Unknown';
  }

  async function startExtraction(mode: ExtractionMode) {
    try {
      setIsLoading(true);
      setErrorMsg(null);

      onStateUpdate({ ...state, status: 'running', mode });

      const response = await sendMessage<any>({
        type: MessageType.START_EXTRACTION,
        payload: { mode, url: currentUrl, tabId: currentTabId, options: {} },
      });

      if (response && response.success) {
        const latestState = await sendMessage<any>({ type: MessageType.GET_STATE });
        onStateUpdate(latestState || { ...state, status: 'idle', mode });

        // Refresh jobs list
        const jobsResponse = await sendMessage<any>({ type: MessageType.GET_JOBS });
        onJobsUpdate(jobsResponse || []);
      } else {
        const errStr = response?.error || 'Unknown error occurred.';
        console.error('Extraction failed:', errStr);
        setErrorMsg(errStr);
      }
    } catch (error: any) {
      console.error('Error starting extraction:', error);
      setErrorMsg(error.message || 'Unknown error starting extraction.');
    } finally {
      setIsLoading(false);
    }
  }

  async function startBulkSearch() {
    const titles = bulkTitles.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    if (titles.length === 0) {
      setErrorMsg('Please enter at least one job title.');
      return;
    }

    try {
      setIsLoading(true);
      setErrorMsg(null);

      onStateUpdate({ ...state, status: 'running', mode: 'bulk-search' });

      const response = await sendMessage<any>({
        type: MessageType.START_BULK_EXTRACTION,
        payload: { titles, options: {} },
      });

      if (response && response.success) {
        const latestState = await sendMessage<any>({ type: MessageType.GET_STATE });
        onStateUpdate(latestState || { ...state, status: 'idle', mode: 'bulk-search' });

        const jobsResponse = await sendMessage<any>({ type: MessageType.GET_JOBS });
        onJobsUpdate(jobsResponse || []);
      } else {
        const errStr = response?.error || 'Unknown error occurred.';
        setErrorMsg(errStr);
      }
    } catch (error: any) {
      setErrorMsg(error.message || 'Error starting bulk search.');
    } finally {
      setIsLoading(false);
    }
  }

  async function stopExtraction() {
    try {
      await sendMessage({ type: MessageType.STOP_EXTRACTION });
      onStateUpdate({ ...state, status: 'idle' });
    } catch (error) {
      console.error('Error stopping extraction:', error);
    }
  }

  return (
    <div className="space-y-4">
      {/* Page info */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Current Page</h2>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">Platform:</span>
            <span className="text-sm font-medium text-gray-900">{platform}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20">URL:</span>
            <span className="text-xs text-gray-700 truncate max-w-[300px]">{currentUrl}</span>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <p className="font-semibold mb-1">Extraction Error</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Extraction progress */}
      {(state.status === 'running' || state.status === 'paused') && (
        <ProgressBar state={state} />
      )}

      {/* Extraction modes */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Extraction Mode</h2>
        <div className="space-y-2">
          <button
            onClick={() => startExtraction('current-page')}
            disabled={isLoading || state.status === 'running'}
            className="w-full btn-primary"
          >
            Extract Current Page
          </button>
          <button
            onClick={() => startExtraction('pagination')}
            disabled={isLoading || state.status === 'running'}
            className="w-full btn-secondary"
          >
            Extract All Pages
          </button>
        </div>

        {/* Stop button */}
        {state.status === 'running' && (
          <button
            onClick={stopExtraction}
            className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Stop Extraction
          </button>
        )}
      </div>

      {/* Bulk Search Mode */}
      <div className="card p-4 space-y-3 border-sky-100 bg-sky-50/30">
        <h2 className="text-sm font-semibold text-sky-800 flex items-center gap-2">
          <span>🚀</span> Bulk Job Search (Indeed)
        </h2>
        <div className="space-y-2">
          <textarea
            className="input text-xs h-24 resize-none"
            placeholder="Paste job titles (one per line)...&#10;e.g.&#10;Software Engineer&#10;Product Manager"
            value={bulkTitles}
            onChange={(e) => setBulkTitles(e.target.value)}
            disabled={isLoading || state.status === 'running'}
          ></textarea>
          <button
            onClick={startBulkSearch}
            disabled={isLoading || state.status === 'running' || !platform.includes('Indeed')}
            className={`w-full py-2 px-4 rounded-lg font-medium shadow-sm transition-all duration-200 ${
              !platform.includes('Indeed') 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-sky-500 text-white hover:bg-sky-600'
            }`}
          >
            {platform.includes('Indeed') ? 'Start Bulk Search' : 'Switch to Indeed for Bulk Search'}
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-700">Statistics</h2>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-primary-600">{state.extractedJobs || 0}</div>
            <div className="text-xs text-gray-500">Jobs Extracted</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-2xl font-bold text-gray-700">{state.totalJobs || 0}</div>
            <div className="text-xs text-gray-500">Total Found</div>
          </div>
        </div>
      </div>
    </div>
  );
}
