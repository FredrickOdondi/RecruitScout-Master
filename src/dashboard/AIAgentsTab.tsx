/// <reference types="vite/client" />
import React, { useState, useRef, useEffect } from 'react';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import ReactMarkdown from 'react-markdown';

// Initialize clients (using Vite env variables)
const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY || '',
  dangerouslyAllowBrowser: true, // required for client-side use
});

const pinecone = new Pinecone({
  apiKey: import.meta.env.VITE_PINECONE_API_KEY || '',
});
const indexName = import.meta.env.VITE_PINECONE_INDEX || 'recruitscout';
const index = pinecone.index(indexName);

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export default function AIAgentsTab() {
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

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

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
      // 1. Get embedding for the user query
      const embeddingRes = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: userMessage,
      });
      const embedding = embeddingRes.data[0].embedding;

      // 2. Query Pinecone for relevant context
      const queryRes = await index.query({
        vector: embedding,
        topK: 5,
        includeMetadata: true,
      });

      // 3. Assemble the context string
      // Assuming metadata contains 'text' or 'pageContent' depending on how it was uploaded
      const contextChunks = queryRes.matches
        .map((match) => {
          const metadata = match.metadata as any;
          return metadata?.text || metadata?.pageContent || metadata?.content || '';
        })
        .filter(Boolean)
        .join('\n\n---\n\n');

      // 4. Create the prompt for the LLM
      const systemPrompt = `You are an AI assistant for the RecruitScout Command Center dashboard.
Use the following pieces of retrieved context from the knowledge base to answer the user's question.
If you don't know the answer based on the context, just say that you don't know. Do not make up information.
Use Markdown to format your response nicely.

Context:
${contextChunks}
`;

      const chatCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          // Include recent chat history (last 5 messages) to maintain conversation context
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

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-5xl mx-auto w-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-4 flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold backdrop-blur-sm">
          AI
        </div>
        <div>
          <h2 className="text-white font-semibold">Command Center Assistant</h2>
          <p className="text-blue-100 text-xs">Knowledge Base RAG Agent</p>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 flex flex-col gap-6">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`w-8 h-8 rounded-full flex shrink-0 items-center justify-center shadow-sm ${
              m.role === 'user' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-600 text-white'
            }`}>
              {m.role === 'user' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>
              )}
            </div>
            <div className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm ${
              m.role === 'user' 
                ? 'bg-indigo-600 text-white rounded-tr-sm' 
                : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
            }`}>
              {m.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-pre:bg-gray-100 prose-pre:text-gray-800">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex shrink-0 items-center justify-center shadow-sm">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/></svg>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm flex items-center gap-1">
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-4 bg-white border-t border-gray-200 shrink-0">
        <form onSubmit={handleSubmit} className="flex gap-3 relative max-w-4xl mx-auto">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a question about the Command Center..."
            className="flex-1 bg-gray-50 border border-gray-300 rounded-full px-5 py-3.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow shadow-sm pr-14"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-1.5 bottom-1.5 aspect-square bg-blue-600 text-white rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </form>
      </div>
    </div>
  );
}
