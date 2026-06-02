/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { supabaseClient } from '../shared/supabase';
import { createLangGraphAgent } from './agent/LangGraphAgentLogic';

type Role = 'user' | 'assistant' | 'tool';
type Message = { id: string; role: Role; content: string; };

// ==========================================
// LANGGRAPH CHAT COMPONENT
// ==========================================
function LangGraphChat({ agentApp, threadId, initialMessages }: { agentApp: any, threadId: string, initialMessages: Message[] }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages.length > 0 ? initialMessages : [
    { id: '1', role: 'assistant', content: 'Hello! I am your LangGraph Agent. I can manage the dashboard, check jobs, and manage tasks for you. How can I help?' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    // Only scroll if we are not loading to prevent jerky scrolls
    setTimeout(scrollToBottom, 100);
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !agentApp) return;

    const userMessage = input.trim();
    setInput('');
    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessage };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const result = await agentApp.invoke(
        { messages: [{ role: 'user', content: userMessage }] },
        { configurable: { thread_id: threadId }, signal: abortControllerRef.current.signal }
      );

      const stateMessages = result.messages;
      const lastMessage = stateMessages[stateMessages.length - 1];

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: lastMessage.content || 'Action completed via tools.' },
      ]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: '🛑 *Agent execution stopped.*' }]);
      } else {
        console.error('LangGraph error:', error);
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: '⚠️ An error occurred while executing tools. Please check your API keys.' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-4 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
              m.role === 'user' ? 'bg-fuchsia-100 text-fuchsia-700' : 'bg-purple-600 text-white'
            }`}>
              {m.role === 'user' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
              )}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
              m.role === 'user' 
                ? 'bg-purple-600 text-white rounded-tr-sm' 
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 relative w-full items-end">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            placeholder="Ask the LangGraph Agent..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl pl-4 pr-10 py-2.5 text-[13px] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-shadow shadow-sm resize-none overflow-y-auto"
            style={{ minHeight: '40px', maxHeight: '150px' }}
            disabled={isLoading || !agentApp}
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={() => abortControllerRef.current?.abort()} className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm" title="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || !agentApp} className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-purple-600 text-white rounded-full flex items-center justify-center hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ==========================================
// STANDARD RAG CHAT COMPONENT
// ==========================================
function StandardRAGChat({ clients }: { clients: { openai: OpenAI, pineconeIndex: any } | null }) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello! I am the Standard RAG Assistant. I can search the knowledge base for you.' },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });

  useEffect(() => {
    setTimeout(scrollToBottom, 100);
  }, [messages, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !clients) return;

    const userMessage = input.trim();
    setInput('');
    const newMessage: Message = { id: Date.now().toString(), role: 'user', content: userMessage };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const embeddingRes = await clients.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userMessage,
      });
      const embedding = embeddingRes.data[0].embedding;

      const queryRes = await clients.pineconeIndex.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });

      const contextChunks = queryRes.matches
        .map((match: any) => match.metadata?.text || match.metadata?.pageContent || match.metadata?.content || '')
        .filter(Boolean)
        .join('\n\n---\n\n');

      const systemPrompt = `You are an AI assistant for the RecruitScout Command Center dashboard.
