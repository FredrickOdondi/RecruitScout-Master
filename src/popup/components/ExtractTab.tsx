import React, { useState, useEffect } from 'react';
import { MessageType, ExtensionMessage, ExtractionMode } from '../../shared/types';
import { storage } from '../../shared/storage';
import { supabaseClient } from '../../shared/supabase';
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
 const [clients, setClients] = useState<any[]>([]);
 const [activeClientName, setActiveClientName] = useState<string>('');

 useEffect(() => {
 getCurrentTabInfo();
 loadClientSettings();
 }, []);

 async function loadClientSettings() {
 try {
 const [settings, clientsRes] = await Promise.all([
 storage.getSettings(),
 supabaseClient.getClients()
 ]);
 const enrolled = (clientsRes.data || []) as any[];
 setClients(enrolled);

 if (settings?.activeClientName) {
 setActiveClientName(settings.activeClientName);
 } else if (enrolled.length > 0) {
 const clientWithSheet = enrolled.find((c: any) => c.spreadsheet_id && c.spreadsheet_id.trim() !== '');
 if (clientWithSheet) {
 setActiveClientName(clientWithSheet.name);
 } else {
 setActiveClientName(enrolled[0].name);
 }
 }
 } catch (err) {
 console.warn('[ExtractTab] Error loading client settings:', err);
 }
 }

 async function handleClientChange(clientName: string) {
 setActiveClientName(clientName);
 try {
 const cur = await storage.getSettings();
 const matched = clients.find(c => c.name === clientName);
 await storage.setSettings({
 ...cur,
 activeClientName: clientName,
 googleSheetsConfig: {
 webAppUrl: cur.googleSheetsConfig?.webAppUrl || 'https://google.com',
 spreadsheetId: matched?.spreadsheet_id || cur.googleSheetsConfig?.spreadsheetId || '',
 sheetName: matched?.sheet_name || cur.googleSheetsConfig?.sheetName || 'Sheet1'
 }
 });
 } catch (err) {
 console.warn('[ExtractTab] Error saving active client:', err);
 }
 }

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

 return'Unknown';
 }

 async function startExtraction(mode: ExtractionMode) {
 try {
 setIsLoading(true);
 setErrorMsg(null);

 onStateUpdate({ ...state, status:'running', mode });

 const matchedClient = clients.find(c => c.name === activeClientName);
 const options = {
 client_name: activeClientName || undefined,
 client_id: matchedClient?.id || undefined
 };

 const response = await sendMessage<any>({
 type: MessageType.START_EXTRACTION,
 payload: { mode, url: currentUrl, tabId: currentTabId, options },
 });

 if (response && response.success) {
 const latestState = await sendMessage<any>({ type: MessageType.GET_STATE });
 onStateUpdate(latestState || { ...state, status:'idle', mode });

 // Refresh jobs list
 const jobsResponse = await sendMessage<any>({ type: MessageType.GET_JOBS });
 onJobsUpdate(jobsResponse || []);
 } else {
 const errStr = response?.error ||'Unknown error occurred.';
 console.error('Extraction failed:', errStr);
 setErrorMsg(errStr);
 }
 } catch (error: any) {
 console.error('Error starting extraction:', error);
 setErrorMsg(error.message ||'Unknown error starting extraction.');
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

 onStateUpdate({ ...state, status:'running', mode:'bulk-search' });

 const matchedClient = clients.find(c => c.name === activeClientName);
 const options = {
 client_name: activeClientName || undefined,
 client_id: matchedClient?.id || undefined
 };

 const response = await sendMessage<any>({
 type: MessageType.START_BULK_EXTRACTION,
 payload: { titles, options },
 });

 if (response && response.success) {
 const latestState = await sendMessage<any>({ type: MessageType.GET_STATE });
 onStateUpdate(latestState || { ...state, status:'idle', mode:'bulk-search' });

 const jobsResponse = await sendMessage<any>({ type: MessageType.GET_JOBS });
 onJobsUpdate(jobsResponse || []);
 } else {
 const errStr = response?.error ||'Unknown error occurred.';
 setErrorMsg(errStr);
 }
 } catch (error: any) {
 setErrorMsg(error.message ||'Error starting bulk search.');
 } finally {
 setIsLoading(false);
 }
 }

 async function stopExtraction() {
 try {
 await sendMessage({ type: MessageType.STOP_EXTRACTION });
 onStateUpdate({ ...state, status:'idle' });
 } catch (error) {
 console.error('Error stopping extraction:', error);
 }
 }

 const activeClientObj = clients.find(c => c.name === activeClientName);

 return (
 <div className="space-y-4">
 {/* Live Google Sheets Sync Target */}
 <div className="card p-3 bg-accent-subtle border border-stroke-card rounded-xl space-y-2">
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-2">
 <span className="relative flex h-2.5 w-2.5">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
 <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
 </span>
 <span className="text-xs font-semibold text-emerald-900 ">Google Sheets live sync</span>
 </div>
 {activeClientObj?.spreadsheet_id ? (
 <span className="text-xs font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300">
 Live connected
 </span>
 ) : (
 <span className="text-xs font-medium text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-300">
 No sheet
 </span>
 )}
 </div>

 {clients.length > 0 ? (
 <div className="space-y-1">
 <div className="flex items-center justify-between text-xs">
 <span className="text-gray-600">Client:</span>
 <select
 className="text-xs font-semibold text-gray-800 bg-white border border-emerald-300 rounded px-2 py-0.5"
 value={activeClientName}
 onChange={(e) => handleClientChange(e.target.value)}
 >
 {clients.map(c => (
 <option key={c.id || c.name} value={c.name}>
 {c.name}{c.spreadsheet_id ? ' (sheet connected)' : ''}
 </option>
 ))}
 </select>
 </div>
 {activeClientObj?.sheet_name && (
 <div className="text-xs text-gray-500 flex justify-between">
 <span>Tab:</span>
 <span className="font-mono text-gray-700 font-medium">{activeClientObj.sheet_name}</span>
 </div>
 )}
 </div>
 ) : (
 <div className="text-xs text-gray-500">
 Enroll a client in the dashboard to stream scraped jobs straight to your Google Sheet.
 </div>
 )}
 </div>

 {/* Page info */}
 <div className="card p-4 space-y-3">
 <h2 className="text-sm font-semibold text-gray-700">Current page</h2>
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
 {(state.status ==='running' || state.status ==='paused') && (
 <ProgressBar state={state} />
 )}

 {/* Extraction modes */}
 <div className="card p-4 space-y-3">
 <h2 className="text-sm font-semibold text-gray-700">Extraction mode</h2>
 <div className="space-y-2">
 <button
 onClick={() => startExtraction('current-page')}
 disabled={isLoading || state.status ==='running'}
 className="w-full btn-primary"
 >
 Extract current page
 </button>
 <button
 onClick={() => startExtraction('pagination')}
 disabled={isLoading || state.status ==='running'}
 className="w-full btn-secondary"
 >
 Extract all pages
 </button>
 </div>

 {/* Stop button */}
 {state.status ==='running' && (
 <button
 onClick={stopExtraction}
 className="w-full mt-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
 >
 Stop extraction
 </button>
 )}
 </div>

 {/* Bulk Search Mode */}
 <div className="card p-4 space-y-3 border-sky-100 bg-sky-50">
 <h2 className="text-sm font-semibold text-sky-800 flex items-center gap-2">
 Bulk job search on Indeed
 </h2>
 <div className="space-y-2">
 <textarea
 className="input text-xs h-24 resize-none"
 placeholder="Paste job titles (one per line)...&#10;e.g.&#10;Software Engineer&#10;Product manager"
 value={bulkTitles}
 onChange={(e) => setBulkTitles(e.target.value)}
 disabled={isLoading || state.status ==='running'}
 ></textarea>
 <button
 onClick={startBulkSearch}
 disabled={isLoading || state.status ==='running' || !platform.includes('Indeed')}
 className={`w-full py-2 px-4 rounded-lg font-medium shadow-sm transition-all duration-200 ${
 !platform.includes('Indeed') 
 ?'bg-gray-100 text-gray-400 cursor-not-allowed' 
 :'bg-sky-500 text-white hover:bg-sky-600'
 }`}
 >
 {platform.includes('Indeed') ?'Start bulk search' :'Switch to Indeed for bulk search'}
 </button>
 </div>
 </div>

 {/* Statistics */}
 <div className="card p-4 space-y-3">
 <h2 className="text-sm font-semibold text-gray-700">Statistics</h2>
 <div className="grid grid-cols-2 gap-3">
 <div className="bg-gray-50 rounded-lg p-3">
 <div className="text-2xl font-semibold text-primary-600">{state.extractedJobs || 0}</div>
 <div className="text-xs text-gray-500">Jobs extracted</div>
 </div>
 <div className="bg-gray-50 rounded-lg p-3">
 <div className="text-2xl font-semibold text-gray-700">{state.totalJobs || 0}</div>
 <div className="text-xs text-gray-500">Total found</div>
 </div>
 </div>
 </div>
 </div>
 );
}
