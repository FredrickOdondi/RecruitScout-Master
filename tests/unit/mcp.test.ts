// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { handleRpc, listTools, annotationsFor, BRIDGE_TOOLS, SUPPORTED_PROTOCOLS } from '../../src/mcp/runtime';
import { ASSISTANT_TOOLS } from '../../src/dashboard/assistant/tools';

const noRun = async () => { throw new Error('should not run'); };

describe('MCP JSON-RPC', () => {
  it('initializes with a supported protocol', async () => {
    const r: any = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, noRun);
    expect(r.result.protocolVersion).toBe('2025-03-26');
    expect(r.result.capabilities.tools).toBeDefined();
    expect(r.result.serverInfo.name).toBe('recruitscout');
  });

  it('falls back to the newest protocol for unknown versions', async () => {
    const r: any = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } }, noRun);
    expect(r.result.protocolVersion).toBe(SUPPORTED_PROTOCOLS[0]);
  });

  it('does not answer notifications', async () => {
    expect(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, noRun)).toBeNull();
  });

  it('rejects unknown methods', async () => {
    const r: any = await handleRpc({ jsonrpc: '2.0', id: 7, method: 'nope' }, noRun);
    expect(r.error.code).toBe(-32601);
    expect(r.id).toBe(7);
  });

  it('routes tools/call and turns a throw into an error result', async () => {
    const ok: any = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'x', arguments: { a: 1 } } },
      async (name, args) => ({ content: [{ type: 'text', text: `${name}:${JSON.stringify(args)}` }], isError: false }));
    expect(ok.result.content[0].text).toBe('x:{"a":1}');
    const bad: any = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'x' } }, noRun);
    expect(bad.result.isError).toBe(true);
    const missing: any = await handleRpc({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: {} }, noRun);
    expect(missing.error.code).toBe(-32602);
  });
});

describe('MCP tool list', () => {
  const tools = listTools();

  it('exposes every Assistant tool except dashboard navigation, plus the chat tools', () => {
    const names = new Set(tools.map((t) => t.name));
    for (const t of ASSISTANT_TOOLS) expect(names.has(t.name)).toBe(t.name !== 'open_dashboard_view');
    for (const n of ['assistant_chat', 'list_chat_threads', 'read_chat_thread', 'get_bridge_command']) expect(names.has(n)).toBe(true);
  });

  it('marks risk with MCP annotations', () => {
    for (const t of ASSISTANT_TOOLS.filter((x) => x.name !== 'open_dashboard_view')) {
      const a = tools.find((x) => x.name === t.name)!.annotations;
      expect(a.readOnlyHint).toBe(t.risk === 'read');
      expect(a.destructiveHint).toBe(!['read', 'write'].includes(t.risk));
    }
    expect(annotationsFor('destructive', 'x').destructiveHint).toBe(true);
  });

  it('lets browser tools pick an agent without changing the Assistant schema', () => {
    for (const name of BRIDGE_TOOLS) {
      const t = tools.find((x) => x.name === name)!;
      expect(t.inputSchema.properties?.agent).toBeDefined();
      expect(ASSISTANT_TOOLS.find((x) => x.name === name)!.parameters.properties?.agent).toBeUndefined();
    }
  });
});

describe('MCP keys', () => {
  it('hashes keys the way Postgres does (sha256 hex of the UTF-8 key)', () => {
    // Value from: select encode(sha256(convert_to('rs_test', 'UTF8')), 'hex')
    expect(createHash('sha256').update('rs_test', 'utf8').digest('hex'))
      .toBe('4c1d40b6ae24393835b280432c24d4018b00e2f858f6a0ff18fd4a7ea017c515');
  });
});
