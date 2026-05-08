import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  Send, Bot, User, BookOpen, Brain, ClipboardCheck,
  Search, PanelLeftClose, PanelLeftOpen, FileText,
  X, Loader2, MessageCircle, GripVertical, StopCircle,
} from 'lucide-react';
import { API } from '../config/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  streaming?: boolean;
}

// Per-session chat histories (keyed by noteId or GLOBAL_KEY)
const chatHistories: Record<string, Message[]> = {};
const GLOBAL_KEY = '__global__';

const makeWelcome = (docTitle?: string): Message => ({
  id: 'welcome',
  text: docTitle
    ? `Hi! I'm your AI tutor for **${docTitle}**. Ask me anything about this document — I can explain concepts, quiz you, summarise sections, or answer any question.`
    : "Hello! I'm your AI learning assistant powered by Gemini. Ask me anything — about your documents, study topics, or any subject you're learning.",
  sender: 'bot',
  timestamp: new Date(),
});

const getHistory = (key: string, docTitle?: string): Message[] => {
  if (!chatHistories[key]) chatHistories[key] = [makeWelcome(docTitle)];
  return chatHistories[key];
};

// ── Markdown renderer — handles bold, bullets, code, paragraphs ──
const BotText: React.FC<{ text: string; streaming?: boolean }> = ({ text, streaming }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        // Bullet points
        if (line.startsWith('- ') || line.startsWith('* ') || line.startsWith('• '))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-teal-500 flex-shrink-0 mt-0.5 font-bold">•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        // Numbered list
        if (/^\d+\.\s/.test(line))
          return (
            <div key={i} className="flex gap-2">
              <span className="text-teal-600 flex-shrink-0 font-semibold text-xs mt-0.5">{line.match(/^\d+/)?.[0]}.</span>
              <span>{renderInline(line.replace(/^\d+\.\s/, ''))}</span>
            </div>
          );
        // Heading (##)
        if (line.startsWith('## '))
          return <p key={i} className="font-bold text-gray-900 mt-2">{line.slice(3)}</p>;
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-gray-900 text-base mt-2">{line.slice(2)}</p>;
        // Horizontal rule
        if (line.trim() === '---' || line.trim() === '***')
          return <hr key={i} className="border-gray-200 my-1" />;
        // Empty line
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // Normal paragraph
        return <p key={i}>{renderInline(line)}</p>;
      })}
      {streaming && (
        <span className="inline-block w-2 h-4 bg-teal-500 animate-pulse rounded-sm ml-0.5 align-middle" />
      )}
    </div>
  );
};

// Render inline markdown: **bold**, `code`, *italic*
const renderInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
};

