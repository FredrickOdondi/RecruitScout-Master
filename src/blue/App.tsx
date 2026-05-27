import React, { useState, useEffect } from 'react';
import { supabaseClient } from '../shared/supabase';
import { BlueCcClient } from '../shared/bluecc';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [tokenId, setTokenId] = useState('');
  const [secretId, setSecretId] = useState('');
  const [companyId, setCompanyId] = useState('');
  
  const [client, setClient] = useState<BlueCcClient | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any | null>(null);

  // Sub tabs: 'workspaces', 'create', 'members', 'webhooks'
  const [activeSubTab, setActiveSubTab] = useState('workspaces');

  // Form states
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [webhookUrl, setWebhookUrl] = useState('');

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoading(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const res = await supabaseClient.getUserIntegration(session.user.id);
      if (res.data) {
        setTokenId(res.data.bluecc_token_id || '');
        setSecretId(res.data.bluecc_secret_id || '');
        setCompanyId(res.data.bluecc_company_id || '');
        
        if (res.data.bluecc_token_id && res.data.bluecc_secret_id) {
          const newClient = new BlueCcClient(
            res.data.bluecc_token_id, 
            res.data.bluecc_secret_id, 
            res.data.bluecc_company_id || undefined
          );
          setClient(newClient);
          fetchWorkspaces(newClient);
        }
      }
    }
    setLoading(false);
  };

  const handleSaveCredentials = async () => {
    setSaving(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const payload = {
        user_id: session.user.id,
        bluecc_token_id: tokenId,
        bluecc_secret_id: secretId,
        bluecc_company_id: companyId
      };
      const res = await supabaseClient.upsertUserIntegration(payload);
      if (res.error) {
        alert('Error saving credentials: ' + res.error);
      } else {
        alert('Credentials saved successfully!');
        const newClient = new BlueCcClient(tokenId, secretId, companyId || undefined);
        setClient(newClient);
        fetchWorkspaces(newClient);
      }
    }
    setSaving(false);
  };

  const fetchWorkspaces = async (blueClient: BlueCcClient) => {
    try {
      const data = await blueClient.getWorkspaces();
      setWorkspaces(data);
    } catch (err) {
      console.error(err);
      // alert('Failed to fetch workspaces: ' + (err as Error).message);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newWorkspaceName) return;
    try {
      await client.createWorkspace(newWorkspaceName, newWorkspaceDesc);
      alert('Workspace created!');
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      fetchWorkspaces(client);
      setActiveSubTab('workspaces');
    } catch (err) {
      alert('Error creating workspace: ' + (err as Error).message);
    }
  };

  const handleInviteUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedWorkspace || !inviteEmail) return;
    try {
      await client.inviteUser(selectedWorkspace.id, inviteEmail);
      alert(`Invited ${inviteEmail} to workspace!`);
      setInviteEmail('');
    } catch (err) {
      alert('Error inviting user: ' + (err as Error).message);
    }
  };

  const handleRegisterWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !selectedWorkspace || !webhookUrl) return;
    try {
      await client.registerWebhook(selectedWorkspace.id, webhookUrl);
      alert('Webhook registered successfully!');
      setWebhookUrl('');
    } catch (err) {
      alert('Error registering webhook: ' + (err as Error).message);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Blue.cc configurations...</div>;
  }

  return (
    <div className="flex flex-col h-full bg-gray-50 overflow-y-auto">
      <div className="max-w-4xl w-full mx-auto p-6 space-y-6">
        
        {/* Settings Panel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><path d="M7 7h.01"></path></svg>
            Blue.cc Integration Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Token ID</label>
              <input type="text" value={tokenId} onChange={e => setTokenId(e.target.value)} placeholder="e.g. key_..." className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Secret ID</label>
              <input type="password" value={secretId} onChange={e => setSecretId(e.target.value)} placeholder="••••••••" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Company ID (Optional)</label>
              <input type="text" value={companyId} onChange={e => setCompanyId(e.target.value)} placeholder="Company ID" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
            </div>
          </div>
          <button onClick={handleSaveCredentials} disabled={saving} className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Credentials'}
          </button>
        </div>

        {/* Dashboard Sections */}
        {client && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-200 flex overflow-x-auto">
              {['workspaces', 'create', 'members', 'webhooks'].map(tab => (
                <button 
                  key={tab} 
                  onClick={() => setActiveSubTab(tab)}
                  className={`px-6 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeSubTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Workspaces List */}
              {activeSubTab === 'workspaces' && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Your Workspaces</h3>
                    <button onClick={() => fetchWorkspaces(client)} className="text-sm text-blue-600 hover:text-blue-800">Refresh</button>
                  </div>
                  {workspaces.length === 0 ? (
                    <p className="text-gray-500 text-sm">No workspaces found or unable to fetch.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {workspaces.map(ws => (
                        <div key={ws.id} className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedWorkspace?.id === ws.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`} onClick={() => setSelectedWorkspace(ws)}>
                          <div className="font-semibold text-gray-900">{ws.name}</div>
                          {ws.description && <div className="text-xs text-gray-500 mt-1 line-clamp-2">{ws.description}</div>}
                          <div className="text-xs text-gray-400 mt-2">ID: {ws.id}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {selectedWorkspace && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <h4 className="font-medium text-gray-900 mb-2">Selected: {selectedWorkspace.name}</h4>
                      <p className="text-sm text-gray-600">Use the Members or Webhooks tabs to manage this workspace.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Create Workspace */}
              {activeSubTab === 'create' && (
                <form onSubmit={handleCreateWorkspace} className="max-w-md space-y-4">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Workspace</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workspace Name</label>
                    <input type="text" required value={newWorkspaceName} onChange={e => setNewWorkspaceName(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                    <textarea value={newWorkspaceDesc} onChange={e => setNewWorkspaceDesc(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" rows={3}></textarea>
                  </div>
                  <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors">Create Workspace</button>
                </form>
              )}

              {/* Members */}
              {activeSubTab === 'members' && (
                <div className="max-w-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Manage Workspace Members</h3>
                  {!selectedWorkspace ? (
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm border border-yellow-200">Please select a workspace from the Workspaces tab first.</div>
                  ) : (
                    <form onSubmit={handleInviteUser} className="space-y-4">
                      <div className="text-sm text-gray-600 mb-2">Inviting to: <strong>{selectedWorkspace.name}</strong></div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">User Email Address</label>
                        <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="colleague@company.com" />
                      </div>
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors">Send Invitation</button>
                    </form>
                  )}
                </div>
              )}

              {/* Webhooks */}
              {activeSubTab === 'webhooks' && (
                <div className="max-w-md">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Workspace Webhooks</h3>
                  {!selectedWorkspace ? (
                    <div className="bg-yellow-50 text-yellow-800 p-3 rounded-md text-sm border border-yellow-200">Please select a workspace from the Workspaces tab first.</div>
                  ) : (
                    <form onSubmit={handleRegisterWebhook} className="space-y-4">
                      <div className="text-sm text-gray-600 mb-4">Registering webhook for: <strong>{selectedWorkspace.name}</strong></div>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                        <h4 className="text-sm font-semibold text-blue-900 mb-1">Supabase Edge Function</h4>
                        <p className="text-xs text-blue-800 mb-2">Configure this webhook to point to your Supabase Edge Function to process Blue.cc events automatically.</p>
                        <code className="block bg-white p-2 rounded text-xs text-gray-800 border border-blue-100 overflow-x-auto">
                          https://[PROJECT_REF].supabase.co/functions/v1/bluecc_webhook
                        </code>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Payload URL</label>
                        <input type="url" required value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" placeholder="https://..." />
                      </div>
                      <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md text-sm transition-colors">Register Webhook</button>
                    </form>
                  )}
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
