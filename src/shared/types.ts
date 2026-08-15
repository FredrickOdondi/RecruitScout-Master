// Core job data interface
export interface JobData {
  id: string;
  title: string;
  company: string;
  companyDomain?: string;
  location: string;
  locationType?: LocationType;
  employmentType?: EmploymentType;
  description?: string;
  url: string;
  salary?: SalaryInfo;
  datePosted?: string;
  datePostedRaw?: string;
  postedAgo?: string;
  source: string;
  extractedAt: string;
  metadata?: Record<string, any>;
  status?: string;
  category?: string;
  industry_vertical?: string;
}

// Location type
export type LocationType = 'remote' | 'hybrid' | 'on-site' | 'any';

// Employment type
export type EmploymentType = 'full-time' | 'part-time' | 'contract' | 'temporary' | 'internship' | 'freelance' | 'other';

// Salary information
export interface SalaryInfo {
  min?: number;
  max?: number;
  currency?: string;
  period?: SalaryPeriod;
  raw?: string;
}

export type SalaryPeriod = 'hourly' | 'monthly' | 'yearly' | 'weekly';

// Extraction state
export interface ExtractionState {
  status: ExtractionStatus;
  mode: ExtractionMode;
  progress: number;
  currentTab?: string;
  totalJobs: number;
  extractedJobs: number;
  errors: number;
  startTime?: string;
  lastUpdate?: string;
  currentPhase?: ExtractionPhase;
}

export type ExtractionStatus = 'idle' | 'running' | 'paused' | 'completed' | 'error';
export type ExtractionMode = 'current-page' | 'pagination' | 'all-listings' | 'selected' | 'bulk-search';
export type ExtractionPhase = 'discovery' | 'extraction' | 'crawling' | 'processing' | 'completed';

// Filter configuration
export interface JobFilters {
  search?: string;
  companies?: string[];
  locations?: string[];
  employmentTypes?: EmploymentType[];
  locationTypes?: LocationType[];
  minSalary?: number;
  maxSalary?: number;
  datePostedAfter?: string;
  hasSalary?: boolean;
}

// Export configuration
export interface ExportConfig {
  format: ExportFormat;
  fields: ExportField[];
  includeMetadata?: boolean;
}

export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ExportField {
  key: keyof JobData;
  label: string;
  enabled: boolean;
}

