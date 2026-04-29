import { describe, it, expect, beforeEach } from 'vitest';
import { CSVExporter } from '../../src/lib/export/csv-exporter';
import { JSONExporter } from '../../src/lib/export/json-exporter';
import { createMockJobs } from '../utils/setup';

describe('CSV Exporter', () => {
  let jobs: any[];

  beforeEach(() => {
    jobs = createMockJobs(3);
  });

  describe('export', () => {
    it('should export jobs to CSV format', () => {
      const csv = CSVExporter.export(jobs);
      expect(csv).toContain('title,company,location');
      expect(csv).toContain(jobs[0].title);
      expect(csv).toContain(jobs[0].company);
    });

    it('should include UTF-8 BOM', () => {
      const csv = CSVExporter.export(jobs);
      expect(csv.startsWith('\uFEFF')).toBe(true);
    });

    it('should escape special characters', () => {
      const jobWithSpecialChars = {
        ...jobs[0],
        title: 'Title with "quotes"',
        description: 'Line 1\nLine 2',
      };
      const csv = CSVExporter.export([jobWithSpecialChars]);
      expect(csv).toContain('"Title with ""quotes"""');
    });

    it('should include headers by default', () => {
      const csv = CSVExporter.export(jobs);
      const lines = csv.split('\n');
      expect(lines[0]).toContain('title');
    });

    it('should respect includeHeaders option', () => {
      const csv = CSVExporter.export(jobs, { includeHeaders: false });
      const lines = csv.split('\n');
      expect(lines[0]).not.toContain('title');
    });
  });

  describe('parse', () => {
    it('should parse CSV string to array', () => {
      const csv = CSVExporter.export(jobs);
      const parsed = CSVExporter.parse(csv);
      expect(parsed).toHaveLength(jobs.length);
    });

    it('should handle quoted fields', () => {
      const csv = 'name,value\n"John, Doe","30"\n"Jane, Smith","25"';
      const parsed = CSVExporter.parse(csv);
      expect(parsed[0].name).toBe('John, Doe');
    });
  });
});

describe('JSON Exporter', () => {
  let jobs: any[];

  beforeEach(() => {
    jobs = createMockJobs(3);
  });

  describe('export', () => {
    it('should export jobs to JSON format', () => {
      const json = JSONExporter.export(jobs);
      const parsed = JSON.parse(json);
      expect(parsed.jobs).toHaveLength(jobs.length);
      expect(parsed.totalJobs).toBe(jobs.length);
    });

    it('should include timestamp by default', () => {
      const json = JSONExporter.export(jobs);
      const parsed = JSON.parse(json);
      expect(parsed.exportedAt).toBeDefined();
    });

    it('should respect pretty option', () => {
      const pretty = JSONExporter.export(jobs, { pretty: true });
      const ugly = JSONExporter.export(jobs, { pretty: false });
      expect(pretty.length).toBeGreaterThan(ugly.length);
    });

    it('should respect includeMetadata option', () => {
      const jobsWithMetadata = jobs.map(job => ({
        ...job,
        metadata: { test: 'value' },
      }));
      const json = JSONExporter.export(jobsWithMetadata, { includeMetadata: true });
      const parsed = JSON.parse(json);
      expect(parsed.jobs[0].metadata).toBeDefined();
    });

    it('should respect wrapInObject option', () => {
      const arrayJson = JSONExporter.export(jobs, { wrapInObject: false });
      const parsed = JSON.parse(arrayJson);
      expect(Array.isArray(parsed)).toBe(true);
    });
  });

  describe('parse', () => {
    it('should parse JSON string to jobs', () => {
      const json = JSONExporter.export(jobs);
      const parsed = JSONExporter.parse(json);
      expect(parsed).toHaveLength(jobs.length);
      expect(parsed[0].title).toBe(jobs[0].title);
    });

    it('should handle array format', () => {
      const json = JSON.stringify(jobs);
      const parsed = JSONExporter.parse(json);
      expect(parsed).toHaveLength(jobs.length);
    });
  });

  describe('validate', () => {
    it('should validate correct JSON', () => {
      const json = JSONExporter.export(jobs);
      const validation = JSONExporter.validate(json);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect missing required fields', () => {
      const invalidJob = { id: 'test' }; // Missing title and url
      const json = JSON.stringify([invalidJob]);
      const validation = JSONExporter.validate(json);
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should detect invalid JSON syntax', () => {
      const validation = JSONExporter.validate('not valid json');
      expect(validation.valid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
