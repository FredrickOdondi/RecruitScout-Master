import { describe, it, expect } from 'vitest';
import { EXTENSION_VERSION } from '../../src/shared/constants';

describe('constants', () => {
  it('EXTENSION_VERSION should be 1.0.1', () => {
    expect(EXTENSION_VERSION).toBe('1.0.1');
  });
});