// Distributed Bulk Queue
export interface BulkQueueRecord {
  id: string;
  job_title: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  assigned_to?: string;
  location?: string;
  client_id?: string;
  target_site?: string;
  date_filter?: string | 'last' | '1' | '3' | '7' | '14';
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

// Client Management Record
export interface ClientRecord {
  id: string;
  name: string;
  apps_script_url: string;
  spreadsheet_id?: string;
  sheet_name?: string;
  created_at: string;
}

// Email Log Record
export interface EmailLogRecord {
  id?: string;
  recruiter_id: string;
  recruiter_name: string;
  matched_jobs: { id: string; title: string; company: string }[];
  email_content: string;
  email_address: string;
  sent_at?: string;
}


// Settings
export interface ExtensionSettings {
  autoExtract?: boolean;
  maxJobsPerPage?: number;
  paginationLimit?: number;
  crawlDelay?: number;
  respectRobotsTxt?: boolean;
  notificationEnabled?: boolean;
  darkMode?: boolean;
  language?: string;
  friendName?: string;
  pollingEnabled?: boolean;
  instanceId?: string;
  googleSheetsConfig?: {
    webAppUrl: string;
    spreadsheetId: string;
    sheetName: string;
  };
  /** When false, Spanish Indeed jobs bypass the Spanish_Companies whitelist and all are synced to Google Sheets */
  spanishWhitelistEnabled?: boolean;
}

// Message types
export const MessageType = {
  GET_STATE: 'GET_STATE',
  UPDATE_STATE: 'UPDATE_STATE',
  START_EXTRACTION: 'START_EXTRACTION',
  START_BULK_EXTRACTION: 'START_BULK_EXTRACTION',
  STOP_EXTRACTION: 'STOP_EXTRACTION',
  PAUSE_EXTRACTION: 'PAUSE_EXTRACTION',
  GET_JOBS: 'GET_JOBS',
  ADD_JOBS: 'ADD_JOBS',
  UPDATE_JOB: 'UPDATE_JOB',
  DELETE_JOBS: 'DELETE_JOBS',
  EXPORT_JOBS: 'EXPORT_JOBS',
  GET_SETTINGS: 'GET_SETTINGS',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  GET_PROGRESS: 'GET_PROGRESS',
  CLEAR_ALL: 'CLEAR_ALL',
  GET_PREFERENCE: 'GET_PREFERENCE',
  UPDATE_PREFERENCE: 'UPDATE_PREFERENCE',
  START_AUTO_SEARCH: 'START_AUTO_SEARCH',
  STOP_AUTO_SEARCH: 'STOP_AUTO_SEARCH',
  PAUSE_AUTO_SEARCH: 'PAUSE_AUTO_SEARCH',
  RESUME_AUTO_SEARCH: 'RESUME_AUTO_SEARCH',
  GET_AUTO_SEARCH_STATE: 'GET_AUTO_SEARCH_STATE',
  DETECT_PAGE: 'DETECT_PAGE',
  EXTRACT_JOBS: 'EXTRACT_JOBS',
  CONTENT_SCRIPT_READY: 'CONTENT_SCRIPT_READY',
  EXPORT_DATA: 'EXPORT_DATA',
  PROCESS_DATA: 'PROCESS_DATA',
  RESOLVE_DOMAIN: 'RESOLVE_DOMAIN',
  FETCH_COMPANY_WEBSITE: 'FETCH_COMPANY_WEBSITE',
  CLICK_NEXT_PAGE: 'CLICK_NEXT_PAGE',
  // Supabase operations
  SUPABASE_GET_JOBS: 'SUPABASE_GET_JOBS',
  SUPABASE_GET_JOBS_BY_COMPANY: 'SUPABASE_GET_JOBS_BY_COMPANY',
  SUPABASE_GET_JOBS_BY_SOURCE: 'SUPABASE_GET_JOBS_BY_SOURCE',
  SUPABASE_GET_JOB_COUNT: 'SUPABASE_GET_JOB_COUNT',
  SUPABASE_DELETE_JOBS: 'SUPABASE_DELETE_JOBS',
  SUPABASE_SYNC_ALL: 'SUPABASE_SYNC_ALL',
  SUPABASE_HEALTH_CHECK: 'SUPABASE_HEALTH_CHECK',
  SUPABASE_ENQUEUE_TASKS: 'SUPABASE_ENQUEUE_TASKS',
  SUPABASE_GET_QUEUE: 'SUPABASE_GET_QUEUE',
  SUPABASE_GET_AGENTS: 'SUPABASE_GET_AGENTS',
  SHEETS_SYNC: 'SHEETS_SYNC',
  // Supabase Client Management operations
  SUPABASE_GET_CLIENTS: 'SUPABASE_GET_CLIENTS',
  SUPABASE_ENROLL_CLIENT: 'SUPABASE_ENROLL_CLIENT',
  SUPABASE_DELETE_CLIENT: 'SUPABASE_DELETE_CLIENT',
  SUPABASE_UPDATE_QUEUE_TASK: 'SUPABASE_UPDATE_QUEUE_TASK',
  SUPABASE_GET_RECRUITERS: 'SUPABASE_GET_RECRUITERS',
  SUPABASE_UPDATE_ALL_RECRUITERS_STATUS: 'SUPABASE_UPDATE_ALL_RECRUITERS_STATUS',
  SUPABASE_UPDATE_ALL_RECRUITERS_LEADS_SENT: 'SUPABASE_UPDATE_ALL_RECRUITERS_LEADS_SENT',
  SUPABASE_UPDATE_ALL_RECRUITERS_TEASER_THRESHOLD: 'SUPABASE_UPDATE_ALL_RECRUITERS_TEASER_THRESHOLD',
  SUPABASE_UPDATE_ALL_RECRUITERS_DAILY_LIMIT: 'SUPABASE_UPDATE_ALL_RECRUITERS_DAILY_LIMIT',
  SUPABASE_UPDATE_RECRUITER_STATUS: 'SUPABASE_UPDATE_RECRUITER_STATUS',
  SUPABASE_UPDATE_RECRUITER: 'SUPABASE_UPDATE_RECRUITER',
  SEND_GMAIL_MESSAGE: 'SEND_GMAIL_MESSAGE',
} as const;

export type MessageType = typeof MessageType[keyof typeof MessageType];

export interface ExtensionMessage {
  type: MessageType;
  payload?: any;
  tabId?: number;
  timestamp?: string;
}

// Page detection
export interface PageInfo {
  isJobBoard: boolean;
  platform?: string;
  pageType: PageType;
  jobCount?: number;
  hasPagination: boolean;
  paginationType?: PaginationType;
}

export type PageType = 'listing' | 'detail' | 'unknown';
export type PaginationType = 'traditional' | 'load-more' | 'infinite-scroll' | 'api-based';

// Storage keys
export const STORAGE_KEYS = {
  JOBS: 'recruitscout_jobs',
  STATE: 'recruitscout_state',
  SETTINGS: 'recruitscout_settings',
  EXTRACTED_JOBS: 'recruitscout_extracted_jobs',
} as const;

// Default export fields
export const DEFAULT_EXPORT_FIELDS: ExportField[] = [
  { key: 'title', label: 'job_title', enabled: true },
  { key: 'company', label: 'company', enabled: true },
  { key: 'companyDomain', label: 'company_domain', enabled: true },
  { key: 'location', label: 'job_location', enabled: true },
  { key: 'description', label: 'description', enabled: true },
  { key: 'url', label: 'job_post_url', enabled: true },
  { key: 'datePosted', label: 'date_posted', enabled: true },
  { key: 'employmentType', label: 'employment_type', enabled: true },
  { key: 'salary', label: 'salary', enabled: true },
  { key: 'status', label: 'status', enabled: true },
  { key: 'source', label: 'source', enabled: true },
];
