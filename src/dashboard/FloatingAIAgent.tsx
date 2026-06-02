/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import ReactMarkdown from 'react-markdown';
import { supabaseClient } from '../shared/supabase';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function FloatingAIAgent() {
  // Widget State
  const [isOpen, setIsOpen] = useState(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I am the RecruitScout Command Center Assistant. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [pineconeKey, setPineconeKey] = useState('');
  const [pineconeIndex, setPineconeIndex] = useState('recruitscout');
  
  // Clients
  const [clients, setClients] = useState<{ openai: OpenAI; pineconeIndex: any } | null>(null);

  useEffect(() => {
    // Only load credentials once the widget is actually opened the first time, 
    // or we can load it on mount. Loading on mount is fine.
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
          initializeClients(ok, pk, pi);
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

  const initializeClients = (ok: string, pk: string, pi: string) => {
    try {
      const o = new OpenAI({ apiKey: ok, dangerouslyAllowBrowser: true });
      const p = new Pinecone({ apiKey: pk });
      const idx = p.index(pi);
      setClients({ openai: o, pineconeIndex: idx });
      setShowSettings(false);
    } catch (err) {
      console.error('Failed to init clients', err);
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
        initializeClients(openaiKey, pineconeKey, pineconeIndex);
      }
    }
    setSavingConfig(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !showSettings) {
      // Small timeout to allow render
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, showSettings, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !clients) return;

    const userMessage = input.trim();
    setInput('');
    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsLoading(true);

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
        .map((match: any) => {
          const metadata = match.metadata as any;
          return metadata?.text || metadata?.pageContent || metadata?.content || '';
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      const systemPrompt = `You are an AI assistant for the RecruitScout Command Center dashboard.
Use the following pieces of retrieved context from the knowledge base to answer the user's question.
If you don't know the answer based on the context, just say that you don't know. Do not make up information.
Use Markdown to format your response nicely.

Context:
${contextChunks}
`;

      const chatCompletion = await clients.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.slice(-5).map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: userMessage },
        ],
      });

      const aiResponse = chatCompletion.choices[0].message.content || 'Sorry, I could not generate a response.';
      
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: aiResponse,
        },
      ]);
    } catch (error) {
      console.error('Error in RAG process:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ An error occurred while fetching the response. Please check your API keys and connection.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // The floating button
  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(59,130,246,0.3)] hover:scale-105 transition-all duration-300 group"
      >
        <svg className="w-7 h-7 group-hover:rotate-12 transition-transform duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
      </button>
    );
  }

  // The expanded chat window
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold backdrop-blur-sm text-xs">
            AI
          </div>
          <div>
            <h2 className="text-white font-medium text-sm leading-tight">Knowledge Agent</h2>
            <p className="text-blue-100 text-[10px] leading-tight">Online & Ready</p>
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
          <div className="w-6 h-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin"></div>
          <p className="mt-3 text-sm text-gray-500">Loading AI...</p>
        </div>
      ) : showSettings ? (
        <div className="flex-1 overflow-y-auto bg-gray-50 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Configure Agent</h2>
              <p className="text-xs text-gray-500">Enter API keys to enable RAG.</p>
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
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
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
                className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingConfig}
                className="w-full bg-blue-600 text-white font-medium rounded-md px-4 py-2 hover:bg-blue-700 disabled:opacity-70 flex justify-center items-center gap-2 transition-colors text-sm"
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
                  m.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-600 text-white'
                }`}>
                  {m.role === 'user' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
                  )}
                </div>
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-sm' 
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
                <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex shrink-0 items-center justify-center shadow-sm">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
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

          {/* Input Form */}
          <div className="p-3 bg-white border-t border-gray-200 shrink-0">
            <form onSubmit={handleSubmit} className="flex gap-2 relative w-full">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about command center..."
                className="flex-1 bg-gray-50 border border-gray-300 rounded-full pl-4 pr-10 py-2.5 text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm"
                disabled={isLoading || !clients}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading || !clients}
                className="absolute right-1.5 top-1.5 bottom-1.5 aspect-square bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
