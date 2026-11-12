import type { JsonSchema } from './types';

/**
 * Checks tool arguments against the JSON-schema subset the tools use, and
 * coerces obvious mistakes (numbers sent as strings, single values for arrays).
 * Returns cleaned arguments, or an error the model can act on.
 */
export function validateArgs(
  schema: JsonSchema,
  raw: unknown,
): { ok: true; args: Record<string, any> } | { ok: false; error: string } {
  const input = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
  const props = schema.properties || {};
  const out: Record<string, any> = {};
  const problems: string[] = [];

  for (const key of Object.keys(input)) {
    if (!(key in props)) {
      if (schema.additionalProperties === false) {
        problems.push(`"${key}" is not a valid argument`);
      } else {
        out[key] = input[key];
      }
    }
  }

  for (const [key, prop] of Object.entries(props)) {
    const value = input[key];
    if (value === undefined || value === null || value === '') {
      if (schema.required?.includes(key)) problems.push(`"${key}" is required`);
      continue;
    }
    const checked = checkValue(key, prop, value);
    if ('error' in checked) problems.push(checked.error);
    else out[key] = checked.value;
  }

  return problems.length ? { ok: false, error: `Invalid arguments: ${problems.join('; ')}.` } : { ok: true, args: out };
}

function checkValue(path: string, schema: JsonSchema, value: any): { value: any } | { error: string } {
  switch (schema.type) {
    case 'string': {
      if (typeof value === 'number' || typeof value === 'boolean') value = String(value);
      if (typeof value !== 'string') return { error: `"${path}" must be text` };
      if (schema.enum && !schema.enum.includes(value)) return { error: `"${path}" must be one of ${schema.enum.join(', ')}` };
      return { value };
    }
    case 'number':
    case 'integer': {
      const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof n !== 'number' || Number.isNaN(n)) return { error: `"${path}" must be a number` };
      if (schema.type === 'integer' && !Number.isInteger(n)) return { error: `"${path}" must be a whole number` };
      if (schema.minimum !== undefined && n < schema.minimum) return { error: `"${path}" must be at least ${schema.minimum}` };
      if (schema.maximum !== undefined && n > schema.maximum) return { error: `"${path}" must be at most ${schema.maximum}` };
      return { value: n };
    }
    case 'boolean': {
      if (value === 'true') return { value: true };
      if (value === 'false') return { value: false };
      if (typeof value !== 'boolean') return { error: `"${path}" must be true or false` };
      return { value };
    }
    case 'array': {
      const arr = Array.isArray(value) ? value : [value];
      if (!schema.items) return { value: arr };
      const items: any[] = [];
      for (let i = 0; i < arr.length; i++) {
        const r = checkValue(`${path}[${i}]`, schema.items, arr[i]);
        if ('error' in r) return r;
        items.push(r.value);
      }
      return { value: items };
    }
    case 'object': {
      if (typeof value !== 'object' || Array.isArray(value)) return { error: `"${path}" must be an object` };
      if (!schema.properties) return { value };
      const nested = validateArgs(schema, value);
      return 'error' in nested ? { error: `${path}: ${nested.error}` } : { value: nested.args };
    }
    default:
      return { value };
  }
}

/** Stable JSON (sorted keys) so the same arguments always produce the same approval key. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

/** The key an approval is bound to: the tool name plus its exact arguments. */
export function approvalKey(name: string, args: Record<string, unknown>): string {
  return `${name}:${stableStringify(args)}`;
}
