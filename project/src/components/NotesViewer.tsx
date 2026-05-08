import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  BookOpen, Highlighter as Highlight,
  Send, Bot, User, Brain, ClipboardCheck, Upload, Search,
  PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  FileText, Loader2, GripVertical, Sparkles, Clock, Tag,
} from 'lucide-react';
import { API } from '../config/api';



interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

// Persist chat history per note across re-renders
const chatHistories: Record<string, ChatMessage[]> = {};

const makeWelcome = (noteTitle: string): ChatMessage => ({
  id: 'welcome',
  text: `Hi! I'm your AI tutor for **${noteTitle}**. Ask me anything â€” I can explain concepts, summarise sections, or quiz you on the content.`,
  sender: 'bot',
  timestamp: new Date(),
});

const getHistory = (noteId: string, noteTitle: string): ChatMessage[] => {
  if (!chatHistories[noteId]) {
    chatHistories[noteId] = [makeWelcome(noteTitle)];
  }
  return chatHistories[noteId];
};

// â”€â”€ Simple markdown-like renderer for bot messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ── Markdown renderer for bot messages ───────────────────────────
const BotText: React.FC<{ text: string }> = ({ text }) => {
  if (!text || text.trim() === '') {
    return (
      <div className="flex items-center gap-1 py-1">
        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-1.5 h-1.5 bg-teal-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    );
  }
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('- ') || line.startsWith('* '))
          return <div key={i} className="flex gap-1.5"><span className="mt-0.5 text-teal-500 flex-shrink-0">•</span><span>{line.slice(2)}</span></div>;
        if (/^\d+\.\s/.test(line))
          return <div key={i} className="flex gap-1.5"><span className="text-teal-600 flex-shrink-0 font-semibold text-xs mt-0.5">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\.\s/, '')}</span></div>;
        if (line.startsWith('## ')) return <p key={i} className="font-bold text-gray-900 mt-1">{line.slice(3)}</p>;
        if (line.startsWith('# '))  return <p key={i} className="font-bold text-gray-900 text-base mt-1">{line.slice(2)}</p>;
        if (line.trim() === '---')  return <hr key={i} className="border-gray-200 my-1" />;
        if (line.trim() === '')     return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return <p key={i}>{parts.map((part, j) => part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2,-2)}</strong> : part)}</p>;
      })}
    </div>
  );
};
export const NotesViewer: React.FC = () => {
  const { notes } = useUser();
  const navigate = useNavigate();

  const [chatOpen, setChatOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);
  const [chatWidth, setChatWidth] = useState(320);

  // Drag-to-resize for chat panel
  const isDragging  = useRef(false);
  const dragStartX  = useRef(0);
  const dragStartW  = useRef(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      // Dragging left increases chat width (handle is on left edge of chat panel)
      const delta = dragStartX.current - e.clientX;
      const newW  = Math.min(Math.max(dragStartW.current + delta, 240), 600);
      setChatWidth(newW);
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

  const onChatDragStart = useCallback((e: React.MouseEvent) => {
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = chatWidth;
    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [chatWidth]);

  // Notes state
  const [selectedNoteId, setSelectedNoteId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Pick first note on load
  useEffect(() => {
    if (notes.length > 0 && !selectedNoteId) {
      setSelectedNoteId(notes[0].id);
    }
  }, [notes]);

  // Load chat history when note changes
  useEffect(() => {
    if (!selectedNoteId) return;
    const note = notes.find(n => n.id === selectedNoteId);
    if (note) setChatMessages(getHistory(selectedNoteId, note.title));
  }, [selectedNoteId]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isTyping]);

  // â”€â”€ Empty state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (notes.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-gray-50">
        <div className="text-center">
          <BookOpen size={56} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-800 mb-2">No documents yet</h3>
          <p className="text-gray-500 mb-6">Upload a document to generate AI-powered notes.</p>
          <button
            onClick={() => navigate('/upload')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Document
          </button>
        </div>
      </div>
    );
  }

  const currentDoc = notes.find(n => n.id === selectedNoteId) || notes[0];
  const filteredNotes = notes.filter(n =>
    n.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const highlightText = (text: string, highlights: string[]) => {
    // Strip any existing HTML tags to prevent double-encoding from stored data
    const clean = text.replace(/<[^>]*>/g, '');
    if (!highlights.length) return clean;
    let result = clean;
    highlights.forEach(h => {
      if (!h || !h.trim()) return;
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      try {
        const regex = new RegExp(`(${escaped})`, 'gi');
        result = result.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded font-medium">$1</mark>');
      } catch { /* skip invalid regex */ }
    });
    return result;
  };
  const selectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
  };

  // â”€â”€ Chat â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || isTyping) return;

    // Capture noteId at call time to avoid stale closure
    const noteKey = selectedNoteId;

    const userMsg: ChatMessage = { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() };
    const history = [...(chatHistories[noteKey] || []), userMsg];
    chatHistories[noteKey] = history;
    setChatMessages([...history]);
    setChatInput('');
    setIsTyping(true);

    const token = localStorage.getItem('lectomate_token');
    if (!token) {
      const e: ChatMessage = { id: (Date.now()+1).toString(), text: 'Please log in to use the AI chat assistant.', sender: 'bot', timestamp: new Date() };
      chatHistories[noteKey] = [...history, e];
      setChatMessages([...history, e]);
      setIsTyping(false);
      return;
    }

    const convHistory = history.filter(m => m.id !== 'welcome').slice(-10).map(m => ({
      role: m.sender === 'user' ? 'user' : 'assistant', content: m.text,
    }));

    const botId = `bot-${Date.now()}`;
    const botMsg: ChatMessage = { id: botId, text: '', sender: 'bot', timestamp: new Date() };
    const withBot = [...history, botMsg];
    chatHistories[noteKey] = withBot;
    setChatMessages([...withBot]);

    const controller = new AbortController();
    abortRef.current = controller;
    let accumulated = '';

    try {
      const res = await fetch(`${API}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: msg, noteId: noteKey || undefined, history: convHistory }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        // Fallback to non-streaming endpoint
        const fallbackRes = await fetch(`${API}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: msg, noteId: noteKey || undefined, history: convHistory }),
        });
        const fallbackData = await fallbackRes.json();
        const replyText = fallbackData?.data?.reply || 'Sorry, I could not get a response. Please try again.';
        const final: ChatMessage = { id: botId, text: replyText, sender: 'bot', timestamp: new Date() };
        chatHistories[noteKey] = [...history, final];
        setChatMessages(prev => prev.map(m => m.id === botId ? final : m));
        return;
      }

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
            const payload = JSON.parse(line.slice(6));
            if (payload.token) {
              accumulated += payload.token;
              const currentText = accumulated;
              setChatMessages(prev => prev.map(m => m.id === botId ? { ...m, text: currentText } : m));
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
            }
            if (payload.error) {
              accumulated += payload.error;
            }
            if (payload.done) {
              const finalText = accumulated || 'No response received. Please try again.';
              const final: ChatMessage = { id: botId, text: finalText, sender: 'bot', timestamp: new Date() };
              chatHistories[noteKey] = [...history, final];
              setChatMessages(prev => prev.map(m => m.id === botId ? final : m));
            }
          } catch { /* skip malformed line */ }
        }
      }

      // Ensure final state is set even if 'done' event was missed
      if (accumulated) {
        const final: ChatMessage = { id: botId, text: accumulated, sender: 'bot', timestamp: new Date() };
        chatHistories[noteKey] = [...history, final];
        setChatMessages(prev => prev.map(m => m.id === botId ? final : m));
      }

    } catch (err: any) {
      const errText = err.name === 'AbortError'
        ? (accumulated || '(Response stopped)')
        : 'Sorry, something went wrong. Please try again.';
      const final: ChatMessage = { id: botId, text: errText, sender: 'bot', timestamp: new Date() };
      chatHistories[noteKey] = [...history, final];
      setChatMessages(prev => prev.map(m => m.id === botId ? final : m));
    } finally {
      setIsTyping(false);
      abortRef.current = null;
    }
  }, [chatInput, isTyping, selectedNoteId]);

  const quickPrompts = ['Summarise this document', 'What are the key concepts?', 'Quiz me on this', 'Explain the main ideas'];

  // â”€â”€ Render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50 dark:bg-gray-950 transition-colors duration-200">

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          LEFT PANEL â€” Search Documents (collapsible)
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className={`flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 flex-shrink-0 ${docsOpen ? 'w-[260px]' : 'w-12'}`}>

        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 dark:border-gray-700 px-3 py-3 gap-2 ${docsOpen ? 'justify-between' : 'justify-center'}`}>
          <button
            onClick={() => setDocsOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
            title={docsOpen ? 'Collapse documents' : 'Open documents'}
          >
            {docsOpen ? <PanelLeftClose size={17} /> : <PanelLeftOpen size={17} />}
          </button>
          {docsOpen && (
            <span className="text-xs font-semibold text-gray-700">Documents</span>
          )}
        </div>

        {docsOpen ? (
          <>
            {/* Search */}
            <div className="px-3 pt-3 pb-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search documentsâ€¦"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-500"
                />
              </div>
            </div>

            {/* Document list */}
            <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
              {filteredNotes.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No documents match your search.</p>
              ) : (
                filteredNotes.map(note => (
                  <button
                    key={note.id}
                    onClick={() => selectNote(note.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-all ${
                      selectedNoteId === note.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-800 border border-transparent'
                    }`}
                  >
                    <div className={`text-xs font-medium truncate ${selectedNoteId === note.id ? 'text-blue-900' : 'text-gray-800'}`}>
                      {note.title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{note.fileName}</div>
                    <div className="text-xs text-gray-300 mt-0.5">{note.uploadDate.toLocaleDateString()}</div>
                  </button>
                ))
              )}
            </div>

            {/* Upload button */}
            <div className="px-3 pb-3 border-t border-gray-100 pt-3">
              <button
                onClick={() => navigate('/upload')}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
              >
                <Upload size={13} /> Upload New Document
              </button>
            </div>
          </>
        ) : (
          /* Collapsed icons */
          <div className="flex flex-col items-center gap-3 pt-4">
            <button onClick={() => setDocsOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors" title="Search documents">
              <Search size={17} />
            </button>
            <button onClick={() => setDocsOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors" title="Documents">
              <BookOpen size={17} />
            </button>
          </div>
        )}
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CENTER â€” Unified Document Summary & Notes
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div className="flex-1 overflow-y-auto min-w-0 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-3xl mx-auto px-6 py-6">

          {/* â”€â”€ Document header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500 mb-2 flex-wrap">
              <FileText size={13} />
              <span className="truncate max-w-xs">{currentDoc.fileName}</span>
              <span>â€¢</span>
              <span>{currentDoc.uploadDate.toLocaleDateString()}</span>
              {currentDoc.fileSize && <><span>â€¢</span><span>{currentDoc.fileSize}</span></>}
              {currentDoc.readingTime && currentDoc.readingTime > 0 && (
                <><span>â€¢</span><Clock size={11} /><span>{currentDoc.readingTime} min read</span></>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-3">{currentDoc.title}</h1>
            {currentDoc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentDoc.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-full">
                    <Tag size={9} />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* â”€â”€ Single unified Document Summary â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md dark:hover:shadow-gray-800 overflow-hidden mb-5 transition-all duration-200">
            {/* Card header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Document Summary</p>

              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-5 space-y-5">
              {/* AI executive summary paragraph */}
              {(currentDoc.summary || currentDoc.sections[0]?.content) && (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  {currentDoc.summary || currentDoc.sections[0]?.content?.slice(0, 500)}
                </p>
              )}

              {/* All section content merged as flowing paragraphs */}
              {currentDoc.sections.map((section, idx) => (
                <div key={section.id}>
                  {/* Skip first section content if it was already shown as summary */}
                  {(idx > 0 || currentDoc.summary) && (
                    <div
                      className="text-sm text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: highlightText(section.content, section.highlights) }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Key terms footer */}
            {(() => {
              const allTerms = [...new Set(currentDoc.sections.flatMap(s => s.highlights))];
              return allTerms.length > 0 ? (
                <div className="px-5 pb-5 pt-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
                    <Highlight size={12} /> Key Terms
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {allTerms.map((term, i) => (
                      <span key={i} className="px-2.5 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 rounded-full hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors cursor-default">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </div>

          {/* â”€â”€ Study tools â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
          <div className="mt-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Study Tools</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={() => navigate('/flashcards')} className="flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                <Brain size={15} /> Study Flashcards
              </button>
              <button onClick={() => navigate('/quiz')} className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 text-white text-sm rounded-lg hover:bg-orange-700 transition-colors shadow-sm">
                <ClipboardCheck size={15} /> Take Quiz
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          RIGHT PANEL â€” AI Chat (collapsible + resizable)
      â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}

      {/* Drag handle â€” only visible when chat is open */}
      {chatOpen && (
        <div
          onMouseDown={onChatDragStart}
          className="w-1.5 flex-shrink-0 bg-gray-200 dark:bg-gray-700 hover:bg-teal-400 active:bg-teal-500 cursor-col-resize transition-colors flex items-center justify-center group"
          title="Drag to resize chat"
        >
          <GripVertical size={14} className="text-gray-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      <div
        className={`flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 transition-all duration-300 flex-shrink-0 ${chatOpen ? '' : 'w-12'}`}
        style={chatOpen ? { width: chatWidth } : undefined}
      >

        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 dark:border-gray-700 px-3 py-3 gap-2 ${chatOpen ? 'justify-between' : 'justify-center'}`}>
          <button
            onClick={() => setChatOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors flex-shrink-0"
            title={chatOpen ? 'Collapse chat' : 'Open AI chat'}
          >
            {chatOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
          </button>
          {chatOpen && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot size={15} className="text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-none">AI Tutor</p>
                <p className="text-xs text-teal-600 truncate max-w-[160px] mt-0.5">{currentDoc.title}</p>
              </div>
              <div className="ml-auto w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
            </div>
          )}
        </div>

        {chatOpen ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0 dark:bg-gray-900">
              {chatMessages.map(msg => (
                <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-end gap-1.5 max-w-[92%] ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.sender === 'user' ? 'bg-blue-100' : 'bg-teal-100'}`}>
                      {msg.sender === 'user'
                        ? <User size={11} className="text-blue-600" />
                        : <Bot size={11} className="text-teal-600" />}
                    </div>
                    <div className={`rounded-2xl px-3 py-2 text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white rounded-br-sm'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
                    }`}>
                      {msg.sender === 'bot' ? <BotText text={msg.text} /> : <span>{msg.text}</span>}
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-end gap-1.5">
                    <div className="w-6 h-6 bg-teal-100 rounded-full flex items-center justify-center">
                      <Bot size={11} className="text-teal-600" />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1">
                      <Loader2 size={12} className="text-teal-500 animate-spin" />
                      <span className="text-xs text-gray-500">Thinkingâ€¦</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-3 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex flex-wrap gap-1">
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    disabled={isTyping}
                    className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-teal-50 dark:hover:bg-teal-900/30 hover:text-teal-700 dark:hover:text-teal-400 text-gray-600 dark:text-gray-300 rounded-full transition-colors disabled:opacity-40"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2 dark:bg-gray-900">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about this documentâ€¦"
                  disabled={isTyping}
                  className="flex-1 text-xs px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none disabled:opacity-50 bg-gray-50 dark:bg-gray-800 dark:text-gray-200"
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || isTyping}
                  className="p-2 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Collapsed icon */
          <div className="flex flex-col items-center gap-3 pt-4">
            <button onClick={() => setChatOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors" title="Open AI chat">
              <Bot size={17} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};

