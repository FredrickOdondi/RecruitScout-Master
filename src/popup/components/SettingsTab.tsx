import React from'react';
import { MessageType, ExtensionMessage } from'../../shared/types';
import Footer from '../../shared/Footer';

interface SettingsTabProps {
 settings: any;
 onSettingsUpdate: (settings: any) => void;
 sendMessage: <T>(message: ExtensionMessage) => Promise<T>;
}

export default function SettingsTab({ settings, onSettingsUpdate, sendMessage }: SettingsTabProps) {
 async function updateSetting(key: string, value: any) {
 try {
 const newSettings = { ...settings, [key]: value };
 await sendMessage({
 type: MessageType.UPDATE_SETTINGS,
 payload: { [key]: value },
 });
 onSettingsUpdate(newSettings);
 } catch (error) {
 console.error('Error updating setting:', error);
 }
 }

 async function clearAllData() {
 if (!confirm('Clear all data?\n\nJobs, settings and progress on this device are deleted. This can\'t be undone.')) {
 return;
 }

 try {
 await sendMessage({ type: MessageType.CLEAR_ALL });
 onSettingsUpdate({});
 } catch (error) {
 console.error('Error clearing data:', error);
 alert('Failed to clear data');
 }
 }

 return (
 <div className="space-y-4">
 {/* General settings */}
 <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 space-y-4">
 <h2 className="text-xs font-bold text-gray-600 border-b border-gray-200 pb-2 mb-3">General settings</h2>

 <label className="flex items-center justify-between cursor-pointer">
 <div>
 <div className="text-sm font-medium text-gray-900">Auto extract</div>
 <div className="text-xs text-gray-600 mt-0.5">Automatically extract jobs when visiting job boards</div>
 </div>
 <input
 type="checkbox"
 checked={settings.autoExtract || false}
 onChange={(e) => updateSetting('autoExtract', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer">
 <div>
 <div className="text-sm font-medium text-gray-900">Notifications</div>
 <div className="text-xs text-gray-600 mt-0.5">Show notifications when extraction completes</div>
 </div>
 <input
 type="checkbox"
 checked={settings.notificationEnabled || true}
 onChange={(e) => updateSetting('notificationEnabled', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
 />
 </label>

 <label className="flex items-center justify-between cursor-pointer">
 <div>
 <div className="text-sm font-medium text-gray-900">Dark mode</div>
 <div className="text-xs text-gray-600 mt-0.5">Use dark theme for the popup</div>
 </div>
 <input
 type="checkbox"
 checked={settings.darkMode || false}
 onChange={(e) => updateSetting('darkMode', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
 />
 </label>

 <div className="space-y-3 pt-4 mt-2 border-t border-gray-200">
 <h3 className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-2">
 Distributed worker mode
 </h3>

 <label className="flex items-center justify-between cursor-pointer mb-3">
 <div>
 <div className="text-sm font-medium text-gray-900">Enable remote queue polling</div>
 <div className="text-xs text-gray-600 mt-0.5">Pull tasks from Supabase command center</div>
 </div>
 <input
 type="checkbox"
 checked={settings.pollingEnabled || false}
 onChange={(e) => updateSetting('pollingEnabled', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
 />
 </label>

 <label className="text-sm font-medium text-gray-900 block">Worker ID / agent name (assigned_to)</label>
 <input
 type="text"
 placeholder="e.g. Node-A"
 value={settings.friendName ||''}
 onChange={(e) => updateSetting('friendName', e.target.value)}
 className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 mt-1 shadow-sm"
 />
 </div>
 </div>

 {/* Extraction settings */}
 <div className="bg-white border border-gray-200 rounded-md shadow-sm p-5 space-y-4">
 <h2 className="text-xs font-bold text-gray-600 border-b border-gray-200 pb-2 mb-3">Extraction settings</h2>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-gray-900">Max jobs per page</label>
 <input
 type="number"
 min="10"
 max="500"
 value={settings.maxJobsPerPage || 100}
 onChange={(e) => updateSetting('maxJobsPerPage', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-gray-900">Pagination limit</label>
 <input
 type="number"
 min="1"
 max="100"
 value={settings.paginationLimit || 10}
 onChange={(e) => updateSetting('paginationLimit', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
 />
 </div>

 <div className="space-y-1.5">
 <label className="text-sm font-medium text-gray-900">Crawl delay (ms)</label>
 <input
 type="number"
 min="100"
 max="10000"
 step="100"
 value={settings.crawlDelay || 1000}
 onChange={(e) => updateSetting('crawlDelay', parseInt(e.target.value))}
 className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-gray-400 shadow-sm"
 />
 </div>

 <label className="flex items-center justify-between cursor-pointer">
 <div>
 <div className="text-sm font-medium text-gray-900">Respect robots.txt</div>
 <div className="text-xs text-gray-600 mt-0.5">Follow robots.txt rules when crawling</div>
 </div>
 <input
 type="checkbox"
 checked={settings.respectRobotsTxt || true}
 onChange={(e) => updateSetting('respectRobotsTxt', e.target.checked)}
 className="form-checkbox h-4 w-4 rounded border-gray-300 bg-white cursor-pointer"
 />
 </label>
 </div>

 {/* Danger zone */}
 <div className="bg-red-50 border border-red-100 rounded-md p-5 space-y-4 shadow-sm">
 <h2 className="text-xs font-bold text-red-600 border-b border-red-100 pb-2 mb-3">Danger zone</h2>

 <button
 onClick={clearAllData}
 className="w-full px-4 py-2 bg-white border border-red-200 text-red-600 rounded-md text-sm font-medium hover:bg-red-50 hover:border-red-300 transition-colors shadow-sm"
 >
 Clear all data
 </button>

 <div className="text-xs text-gray-600">
 This will permanently delete all extracted jobs and settings.
 </div>
 </div>

 {/* Footer */}
 <div className="text-center text-xs text-gray-500">
 <Footer />
 <div className="mt-1">RecruitScout v1.0.0</div>
 <div className="mt-1">
 <a
 href="https://github.com/recruitscout/recruitscout"
 target="_blank"
 rel="noopener noreferrer"
 className="hover:text-gray-700"
 >
 View on GitHub
 </a>
 </div>
 </div>
 </div>
 );
}