Use the following retrieved context to answer the user's question. If you don't know, say you don't know. Do not make up info.
Context:
${contextChunks}
`;

      const chatCompletion = await clients.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-5).map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
          { role: 'user', content: userMessage },
        ],
      }, { signal: abortControllerRef.current.signal });

      const aiResponse = chatCompletion.choices[0].message.content || 'Sorry, I could not generate a response.';
      
      setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiResponse }]);
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: '🛑 *Agent execution stopped.*' }]);
      } else {
        setMessages((prev) => [...prev, { id: Date.now().toString(), role: 'assistant', content: '⚠️ An error occurred while fetching the response.' }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-4 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-7 h-7 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
              m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 text-white'
            }`}>
              {m.role === 'user' ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
              )}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
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
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex shrink-0 items-center justify-center shadow-sm">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 relative w-full items-end">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            placeholder="Ask Standard RAG..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-2xl pl-4 pr-10 py-2.5 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm resize-none overflow-y-auto"
            style={{ minHeight: '40px', maxHeight: '150px' }}
            disabled={isLoading || !clients}
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={() => abortControllerRef.current?.abort()} className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm" title="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || !clients} className="absolute right-1.5 bottom-1.5 w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ==========================================
// MAIN UNIFIED WIDGET
// ==========================================
export default function UnifiedFloatingAgent() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeMode, setActiveMode] = useState<'langgraph' | 'rag'>('langgraph');
  
  const [showSettings, setShowSettings] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // API Keys
  const [openaiKey, setOpenaiKey] = useState('');
  const [pineconeKey, setPineconeKey] = useState('');
  const [pineconeIndex, setPineconeIndex] = useState('recruitscout');
  const [blueccTokenId, setBlueccTokenId] = useState('');
  const [blueccSecretId, setBlueccSecretId] = useState('');
  const [blueccCompanyId, setBlueccCompanyId] = useState('');

  // Agent State
  const [agentApp, setAgentApp] = useState<any>(null);
  const [langGraphThreadId, setLangGraphThreadId] = useState('');
  const [initialLangGraphMessages, setInitialLangGraphMessages] = useState<Message[]>([]);
  const [ragClients, setRagClients] = useState<{ openai: OpenAI, pineconeIndex: any } | null>(null);

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
        const bti = res.data.bluecc_token_id || '';
        const bsi = res.data.bluecc_secret_id || '';
        const bci = res.data.bluecc_company_id || '';
        
        setOpenaiKey(ok);
        setPineconeKey(pk);
        setPineconeIndex(pi);
        setBlueccTokenId(bti);
        setBlueccSecretId(bsi);
        setBlueccCompanyId(bci);

        if (ok && pk) {
          initializeAgents(ok, pk, pi, session.user.id, bti, bsi, bci);
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

  const initializeAgents = async (ok: string, pk: string, pi: string, uid: string, bti: string, bsi: string, bci: string) => {
    try {
      // 1. Initialize RAG
      const o = new OpenAI({ apiKey: ok, dangerouslyAllowBrowser: true });
      const p = new Pinecone({ apiKey: pk });
      const idx = p.index(pi);
      setRagClients({ openai: o, pineconeIndex: idx });

      // 2. Initialize LangGraph
      const app = createLangGraphAgent(ok, pk, pi, uid, bti, bsi, bci);
      setAgentApp(app);
      setLangGraphThreadId(uid);

      // Load previous LangGraph memory
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
          setInitialLangGraphMessages([
            { id: '0', role: 'assistant', content: 'Welcome back! I loaded our previous conversation from memory.' },
            ...mappedMessages
          ]);
        }
      }

      setShowSettings(false);
    } catch (err) {
      console.error('Failed to init agents', err);
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
        bluecc_token_id: blueccTokenId,
        bluecc_secret_id: blueccSecretId,
        bluecc_company_id: blueccCompanyId,
      };
      const res = await supabaseClient.upsertUserIntegration(payload);
      if (res.error) {
        alert('Error saving credentials: ' + res.error);
      } else {
        initializeAgents(openaiKey, pineconeKey, pineconeIndex, session.user.id, blueccTokenId, blueccSecretId, blueccCompanyId);
      }
    }
    setSavingConfig(false);
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-gray-800 to-gray-900 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.3)] hover:scale-105 transition-all duration-300 group"
      >
        <svg className="w-6 h-6 group-hover:-rotate-12 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
      </button>
    );
  }

  // Determine header color based on mode
  const headerGradient = activeMode === 'langgraph' 
    ? 'from-purple-600 to-fuchsia-700' 
    : 'from-blue-600 to-indigo-700';

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[420px] h-[650px] min-w-[320px] min-h-[400px] max-w-[90vw] max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden resize animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Header */}
      <div className={`bg-gradient-to-r ${headerGradient} p-3 flex items-center justify-between shrink-0 transition-colors duration-300`}>
        <div className="flex-1 flex justify-center">
          {/* Custom segmented toggle */}
          <div className="bg-black/20 p-1 rounded-lg flex items-center gap-1 backdrop-blur-sm shadow-inner">
            <button
              onClick={() => setActiveMode('langgraph')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeMode === 'langgraph' ? 'bg-white text-purple-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              LangGraph Agent
            </button>
            <button
              onClick={() => setActiveMode('rag')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${activeMode === 'rag' ? 'bg-white text-blue-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              Standard RAG
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1 absolute right-3">
          <button onClick={() => setShowSettings(!showSettings)} className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors" title="Settings">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors" title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {loadingConfig ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-gray-50">
          <div className="w-6 h-6 rounded-full border-2 border-gray-400 border-t-transparent animate-spin"></div>
          <p className="mt-3 text-sm text-gray-500">Initializing Agents...</p>
        </div>
      ) : showSettings ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Configure Agents</h2>
              <p className="text-xs text-gray-500">Settings apply to both AI modes.</p>
            </div>
          </div>
          <form onSubmit={handleSaveCredentials} className="space-y-4">
            <div><label className="block text-xs font-medium text-gray-700 mb-1">OpenAI API Key</label><input type="password" required value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder="sk-..." className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Pinecone API Key</label><input type="password" required value={pineconeKey} onChange={(e) => setPineconeKey(e.target.value)} placeholder="pcsk_..." className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Pinecone Index Name</label><input type="text" required value={pineconeIndex} onChange={(e) => setPineconeIndex(e.target.value)} placeholder="recruitscout" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>
            
            <div className="pt-2 border-t border-gray-200 mt-2"><h3 className="text-xs font-bold text-gray-700 mb-2">Optional: Blue.cc Integration</h3></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Blue.cc Token ID</label><input type="text" value={blueccTokenId} onChange={(e) => setBlueccTokenId(e.target.value)} placeholder="e.g. 5x..." className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Blue.cc Secret ID</label><input type="password" value={blueccSecretId} onChange={(e) => setBlueccSecretId(e.target.value)} placeholder="secret..." className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>
            <div><label className="block text-xs font-medium text-gray-700 mb-1">Blue.cc Company ID</label><input type="text" value={blueccCompanyId} onChange={(e) => setBlueccCompanyId(e.target.value)} placeholder="(Optional)" className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500" /></div>

            <div className="pt-2">
              <button type="submit" disabled={savingConfig} className="w-full bg-gray-800 text-white font-medium rounded-md px-4 py-2 hover:bg-gray-900 disabled:opacity-70 flex justify-center items-center gap-2 transition-colors text-sm">
                {savingConfig ? (<><div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>Saving...</>) : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className={`absolute inset-0 flex flex-col ${activeMode === 'langgraph' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <LangGraphChat agentApp={agentApp} threadId={langGraphThreadId} initialMessages={initialLangGraphMessages} />
          </div>
          <div className={`absolute inset-0 flex flex-col ${activeMode === 'rag' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <StandardRAGChat clients={ragClients} />
          </div>
        </div>
      )}
    </div>
  );
}
