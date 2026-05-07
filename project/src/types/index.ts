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
}

export interface Note {
  id: string;
  title: string;
  fileName: string;
  uploadDate: Date;
  fileSize: string;
  status: 'processing' | 'completed';
  summary?: string;
  readingTime?: number;
  sections: NoteSection[];
  tags: string[];
  rawContent?: string;
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

export type ViewType = 'dashboard' | 'upload' | 'notes' | 'flashcards' | 'quiz' | 'chat' | 'profile';