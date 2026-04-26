import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Note, Flashcard, Quiz } from '../types';
import { API } from '../config/api';

interface UserContextType {
  user: User | null;
  notes: Note[];
  flashcards: Flashcard[];
  quizzes: Quiz[];
  loading: boolean;
  setUser: (user: User | null) => void;
  login: (email: string, password: string) => Promise<boolean | string>;
  register: (name: string, email: string, password: string) => Promise<boolean | string>;
  logout: () => void;
  loadUserData: () => Promise<void>;
  addNote: (note: Note) => void;
  updateNote: (noteId: string, updates: Partial<Note>) => void;
  deleteNote: (noteId: string) => void;
  addFlashcard: (flashcard: Flashcard) => void;
  addQuiz: (quiz: Quiz) => void;
  getFlashcardsByNoteId: (noteId: string) => Flashcard[];
  getQuizzesByNoteId: (noteId: string) => Quiz[];
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
};

interface UserProviderProps {
  children: ReactNode;
}

const toDate = (value: any): Date => {
  const parsed = value ? new Date(value) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const normalizeDifficulty = (value: any): 'easy' | 'medium' | 'hard' => {
  return value === 'easy' || value === 'medium' || value === 'hard' ? value : 'medium';
};

const normalizeQuestionType = (value: any): 'multiple-choice' | 'true-false' | 'short-answer' => {
  if (value === 'true-false' || value === 'short-answer' || value === 'multiple-choice') {
    return value;
  }
  return 'multiple-choice';
};

const normalizeUser = (raw: any): User => ({
  id: raw.id,
  name: raw.name,
  email: raw.email,
  avatar: raw.avatar,
  joinDate: toDate(raw.joinDate || raw.join_date),
  studyStreak: raw.studyStreak ?? raw.study_streak ?? 0,
  totalDocuments: raw.totalDocuments ?? raw.total_documents ?? 0,
  totalFlashcards: raw.totalFlashcards ?? raw.total_flashcards ?? 0,
  totalQuizzes: raw.totalQuizzes ?? raw.total_quizzes ?? 0
});

const normalizeNote = (raw: any): Note => ({
  id: raw.id,
  title: raw.title || 'Untitled Document',
  fileName: raw.fileName || raw.file_name || raw.originalName || raw.original_name || 'Unknown File',
  uploadDate: toDate(raw.uploadDate || raw.upload_date),
  fileSize: raw.fileSize || raw.file_size || '0 B',
  status: raw.status === 'processing' ? 'processing' : 'completed',
  sections: (raw.sections || []).map((section: any, index: number) => ({
    id: section.id || `section-${index + 1}`,
    title: section.title || `Section ${index + 1}`,
    content: section.content || '',
    highlights: Array.isArray(section.highlights) ? section.highlights : []
  })),
  tags: Array.isArray(raw.tags) ? raw.tags : [],
  rawContent: raw.rawContent || raw.raw_content || '',
  lastAccessed: raw.lastAccessed || raw.last_accessed
    ? toDate(raw.lastAccessed || raw.last_accessed)
    : undefined
});

const normalizeFlashcard = (raw: any): Flashcard => ({
  id: raw.id,
  noteId: raw.noteId || raw.note_id,
  front: raw.front || '',
  back: raw.back || '',
  difficulty: normalizeDifficulty(raw.difficulty),
  lastReviewed: raw.lastReviewed || raw.last_reviewed
    ? toDate(raw.lastReviewed || raw.last_reviewed)
    : undefined,
  correctCount: raw.correctCount ?? raw.correct_count ?? 0,
  totalReviews: raw.totalReviews ?? raw.total_reviews ?? 0,
  createdAt: toDate(raw.createdAt || raw.created_at)
});

const normalizeQuiz = (raw: any): Quiz => ({
  id: raw.id,
  noteId: raw.noteId || raw.note_id,
  title: raw.title || 'Generated Quiz',
  questions: (raw.questions || []).map((question: any, index: number) => ({
    id: question.id || `q-${index + 1}`,
    type: normalizeQuestionType(question.type),
    question: question.question || '',
    options: Array.isArray(question.options) ? question.options : undefined,
    correctAnswer: question.correctAnswer || question.correct_answer || '',
    explanation: question.explanation || '',
    difficulty: normalizeDifficulty(question.difficulty)
  })),
  createdAt: toDate(raw.createdAt || raw.created_at),
  attempts: (raw.attempts || []).map((attempt: any) => ({
    id: attempt.id,
    completedAt: toDate(attempt.completedAt || attempt.completed_at),
    score: attempt.score ?? 0,
    totalQuestions: attempt.totalQuestions ?? attempt.total_questions ?? 0,
    timeSpent: attempt.timeSpent ?? attempt.time_spent ?? 0
  }))
});

export const UserProvider: React.FC<UserProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  // API base URL
  const API_BASE = API;

  // Check for existing token on mount
  useEffect(() => {
    const token = localStorage.getItem('lectomate_token');
    if (token) {
      loadUserData();
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<boolean | string> => {
    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('lectomate_token', data.data.token);
        setUser(normalizeUser(data.data.user));
        await loadUserData();
        return true;
      }
      return data.error || 'Login failed';
    } catch {
      return 'Connection error. Make sure the server is running.';
    }
  };

  const register = async (name: string, email: string, password: string): Promise<boolean | string> => {
    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await response.json();
      if (data.success) {
        localStorage.setItem('lectomate_token', data.data.token);
        setUser(normalizeUser(data.data.user));
        await loadUserData();
        return true;
      }
      return data.error || 'Registration failed';
    } catch {
      return 'Connection error. Make sure the server is running.';
    }
  };

  const logout = () => {
    localStorage.removeItem('lectomate_token');
    setUser(null);
    setNotes([]);
    setFlashcards([]);
    setQuizzes([]);
  };

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('lectomate_token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Load user profile
      const userResponse = await fetch(`${API_BASE}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(normalizeUser(userData.data.user));
      }

      // Load notes
      const notesResponse = await fetch(`${API_BASE}/notes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (notesResponse.ok) {
        const notesData = await notesResponse.json();
        setNotes((notesData.data.notes || []).map(normalizeNote));
      }

      // Load flashcards
      const flashcardsResponse = await fetch(`${API_BASE}/flashcards`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (flashcardsResponse.ok) {
        const flashcardsData = await flashcardsResponse.json();
        setFlashcards((flashcardsData.data.flashcards || []).map(normalizeFlashcard));
      }

      // Load quizzes
      const quizzesResponse = await fetch(`${API_BASE}/quizzes`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (quizzesResponse.ok) {
        const quizzesData = await quizzesResponse.json();
        setQuizzes((quizzesData.data.quizzes || []).map(normalizeQuiz));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addNote = (note: Note) => {
    setNotes(prev => [...prev, normalizeNote(note)]);
    if (user) {
      setUser({ ...user, totalDocuments: user.totalDocuments + 1 });
    }
  };

  const updateNote = (noteId: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, ...updates } : note
    ));
  };

  const deleteNote = (noteId: string) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
    setFlashcards(prev => prev.filter(card => card.noteId !== noteId));
    setQuizzes(prev => prev.filter(quiz => quiz.noteId !== noteId));
  };

  const addFlashcard = (flashcard: Flashcard) => {
    setFlashcards(prev => [...prev, normalizeFlashcard(flashcard)]);
    if (user) {
      setUser({ ...user, totalFlashcards: user.totalFlashcards + 1 });
    }
  };

  const addQuiz = (quiz: Quiz) => {
    setQuizzes(prev => [...prev, normalizeQuiz(quiz)]);
    if (user) {
      setUser({ ...user, totalQuizzes: user.totalQuizzes + 1 });
    }
  };

  const getFlashcardsByNoteId = (noteId: string) => {
    return flashcards.filter(card => card.noteId === noteId);
  };

  const getQuizzesByNoteId = (noteId: string) => {
    return quizzes.filter(quiz => quiz.noteId === noteId);
  };

  const value = {
    user,
    notes,
    flashcards,
    quizzes,
    loading,
    setUser,
    login,
    register,
    logout,
    loadUserData,
    addNote,
    updateNote,
    deleteNote,
    addFlashcard,
    addQuiz,
    getFlashcardsByNoteId,
    getQuizzesByNoteId
  };

  return (
    <UserContext.Provider value={value}>
      {children}
    </UserContext.Provider>
  );
};