import { JobData } from '../shared/types';

export interface QueueJob {
  id: string;
  tabId: number;
  url: string;
  priority: number;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retries: number;
  data?: any;
}

export interface QueueStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

/**
 * Extraction queue for managing concurrent tab operations
 */
export class ExtractionQueue {
  private static instance: ExtractionQueue;
  private queue: Map<string, QueueJob> = new Map();
  private processing: Set<string> = new Set();
  private maxConcurrent: number;
  private callbacks: Map<string, (job: QueueJob) => void> = new Map();

  private constructor(maxConcurrent: number = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  static getInstance(maxConcurrent?: number): ExtractionQueue {
    if (!ExtractionQueue.instance) {
      ExtractionQueue.instance = new ExtractionQueue(maxConcurrent);
    }
    return ExtractionQueue.instance;
  }

  /**
   * Add job to queue
   */
  async add(job: Omit<QueueJob, 'id' | 'createdAt' | 'status' | 'retries'>): Promise<string> {
    const queueJob: QueueJob = {
      ...job,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
      status: 'pending',
      retries: 0,
    };

    this.queue.set(queueJob.id, queueJob);
    this.processQueue();

    return queueJob.id;
  }

  /**
   * Add multiple jobs to queue
   */
  async addMany(jobs: Omit<QueueJob, 'id' | 'createdAt' | 'status' | 'retries'>[]): Promise<string[]> {
    const jobIds: string[] = [];
    for (const job of jobs) {
      const jobId = await this.add(job);
      jobIds.push(jobId);
    }
    return jobIds;
  }

  /**
   * Remove job from queue
   */
  remove(jobId: string): boolean {
    return this.queue.delete(jobId);
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.queue.clear();
    this.processing.clear();
  }

  /**
   * Get job by ID
   */
  get(jobId: string): QueueJob | undefined {
    return this.queue.get(jobId);
  }

  /**
   * Get all jobs
   */
  getAll(): QueueJob[] {
    return Array.from(this.queue.values());
  }

  /**
   * Get queue statistics
   */
  getStats(): QueueStats {
    const jobs = this.getAll();
    return {
      total: jobs.length,
      pending: jobs.filter(j => j.status === 'pending').length,
      processing: jobs.filter(j => j.status === 'processing').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
    };
  }

  /**
   * Get jobs by status
   */
  getByStatus(status: QueueJob['status']): QueueJob[] {
    return this.getAll().filter(job => job.status === status);
  }

  /**
   * Get jobs by tab ID
   */
  getByTabId(tabId: number): QueueJob[] {
    return this.getAll().filter(job => job.tabId === tabId);
  }

  /**
   * Update job status
   */
  updateStatus(jobId: string, status: QueueJob['status']): void {
    const job = this.queue.get(jobId);
    if (job) {
      job.status = status;
      if (status === 'completed' || status === 'failed') {
        this.processing.delete(jobId);
      }
    }
  }

  /**
   * Mark job as completed with data
   */
  complete(jobId: string, data: any): void {
    const job = this.queue.get(jobId);
    if (job) {
      job.status = 'completed';
      job.data = data;
      this.processing.delete(jobId);
      this.processQueue();
    }
  }

  /**
   * Mark job as failed
   */
  fail(jobId: string, error: any): void {
    const job = this.queue.get(jobId);
    if (job) {
      job.retries++;
      if (job.retries >= 3) {
        job.status = 'failed';
      } else {
        job.status = 'pending';
      }
      this.processing.delete(jobId);
      this.processQueue();
    }
  }

  /**
   * Register callback for completed jobs
   */
  onCompleted(callback: (job: QueueJob) => void): void {
    this.callbacks.set('completed', callback);
  }

  /**
   * Register callback for failed jobs
   */
  onFailed(callback: (job: QueueJob) => void): void {
    this.callbacks.set('failed', callback);
  }

  /**
   * Pause queue processing
   */
  pause(): void {
    this.maxConcurrent = 0;
  }

  /**
   * Resume queue processing
   */
  resume(maxConcurrent: number = 3): void {
    this.maxConcurrent = maxConcurrent;
    this.processQueue();
  }

  /**
   * Set max concurrent jobs
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrent = max;
    this.processQueue();
  }

  /**
   * Process queue
   */
  private processQueue(): void {
    const pending = this.getByStatus('pending');
    const processing = this.getByStatus('processing');

    if (processing.length >= this.maxConcurrent) {
      return;
    }

    const available = this.maxConcurrent - processing.length;
    const toProcess = pending
      .sort((a, b) => b.priority - a.priority)
      .slice(0, available);

    for (const job of toProcess) {
      this.processJob(job);
    }
  }

  /**
   * Process a single job
   */
  private processJob(job: QueueJob): void {
    job.status = 'processing';
    this.processing.add(job.id);

    // Trigger job processing through the queue system
    // The actual processing is handled by the extraction orchestrator
  }
}

export const extractionQueue = ExtractionQueue.getInstance();
