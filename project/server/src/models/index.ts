import mongoose, { Schema, Document } from 'mongoose';

// ── User ──────────────────────────────────────────────────────────
export interface IUser extends Document {
  id: string;
  name: string;
  email: string;
  password: string;
  joinDate: Date;
  studyStreak: number;
  totalDocuments: number;
  totalFlashcards: number;
  totalQuizzes: number;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    joinDate: { type: Date, default: Date.now },
    studyStreak: { type: Number, default: 0 },
    totalDocuments: { type: Number, default: 0 },
    totalFlashcards: { type: Number, default: 0 },
    totalQuizzes: { type: Number, default: 0 },
  },
  { timestamps: false }
);

// Virtual `id` that mirrors `_id` as a plain string
UserSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    delete ret.password;
    return ret;
  },
});

// ── Document ──────────────────────────────────────────────────────
export interface IDocument extends Document {
  userId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  filePath: string;
  uploadedAt: Date;
  processed: boolean;
  processingError: string | null;
  processedAt: Date | null;
}

const DocumentSchema = new Schema<IDocument>(
  {
    userId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    mimeType: { type: String, required: true },
    filePath: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now },
    processed: { type: Boolean, default: false },
    processingError: { type: String, default: null },
    processedAt: { type: Date, default: null },
  },
  { timestamps: false }
);

DocumentSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// ── Note ──────────────────────────────────────────────────────────
const SectionSchema = new Schema(
  {
    id: String,
    title: String,
    content: String,
    highlights: [String],
  },
  { _id: false }
);

export interface INote extends Document {
  userId: string;
  title: string;
  fileName: string;
  uploadDate: Date;
  fileSize: string;
  status: 'processing' | 'completed';
  sections: Array<{ id: string; title: string; content: string; highlights: string[] }>;
  tags: string[];
  lastAccessed: Date;
  sourceDocumentId: string;
}

const NoteSchema = new Schema<INote>(
  {
    userId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    fileName: { type: String, default: '' },
    uploadDate: { type: Date, default: Date.now },
    fileSize: { type: String, default: '0 B' },
    status: { type: String, enum: ['processing', 'completed'], default: 'completed' },
    sections: [SectionSchema],
    tags: [String],
    lastAccessed: { type: Date, default: Date.now },
    sourceDocumentId: { type: String, default: '' },
  },
  { timestamps: false }
);

NoteSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// ── Flashcard ─────────────────────────────────────────────────────
export interface IFlashcard extends Document {
  userId: string;
  noteId: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  createdAt: Date;
  lastReviewed: Date | null;
  correctCount: number;
  totalReviews: number;
}

const FlashcardSchema = new Schema<IFlashcard>(
  {
    userId: { type: String, required: true, index: true },
    noteId: { type: String, required: true, index: true },
    front: { type: String, required: true },
    back: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    createdAt: { type: Date, default: Date.now },
    lastReviewed: { type: Date, default: null },
    correctCount: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
  },
  { timestamps: false }
);

FlashcardSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// ── Quiz ──────────────────────────────────────────────────────────
const QuestionSchema = new Schema(
  {
    id: String,
    type: { type: String, enum: ['multiple-choice', 'true-false', 'short-answer'], default: 'multiple-choice' },
    question: String,
    options: [String],
    correctAnswer: String,
    explanation: String,
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  },
  { _id: false }
);

const AttemptSchema = new Schema(
  {
    id: String,
    completedAt: { type: Date, default: Date.now },
    score: Number,
    totalQuestions: Number,
    timeSpent: Number,
  },
  { _id: false }
);

export interface IQuiz extends Document {
  userId: string;
  noteId: string;
  title: string;
  questions: any[];
  createdAt: Date;
  attempts: any[];
}

const QuizSchema = new Schema<IQuiz>(
  {
    userId: { type: String, required: true, index: true },
    noteId: { type: String, required: true, index: true },
    title: { type: String, required: true },
    questions: [QuestionSchema],
    createdAt: { type: Date, default: Date.now },
    attempts: [AttemptSchema],
  },
  { timestamps: false }
);

QuizSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString();
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

// ── Exports ───────────────────────────────────────────────────────
export const User = mongoose.model<IUser>('User', UserSchema);
export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
export const Note = mongoose.model<INote>('Note', NoteSchema);
export const Flashcard = mongoose.model<IFlashcard>('Flashcard', FlashcardSchema);
export const Quiz = mongoose.model<IQuiz>('Quiz', QuizSchema);
