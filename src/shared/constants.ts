import { ExtensionSettings, ExportConfig, DEFAULT_EXPORT_FIELDS } from './types';

// Extension metadata
export const EXTENSION_NAME = 'RecruitScout';
export const EXTENSION_VERSION = '1.0.0';

// Default settings
export const DEFAULT_SETTINGS: ExtensionSettings = {
  autoExtract: false,
  maxJobsPerPage: 100,
  paginationLimit: 10,
  crawlDelay: 1000,
  respectRobotsTxt: true,
  notificationEnabled: true,
  darkMode: false,
  language: 'en',
  friendName: '',
};

// Default export configuration
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  format: 'csv',
  fields: DEFAULT_EXPORT_FIELDS,
  includeMetadata: false,
};

// Heuristic selectors
export const HEURISTIC_SELECTORS = {
  // Job listing containers
  jobListings: [
    'article[data-automation-id="jobTile"]',
    'div[data-testid="job-card"]',
    'div.job-card',
    'div.jobsearch-SerpJobCard',
    'li.job-result',
    'div.job-item',
    'li.css-5lfssm',
    '.job_seen_beacon',
    '.cardOutline',
    '[class*="job"][class*="card"]',
    '[class*="Job"][class*="Card"]',
  ],

  // Job title
  jobTitle: [
    'h2.jobTitle',
    'a[data-testid="job-title"]',
    'h3.job-title',
    '[data-job-title]',
    '[class*="job"][class*="title"]',
    '[class*="Job"][class*="Title"]',
    'a.jcs-JobTitle',
    'h2',
    'h3',
  ],

  // Company name
  company: [
    'span[data-testid="company-name"]',
    'div[data-testid="company-name"]',
    'a[data-testid="company-link"]',
    '[class*="company"][class*="name"]',
    '[data-company-name]',
    '[class*="Company"][class*="Name"]',
  ],

  // Location
  location: [
    'div[data-testid="job-location"]',
    'div[data-automation-id="jobLocation"]',
    '[class*="job"][class*="location"]',
    '[data-job-location]',
    '[class*="Location"]',
  ],

  // Salary
  salary: [
    'div[data-testid="salary-snippet"]',
    'div[data-automation-id="jobSalary"]',
    '[class*="salary"]',
    '[data-salary]',
    '[class*="Salary"]',
    'div.salary-snippet-container',
    'div.jobMetaDataGroup',
    '[class*="metadataContainer"]',
    '[class*="EstimatedSalary"]',
  ],

  // Description
  description: [
    '#jobDescriptionText',
    '.jobsearch-jobDescriptionText',
    'div[data-testid="job-description"]',
    'div.job-description',
    '[class*="description"][class*="job"]',
    '[data-job-description]',
    '[class*="JobDescription"]',
    'div.job-snippet',
    '[class*="snippet"]',
  ],

  // Date posted
  datePosted: [
    'span[data-testid="job-age"]',
    'span[data-automation-id="jobAge"]',
    'div[data-testid="myJobsStateDatePosted"]',
    '[class*="date"][class*="posted"]',
    '[data-date-posted]',
  ],

  // Employment type
  employmentType: [
    'div[data-testid="job-type"]',
    '[data-employment-type]',
    '[class*="job"][class*="type"]',
    '[class*="EmploymentType"]',
    'div.jobMetaDataGroup',
    '[class*="metadataContainer"]',
  ],

  // Job links
  jobLink: [
    'a[data-automation-id="jobTitle"]',
    'a[data-testid="job-title"]',
    'a.job-card-link',
    'a.jcs-JobTitle',
    '[href*="/jobs/"]',
    '[href*="/job/"]',
    '[href*="/rc/clk"]',
  ],
} as const;

// Schema.org JobPosting JSON-LD
export const SCHEMA_SELECTOR = 'script[type="application/ld+json"]';

// Pagination selectors
export const PAGINATION_SELECTORS = {
  nextButton: [
    'a[data-testid="pagination-page-next"]',
    'button[aria-label="Next"]',
    'a[aria-label="Next"]',
    '[class*="pagination"][class*="next"]',
    '[data-testid="next-page"]',
  ],
  loadMore: [
    'button[class*="load"][class*="more"]',
    '[data-testid="load-more"]',
    '[data-automation-id="loadMore"]',
  ],
  pageNumber: [
    'li.pagination-page',
    'li.page-item',
    '[data-page]',
  ],
} as const;

