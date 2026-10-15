import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

describe('impeccable provider id', () => {
  it('exports IMPECCABLE_PROVIDER_ID === "perplexity"', async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const providerPath = path.resolve(__dirname, '../../.claude/skills/impeccable/scripts/lib/provider.mjs');
    const mod = await import(pathToFileURL(providerPath).href);
    expect(mod.IMPECCABLE_PROVIDER_ID).toBe('perplexity');
  });
});
