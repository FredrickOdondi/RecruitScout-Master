import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

describe('impeccable provider id', () => {
  it('exports IMPECCABLE_PROVIDER_ID === "perplexity"', async () => {
    const providerPath = path.resolve('.claude/skills/impeccable/scripts/lib/provider.mjs');
    const mod = await import(pathToFileURL(providerPath).href);
    expect(mod.IMPECCABLE_PROVIDER_ID).toBe('perplexity');
  });
});
