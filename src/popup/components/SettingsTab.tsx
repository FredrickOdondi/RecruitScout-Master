import React from 'react';
import { MessageType, ExtensionMessage } from '../../shared/types';

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
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
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
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">General Settings</h2>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm text-gray-700">Auto Extract</div>
            <div className="text-xs text-gray-500">Automatically extract jobs when visiting job boards</div>
          </div>
          <input
            type="checkbox"
            checked={settings.autoExtract || false}
            onChange={(e) => updateSetting('autoExtract', e.target.checked)}
            className="checkbox"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm text-gray-700">Notifications</div>
            <div className="text-xs text-gray-500">Show notifications when extraction completes</div>
          </div>
          <input
            type="checkbox"
            checked={settings.notificationEnabled || true}
            onChange={(e) => updateSetting('notificationEnabled', e.target.checked)}
            className="checkbox"
          />
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm text-gray-700">Dark Mode</div>
            <div className="text-xs text-gray-500">Use dark theme for the popup</div>
          </div>
          <input
            type="checkbox"
            checked={settings.darkMode || false}
            onChange={(e) => updateSetting('darkMode', e.target.checked)}
            className="checkbox"
          />
        </label>

        <div className="space-y-2 pt-4 mt-2 border-t border-gray-200">
          <h3 className="text-sm font-bold text-sky-700 mb-3 flex items-center gap-2">
            <span>📡</span> Distributed Worker Mode
          </h3>

          <label className="flex items-center justify-between cursor-pointer mb-4">
            <div>
              <div className="text-sm font-medium text-gray-800">Enable Remote Queue Polling</div>
              <div className="text-xs text-gray-500">Pull tasks from Supabase Command Center</div>
            </div>
            <input
              type="checkbox"
              checked={settings.pollingEnabled || false}
              onChange={(e) => updateSetting('pollingEnabled', e.target.checked)}
              className="checkbox"
            />
          </label>

          <label className="text-sm text-gray-700 block">Worker ID / Agent Name (assigned_to)</label>
          <input
            type="text"
            placeholder="e.g. Node-A"
            value={settings.friendName || ''}
            onChange={(e) => updateSetting('friendName', e.target.value)}
            className="input mt-1"
          />
        </div>
      </div>

      {/* Extraction settings */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-gray-700">Extraction Settings</h2>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Max Jobs per Page</label>
          <input
            type="number"
            min="10"
            max="500"
            value={settings.maxJobsPerPage || 100}
            onChange={(e) => updateSetting('maxJobsPerPage', parseInt(e.target.value))}
            className="input"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Pagination Limit</label>
          <input
            type="number"
            min="1"
            max="100"
            value={settings.paginationLimit || 10}
            onChange={(e) => updateSetting('paginationLimit', parseInt(e.target.value))}
            className="input"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm text-gray-700">Crawl Delay (ms)</label>
          <input
            type="number"
            min="100"
            max="10000"
            step="100"
            value={settings.crawlDelay || 1000}
            onChange={(e) => updateSetting('crawlDelay', parseInt(e.target.value))}
            className="input"
          />
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <div className="text-sm text-gray-700">Respect robots.txt</div>
            <div className="text-xs text-gray-500">Follow robots.txt rules when crawling</div>
          </div>
          <input
            type="checkbox"
            checked={settings.respectRobotsTxt || true}
            onChange={(e) => updateSetting('respectRobotsTxt', e.target.checked)}
            className="checkbox"
          />
        </label>
      </div>

      {/* Danger zone */}
      <div className="card p-4 border-red-200 space-y-4">
        <h2 className="text-sm font-semibold text-red-700">Danger Zone</h2>

        <button
          onClick={clearAllData}
          className="w-full px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
        >
          Clear All Data
        </button>

        <div className="text-xs text-gray-500">
          This will permanently delete all extracted jobs and settings.
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400">
        <div>RecruitScout v1.0.0</div>
        <div className="mt-1">
          <a
            href="https://github.com/recruitscout/recruitscout"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-600"
          >
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
