/**
 * Test setup utilities
 */
export function setupTestEnvironment() {
  // Mock Chrome API
  global.chrome = {
    runtime: {
      sendMessage: jest.fn(),
      onMessage: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      getURL: jest.fn(path => path),
      getManifest: jest.fn(() => ({ name: 'RecruitScout', version: '1.0.0' })),
    },
    storage: {
      local: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn(),
        getBytesInUse: jest.fn(),
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
      sync: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn(),
        getBytesInUse: jest.fn(),
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn(),
        },
      },
    },
    tabs: {
      query: jest.fn(),
      get: jest.fn(),
      sendMessage: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      onActivated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
      onUpdated: {
        addListener: jest.fn(),
        removeListener: jest.fn(),
      },
    },
  } as any;
}

export function createMockJob(overrides: Partial<any> = {}): any {
  return {
    id: 'test-job-1',
    title: 'Software Engineer',
    company: 'Tech Company',
    location: 'San Francisco, CA',
    employmentType: 'full-time',
    url: 'https://example.com/job/123',
    description: 'Test job description',
    source: 'example.com',
    extractedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockJobs(count: number = 5): any[] {
  return Array.from({ length: count }, (_, i) => createMockJob({
    id: `test-job-${i}`,
    title: `Job ${i + 1}`,
  }));
}
