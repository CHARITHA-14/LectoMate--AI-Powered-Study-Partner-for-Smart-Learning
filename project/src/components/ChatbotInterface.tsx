import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  Send, Bot, User, BookOpen, Brain, ClipboardCheck,
  Search, PanelLeftClose, PanelLeftOpen, FileText,
  X, Loader2, MessageCircle, GripVertical,
} from 'lucide-react';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

const chatHistories: Record<string, Message[]> = {};
const GLOBAL_KEY = '__global__';

const makeWelcome = (docTitle?: string): Message => ({
  id: 'welcome',
  text: docTitle
    ? `Hi! I'm your AI tutor for **${docTitle}**. Ask me anything about this document.`
    : "Hello! I'm your AI learning assistant. Ask me anything about your study materials.",
  sender: 'bot',
  timestamp: new Date(),
});

const getHistory = (key: string, docTitle?: string): Message[] => {
  if (!chatHistories[key]) chatHistories[key] = [makeWelcome(docTitle)];
  return chatHistories[key];
};

const BotText: React.FC<{ text: string }> = ({ text }) => (
  <div className="space-y-1">
    {text.split('\n').map((line, i) => {
      if (line.startsWith('- ') || line.startsWith('• '))
        return <div key={i} className="flex gap-1.5"><span className="text-teal-400 flex-shrink-0 mt-0.5">•</span><span>{line.slice(2)}</span></div>;
      if (line.trim() === '') return <div key={i} className="h-1" />;
      const parts = line.split(/(\*\*[^*]+\*\*)/g);
      return (
        <p key={i}>
          {parts.map((p, j) =>
            p.startsWith('**') && p.endsWith('**') ? <strong key={j}>{p.slice(2, -2)}</strong> : p
          )}
        </p>
      );
    })}
  </div>
);

import { API } from '../config/api';

