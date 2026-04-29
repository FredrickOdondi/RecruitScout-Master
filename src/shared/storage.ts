import {
  STORAGE_KEYS,
  JobData,
  ExtractionState,
  ExtensionSettings,
} from './types';
import { STORAGE_LIMITS } from './constants';

/**
 * Storage abstraction layer for Chrome Extension
 * Handles tiered storage (Sync, Local, IndexedDB) and automatic migration
 */
export class StorageManager {
  private static instance: StorageManager;
  private initialized = false;

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * Initialize storage manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure default settings exist
    await this.ensureDefaultSettings();
    this.initialized = true;
  }

  /**
   * Get item from storage
   */
  async get<T>(key: string): Promise<T | null> {
    const result = await chrome.storage.local.get(key);
    return result[key] || null;
  }

  /**
   * Set item in storage
   */
  async set<T>(key: string, value: T): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  /**
   * Remove item from storage
   */
  async remove(key: string | string[]): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  /**
   * Clear all storage
   */
  async clear(): Promise<void> {
    await chrome.storage.local.clear();
  }

  /**
   * Get all jobs
   */
  async getJobs(): Promise<JobData[]> {
    // Check if jobs are chunked
    const metadata = await this.get<{ count: number, chunkCount: number }>(STORAGE_KEYS.JOBS + '_metadata');
    if (metadata) {
      const recombined: JobData[] = [];
      for (let i = 0; i < metadata.chunkCount; i++) {
        const chunkStr = await this.get<string>(`${STORAGE_KEYS.JOBS}_chunk_${i}`);
        if (chunkStr) {
          try {
            const parsed = JSON.parse(chunkStr);
            recombined.push(...parsed);
          } catch (e) {
            console.error('[RecruitScout] Chunk parse error', e);
          }
        }
      }
      return recombined;
    }

    const jobs = await this.get<JobData[]>(STORAGE_KEYS.JOBS);
    return jobs || [];
  }

  /**
   * Set jobs (handles chunking for large datasets)
   */
  async setJobs(jobs: JobData[]): Promise<void> {
    const jobsJson = JSON.stringify(jobs);
    const size = new Blob([jobsJson]).size;

    if (size > STORAGE_LIMITS.LOCAL_MAX_BYTES) {
      // Clean up the non-chunked key
      await this.remove(STORAGE_KEYS.JOBS);
      
      // Store in discrete keys to perfectly bypass the 5MB single-item quota!
      const chunks = this.chunkJobs(jobs, STORAGE_LIMITS.CHUNK_SIZE);
      for (let i = 0; i < chunks.length; i++) {
        await this.set(`${STORAGE_KEYS.JOBS}_chunk_${i}`, chunks[i]);
      }
      // Also cleanup any orphaned old chunks if length decreased
      const oldMetadata = await this.get<{ count: number, chunkCount: number }>(STORAGE_KEYS.JOBS + '_metadata');
      if (oldMetadata && oldMetadata.chunkCount > chunks.length) {
          for (let i = chunks.length; i < oldMetadata.chunkCount; i++) {
              await this.remove(`${STORAGE_KEYS.JOBS}_chunk_${i}`);
          }
      }
      await this.set(STORAGE_KEYS.JOBS + '_metadata', { count: jobs.length, chunkCount: chunks.length });
    } else {
      await this.set(STORAGE_KEYS.JOBS, jobs);
      // Clean up old chunks if they existed
      const oldMetadata = await this.get<{ count: number, chunkCount: number }>(STORAGE_KEYS.JOBS + '_metadata');
      if (oldMetadata) {
          for (let i = 0; i < oldMetadata.chunkCount; i++) {
              await this.remove(`${STORAGE_KEYS.JOBS}_chunk_${i}`);
          }
          await this.remove(STORAGE_KEYS.JOBS + '_metadata');
      }
    }
  }

  /**
   * Add jobs to storage
   */
  async addJobs(newJobs: JobData[]): Promise<void> {
    const existingJobs = await this.getJobs();
    const combinedJobs = [...existingJobs, ...newJobs];
    const uniqueJobs = this.deduplicateJobs(combinedJobs);
    await this.setJobs(uniqueJobs);
  }

  /**
   * Update job in storage
   */
  async updateJob(jobId: string, updates: Partial<JobData>): Promise<void> {
    const jobs = await this.getJobs();
    const index = jobs.findIndex(job => job.id === jobId);
    if (index !== -1) {
      jobs[index] = { ...jobs[index], ...updates };
      await this.setJobs(jobs);
    }
  }

  /**
   * Delete jobs from storage
   */
  async deleteJobs(jobIds: string[]): Promise<void> {
    const jobs = await this.getJobs();
    const filteredJobs = jobs.filter(job => !jobIds.includes(job.id));
    await this.setJobs(filteredJobs);
  }

  /**
   * Get extraction state
   */
  async getState(): Promise<ExtractionState> {
    const state = await this.get<ExtractionState>(STORAGE_KEYS.STATE);
    return state || this.getDefaultState();
  }

  /**
   * Set extraction state
   */
  async setState(state: ExtractionState): Promise<void> {
    await this.set(STORAGE_KEYS.STATE, state);
  }

  /**
   * Get settings
   */
  async getSettings(): Promise<ExtensionSettings> {
    const settings = await this.get<ExtensionSettings>(STORAGE_KEYS.SETTINGS);
    return { ...this.getDefaultSettings(), ...settings };
  }

  /**
   * Set settings
   */
  async setSettings(settings: Partial<ExtensionSettings>): Promise<void> {
    const currentSettings = await this.getSettings();
    await this.set(STORAGE_KEYS.SETTINGS, { ...currentSettings, ...settings });
  }

  /**
   * Clear all data
   */
  async clearAllData(): Promise<void> {
    await Promise.all([
      this.remove(STORAGE_KEYS.JOBS),
      this.remove(STORAGE_KEYS.JOBS + '_chunks'),
      this.remove(STORAGE_KEYS.JOBS + '_metadata'),
      this.remove(STORAGE_KEYS.EXTRACTED_JOBS),
      this.remove(STORAGE_KEYS.EXTRACTED_JOBS + '_chunks'),
      this.remove(STORAGE_KEYS.EXTRACTED_JOBS + '_metadata'),
    ]);
  }

  /**
   * Get storage usage
   */
  async getUsage(): Promise<{ used: number; limit: number; percentage: number }> {
    const result = await chrome.storage.local.getBytesInUse(null);
    const used = (result as unknown) as number;
    return {
      used,
      limit: STORAGE_LIMITS.LOCAL_MAX_BYTES,
      percentage: (used / STORAGE_LIMITS.LOCAL_MAX_BYTES) * 100,
    };
  }

  /**
   * Subscribe to storage changes
   */
  onStorageChanged(callback: (changes: Record<string, chrome.storage.StorageChange>) => void): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local') {
        callback(changes);
      }
    });
  }

  /**
   * Ensure default settings exist
   */
  private async ensureDefaultSettings(): Promise<void> {
    const settings = await this.getSettings();
    await this.set(STORAGE_KEYS.SETTINGS, settings);
  }

  /**
   * Get default state
   */
  private getDefaultState(): ExtractionState {
    return {
      status: 'idle',
      mode: 'current-page',
      progress: 0,
      totalJobs: 0,
      extractedJobs: 0,
      errors: 0,
    };
  }

  /**
   * Get default settings
   */
  private getDefaultSettings(): ExtensionSettings {
    return {
      autoExtract: false,
      maxJobsPerPage: 100,
      paginationLimit: 10,
      crawlDelay: 1000,
      respectRobotsTxt: true,
      notificationEnabled: true,
      darkMode: false,
      language: 'en',
    };
  }

  /**
   * Chunk jobs for storage
   */
  private chunkJobs(jobs: JobData[], chunkSize: number): string[] {
    const chunks: string[] = [];
    for (let i = 0; i < jobs.length; i += chunkSize) {
      chunks.push(JSON.stringify(jobs.slice(i, i + chunkSize)));
    }
    return chunks;
  }

  private deduplicateJobs(jobs: JobData[]): JobData[] {
    const seen = new Map<string, JobData>();

    for (const job of jobs) {
      const baseUrl = job.url.split('?')[0];
      const key = `${baseUrl}-${job.title}-${job.company}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, job);
      } else {
        // Merge data, preferring more complete records
        const merged = { ...existing };
        if (!merged.salary && job.salary) merged.salary = job.salary;
        if (!merged.description && job.description) merged.description = job.description;
        if (!existing.metadata && job.metadata) {
          merged.metadata = { ...existing.metadata, ...job.metadata };
        }
        seen.set(key, merged);
      }
    }

    return Array.from(seen.values());
  }
}

// Export singleton instance
export const storage = StorageManager.getInstance();