export const ChatbotInterface: React.FC = () => {
  const { notes } = useUser();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [docPanelOpen, setDocPanelOpen]     = useState(false);
  const [docPanelWidth, setDocPanelWidth]   = useState(480);
  const [docFileUrl, setDocFileUrl]         = useState<string | null>(null);
  const [docLoadError, setDocLoadError]     = useState(false);

  const [messages, setMessages]     = useState<Message[]>(() => getHistory(GLOBAL_KEY));
  const [inputText, setInputText]   = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Drag resize
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const selectedNote  = notes.find(n => n.id === selectedNoteId) ?? null;
  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = docPanelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [docPanelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      setDocPanelWidth(Math.min(Math.max(dragStartW.current + (e.clientX - dragStartX.current), 280), 900));
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // Select document
  const handleSelectDoc = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setSelectedNoteId(noteId);
    setDocPanelOpen(true);
    setDocLoadError(false);
    setDocFileUrl(null);
    setMessages([...getHistory(noteId, note.title)]);
    const token = localStorage.getItem('lectomate_token');
    const docId = note.sourceDocumentId;
    if (token && docId) {
      try {
        const res = await fetch(`${API}/documents/${docId}/file`, { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const blob = await res.blob();
          setDocFileUrl(URL.createObjectURL(blob));
        } else { setDocLoadError(true); }
      } catch { setDocLoadError(true); }
    } else { setDocLoadError(true); }
  };

  const handleCloseDoc = () => {
    setDocPanelOpen(false);
    setSelectedNoteId(null);
    if (docFileUrl) URL.revokeObjectURL(docFileUrl);
    setDocFileUrl(null);
    setDocLoadError(false);
    setMessages([...getHistory(GLOBAL_KEY)]);
  };

  useEffect(() => { return () => { if (docFileUrl) URL.revokeObjectURL(docFileUrl); }; }, [docFileUrl]);

  // Stop streaming
  const handleStop = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
    // Mark last bot message as no longer streaming
    setMessages(prev => prev.map((m, i) =>
      i === prev.length - 1 && m.sender === 'bot' ? { ...m, streaming: false } : m
    ));
  };

  // ── Main send with SSE streaming ─────────────────────────────
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || isStreaming) return;

    const chatKey = selectedNoteId ?? GLOBAL_KEY;
    const userMsg: Message = { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() };
    const history = [...(chatHistories[chatKey] || []), userMsg];
    chatHistories[chatKey] = history;
    setMessages([...history]);
    setInputText('');
    setIsStreaming(true);

    const token = localStorage.getItem('lectomate_token');
    if (!token) {
      const errMsg: Message = { id: (Date.now()+1).toString(), text: 'Please log in to use the AI chat assistant.', sender: 'bot', timestamp: new Date() };
      chatHistories[chatKey] = [...history, errMsg];
      setMessages([...history, errMsg]);
      setIsStreaming(false);
      return;
    }

    // Build conversation history (exclude welcome message, last 10 exchanges)
    const convHistory = history
      .filter(m => m.id !== 'welcome')
      .slice(-10)
      .map(m => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.text }));

    // Add streaming bot message placeholder
    const botId = (Date.now() + 1).toString();
    const botMsg: Message = { id: botId, text: '', sender: 'bot', timestamp: new Date(), streaming: true };
    const withBot = [...history, botMsg];
    chatHistories[chatKey] = withBot;
    setMessages([...withBot]);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, noteId: selectedNoteId ?? undefined, history: convHistory }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.token) {
              accumulated += parsed.token;
              setMessages(prev => prev.map(m =>
                m.id === botId ? { ...m, text: accumulated, streaming: true } : m
              ));
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
            if (parsed.done || parsed.error) {
              const finalText = parsed.error ? (accumulated || parsed.error) : accumulated;
              const finalMsg: Message = { id: botId, text: finalText, sender: 'bot', timestamp: new Date(), streaming: false };
              chatHistories[chatKey] = [...history, finalMsg];
              setMessages(prev => prev.map(m => m.id === botId ? finalMsg : m));
            }
          } catch { /* skip malformed SSE line */ }
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped — keep what was accumulated
        const stoppedMsg: Message = { id: botId, text: accumulated || '(Response stopped)', sender: 'bot', timestamp: new Date(), streaming: false };
        chatHistories[chatKey] = [...history, stoppedMsg];
        setMessages(prev => prev.map(m => m.id === botId ? stoppedMsg : m));
      } else {
        const errMsg: Message = { id: botId, text: 'Sorry, I encountered an error. Please try again.', sender: 'bot', timestamp: new Date(), streaming: false };
        chatHistories[chatKey] = [...history, errMsg];
        setMessages(prev => prev.map(m => m.id === botId ? errMsg : m));
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [inputText, isStreaming, selectedNoteId]);

  const quickPrompts = selectedNote
    ? ['Summarise this document', 'What are the key concepts?', 'Quiz me on this', 'Explain the main ideas']
    : ['Explain machine learning', 'What is deep learning?', 'Help me study effectively', 'What is overfitting?'];

  const isPdf = selectedNote?.fileName?.toLowerCase().endsWith('.pdf') ?? false;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 select-none">

      {/* LEFT SIDEBAR */}
      <div className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${sidebarOpen ? 'w-64' : 'w-12'}`}>
        <div className={`flex items-center border-b border-gray-100 px-3 py-3 ${sidebarOpen ? 'justify-between' : 'justify-center'}`}>
          {sidebarOpen && <span className="text-xs font-semibold text-gray-700">Documents</span>}
          <button onClick={() => setSidebarOpen(v => !v)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors">
            {sidebarOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
        </div>
        {sidebarOpen ? (
          <>
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search documents…"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none bg-gray-50" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              <button onClick={handleCloseDoc}
                className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${!selectedNoteId ? 'bg-teal-50 border-teal-200' : 'hover:bg-gray-50 border-transparent'}`}>
                <div className={`text-xs font-medium ${!selectedNoteId ? 'text-teal-800' : 'text-gray-700'}`}>General Chat</div>
                <div className="text-xs text-gray-400 mt-0.5">Ask anything</div>
              </button>
              {notes.length === 0 ? (
                <div className="text-center py-6">
                  <FileText size={28} className="mx-auto text-gray-300 mb-2" />
                  <p className="text-xs text-gray-400">No documents yet.</p>
                  <button onClick={() => navigate('/upload')} className="mt-2 text-xs text-teal-600 hover:underline">Upload one</button>
                </div>
              ) : filteredNotes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">No matches.</p>
              ) : filteredNotes.map(note => (
                <button key={note.id} onClick={() => handleSelectDoc(note.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-all border ${selectedNoteId === note.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-transparent'}`}>
                  <div className={`text-xs font-medium truncate ${selectedNoteId === note.id ? 'text-blue-900' : 'text-gray-800'}`}>{note.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">{note.fileName}</div>
                  <div className="text-xs text-gray-300 mt-0.5">{note.uploadDate.toLocaleDateString()}</div>
                </button>
              ))}
            </div>
            <div className="px-3 pb-3 pt-2 border-t border-gray-100 space-y-1">
              <button onClick={() => navigate('/flashcards')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"><Brain size={13} /> Flashcards</button>
              <button onClick={() => navigate('/quiz')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-orange-700 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"><ClipboardCheck size={13} /> Quiz</button>
              <button onClick={() => navigate('/notes')} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"><BookOpen size={13} /> Notes</button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 pt-4">
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><Search size={17} /></button>
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><BookOpen size={17} /></button>
            <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><MessageCircle size={17} /></button>
          </div>
        )}
      </div>

      {/* DOCUMENT PANEL */}
      {docPanelOpen && selectedNote && (
        <>
          <div className="flex flex-col bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden" style={{ width: docPanelWidth }}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-50 flex-shrink-0">
              <div className="min-w-0 flex items-center gap-2">
                <FileText size={15} className="text-blue-500 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-blue-900 truncate">{selectedNote.title}</p>
                  <p className="text-xs text-blue-400 truncate mt-0.5">{selectedNote.fileName} · {selectedNote.fileSize}</p>
                </div>
              </div>
              <button onClick={handleCloseDoc} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0 ml-2"><X size={15} /></button>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {!docFileUrl && !docLoadError && (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50">
                  <Loader2 size={28} className="text-blue-400 animate-spin" />
                  <p className="text-xs text-gray-500">Loading document…</p>
                </div>
              )}
              {docFileUrl && isPdf && (
                <iframe src={`${docFileUrl}#toolbar=1&navpanes=1&scrollbar=1`} className="flex-1 w-full border-0" title={selectedNote.fileName} style={{ minHeight: 0 }} />
              )}
              {docFileUrl && !isPdf && (
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words font-mono bg-gray-50 rounded-lg p-4 border border-gray-100">
                    {selectedNote.rawContent || selectedNote.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n') || 'No content available.'}
                  </div>
                </div>
              )}
              {docLoadError && (
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                    <span className="text-xs text-amber-500 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Original file unavailable — showing extracted text</span>
                  </div>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4 border border-gray-100">
                    {selectedNote.rawContent || selectedNote.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n') || 'No content available.'}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div onMouseDown={onDragStart} className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-teal-400 active:bg-teal-500 cursor-col-resize transition-colors flex items-center justify-center group" title="Drag to resize">
            <GripVertical size={14} className="text-gray-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      )}

      {/* AI CHATBOT */}
      <div className="flex-1 flex flex-col min-w-[300px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot size={20} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Tutor</p>
              <p className="text-xs flex items-center gap-1.5">
                <span className={`w-1.5 h-1.5 rounded-full inline-block ${isStreaming ? 'bg-teal-400 animate-pulse' : 'bg-green-400'}`} />
                <span className={isStreaming ? 'text-teal-600' : 'text-green-500'}>
                  {isStreaming ? 'Generating response…' : selectedNote ? `Focused on: ${selectedNote.title}` : 'Ready to help'}
                </span>
              </p>
            </div>
          </div>
          {selectedNote && (
            <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 font-medium truncate max-w-[180px]">
              {selectedNote.title}
            </span>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-2 max-w-[85%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-teal-100'}`}>
                  {msg.sender === 'user' ? <User size={13} className="text-blue-600" /> : <Bot size={13} className="text-teal-600" />}
                </div>
                <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {msg.sender === 'bot'
                    ? <BotText text={msg.text || '…'} streaming={msg.streaming} />
                    : <span>{msg.text}</span>}
                  {!msg.streaming && (
                    <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-5 py-2 border-t border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button key={i} onClick={() => handleSend(p)} disabled={isStreaming}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-600 rounded-full transition-colors disabled:opacity-40">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <div className={`flex items-center gap-3 bg-gray-50 border rounded-xl px-4 py-2 transition-all ${isStreaming ? 'border-teal-300 ring-2 ring-teal-100' : 'border-gray-200 focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-transparent'}`}>
            <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && !isStreaming && handleSend()}
              placeholder={selectedNote ? `Ask about "${selectedNote.title}"…` : 'Ask me anything…'}
              disabled={isStreaming}
              className="flex-1 text-sm bg-transparent outline-none disabled:opacity-60 placeholder-gray-400" />
            {isStreaming ? (
              <button onClick={handleStop} className="p-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex-shrink-0" title="Stop generating">
                <StopCircle size={15} />
              </button>
            ) : (
              <button onClick={() => handleSend()} disabled={!inputText.trim()}
                className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
                <Send size={15} />
              </button>
            )}
          </div>
          {selectedNote && (
            <p className="text-xs text-gray-400 mt-1.5 text-center">
              Context: <span className="text-blue-500 font-medium">{selectedNote.title}</span> •{' '}
              <button onClick={handleCloseDoc} className="text-gray-400 hover:text-gray-600 underline">switch to general</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
