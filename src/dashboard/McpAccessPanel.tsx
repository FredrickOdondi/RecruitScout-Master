import React, { useCallback, useEffect, useState } from 'react';
import { Check, Copy, KeyRound, Plug, TriangleAlert } from 'lucide-react';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseClient } from '../shared/supabase';

/**
 * Settings → Connect an AI agent (MCP).
 * A signed-in user creates a personal MCP URL that carries their key. The key is
 * created and hashed in Postgres (create_mcp_key) and is shown only once.
 */

interface McpKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

const MCP_BASE = `${SUPABASE_URL}/functions/v1/mcp`;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Never';

async function listKeys(): Promise<McpKey[]> {
  const token = supabaseClient.getSession()?.access_token;
  if (!token) throw new Error('Your session has ended. Sign in again.');
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/mcp_keys?select=id,name,key_prefix,created_at,last_used_at,revoked_at&order=created_at.desc`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) },
  );
  if (!res.ok) throw new Error(`Couldn't load your keys (HTTP ${res.status}).`);
  return res.json();
}

const CopyButton: React.FC<{ value: string; label: string }> = ({ value, label }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard blocked: the text is selectable */ }
      }}
      className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      aria-label={label}
    >
      {copied ? <Check size={14} className="text-success-600" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
};

const McpAccessPanel: React.FC = () => {
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [revoking, setRevoking] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setKeys(await listKeys());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn\'t load your keys.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async () => {
    setCreating(true);
    setError('');
    const res = await supabaseClient.callUserRpc<{ id: string; key: string }>('create_mcp_key', { p_name: name.trim() || 'MCP key' });
    setCreating(false);
    if (res.error || !res.data?.key) {
      setError(res.error || 'Couldn\'t create a key.');
      return;
    }
    setNewUrl(`${MCP_BASE}/${res.data.key}`);
    setName('');
    refresh();
  };

  const revoke = async (key: McpKey) => {
    if (!window.confirm(`Revoke "${key.name}"? Agents using this URL lose access straight away.`)) return;
    setRevoking(key.id);
    const res = await supabaseClient.callUserRpc<boolean>('revoke_mcp_key', { p_id: key.id });
    setRevoking(null);
    if (res.error) setError(res.error);
    refresh();
  };

  const active = keys.filter((k) => !k.revoked_at);
  const revoked = keys.filter((k) => k.revoked_at);
  const cliLine = newUrl ? `claude mcp add --transport http recruitscout ${newUrl}` : '';

  return (
    <section className="lg:col-span-2 bg-white rounded-md p-5 border border-gray-200 space-y-4" aria-labelledby="mcp-heading">
      <div className="flex items-start gap-3 border-b border-gray-200 pb-3">
        <Plug size={18} className="text-gray-500 mt-0.5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <h3 id="mcp-heading" className="text-xs font-semibold text-gray-900">Connect an AI agent (MCP)</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Give Claude or another MCP client a personal URL. It can then do everything you can do here: the queue and agents,
            jobs, clients and Sheets, recruiters and lead emails, Indeed accounts, Blue.cc, the database and the Assistant chat.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col sm:flex-row gap-2"
        onSubmit={(e) => { e.preventDefault(); if (!creating) create(); }}
      >
        <label htmlFor="mcp-key-name" className="sr-only">Key name</label>
        <input
          id="mcp-key-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name, e.g. Claude Desktop"
          maxLength={60}
          className="flex-1 min-w-0 px-3 py-2 rounded border border-gray-200 bg-white text-xs text-gray-900 placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={creating}
          className="inline-flex items-center justify-center gap-1.5 bg-accent hover:bg-primary-400 text-on-accent font-semibold px-3 py-2 rounded text-xs disabled:bg-subtle disabled:text-fg-subtle"
        >
          <KeyRound size={14} aria-hidden />
          {creating ? 'Generating…' : 'Generate MCP URL'}
        </button>
      </form>

      {newUrl && (
        <div className="rounded-md border border-primary-200 bg-primary-50 p-4 space-y-3" role="status">
          <div className="text-xs font-semibold text-gray-900">Your MCP URL. Copy it now: it won't be shown again.</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs text-gray-900 font-mono select-all">{newUrl}</code>
            <CopyButton value={newUrl} label="Copy MCP URL" />
          </div>
          <div className="text-xs text-gray-600 space-y-1.5">
            <div><span className="font-medium text-gray-900">Claude (web or desktop):</span> Settings → Connectors → Add custom connector, then paste the URL.</div>
            <div className="font-medium text-gray-900">Claude Code:</div>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate px-2.5 py-1.5 rounded border border-gray-200 bg-white text-xs text-gray-900 font-mono select-all">{cliLine}</code>
              <CopyButton value={cliLine} label="Copy Claude Code command" />
            </div>
          </div>
          <button type="button" onClick={() => setNewUrl('')} className="text-xs font-medium text-primary-700 hover:underline">I've saved it</button>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-gray-500">
        <TriangleAlert size={14} className="text-warning-600 mt-0.5 shrink-0" aria-hidden />
        Anyone with the URL can act as you. Keep it private and revoke it if it leaks.
      </p>

      {error && <p className="text-xs text-danger-600" role="alert">{error}</p>}

      <div>
        <div className="text-xs font-semibold text-gray-500 mb-2">Your keys</div>
        {loading ? (
          <p className="text-xs text-gray-500">Loading…</p>
        ) : !active.length ? (
          <p className="text-xs text-gray-500">No active keys yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-200">
                  <th className="py-2 pr-3 font-medium">Name</th>
                  <th className="py-2 pr-3 font-medium">Key</th>
                  <th className="py-2 pr-3 font-medium hidden sm:table-cell">Created</th>
                  <th className="py-2 pr-3 font-medium">Last used</th>
                  <th className="py-2 font-medium sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {active.map((k) => (
                  <tr key={k.id} className="border-b border-gray-100 last:border-0">
                    <td className="py-2 pr-3 text-gray-900 font-medium">{k.name}</td>
                    <td className="py-2 pr-3 font-mono text-gray-600">{k.key_prefix}…</td>
                    <td className="py-2 pr-3 text-gray-600 hidden sm:table-cell">{formatDate(k.created_at)}</td>
                    <td className="py-2 pr-3 text-gray-600">{formatDate(k.last_used_at)}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => revoke(k)}
                        disabled={revoking === k.id}
                        className="px-2.5 py-1 rounded border border-gray-200 text-xs font-medium text-danger-600 hover:bg-danger-50 disabled:bg-subtle disabled:text-fg-subtle"
                      >
                        {revoking === k.id ? 'Revoking…' : 'Revoke'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {revoked.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">{revoked.length} revoked {revoked.length === 1 ? 'key' : 'keys'} no longer work.</p>
        )}
      </div>
    </section>
  );
};

export default McpAccessPanel;
