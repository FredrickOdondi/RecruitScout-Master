import { ExtractionState, ExtensionSettings, JobData } from '../shared/types';
import { storage } from '../shared/storage';

type Subscriber = (state: ExtractionState) => void;

/**
 * Centralized state management for the extension
 * Implements pub/sub pattern for reactive updates
 */
export class StateManager {
  private static instance: StateManager;
  private state: ExtractionState;
  private subscribers: Set<Subscriber> = new Set();

  private constructor() {
    this.state = this.getInitialState();
  }

  static getInstance(): StateManager {
    if (!StateManager.instance) {
      StateManager.instance = new StateManager();
    }
    return StateManager.instance;
  }

  /**
   * Initialize state manager from storage
   */
  async initialize(): Promise<void> {
    const savedState = await storage.getState();
    this.state = { ...this.getInitialState(), ...savedState };
    this.notifySubscribers();
  }

  /**
   * Get current state
   */
  getState(): ExtractionState {
    return { ...this.state };
  }

  /**
   * Update state
   */
  async setState(updates: Partial<ExtractionState>): Promise<void> {
    const newState = { ...this.state, ...updates };
    newState.lastUpdate = new Date().toISOString();
    this.state = newState;
    await storage.setState(this.state);
    this.notifySubscribers();
  }

  /**
   * Reset state to initial values
   */
  async resetState(): Promise<void> {
    this.state = this.getInitialState();
    await storage.setState(this.state);
    this.notifySubscribers();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  /**
   * Get progress percentage
   */
  getProgress(): number {
    if (this.state.totalJobs === 0) return 0;
    return Math.round((this.state.extractedJobs / this.state.totalJobs) * 100);
  }

  /**
   * Check if extraction is running
   */
  isRunning(): boolean {
    return this.state.status === 'running';
  }

  /**
   * Check if extraction is paused
   */
  isPaused(): boolean {
    return this.state.status === 'paused';
  }

  /**
   * Check if extraction is idle
   */
  isIdle(): boolean {
    return this.state.status === 'idle';
  }

  /**
   * Notify all subscribers
   */
  private notifySubscribers(): void {
    this.subscribers.forEach(callback => callback(this.getState()));
  }

  /**
   * Get initial state
   */
  private getInitialState(): ExtractionState {
    return {
      status: 'idle',
      mode: 'current-page',
      progress: 0,
      totalJobs: 0,
      extractedJobs: 0,
      errors: 0,
      lastUpdate: new Date().toISOString(),
    };
  }
}

export const stateManager = StateManager.getInstance();
