import React from 'react';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const tabs = [
    { id: 'extract', label: 'Extract', icon: '🔍' },
    { id: 'jobs', label: 'Jobs', icon: '💼' },
    { id: 'export', label: 'Export', icon: '📤' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <nav className="glass px-2 py-2 border-b border-gray-200">
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
              transition-all duration-200
              ${activeTab === tab.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
              }
            `}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
