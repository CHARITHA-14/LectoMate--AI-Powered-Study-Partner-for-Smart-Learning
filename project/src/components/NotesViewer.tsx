import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import {
  BookOpen, Highlighter as Highlight, ChevronDown, ChevronRight,
  Send, Bot, User, Brain, ClipboardCheck, Upload, Search,
  PanelLeftOpen, PanelLeftClose, PanelRightOpen, PanelRightClose,
  FileText, Loader2, GripVertical, Sparkles, Clock, Tag,
  ChevronUp, AlignLeft,
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
  text: `Hi! I'm your AI tutor for **${noteTitle}**. Ask me anything — I can explain concepts, summarise sections, or quiz you on the content.`,
  sender: 'bot',
  timestamp: new Date(),
});

const getHistory = (noteId: string, noteTitle: string): ChatMessage[] => {
  if (!chatHistories[noteId]) {
    chatHistories[noteId] = [makeWelcome(noteTitle)];
  }
  return chatHistories[noteId];
};

// ── Simple markdown-like renderer for bot messages ────────────────
const BotText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('**') && line.endsWith('**')) {
          return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <div key={i} className="flex gap-1.5">
              <span className="mt-0.5 text-teal-500 flex-shrink-0">•</span>
              <span>{line.slice(2)}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        // inline bold: **word**
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part
            )}
          </p>
        );
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
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['summary', 'overview', 'section-1'])
  );
  const [searchTerm, setSearchTerm] = useState('');

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput]       = useState('');
  const [isTyping, setIsTyping]         = useState(false);
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

  // ── Empty state ───────────────────────────────────────────────
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

  // ── Helpers ───────────────────────────────────────────────────
  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const highlightText = (text: string, highlights: string[]) => {
    if (!highlights.length) return text;
    let result = text;
    highlights.forEach(h => {
      const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      result = result.replace(regex, '<mark class="bg-yellow-200 px-0.5 rounded">$1</mark>');
    });
    return result;
  };

  const selectNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setExpandedSections(new Set(['summary', 'overview', 'section-1']));
  };

  // ── Chat ──────────────────────────────────────────────────────
  const localFallback = useCallback((input: string): string => {
    const l = input.toLowerCase();
    if (l.includes('summarise') || l.includes('summarize') || l.includes('summary'))
      return `Here's a quick summary of "${currentDoc.title}":\n\n${currentDoc.sections[0]?.content?.slice(0, 400) || 'No content available.'}`;
    if (l.includes('flashcard'))
      return `Flashcards for "${currentDoc.title}" are ready in the Flashcards section. Head there to study with spaced repetition!`;
    if (l.includes('quiz') || l.includes('test'))
      return `A quiz for "${currentDoc.title}" is waiting in the Quiz section. Give it a try!`;
    if (l.includes('key') || l.includes('concept') || l.includes('topic')) {
      const terms = currentDoc.sections.flatMap(s => s.highlights).slice(0, 6);
      return terms.length
        ? `Key concepts in "${currentDoc.title}":\n\n${terms.map(t => `• ${t}`).join('\n')}`
        : `The key concepts are covered in the sections of "${currentDoc.title}". Expand them to read more.`;
    }
    return `I'm your AI tutor for "${currentDoc.title}". Ask me to explain a concept, summarise a section, or quiz you on the content!`;
  }, [currentDoc]);

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? chatInput).trim();
    if (!msg || isTyping) return;

    const userMsg: ChatMessage = { id: Date.now().toString(), text: msg, sender: 'user', timestamp: new Date() };
    const history = [...(chatHistories[selectedNoteId] || []), userMsg];
    chatHistories[selectedNoteId] = history;
    setChatMessages([...history]);
    setChatInput('');
    setIsTyping(true);

    const token = localStorage.getItem('lectomate_token');
    let botText = '';

    if (!token) {
      botText = 'Please log in to use the AI chat assistant.';
    } else {
      try {
        // Build conversation history for multi-turn context (last 6 exchanges)
        const conversationHistory = history.slice(-12).map(m => ({
          role: m.sender === 'user' ? 'user' : 'assistant',
          content: m.text,
        }));
        const res = await fetch(`${API}/chat/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ message: msg, noteId: selectedNoteId, history: conversationHistory }),
        });
        const data = await res.json();
        botText = (res.ok && data.success && data.data?.reply) ? data.data.reply : localFallback(msg);
      } catch {
        botText = localFallback(msg);
      }
    }

    const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), text: botText, sender: 'bot', timestamp: new Date() };
    const updated = [...history, botMsg];
    chatHistories[selectedNoteId] = updated;
    setChatMessages([...updated]);
    setIsTyping(false);
  }, [chatInput, isTyping, selectedNoteId, localFallback]);

  const quickPrompts = ['Summarise this document', 'What are the key concepts?', 'Quiz me on this', 'Explain the main ideas'];

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-gray-50">

      {/* ════════════════════════════════════════════════════════
          LEFT PANEL — Search Documents (collapsible)
      ════════════════════════════════════════════════════════ */}
      <div className={`flex flex-col bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${docsOpen ? 'w-[260px]' : 'w-12'}`}>

        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 px-3 py-3 gap-2 ${docsOpen ? 'justify-between' : 'justify-center'}`}>
          <button
            onClick={() => setDocsOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
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
                  placeholder="Search documents…"
                  className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none bg-gray-50"
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
                        ? 'bg-blue-50 border border-blue-200'
                        : 'hover:bg-gray-50 border border-transparent'
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
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Upload size={13} /> Upload New Document
              </button>
            </div>
          </>
        ) : (
          /* Collapsed icons */
          <div className="flex flex-col items-center gap-3 pt-4">
            <button onClick={() => setDocsOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Search documents">
              <Search size={17} />
            </button>
            <button onClick={() => setDocsOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Documents">
              <BookOpen size={17} />
            </button>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════
          CENTER — Unified Document Summary & Notes
      ════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto min-w-0 bg-gray-50">
        <div className="max-w-3xl mx-auto px-6 py-6">

          {/* ── Document header ─────────────────────────────── */}
          <div className="mb-6">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2 flex-wrap">
              <FileText size={13} />
              <span className="truncate max-w-xs">{currentDoc.fileName}</span>
              <span>•</span>
              <span>{currentDoc.uploadDate.toLocaleDateString()}</span>
              {currentDoc.fileSize && <><span>•</span><span>{currentDoc.fileSize}</span></>}
              {currentDoc.readingTime && currentDoc.readingTime > 0 && (
                <><span>•</span><Clock size={11} /><span>{currentDoc.readingTime} min read</span></>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 leading-tight mb-3">{currentDoc.title}</h1>
            {currentDoc.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {currentDoc.tags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
                    <Tag size={9} />{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* ── AI Summary hero ──────────────────────────────── */}
          <div className="relative overflow-hidden bg-gradient-to-br from-teal-600 via-teal-700 to-blue-700 rounded-2xl p-6 text-white shadow-lg mb-6">
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white opacity-5 rounded-full" />
            <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white opacity-5 rounded-full" />
            <div className="relative">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-white bg-opacity-20 rounded-lg flex items-center justify-center">
                  <Sparkles size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">AI-Generated Summary</p>
                  <p className="text-xs text-teal-200">Powered by Gemini AI</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-teal-50">
                {currentDoc.summary || currentDoc.sections[0]?.content?.slice(0, 400) || 'No summary available.'}
              </p>
              {/* Inline stats */}
              <div className="flex gap-5 mt-4 pt-3 border-t border-white border-opacity-20">
                <div>
                  <p className="text-lg font-bold text-white">{currentDoc.sections.length}</p>
                  <p className="text-xs text-teal-200">Sections</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{[...new Set(currentDoc.sections.flatMap(s => s.highlights))].length}</p>
                  <p className="text-xs text-teal-200">Key Terms</p>
                </div>
                {currentDoc.readingTime && currentDoc.readingTime > 0 && (
                  <div>
                    <p className="text-lg font-bold text-white">{currentDoc.readingTime}</p>
                    <p className="text-xs text-teal-200">Min Read</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Expand / Collapse all ────────────────────────── */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
              <AlignLeft size={13} /> Detailed Notes
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setExpandedSections(new Set(currentDoc.sections.map(s => s.id)))}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
              >
                <ChevronDown size={12} /> Expand all
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={() => setExpandedSections(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
              >
                <ChevronUp size={12} /> Collapse all
              </button>
            </div>
          </div>

          {/* ── Sections ─────────────────────────────────────── */}
          <div className="space-y-3">
            {currentDoc.sections.map((section, idx) => (
              <div
                key={section.id}
                id={`section-${section.id}`}
                className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h3 className="text-sm font-semibold text-gray-900">{section.title}</h3>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {section.highlights.length > 0 && (
                      <span className="text-xs text-gray-400 hidden sm:block">{section.highlights.length} terms</span>
                    )}
                    {expandedSections.has(section.id)
                      ? <ChevronDown size={16} className="text-gray-400" />
                      : <ChevronRight size={16} className="text-gray-400" />}
                  </div>
                </button>

                {expandedSections.has(section.id) && (
                  <div className="border-t border-gray-100">
                    <div className="px-5 pt-4 pb-3">
                      <div
                        className="text-sm text-gray-700 leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: highlightText(section.content, section.highlights) }}
                      />
                    </div>
                    {section.highlights.length > 0 && (
                      <div className="px-5 pb-4 pt-3 border-t border-gray-50 bg-gray-50">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                          <Highlight size={11} /> Key Terms
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {section.highlights.map((term, i) => (
                            <span key={i} className="px-2.5 py-1 text-xs font-medium text-blue-800 bg-white border border-blue-200 rounded-full hover:bg-blue-50 transition-colors cursor-default">
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── All key terms cloud ──────────────────────────── */}
          {(() => {
            const allTerms = [...new Set(currentDoc.sections.flatMap(s => s.highlights))];
            return allTerms.length > 0 ? (
              <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-3">
                  <Highlight size={13} /> All Key Terms
                </p>
                <div className="flex flex-wrap gap-2">
                  {allTerms.map((term, i) => (
                    <span key={i} className="px-3 py-1.5 text-xs font-medium text-blue-800 bg-blue-50 border border-blue-100 rounded-full hover:bg-blue-100 transition-colors cursor-default">
                      {term}
                    </span>
                  ))}
                </div>
              </div>
            ) : null;
          })()}

          {/* ── Study tools ──────────────────────────────────── */}
          <div className="mt-5 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Study Tools</p>
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

      {/* ════════════════════════════════════════════════════════
          RIGHT PANEL — AI Chat (collapsible + resizable)
      ════════════════════════════════════════════════════════ */}

      {/* Drag handle — only visible when chat is open */}
      {chatOpen && (
        <div
          onMouseDown={onChatDragStart}
          className="w-1.5 flex-shrink-0 bg-gray-200 hover:bg-teal-400 active:bg-teal-500 cursor-col-resize transition-colors flex items-center justify-center group"
          title="Drag to resize chat"
        >
          <GripVertical size={14} className="text-gray-400 group-hover:text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      <div
        className={`flex flex-col bg-white border-l border-gray-200 transition-all duration-300 flex-shrink-0 ${chatOpen ? '' : 'w-12'}`}
        style={chatOpen ? { width: chatWidth } : undefined}
      >

        {/* Header */}
        <div className={`flex items-center border-b border-gray-100 px-3 py-3 gap-2 ${chatOpen ? 'justify-between' : 'justify-center'}`}>
          <button
            onClick={() => setChatOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors flex-shrink-0"
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
                <p className="text-xs font-semibold text-gray-800 leading-none">AI Tutor</p>
                <p className="text-xs text-teal-600 truncate max-w-[160px] mt-0.5">{currentDoc.title}</p>
              </div>
              <div className="ml-auto w-2 h-2 bg-green-400 rounded-full flex-shrink-0" />
            </div>
          )}
        </div>

        {chatOpen ? (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
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
                      <span className="text-xs text-gray-500">Thinking…</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick prompts */}
            <div className="px-3 pt-2 pb-1 border-t border-gray-100">
              <div className="flex flex-wrap gap-1">
                {quickPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(p)}
                    disabled={isTyping}
                    className="text-xs px-2.5 py-1 bg-gray-100 hover:bg-teal-50 hover:text-teal-700 text-gray-600 rounded-full transition-colors disabled:opacity-40"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="px-3 pb-3 pt-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Ask about this document…"
                  disabled={isTyping}
                  className="flex-1 text-xs px-3 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-teal-400 focus:border-transparent outline-none disabled:opacity-50 bg-gray-50"
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
            <button onClick={() => setChatOpen(true)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors" title="Open AI chat">
              <Bot size={17} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
};
