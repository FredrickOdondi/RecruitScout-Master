import { defineManifest } from '@crxjs/vite-plugin';
import packageJson from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'RecruitScout - Job Data Extractor',
  version: packageJson.version,
  description: 'Extract job listing data from any job board website with a single click. Supports LinkedIn, Indeed, Glassdoor, and 20+ other platforms.',
  permissions: [
    'storage',
    'activeTab',
    'tabs',
    'scripting',
    'offscreen'
  ],
  host_permissions: [
    'https://www.linkedin.com/*',
    '*://*.indeed.com/*',
    '*://*.indeed.it/*',
    '*://*.indeed.co.uk/*',
    'https://www.glassdoor.com/*',
    'https://www.monster.com/*',
    'https://www.ziprecruiter.com/*',
    'https://www.careerbuilder.com/*',
    'https://www.simplyhired.com/*',
    'https://www.jobs.net/*',
    'https://www.jobrapido.com/*',
    'https://www.neuvoo.com/*',
    'https://www.snagajob.com/*',
    'https://www.dice.com/*',
    'https://www.guru.com/*',
    'https://www.upwork.com/*',
    'https://www.freelancer.com/*',
    'https://jobs.careers.microsoft.com/*',
    'https://careers.google.com/*',
    'https://careers.apple.com/*',
    'https://jobs.netflix.com/*',
    'https://www.amazon.jobs/*',
    'http://localhost:5173/*',
    'http://72.60.215.34/*'
  ],
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module'
  },
  content_scripts: [
    {
      matches: [
        'https://www.linkedin.com/*',
        '*://*.indeed.com/*',
        '*://*.indeed.it/*',
        '*://*.indeed.co.uk/*',
        'https://www.glassdoor.com/*',
        'https://www.monster.com/*',
        'https://www.ziprecruiter.com/*',
        'https://www.careerbuilder.com/*',
        'https://www.simplyhired.com/*',
        'https://www.jobs.net/*',
        'https://www.jobrapido.com/*',
        'https://www.neuvoo.com/*',
        'https://www.snagajob.com/*',
        'https://www.dice.com/*',
        'https://www.guru.com/*',
        'https://www.upwork.com/*',
        'https://www.freelancer.com/*',
        'https://jobs.careers.microsoft.com/*',
        'https://careers.google.com/*',
        'https://careers.apple.com/*',
        'https://jobs.netflix.com/*',
        'https://www.amazon.jobs/*',
        'http://localhost:5173/*',
        'http://72.60.215.34/*'
      ],
      js: ['src/content/index.ts'],
      run_at: 'document_end'
    }
  ],
  action: {
    default_popup: 'src/popup/index.html',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png'
    }
  },
  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png'
  },
  web_accessible_resources: [
    {
      resources: ['public/icons/*'],
      matches: ['<all_urls>']
    }
  ],
  offscreen: {
    document: 'src/offscreen/index.html',
    persistent: false
  },
  options_page: 'src/dashboard/index.html'
});