export const ChatbotInterface: React.FC = () => {
  const { notes } = useUser();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchTerm, setSearchTerm]   = useState('');

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [docPanelOpen, setDocPanelOpen]     = useState(false);
  const [docPanelWidth, setDocPanelWidth]   = useState(480);
  // URL of the actual file to display in iframe
  const [docFileUrl, setDocFileUrl]         = useState<string | null>(null);
  const [docLoadError, setDocLoadError]     = useState(false);

  // Drag-to-resize
  const isDragging  = useRef(false);
  const dragStartX  = useRef(0);
  const dragStartW  = useRef(0);

  const [messages, setMessages]   = useState<Message[]>(() => getHistory(GLOBAL_KEY));
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping]   = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const selectedNote  = notes.find(n => n.id === selectedNoteId) ?? null;
  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Drag resize ───────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = docPanelWidth;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [docPanelWidth]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const newW = Math.min(Math.max(dragStartW.current + (e.clientX - dragStartX.current), 280), 900);
      setDocPanelWidth(newW);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  // ── Select document ───────────────────────────────────────────
  const handleSelectDoc = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    setSelectedNoteId(noteId);
    setDocPanelOpen(true);
    setDocLoadError(false);
    setDocFileUrl(null);
    setMessages([...getHistory(noteId, note.title)]);

    // Try to load the actual file via the document file endpoint
    // The note has sourceDocumentId which maps to the DocModel _id
    const token = localStorage.getItem('lectomate_token');
    if (token && (note as any).sourceDocumentId) {
      const docId = (note as any).sourceDocumentId;
      // Build authenticated URL — we'll use a blob URL approach
      try {
        const res = await fetch(`${API}/api/documents/${docId}/file`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          setDocFileUrl(url);
        } else {
          setDocLoadError(true);
        }
      } catch {
        setDocLoadError(true);
      }
    } else {
      setDocLoadError(true);
    }
  };

  const handleCloseDoc = () => {
    setDocPanelOpen(false);
    setSelectedNoteId(null);
    if (docFileUrl) URL.revokeObjectURL(docFileUrl);
    setDocFileUrl(null);
    setDocLoadError(false);
    setMessages([...getHistory(GLOBAL_KEY)]);
  };

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (docFileUrl) URL.revokeObjectURL(docFileUrl); };
  }, [docFileUrl]);

  // ── Chat ──────────────────────────────────────────────────────
  const localFallback = useCallback((input: string): string => {
    const l = input.toLowerCase();
    if (selectedNote) {
      if (l.includes('summarise') || l.includes('summarize') || l.includes('summary'))
        return `Here's a quick summary of "${selectedNote.title}":\n\n${selectedNote.sections[0]?.content?.slice(0, 400) || 'No content available.'}`;
      if (l.includes('key') || l.includes('concept'))
        return `Key concepts in "${selectedNote.title}":\n\n${selectedNote.sections.flatMap(s => s.highlights).slice(0, 6).map(t => `• ${t}`).join('\n') || 'No key terms found.'}`;
    }
    if (l.includes('flashcard')) return 'Flashcards are automatically generated when you upload a document. Head to the Flashcards section!';
    if (l.includes('quiz') || l.includes('test')) return 'Quizzes are automatically created from your uploaded documents. Go to the Quiz section!';
    return "I'm your AI tutor! Ask me to explain a concept, summarise a document, or quiz you on any topic.";
  }, [selectedNote]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text ?? inputText).trim();
    if (!msg || isTyping) return;
    const chatKey = selectedNoteId ?? GLOBAL_KEY;
    const userMsg: Message = { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() };
    const history = [...(chatHistories[chatKey] || []), userMsg];
    chatHistories[chatKey] = history;
    setMessages([...history]);
    setInputText('');
    setIsTyping(true);

    const token = localStorage.getItem('lectomate_token');
    let botText = '';
    if (!token) {
      botText = 'Please log in to use the AI chat assistant.';
    } else {
      try {
        // Pass last 12 messages as conversation history for multi-turn context
        const conversationHistory = history.slice(-12).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));
        const res = await fetch(`${API}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: msg, noteId: selectedNoteId ?? undefined, history: conversationHistory }),
        });
        const data = await res.json();
        botText = (res.ok && data.success && data.data?.reply) ? data.data.reply : localFallback(msg);
      } catch {
        botText = localFallback(msg);
      }
    }

    const botMsg: Message = { id: (Date.now() + 1).toString(), text: botText, sender: 'bot', timestamp: new Date() };
    const updated = [...history, botMsg];
    chatHistories[chatKey] = updated;
    setMessages([...updated]);
    setIsTyping(false);
  }, [inputText, isTyping, selectedNoteId, localFallback]);

  const quickPrompts = selectedNote
    ? ['Summarise this document', 'What are the key concepts?', 'Quiz me on this', 'Explain the main ideas']
    : ['Explain machine learning', 'What is overfitting?', 'Help me study', 'Generate practice questions'];

  const isPdf = selectedNote?.fileName?.toLowerCase().endsWith('.pdf') ?? false;

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 select-none">

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
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

      {/* ── DOCUMENT PANEL (resizable) ────────────────────────── */}
      {docPanelOpen && selectedNote && (
        <>
          <div className="flex flex-col bg-white border-r border-gray-200 flex-shrink-0 overflow-hidden" style={{ width: docPanelWidth }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-blue-50 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-blue-900 truncate">{selectedNote.title}</p>
                <p className="text-xs text-blue-500 truncate mt-0.5">{selectedNote.fileName} • {selectedNote.fileSize}</p>
              </div>
              <button onClick={handleCloseDoc} className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-400 transition-colors flex-shrink-0 ml-2"><X size={15} /></button>
            </div>

            {/* Tags */}
            {selectedNote.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-100 flex-shrink-0">
                {selectedNote.tags.map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            {/* File viewer */}
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {docFileUrl && isPdf ? (
                /* PDF — render directly in iframe */
                <iframe
                  src={docFileUrl}
                  className="flex-1 w-full border-0"
                  title={selectedNote.fileName}
                />
              ) : docFileUrl && !isPdf ? (
                /* Non-PDF file — show raw text */
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <FileText size={12} /> Document Content
                  </p>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4 border border-gray-100 font-mono">
                    {(selectedNote as any).rawContent || selectedNote.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n') || 'No content available.'}
                  </div>
                </div>
              ) : docLoadError ? (
                /* File not accessible — show extracted text */
                <div className="flex-1 overflow-y-auto px-4 py-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <FileText size={12} /> Extracted Content
                  </p>
                  <div className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-4 border border-gray-100">
                    {(selectedNote as any).rawContent || selectedNote.sections.map(s => `${s.title}\n\n${s.content}`).join('\n\n---\n\n') || 'No content available.'}
                  </div>
                </div>
              ) : (
                /* Loading */
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 size={28} className="mx-auto text-blue-400 animate-spin mb-3" />
                    <p className="text-xs text-gray-500">Loading document…</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Drag handle */}
          <div
            onMouseDown={onDragStart}
            className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-teal-400 active:bg-teal-500 cursor-col-resize transition-colors flex items-center justify-center group"
            title="Drag to resize"
          >
            <GripVertical size={14} className="text-gray-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </>
      )}

      {/* ── AI CHATBOT ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-[300px] bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot size={20} className="text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Tutor</p>
              <p className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                {selectedNote ? `Focused on: ${selectedNote.title}` : 'General mode • Ready to help'}
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
              <div className={`flex items-end gap-2 max-w-[82%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-teal-100'}`}>
                  {msg.sender === 'user' ? <User size={13} className="text-blue-600" /> : <Bot size={13} className="text-teal-600" />}
                </div>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${msg.sender === 'user' ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                  {msg.sender === 'bot' ? <BotText text={msg.text} /> : <span>{msg.text}</span>}
                  <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-blue-200' : 'text-gray-400'}`}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="flex items-end gap-2">
                <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center"><Bot size={13} className="text-teal-600" /></div>
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2">
                  <Loader2 size={13} className="text-teal-500 animate-spin" />
                  <span className="text-sm text-gray-500">Thinking…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick prompts */}
        <div className="px-5 py-2 border-t border-gray-100 flex-shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {quickPrompts.map((p, i) => (
              <button key={i} onClick={() => handleSend(p)} disabled={isTyping}
                className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-600 rounded-full transition-colors disabled:opacity-40">
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-gray-200 flex-shrink-0">
          <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-teal-400 focus-within:border-transparent transition-all">
            <input type="text" value={inputText} onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={selectedNote ? `Ask about "${selectedNote.title}"…` : 'Ask me anything…'}
              disabled={isTyping}
              className="flex-1 text-sm bg-transparent outline-none disabled:opacity-50 placeholder-gray-400" />
            <button onClick={() => handleSend()} disabled={!inputText.trim() || isTyping}
              className="p-1.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0">
              <Send size={15} />
            </button>
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