// Rate limiting
export const RATE_LIMIT = {
  MIN_DELAY: 500,
  DEFAULT_DELAY: 1000,
  MAX_DELAY: 3000,
  RETRY_ATTEMPTS: 3,
  BACKOFF_MULTIPLIER: 2,
} as const;

// Storage limits
export const STORAGE_LIMITS = {
  SYNC_MAX_ITEMS: 512,
  LOCAL_MAX_BYTES: 5 * 1024 * 1024, // 5MB
  CHUNK_SIZE: 100, // Jobs per chunk
} as const;

// Message timeouts
export const MESSAGE_TIMEOUT = 300000; // 5 minutes constraint

// Progress update intervals
export const PROGRESS_UPDATE_INTERVAL = 500; // 500ms

// Date formats
export const DATE_FORMATS = {
  ISO: 'YYYY-MM-DD',
  DISPLAY: 'MMM DD, YYYY',
} as const;

// Currency symbols
export const CURRENCY_SYMBOLS = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'C$',
  AUD: 'A$',
  JPY: '¥',
  INR: '₹',
  CNY: '¥',
} as const;

// Employment type keywords
export const EMPLOYMENT_TYPE_KEYWORDS = {
  fullTime: ['full-time', 'full time', 'ft', 'fulltime'],
  partTime: ['part-time', 'part time', 'pt', 'parttime'],
  contract: ['contract', 'contractor', 'consultant'],
  temporary: ['temporary', 'temp', 'seasonal'],
  internship: ['internship', 'intern', 'apprentice'],
  freelance: ['freelance', 'freelancer', 'self-employed'],
} as const;

// Location type keywords
export const LOCATION_TYPE_KEYWORDS = {
  remote: ['remote', 'work from home', 'wfh', 'telecommute', 'virtual'],
  hybrid: ['hybrid', 'mixed'],
  onSite: ['on-site', 'onsite', 'in-office', 'in person', 'office'],
} as const;

// Salary period keywords
export const SALARY_PERIOD_KEYWORDS = {
  hourly: ['hour', '/hr', '/hour', 'per hour', 'hourly'],
  monthly: ['month', '/mo', '/month', 'per month', 'monthly'],
  yearly: ['year', '/yr', '/year', 'per year', 'annually', 'annual', 'pa'],
  weekly: ['week', '/wk', '/week', 'per week', 'weekly'],
} as const;

// Date posted keywords
export const DATE_POSTED_KEYWORDS = {
  today: ['today', 'just now', 'posted today'],
  yesterday: ['yesterday', '1 day ago'],
  week: ['week', '7 days', '7 day'],
  month: ['month', '30 days', '30 day'],
  year: ['year', '365 days', '365 day'],
} as const;

// Platform detection patterns
export const PLATFORM_PATTERNS: Record<string, RegExp> = {
  linkedin: /linkedin\.com\/jobs/,
  indeed: /indeed\.com/,
  glassdoor: /glassdoor\.com\/Job/,
  monster: /monster\.com\/job/,
  ziprecruiter: /ziprecruiter\.com\/job/,
  careerbuilder: /careerbuilder\.com\/job/,
  simplyhired: /simplyhired\.com\/job/,
  jobs: /jobs\.net\/job/,
  jobrapido: /jobrapido\.com/,
  neuvoo: /neuvoo\.com\/job/,
  snagajob: /snagajob\.com\/job/,
  dice: /dice\.com\/jobs/,
  guru: /guru\.com\/jobs/,
  upwork: /upwork\.com\/ab/,
  freelancer: /freelancer\.com\/projects/,
  microsoft: /jobs\.careers\.microsoft\.com/,
  google: /careers\.google\.com\/jobs/,
  apple: /jobs\.apple\.com/,
  netflix: /jobs\.netflix\.com/,
  amazon: /amazon\.jobs/,
} as const;

// Colors
export const COLORS = {
  PRIMARY: '#0ea5e9',
  SUCCESS: '#10b981',
  WARNING: '#f59e0b',
  ERROR: '#ef4444',
  INFO: '#3b82f6',
} as const;
