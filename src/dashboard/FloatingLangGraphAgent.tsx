/// <reference types="vite/client" />
import React, { useState, useRef, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabaseClient } from '../shared/supabase';
import { createLangGraphAgent } from './agent/LangGraphAgentLogic';

type Role = 'user' | 'assistant' | 'tool';

type Message = {
  id: string;
  role: Role;
  content: string;
};

export default function FloatingLangGraphAgent() {
  // Widget State
  const [isOpen, setIsOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am your powerful LangGraph Agent. I can manage the dashboard, check jobs, and manage the queue for you. How can I help?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Thread ID for LangGraph memory
  const [threadId, setThreadId] = useState<string>('');

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [pineconeKey, setPineconeKey] = useState('');
  const [pineconeIndex, setPineconeIndex] = useState('recruitscout');
  
  // Compiled Graph
  const [agentApp, setAgentApp] = useState<any>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoadingConfig(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const res = await supabaseClient.getUserIntegration(session.user.id);
      if (res.data) {
        const ok = res.data.openai_api_key || '';
        const pk = res.data.pinecone_api_key || '';
        const pi = res.data.pinecone_index || 'recruitscout';
        
        setOpenaiKey(ok);
        setPineconeKey(pk);
        setPineconeIndex(pi);

        if (ok && pk) {
          initializeAgent(ok, pk, pi, session.user.id);
        } else {
          setShowSettings(true);
        }
      } else {
        setShowSettings(true);
      }
    } else {
      setShowSettings(true);
    }
    setLoadingConfig(false);
  };

  const initializeAgent = async (ok: string, pk: string, pi: string, uid: string) => {
    try {
      const app = createLangGraphAgent(ok, pk, pi, uid);
      setAgentApp(app);
      setThreadId(uid);
      
      // Load previous memory!
      const agentState = await app.getState({ configurable: { thread_id: uid } });
      if (agentState?.values?.messages?.length > 0) {
        const mappedMessages = agentState.values.messages.map((m: any, idx: number) => {
          const type = typeof m.getType === 'function' ? m.getType() : m.type || '';
          return {
            id: `hist-${idx}`,
            role: type === 'ai' ? 'assistant' : type === 'human' ? 'user' : 'tool',
            content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
          };
        }).filter((m: any) => (m.role === 'user' || m.role === 'assistant') && m.content.trim() !== '');

        if (mappedMessages.length > 0) {
          setMessages([
            { id: '0', role: 'assistant', content: 'Welcome back! I loaded our previous conversation from memory.' },
            ...mappedMessages
          ]);
        }
      }

      setShowSettings(false);
    } catch (err) {
      console.error('Failed to init LangGraph agent', err);
      setShowSettings(true);
    }
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const payload = {
        user_id: session.user.id,
        openai_api_key: openaiKey,
        pinecone_api_key: pineconeKey,
        pinecone_index: pineconeIndex,
      };
      const res = await supabaseClient.upsertUserIntegration(payload);
      if (res.error) {
        alert('Error saving credentials: ' + res.error);
      } else {
        initializeAgent(openaiKey, pineconeKey, pineconeIndex, session.user.id);
      }
    }
    setSavingConfig(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !showSettings) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, showSettings, isOpen, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !agentApp) return;

    const userMessage = input.trim();
    setInput('');
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      // Invoke LangGraph app with thread memory
      const result = await agentApp.invoke(
        { messages: [{ role: 'user', content: userMessage }] },
        { configurable: { thread_id: threadId }, signal: abortControllerRef.current.signal }
      );

      // The state returned has an array of messages.
      // We extract the last AI message.
      const stateMessages = result.messages;
      const lastMessage = stateMessages[stateMessages.length - 1];

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: lastMessage.content || 'Action completed via tools.',
        },
      ]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Agent execution stopped by user.');
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '🛑 *Agent execution stopped.*',
          },
        ]);
      } else {
        console.error('Error in LangGraph execution:', error);
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '⚠️ An error occurred while executing tools. Please check your API keys or connection.',
          },
        ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`;
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-purple-600 to-fuchsia-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(168,85,247,0.3)] hover:scale-105 transition-all duration-300 group"
      >
        <svg className="w-6 h-6 group-hover:-rotate-12 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-24 right-6 z-50 w-[420px] h-[650px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-fuchsia-700 p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold backdrop-blur-sm text-xs">
            LG
          </div>
          <div>
            <h2 className="text-white font-medium text-sm leading-tight">LangGraph Agent</h2>
            <p className="text-purple-100 text-[10px] leading-tight">Supabase & Pinecone Tools</p>
          </div>
        </div>
        <div className="flex items-center">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors"
            title="Settings"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors"
            title="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {loadingConfig ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <div className="w-6 h-6 rounded-full border-2 border-purple-600 border-t-transparent animate-spin"></div>
          <p className="mt-3 text-sm text-gray-500">Initializing LangGraph...</p>
        </div>
      ) : showSettings ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Configure Graph Agent</h2>
              <p className="text-xs text-gray-500">Uses the same keys as the primary agent.</p>
            </div>
          </div>

          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">OpenAI API Key</label>
              <input
                type="password"
                required
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pinecone API Key</label>
              <input
                type="password"
                required
                value={pineconeKey}
                onChange={(e) => setPineconeKey(e.target.value)}
                placeholder="pcsk_..."
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Pinecone Index Name</label>
              <input
                type="text"
                required
                value={pineconeIndex}
                onChange={(e) => setPineconeIndex(e.target.value)}
                placeholder="recruitscout"
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-purple-600 text-white font-medium rounded-md px-4 py-2 hover:bg-purple-700 disabled:opacity-70 flex justify-center items-center gap-2 transition-colors text-sm"
              >
                {savingConfig ? (
                  <>
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  'Save Configuration'
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <>
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-4 text-sm">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-7 h-7 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
                  m.role === 'user' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-purple-600 text-white'
                }`}>
                  {m.role === 'user' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
                  )}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-fuchsia-600 text-white rounded-tr-sm' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}>
                  {m.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-100 prose-pre:text-gray-800 text-[13px]">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-[13px] whitespace-pre-wrap">{m.content}</p>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex shrink-0 items-center justify-center shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse"></div>
                  <div className="text-[11px] text-gray-500 font-medium italic animate-pulse tracking-wide">Executing Tools...</div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-3 bg-white border-t border-gray-200 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 relative w-full items-end">
              <textarea
                value={input}
                onChange={handleTextareaInput}
                onKeyDown={handleInputKeyDown}
                placeholder="Ask agent to act (e.g. Delete queue tasks)..."
                className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl pl-4 pr-10 py-2.5 text-[13px] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-shadow shadow-sm resize-none overflow-y-auto"
                style={{ minHeight: '40px', maxHeight: '150px' }}
                disabled={isLoading || !agentApp}
                rows={1}
              />
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
                  title="Stop Execution"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" /></svg>
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim() || !agentApp}
                  className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 disabled:opacity-50 disabled:hover:bg-purple-600 transition-colors shadow-sm"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                </button>
              )}
            </form>
          </div>
        </>
      )}
    </div>
  );
}
