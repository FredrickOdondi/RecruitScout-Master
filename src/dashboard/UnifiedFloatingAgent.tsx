/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { GoogleGenAI } from '@google/genai';
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
              m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-gray-900 text-white'
            }`}>
              {m.role === 'user' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
              )}
            </div>
            <div className={`max-w-[85%] px-4 py-3 shadow-sm ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                : 'bg-white border border-gray-100/50 text-gray-800 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgb(0,0,0,0.03)]'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-pre:border prose-pre:border-gray-100 text-[14px]">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[14px] whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex shrink-0 items-center justify-center shadow-sm">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/></svg>
            </div>
            <div className="bg-white border border-gray-100/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_10px_rgb(0,0,0,0.03)] flex items-center gap-1.5 h-10">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-transparent shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 relative w-full items-end bg-white border border-gray-200 rounded-3xl p-1.5 shadow-[0_4px_20px_rgb(0,0,0,0.05)] transition-shadow focus-within:shadow-[0_4px_20px_rgb(37,99,235,0.1)] focus-within:border-blue-400/50">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            placeholder="Ask the Agent..."
            className="flex-1 bg-transparent border-none rounded-3xl pl-4 pr-12 py-2.5 text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '44px', maxHeight: '150px' }}
            disabled={isLoading || !agentApp}
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={() => abortControllerRef.current?.abort()} className="absolute right-2.5 bottom-2.5 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors shadow-sm" title="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || !agentApp} className="absolute right-2.5 bottom-2.5 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-sm active:scale-95">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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
function StandardRAGChat({ clients }: { clients: { gemini: GoogleGenAI, pineconeIndex: any } | null }) {
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
      const embeddingRes = await clients.gemini.models.embedContent({
        model: 'text-embedding-004',
        contents: userMessage,
      });
      const embedding = embeddingRes.embeddings?.[0]?.values;
      if (!embedding) throw new Error("Failed to generate embedding");

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

      const formattedMessages = [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: "Understood." }] },
        ...messages.slice(-5).map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        { role: 'user', parts: [{ text: userMessage }] },
      ];

      const chatCompletion = await clients.gemini.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: formattedMessages,
      }); // GoogleGenAI does not natively support abort signal yet in the same way, so we leave it standard

      const aiResponse = chatCompletion.text || 'Sorry, I could not generate a response.';
      
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
    <div className="flex-1 flex flex-col overflow-hidden bg-transparent">
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 text-sm">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
              m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-blue-600 text-white'
            }`}>
              {m.role === 'user' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
              )}
            </div>
            <div className={`max-w-[85%] px-4 py-3 shadow-sm ${
              m.role === 'user' 
                ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm' 
                : 'bg-white border border-gray-100/50 text-gray-800 rounded-2xl rounded-tl-sm shadow-[0_2px_10px_rgb(0,0,0,0.03)]'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-pre:border prose-pre:border-gray-100 text-[14px]">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[14px] whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex shrink-0 items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            </div>
            <div className="bg-white border border-gray-100/50 rounded-2xl rounded-tl-sm px-4 py-3 shadow-[0_2px_10px_rgb(0,0,0,0.03)] flex items-center gap-1.5 h-10">
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 bg-transparent shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-2 relative w-full items-end bg-white border border-gray-200 rounded-3xl p-1.5 shadow-[0_4px_20px_rgb(0,0,0,0.05)] transition-shadow focus-within:shadow-[0_4px_20px_rgb(37,99,235,0.1)] focus-within:border-blue-400/50">
          <textarea
            value={input}
            onChange={(e) => { setInput(e.target.value); e.target.style.height = 'auto'; e.target.style.height = `${Math.min(e.target.scrollHeight, 150)}px`; }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as any); } }}
            placeholder="Ask Standard RAG..."
            className="flex-1 bg-transparent border-none rounded-3xl pl-4 pr-12 py-2.5 text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none overflow-y-auto"
            style={{ minHeight: '44px', maxHeight: '150px' }}
            disabled={isLoading || !clients}
            rows={1}
          />
          {isLoading ? (
            <button type="button" onClick={() => abortControllerRef.current?.abort()} className="absolute right-2.5 bottom-2.5 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center hover:bg-black transition-colors shadow-sm" title="Stop">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" /></svg>
            </button>
          ) : (
            <button type="submit" disabled={!input.trim() || !clients} className="absolute right-2.5 bottom-2.5 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 transition-colors shadow-sm active:scale-95">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
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

  // Custom Resize State
  const [size, setSize] = useState({ width: 420, height: 700 });
  const isResizing = useRef(false);

  // API Keys
  const [geminiKey, setGeminiKey] = useState('');
  const [pineconeKey, setPineconeKey] = useState('');
  const [pineconeIndex, setPineconeIndex] = useState('recruitscout');
  const [blueccTokenId, setBlueccTokenId] = useState('');
  const [blueccSecretId, setBlueccSecretId] = useState('');
  const [blueccCompanyId, setBlueccCompanyId] = useState('');

  // Agent State
  const [agentApp, setAgentApp] = useState<any>(null);
  const [langGraphThreadId, setLangGraphThreadId] = useState('');
  const [initialLangGraphMessages, setInitialLangGraphMessages] = useState<Message[]>([]);
  const [ragClients, setRagClients] = useState<{ gemini: GoogleGenAI, pineconeIndex: any } | null>(null);

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    setLoadingConfig(true);
    const session = supabaseClient.getSession();
    if (session?.user?.id) {
      const res = await supabaseClient.getUserIntegration(session.user.id);
      if (res.data) {
        const ok = res.data.gemini_api_key || '';
        const pk = res.data.pinecone_api_key || '';
        const pi = res.data.pinecone_index || 'recruitscout';
        const bti = res.data.bluecc_token_id || '';
        const bsi = res.data.bluecc_secret_id || '';
        const bci = res.data.bluecc_company_id || '';
        
        setGeminiKey(ok);
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
      const o = new GoogleGenAI({ apiKey: ok });
      const pc = new Pinecone({ apiKey: pk });
      const idx = pc.index(pi);
      setRagClients({ gemini: o, pineconeIndex: idx });

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
        gemini_api_key: geminiKey,
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
        initializeAgents(geminiKey, pineconeKey, pineconeIndex, session.user.id, blueccTokenId, blueccSecretId, blueccCompanyId);
      }
    }
    setSavingConfig(false);
  };

  // --- Resizing Logic ---
  const handleMouseDown = (e: React.MouseEvent, type: 'topLeft' | 'top' | 'left') => {
    e.preventDefault();
    isResizing.current = true;
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      setSize(() => {
        let newWidth = startWidth;
        let newHeight = startHeight;

        if (type === 'topLeft' || type === 'left') {
          newWidth = Math.max(340, Math.min(window.innerWidth * 0.9, startWidth - deltaX));
        }
        if (type === 'topLeft' || type === 'top') {
          newHeight = Math.max(450, Math.min(window.innerHeight * 0.9, startHeight - deltaY));
        }

        return { width: newWidth, height: newHeight };
      });
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    if (type === 'topLeft') document.body.style.cursor = 'nwse-resize';
    else if (type === 'top') document.body.style.cursor = 'ns-resize';
    else if (type === 'left') document.body.style.cursor = 'ew-resize';
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-white border border-gray-200/60 text-gray-800 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.15)] hover:scale-105 transition-all duration-300 group"
      >
        <svg className="w-7 h-7 text-blue-600 group-hover:rotate-12 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 z-50 bg-white/80 backdrop-blur-3xl rounded-3xl shadow-[0_20px_50px_rgb(0,0,0,0.1)] border border-white/50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300"
      style={{ width: size.width, height: size.height }}
    >
      {/* Invisible Drag Handles */}
      <div className="absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'topLeft')} />
      <div className="absolute top-0 left-4 right-0 h-2 cursor-ns-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'top')} />
      <div className="absolute top-4 left-0 bottom-0 w-2 cursor-ew-resize z-50" onMouseDown={(e) => handleMouseDown(e, 'left')} />

      {/* Sleek Header */}
      <div className="px-5 py-4 flex items-center justify-between shrink-0 border-b border-gray-200/50 relative">
        <div className="flex-1 flex justify-center">
          {/* Glass Segmented Control */}
          <div className="bg-gray-200/60 p-1 rounded-xl flex items-center gap-1 shadow-inner relative overflow-hidden">
            <div 
              className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-transform duration-300 ease-out"
              style={{ transform: activeMode === 'langgraph' ? 'translateX(0)' : 'translateX(100%)', left: '4px' }}
            />
            <button
              onClick={() => setActiveMode('langgraph')}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors relative z-10 w-32 ${activeMode === 'langgraph' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              LangGraph
            </button>
            <button
              onClick={() => setActiveMode('rag')}
              className={`px-4 py-1.5 text-[13px] font-semibold rounded-lg transition-colors relative z-10 w-32 ${activeMode === 'rag' ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Knowledge
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1 absolute right-4">
          <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-colors ${showSettings ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'}`} title="Settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors" title="Close">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      {loadingConfig ? (
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="w-8 h-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
        </div>
      ) : showSettings ? (
        <div className="flex-1 overflow-y-auto p-6 bg-transparent">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Agent Configuration</h2>
              <p className="text-sm text-gray-500">Settings apply to both AI modes.</p>
            </div>
          </div>
          <form onSubmit={handleSaveCredentials} className="space-y-5">
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Gemini API Key</label><input type="password" required value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder="AIzaSy..." className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Pinecone API Key</label><input type="password" required value={pineconeKey} onChange={(e) => setPineconeKey(e.target.value)} placeholder="pcsk_..." className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Pinecone Index Name</label><input type="text" required value={pineconeIndex} onChange={(e) => setPineconeIndex(e.target.value)} placeholder="recruitscout" className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>
            
            <div className="pt-4 border-t border-gray-200/60 mt-4"><h3 className="text-sm font-bold text-gray-800 mb-3">Blue.cc Integration (Optional)</h3></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Token ID</label><input type="text" value={blueccTokenId} onChange={(e) => setBlueccTokenId(e.target.value)} placeholder="e.g. 5x..." className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Secret ID</label><input type="password" value={blueccSecretId} onChange={(e) => setBlueccSecretId(e.target.value)} placeholder="secret..." className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Company ID</label><input type="text" value={blueccCompanyId} onChange={(e) => setBlueccCompanyId(e.target.value)} placeholder="(Optional)" className="w-full bg-white/50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm" /></div>

            <div className="pt-4">
              <button type="submit" disabled={savingConfig} className="w-full bg-gray-900 text-white font-medium rounded-xl px-4 py-3 hover:bg-black disabled:opacity-70 flex justify-center items-center gap-2 transition-colors text-sm shadow-md">
                {savingConfig ? (<><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>Saving...</>) : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden relative bg-transparent">
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeMode === 'langgraph' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <LangGraphChat agentApp={agentApp} threadId={langGraphThreadId} initialMessages={initialLangGraphMessages} />
          </div>
          <div className={`absolute inset-0 flex flex-col transition-opacity duration-300 ${activeMode === 'rag' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
            <StandardRAGChat clients={ragClients} />
          </div>
        </div>
      )}
    </div>
  );
}
