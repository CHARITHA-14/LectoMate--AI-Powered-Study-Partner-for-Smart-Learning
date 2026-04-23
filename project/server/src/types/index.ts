export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinDate: Date;
  studyStreak: number;
  totalDocuments: number;
  totalFlashcards: number;
  totalQuizzes: number;
  password: string;
}

export interface Note {
  id: string;
  userId: string;
  title: string;
  fileName: string;
  uploadDate: Date;
  fileSize: string;
  status: 'processing' | 'completed';
  sections: NoteSection[];
  tags: string[];
  lastAccessed?: Date;
}

export interface NoteSection {
  id: string;
  title: string;
  content: string;
  highlights: string[];
}

export interface Flashcard {
  id: string;
  userId: string;
  noteId: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastReviewed?: Date;
  correctCount: number;
  totalReviews: number;
  createdAt: Date;
}

export interface Quiz {
  id: string;
  userId: string;
  noteId: string;
  title: string;
  questions: Question[];
  createdAt: Date;
  attempts: QuizAttempt[];
}

export interface Question {
  id: string;
  type: 'multiple-choice' | 'true-false' | 'short-answer';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizAttempt {
  id: string;
  completedAt: Date;
  score: number;
  totalQuestions: number;
  timeSpent: number;
}

export interface Document {
  id: string;
  userId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedAt: Date;
  processed: boolean;
}

export interface ChatMessage {
  id: string;
  userId: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
  type?: 'text' | 'suggestion' | 'document-ref';
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthPayload {
  userId: string;
  email: string;
}

export interface JwtPayload extends AuthPayload {
  iat: number;
  exp: number;
}
