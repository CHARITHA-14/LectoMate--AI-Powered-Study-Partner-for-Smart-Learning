const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const mongoose = require('mongoose');
require('dotenv').config();

// pdf-parse has a known issue where it reads a test file on require() in some
// environments. Suppress that by setting the test-file env var before importing.
process.env.PDF_PARSE_NO_TEST = '1';
const pdfParse = require('pdf-parse');

// ── Config ────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');
const app = express();
// Render injects PORT automatically — never hardcode it
const PORT = Number(process.env.PORT || 3001);
const JWT_SECRET = process.env.JWT_SECRET || 'lectomate_local_dev_secret';
const MAX_FILE_SIZE = Number(process.env.MAX_FILE_SIZE || 10 * 1024 * 1024);
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lectomate';

// Accept comma-separated origins OR wildcard for CORS
const rawOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',').map(o => o.trim()).filter(Boolean);
const FRONTEND_URLS = rawOrigins;

const resolveRuntimePath = (p, fallback) => {
  const t = (p || '').trim() || fallback;
  return path.isAbsolute(t) ? t : path.join(__dirname, t);
};
const UPLOAD_DIR = resolveRuntimePath(process.env.UPLOAD_DIR, 'uploads');

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf','application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain','application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream'
]);
const ALLOWED_EXTENSIONS = new Set(['.pdf','.doc','.docx','.txt','.ppt','.pptx']);

// ── Mongoose Schemas ──────────────────────────────────────────────
const userSchema = new mongoose.Schema({
  name:           { type: String, required: true, trim: true },
  email:          { type: String, required: true, unique: true, lowercase: true, trim: true },
  // select:false means password is never returned unless explicitly requested with .select('+password')
  password:       { type: String, required: true, select: false },
  avatar:         { type: String, default: '' },
  joinDate:       { type: Date, default: Date.now },
  studyStreak:    { type: Number, default: 0 },
  totalDocuments: { type: Number, default: 0 },
  totalFlashcards:{ type: Number, default: 0 },
  totalQuizzes:   { type: Number, default: 0 }
});
userSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; delete r.password; return r; } });

const documentSchema = new mongoose.Schema({
  userId:          { type: String, required: true, index: true },
  fileName:        String,
  originalName:    String,
  fileSize:        Number,
  mimeType:        String,
  filePath:        String,
  uploadedAt:      { type: Date, default: Date.now },
  processed:       { type: Boolean, default: false },
  processingError: { type: String, default: null },
  processedAt:     { type: Date, default: null }
});
documentSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; return r; } });

const sectionSchema = new mongoose.Schema({ id: String, title: String, content: String, highlights: [String] }, { _id: false });

const noteSchema = new mongoose.Schema({
  userId:           { type: String, required: true, index: true },
  title:            { type: String, required: true },
  fileName:         { type: String, default: '' },
  uploadDate:       { type: Date, default: Date.now },
  fileSize:         { type: String, default: '0 B' },
  status:           { type: String, enum: ['processing','completed'], default: 'completed' },
  summary:          { type: String, default: '' },   // AI executive summary
  readingTime:      { type: Number, default: 0 },    // estimated minutes
  sections:         [sectionSchema],
  tags:             [String],
  rawContent:       { type: String, default: '' },
  lastAccessed:     { type: Date, default: Date.now },
  sourceDocumentId: { type: String, default: '' }
});
noteSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; return r; } });

const flashcardSchema = new mongoose.Schema({
  userId:       { type: String, required: true, index: true },
  noteId:       { type: String, required: true, index: true },
  front:        { type: String, required: true },
  back:         { type: String, required: true },
  difficulty:   { type: String, enum: ['easy','medium','hard'], default: 'medium' },
  createdAt:    { type: Date, default: Date.now },
  lastReviewed: { type: Date, default: null },
  correctCount: { type: Number, default: 0 },
  totalReviews: { type: Number, default: 0 }
});
flashcardSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; return r; } });

const questionSchema = new mongoose.Schema({ id: String, type: String, question: String, options: [String], correctAnswer: String, explanation: String, difficulty: String }, { _id: false });
const attemptSchema  = new mongoose.Schema({ id: String, completedAt: { type: Date, default: Date.now }, score: Number, totalQuestions: Number, timeSpent: Number }, { _id: false });

const quizSchema = new mongoose.Schema({
  userId:    { type: String, required: true, index: true },
  noteId:    { type: String, required: true, index: true },
  title:     { type: String, required: true },
  questions: [questionSchema],
  createdAt: { type: Date, default: Date.now },
  attempts:  [attemptSchema]
});
quizSchema.set('toJSON', { virtuals: true, transform: (_d, r) => { r.id = r._id.toString(); delete r._id; delete r.__v; return r; } });

const UserModel     = mongoose.model('User',     userSchema);
const DocModel      = mongoose.model('Document', documentSchema);
const NoteModel     = mongoose.model('Note',     noteSchema);
const FlashModel    = mongoose.model('Flashcard',flashcardSchema);
const QuizModel     = mongoose.model('Quiz',     quizSchema);

// ── Helpers ───────────────────────────────────────────────────────
const ensureDir = (p) => { if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true }); };

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B','KB','MB','GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
};

const sanitizeUser = (user) => {
  const obj = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete obj.password;
  return obj;
};

const createToken = (user) =>
  jwt.sign({ id: user._id ? user._id.toString() : user.id, email: user.email }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const authenticate = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ success: false, error: 'Access token required' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    const user = await UserModel.findById(payload.id).lean();
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    const { password: _p, ...safe } = user;
    safe.id = user._id.toString();
    req.user = safe;
    return next();
  } catch {
    return res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
};

const extractKeywords = (text) => {
  const stop = new Set(['about','above','after','again','against','between','could','first','from','have','into','just','main','more','most','other','over','same','some','such','than','that','their','there','these','they','this','those','through','under','very','what','when','where','which','while','with','would','your']);
  const freq = new Map();
  for (const w of (text.toLowerCase().match(/\b[a-z][a-z-]{3,}\b/g) || []))
    if (!stop.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
  return [...freq.entries()].sort((a,b) => b[1]-a[1]).slice(0,12).map(([w]) => w.charAt(0).toUpperCase()+w.slice(1));
};

const buildFallbackContent = (cleanText, originalName) => {
  const keywords = extractKeywords(cleanText);
  const baseName = (originalName || 'Document').replace(/\.[^/.]+$/, '').replace(/[-_]/g,' ');
  const sections = [{ id:'summary', title:'Document Summary', content: cleanText.slice(0,1800) || 'No readable text found.', highlights: keywords.slice(0,6) }];
  if (cleanText.length > 1800) sections.push({ id:'details', title:'Detailed Notes', content: cleanText.slice(1800,3600), highlights: keywords.slice(6,12) });
  const flashcards = keywords.slice(0,8).map((kw,i) => ({ front:`What does "${kw}" refer to in this document?`, back:`"${kw}" is a key concept from your uploaded content.`, difficulty: i<3?'easy':i<6?'medium':'hard' }));
  const shuffle = (a) => { const b=[...a]; for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];} return b; };
  const questions = keywords.slice(0,5).map((kw,i) => {
    const correct = `${kw} is a key concept from this study material.`;
    return { id:`q-${i+1}`, type:'multiple-choice', question:`Which option best describes "${kw}"?`, options: shuffle([correct,`${kw} is unrelated to the document.`,`${kw} only appears in metadata.`,`${kw} is a formatting marker.`]), correctAnswer: correct, explanation:`Checks recall of "${kw}".`, difficulty: i<2?'easy':i<4?'medium':'hard' };
  });
  return { title: baseName, sections, tags: keywords.slice(0,5), flashcards, quiz: { title:`Quiz: ${baseName}`, questions } };
};

const normalizeText = (t) =>
  String(t || '')
    .replace(/\u0000/g, ' ')          // remove null bytes
    .replace(/\r\n/g, '\n')           // normalize line endings
    .replace(/\r/g, '\n')
    .replace(/[ \t]{3,}/g, '  ')      // collapse excessive spaces but keep 2
    .replace(/\n{4,}/g, '\n\n\n')     // max 3 consecutive newlines (preserve paragraph breaks)
    .trim();

const extractTextFromFile = async (filePath, mimeType) => {
  const ext = path.extname(filePath).toLowerCase();
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const data = await pdfParse(fs.readFileSync(filePath));
    return data.text || '';
  }
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === '.docx') {
    const r = await mammoth.extractRawText({ path: filePath });
    return r.value || '';
  }
  if (mimeType === 'text/plain' || ext === '.txt') return fs.readFileSync(filePath,'utf8');
  if (['.doc','.ppt','.pptx'].includes(ext)) return `File "${path.basename(filePath)}" uploaded. Rich text extraction limited for this format.`;
  return '';
};

// ── AI helpers ────────────────────────────────────────────────────

// Retry helper with exponential backoff
const withRetry = async (fn, maxAttempts = 3, baseDelayMs = 1000) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === maxAttempts;
      const isRetryable = err.message && (
        err.message.includes('503') ||
        err.message.includes('429') ||
        err.message.includes('overloaded') ||
        err.message.includes('timeout')
      );
      if (isLast || !isRetryable) throw err;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(`AI attempt ${attempt} failed, retrying in ${delay}ms: ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
};

// Strip markdown code fences from AI response
const stripCodeFences = (text) =>
  text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

// Shuffle array in-place (Fisher-Yates)
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Estimate reading time in minutes
const estimateReadingTime = (text) => Math.max(1, Math.ceil(text.split(/\s+/).length / 200));

const generateAIContent = async (cleanText, originalName) => {
  if (!process.env.OPENAI_API_KEY) return buildFallbackContent(cleanText, originalName);

  const baseName = (originalName || 'Document').replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

  const proModel = genAI.getGenerativeModel({
    model: 'gemini-1.5-pro',
    systemInstruction:
      'You are a precise academic content analyst. ' +
      'You extract and summarize information EXACTLY as it appears in the source document. ' +
      'Never invent, assume, or generalize beyond what the document states. ' +
      'Always return valid JSON only — no markdown fences, no extra text.',
    generationConfig: { temperature: 0.2, topP: 0.8 },
  });

  const flashModel = genAI.getGenerativeModel({
    model: 'gemini-1.5-flash',
    systemInstruction:
      'You create educational flashcards and quiz questions strictly from the provided document. ' +
      'Every question and answer must be directly traceable to the document text. ' +
      'Always return valid JSON only — no markdown fences, no extra text.',
    generationConfig: { temperature: 0.3 },
  });

  // Keep as much text as possible — pro model supports large context
  const fullText = cleanText.length > 30000 ? cleanText.slice(0, 30000) + '\n\n[...document continues]' : cleanText;
  const studyText = cleanText.length > 16000 ? cleanText.slice(0, 16000) : cleanText;

  try {
    // ── Call 1: Title, summary, sections ───────────────────────
    const notesPrompt = `Read the following document carefully and extract its content into structured study notes.

Return ONLY this JSON structure (no markdown, no code blocks):
{
  "title": "The actual title or topic of this document in 4-10 words",
  "summary": "A 4-6 sentence executive summary that covers: (1) what this document is about, (2) the main arguments or findings, (3) key conclusions. Use specific terms, names, numbers from the document.",
  "tags": ["topic1", "topic2", "topic3", "topic4", "topic5"],
  "sections": [
    {
      "id": "section-1",
      "title": "Heading that matches the document's actual structure or topic",
      "content": "5-8 sentences of accurate, detailed content extracted directly from this part of the document. Quote or closely paraphrase the source. Include specific data, examples, definitions, or arguments as they appear.",
      "highlights": ["exact phrase from doc", "key term", "important concept", "specific name or number"]
    }
  ]
}

RULES:
- Generate 5-8 sections that cover the ENTIRE document, not just the beginning
- Section titles must reflect what is actually in that part of the document
- Section content must be accurate — copy key sentences, preserve numbers and names
- Highlights must be exact terms or short phrases that appear in the document
- Tags must be the actual subject areas covered

DOCUMENT TEXT:
${fullText}`;

    const notesResult = await withRetry(() => proModel.generateContent(notesPrompt));
    const notesText   = stripCodeFences(notesResult.response.text().trim());
    const notesParsed = JSON.parse(notesText);

    // ── Call 2: Flashcards + Quiz ───────────────────────────────
    const studyPrompt = `Based on the document below, create study materials. Return ONLY this JSON (no markdown):
{
  "flashcards": [
    {
      "front": "A specific question about a fact, definition, concept, or relationship in the document",
      "back": "The precise answer as stated in the document (2-4 sentences with enough context to be useful)",
      "difficulty": "easy|medium|hard"
    }
  ],
  "quiz": {
    "title": "Quiz on [document topic]",
    "questions": [
      {
        "id": "q1",
        "type": "multiple-choice",
        "question": "A question that tests understanding of a specific point in the document",
        "options": ["The correct answer from the document", "A plausible wrong answer", "Another plausible wrong answer", "Another plausible wrong answer"],
        "correctAnswer": "The correct answer from the document",
        "explanation": "Why this is correct — cite the specific part of the document that supports this answer",
        "difficulty": "easy|medium|hard"
      }
    ]
  }
}

FLASHCARD RULES (generate 12-15 cards):
- Cover the full document, not just the first section
- Mix types: definitions (25%), cause/effect (25%), compare/contrast (25%), application (25%)
- Easy = recall a stated fact; Medium = explain a relationship; Hard = apply or analyze
- Back must be a complete, standalone answer — not just one word

QUIZ RULES (generate 10-12 questions):
- 7-8 multiple-choice: 4 options, exactly one correct, distractors are plausible misconceptions
- 3-4 true-false: options must be exactly ["True", "False"]
- Questions must test comprehension, not just word-matching
- Explanations must cite the document

DOCUMENT TEXT:
${studyText}`;

    const studyResult = await withRetry(() => flashModel.generateContent(studyPrompt));
    const studyText2  = stripCodeFences(studyResult.response.text().trim());
    const studyParsed = JSON.parse(studyText2);

    return {
      title:       notesParsed.title   || baseName,
      summary:     notesParsed.summary || '',
      readingTime: estimateReadingTime(cleanText),
      sections: (notesParsed.sections || []).map((s, i) => ({
        id:         s.id         || `section-${i + 1}`,
        title:      s.title      || `Section ${i + 1}`,
        content:    s.content    || '',
        highlights: Array.isArray(s.highlights) ? s.highlights.filter(h => h && h.trim()) : [],
      })),
      tags: Array.isArray(notesParsed.tags) && notesParsed.tags.length > 0
        ? notesParsed.tags
        : extractKeywords(cleanText).slice(0, 6),
      flashcards: (studyParsed.flashcards || [])
        .filter(f => f.front && f.back)
        .map(f => ({
          front:      f.front.trim(),
          back:       f.back.trim(),
          difficulty: ['easy', 'medium', 'hard'].includes(f.difficulty) ? f.difficulty : 'medium',
        })),
      quiz: studyParsed.quiz ? {
        title: studyParsed.quiz.title || `${notesParsed.title || baseName} Quiz`,
        questions: (studyParsed.quiz.questions || [])
          .filter(q => q.question && q.correctAnswer)
          .map((q, i) => {
            const type = ['multiple-choice', 'true-false', 'short-answer'].includes(q.type)
              ? q.type : 'multiple-choice';
            const options = type === 'multiple-choice'
              ? shuffle(Array.isArray(q.options) && q.options.length >= 2 ? q.options : [q.correctAnswer, 'None of the above'])
              : ['True', 'False'];
            return {
              id:            q.id || `q${i + 1}`,
              type,
              question:      q.question.trim(),
              options,
              correctAnswer: q.correctAnswer.trim(),
              explanation:   (q.explanation || '').trim(),
              difficulty:    ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium',
            };
          }),
      } : null,
    };

  } catch (err) {
    console.error('AI content generation failed:', err.message);
    // Flash model single-call fallback
    try {
      console.log('Falling back to gemini-1.5-flash single call...');
      const fb = genAI.getGenerativeModel({ model: 'gemini-1.5-flash', generationConfig: { temperature: 0.2 } });
      const fbText = cleanText.length > 12000 ? cleanText.slice(0, 12000) : cleanText;
      const fbPrompt = `Analyze this document. Return ONLY valid JSON (no markdown):
{"title":"title","summary":"3-5 sentence summary using specific terms from the document","tags":["t1","t2","t3"],"sections":[{"id":"s1","title":"heading","content":"5+ sentences of accurate content from the document","highlights":["term1","term2","term3"]}],"flashcards":[{"front":"specific question","back":"precise answer from document","difficulty":"medium"}],"quiz":{"title":"Quiz","questions":[{"id":"q1","type":"multiple-choice","question":"question","options":["correct","wrong1","wrong2","wrong3"],"correctAnswer":"correct","explanation":"why","difficulty":"medium"}]}}
Generate 5 sections, 10 flashcards, 8 quiz questions.
DOCUMENT: ${fbText}`;
      const fbResult = await fb.generateContent(fbPrompt);
      const fbParsed = JSON.parse(stripCodeFences(fbResult.response.text().trim()));
      return {
        title: fbParsed.title || baseName,
        summary: fbParsed.summary || '',
        readingTime: estimateReadingTime(cleanText),
        sections: (fbParsed.sections || []).map((s, i) => ({ id: s.id || `s${i+1}`, title: s.title || `Section ${i+1}`, content: s.content || '', highlights: Array.isArray(s.highlights) ? s.highlights : [] })),
        tags: Array.isArray(fbParsed.tags) ? fbParsed.tags : extractKeywords(cleanText).slice(0, 5),
        flashcards: (fbParsed.flashcards || []).map(f => ({ front: f.front || '', back: f.back || '', difficulty: f.difficulty || 'medium' })),
        quiz: fbParsed.quiz ? { title: fbParsed.quiz.title || `${fbParsed.title} Quiz`, questions: (fbParsed.quiz.questions || []).map((q, i) => ({ id: q.id || `q${i+1}`, type: q.type || 'multiple-choice', question: q.question || '', options: Array.isArray(q.options) ? shuffle(q.options) : ['True', 'False'], correctAnswer: q.correctAnswer || '', explanation: q.explanation || '', difficulty: q.difficulty || 'medium' })) } : null,
      };
    } catch (fbErr) {
      console.error('Fallback also failed:', fbErr.message);
      return buildFallbackContent(cleanText, originalName);
    }
  }
};

// ── Chat — uses Gemini's native multi-turn Chat API ───────────────
const generateChatReply = async (userMessage, notesContext, conversationHistory = []) => {
  if (!process.env.OPENAI_API_KEY) return generateFallbackReply(userMessage);

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are an expert AI tutor embedded in Lectomate, an AI-powered study assistant. ' +
        'Your job is to help students understand their uploaded documents deeply and accurately. ' +
        '\n\nCORE RULES:\n' +
        '- Base all answers on the provided document context. Quote or cite specific parts when relevant.\n' +
        '- Be educational: explain WHY and HOW, not just WHAT.\n' +
        '- Use clear formatting: short paragraphs, **bold** for key terms, bullet points (- item) for lists.\n' +
        '- If asked to quiz the student, generate 3-5 specific questions from the document.\n' +
        '- If asked to summarize, give a structured summary with the main points.\n' +
        '- Never say "I cannot answer" or "I don\'t have access" — always provide value.\n' +
        '- Keep responses focused and concise (2-4 paragraphs max unless a detailed explanation is needed).',
      generationConfig: { temperature: 0.4, topP: 0.9 },
    });

    // Build the document context block
    const ctxBlock = notesContext && notesContext.length > 0
      ? `STUDENT DOCUMENTS:\n${'─'.repeat(40)}\n${notesContext.join('\n\n' + '─'.repeat(40) + '\n\n')}\n${'─'.repeat(40)}\n\n`
      : 'No documents selected. Answer from general knowledge.\n\n';

    // Use Gemini's native chat API for proper multi-turn conversation
    const chat = model.startChat({
      history: conversationHistory.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }],
      })),
    });

    // First message sets the document context, then the actual question
    const fullMessage = conversationHistory.length === 0
      ? `${ctxBlock}Student question: ${userMessage}`
      : userMessage;

    const result = await withRetry(() => chat.sendMessage(fullMessage));
    const text = result.response.text().trim();
    return text || generateFallbackReply(userMessage);

  } catch (err) {
    console.error('Chat generation error:', err.message);
    return generateFallbackReply(userMessage);
  }
};

const generateFallbackReply = (msg) => {
  const m = msg.toLowerCase();
  if (m.includes('summarize') || m.includes('summarise') || m.includes('summary'))
    return "I can help summarize your documents! When you upload a document, I automatically generate structured notes with an executive summary and key sections. Check the Notes page to see the full breakdown.";
  if (m.includes('flashcard'))
    return "Flashcards are automatically generated when you upload a document — covering key definitions, concepts, and relationships. Head to the Flashcards section to study them with spaced repetition!";
  if (m.includes('quiz') || m.includes('test'))
    return "Quizzes with multiple-choice and true/false questions are automatically created from your uploaded documents. Go to the Quiz section to test your knowledge!";
  if (m.includes('explain') || m.includes('what is') || m.includes('how does'))
    return "Great question! To give you the most accurate explanation, please select a specific document from the sidebar so I can answer based on your actual study materials.";
  if (m.includes('help'))
    return "I'm your AI tutor! I can:\n- Explain concepts from your documents\n- Summarize sections\n- Quiz you on the content\n- Answer questions about your study materials\n\nSelect a document from the sidebar to get started!";
  return "I'm here to help you understand your study materials! Select a document from the sidebar and ask me anything — I can explain concepts, summarize sections, quiz you, or answer specific questions about the content.";
};

// ── Document processing ───────────────────────────────────────────
const processDocument = async (docRecord) => {
  try {
    const rawText = await extractTextFromFile(docRecord.filePath, docRecord.mimeType);
    const cleanText = normalizeText(rawText);
    if (!cleanText || cleanText.trim().length === 0) throw new Error('No text could be extracted');

    const aiContent = await generateAIContent(cleanText, docRecord.originalName);

    const note = await NoteModel.create({
      userId:           docRecord.userId,
      title:            aiContent.title,
      fileName:         docRecord.originalName,
      uploadDate:       new Date(),
      fileSize:         formatFileSize(docRecord.fileSize),
      status:           'completed',
      summary:          aiContent.summary || '',
      readingTime:      aiContent.readingTime || 0,
      sections:         aiContent.sections,
      tags:             aiContent.tags,
      rawContent:       cleanText,
      lastAccessed:     new Date(),
      sourceDocumentId: docRecord._id.toString()
    });

    if (aiContent.flashcards && aiContent.flashcards.length > 0) {
      await FlashModel.insertMany(aiContent.flashcards.map(f => ({
        userId: docRecord.userId, noteId: note._id.toString(),
        front: f.front, back: f.back, difficulty: f.difficulty,
        createdAt: new Date(), lastReviewed: null, correctCount: 0, totalReviews: 0
      })));
    }

    if (aiContent.quiz && aiContent.quiz.questions && aiContent.quiz.questions.length > 0) {
      await QuizModel.create({
        userId: docRecord.userId, noteId: note._id.toString(),
        title: aiContent.quiz.title,
        questions: aiContent.quiz.questions.map((q,i) => ({ ...q, id: q.id||`q${i+1}` })),
        createdAt: new Date(), attempts: []
      });
    }

    await DocModel.findByIdAndUpdate(docRecord._id, { processed: true, processedAt: new Date(), processingError: null });

    // Update user stats
    const [docCount, flashCount, quizCount] = await Promise.all([
      NoteModel.countDocuments({ userId: docRecord.userId }),
      FlashModel.countDocuments({ userId: docRecord.userId }),
      QuizModel.countDocuments({ userId: docRecord.userId })
    ]);
    await UserModel.findByIdAndUpdate(docRecord.userId, { totalDocuments: docCount, totalFlashcards: flashCount, totalQuizzes: quizCount });

    console.log(`Document processed: ${docRecord.originalName}`);
  } catch (err) {
    console.error('Document processing error:', err.message);
    await DocModel.findByIdAndUpdate(docRecord._id, { processed: false, processingError: err.message });
  }
};

// ── Express setup ─────────────────────────────────────────────────
// CORS: allow listed origins OR all origins if FRONTEND_URL contains '*'
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Render health checks)
    if (!origin) return callback(null, true);
    if (FRONTEND_URLS.includes('*') || FRONTEND_URLS.includes(origin)) {
      return callback(null, true);
    }
    // In development, allow all
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(UPLOAD_DIR));

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { ensureDir(UPLOAD_DIR); cb(null, UPLOAD_DIR); },
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${uuidv4()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname||'').toLowerCase();
    if (ALLOWED_MIME_TYPES.has(file.mimetype) || ALLOWED_EXTENSIONS.has(ext)) return cb(null, true);
    cb(new Error('Unsupported file type. Allowed: PDF, DOC, DOCX, TXT, PPT, PPTX.'));
  }
});

// ── Health ────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const [users, docs, notes, flash, quizzes] = await Promise.all([
    UserModel.countDocuments(), DocModel.countDocuments(), NoteModel.countDocuments(),
    FlashModel.countDocuments(), QuizModel.countDocuments()
  ]);
  res.json({ status:'ok', db:'mongodb', counts:{ users, docs, notes, flash, quizzes }, ts: new Date().toISOString() });
});

// ── Auth ──────────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    const name  = String(req.body.name  || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const pass  = String(req.body.password || '');
    if (!name || !email || !pass) return res.status(400).json({ success:false, error:'Name, email, and password are required' });
    if (pass.length < 6) return res.status(400).json({ success:false, error:'Password must be at least 6 characters' });
    if (await UserModel.findOne({ email })) return res.status(409).json({ success:false, error:'Email is already registered' });
    const hashed = await bcrypt.hash(pass, 12);
    const user = await UserModel.create({ name, email, password: hashed });
    const token = createToken(user);
    return res.status(201).json({ success:true, data:{ user: sanitizeUser(user), token }, message:'Registered successfully' });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success:false, error:'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const pass  = String(req.body.password || '');
    if (!email || !pass) return res.status(400).json({ success:false, error:'Email and password are required' });
    const user = await UserModel.findOne({ email }).select('+password');
    if (!user || !(await bcrypt.compare(pass, user.password)))
      return res.status(401).json({ success:false, error:'Invalid email or password' });
    const token = createToken(user);
    return res.json({ success:true, data:{ user: sanitizeUser(user), token }, message:'Login successful' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success:false, error:'Login failed. Please try again.' });
  }
});

app.get('/api/auth/me', authenticate, async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id).lean();
    if (!user) return res.status(404).json({ success:false, error:'User not found' });
    const { password:_p, ...safe } = user;
    safe.id = user._id.toString();
    return res.json({ success:true, data:{ user: safe } });
  } catch (err) {
    return res.status(500).json({ success:false, error:'Failed to get user' });
  }
});

// ── Documents ─────────────────────────────────────────────────────
app.post('/api/documents/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success:false, error:'No file uploaded' });
    const doc = await DocModel.create({
      userId: req.user.id, fileName: req.file.filename, originalName: req.file.originalname,
      fileSize: req.file.size, mimeType: req.file.mimetype, filePath: req.file.path,
      uploadedAt: new Date(), processed: false
    });
    processDocument(doc).catch(e => console.error('Async processing failed:', e));
    return res.status(201).json({ success:true, data:{ document:{ id:doc._id.toString(), fileName:doc.originalName, fileSize:doc.fileSize, uploadedAt:doc.uploadedAt, processed:doc.processed } }, message:'Document uploaded. Processing started.' });
  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success:false, error: err.message || 'Upload failed' });
  }
});

app.get('/api/documents', authenticate, async (req, res) => {
  const docs = await DocModel.find({ userId: req.user.id }).lean();
  res.json({ success:true, data:{ documents: docs.map(d => ({ id:d._id.toString(), fileName:d.originalName, fileSize:d.fileSize, uploadedAt:d.uploadedAt, processed:d.processed, processingError:d.processingError, processedAt:d.processedAt })) } });
});

app.get('/api/documents/:id/status', authenticate, async (req, res) => {
  const doc = await DocModel.findOne({ _id: req.params.id, userId: req.user.id }).lean();
  if (!doc) return res.status(404).json({ success:false, error:'Document not found' });
  res.json({ success:true, data:{ id:doc._id.toString(), processed:doc.processed, uploadedAt:doc.uploadedAt, processingError:doc.processingError, processedAt:doc.processedAt } });
});

app.delete('/api/documents/:id', authenticate, async (req, res) => {
  const doc = await DocModel.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!doc) return res.status(404).json({ success:false, error:'Document not found' });
  if (doc.filePath && fs.existsSync(doc.filePath)) try { fs.unlinkSync(doc.filePath); } catch {}
  await NoteModel.deleteMany({ sourceDocumentId: doc._id.toString(), userId: req.user.id });
  const noteIds = (await NoteModel.find({ sourceDocumentId: doc._id.toString(), userId: req.user.id }).select('_id').lean()).map(n => n._id.toString());
  await FlashModel.deleteMany({ userId: req.user.id, noteId: { $in: noteIds } });
  await QuizModel.deleteMany({ userId: req.user.id, noteId: { $in: noteIds } });
  res.json({ success:true, message:'Document and study content deleted' });
});

// ── Notes ─────────────────────────────────────────────────────────
app.get('/api/notes', authenticate, async (req, res) => {
  const notes = await NoteModel.find({ userId: req.user.id }).lean();
  res.json({ success:true, data:{ notes: notes.map(n => ({ ...n, id:n._id.toString() })) } });
});

// ── Flashcards ────────────────────────────────────────────────────
app.get('/api/flashcards', authenticate, async (req, res) => {
  const query = { userId: req.user.id };
  if (req.query.noteId) query.noteId = req.query.noteId;
  const cards = await FlashModel.find(query).lean();
  res.json({ success:true, data:{ flashcards: cards.map(c => ({ ...c, id:c._id.toString() })) } });
});

app.post('/api/flashcards/:id/review', authenticate, async (req, res) => {
  const correct = req.body.correct === true;
  const card = await FlashModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { $set: { lastReviewed: new Date() }, $inc: { totalReviews: 1, correctCount: correct ? 1 : 0 } },
    { new: true }
  ).lean();
  if (!card) return res.status(404).json({ success:false, error:'Flashcard not found' });
  res.json({ success:true, data:{ flashcard: { ...card, id:card._id.toString() } }, message:'Review recorded' });
});

// ── Quizzes ───────────────────────────────────────────────────────
app.get('/api/quizzes', authenticate, async (req, res) => {
  const query = { userId: req.user.id };
  if (req.query.noteId) query.noteId = req.query.noteId;
  const quizzes = await QuizModel.find(query).lean();
  res.json({ success:true, data:{ quizzes: quizzes.map(q => ({ ...q, id:q._id.toString() })) } });
});

app.post('/api/quizzes/:id/attempt', authenticate, async (req, res) => {
  const quiz = await QuizModel.findOne({ _id: req.params.id, userId: req.user.id });
  if (!quiz) return res.status(404).json({ success:false, error:'Quiz not found' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  if (answers.length !== quiz.questions.length) return res.status(400).json({ success:false, error:'Answers array must match question count' });
  const scored = quiz.questions.map((q,i) => {
    const userAnswer = answers[i];
    const isCorrect = userAnswer === q.correctAnswer;
    return { question:q.question, userAnswer, correctAnswer:q.correctAnswer, isCorrect, explanation:q.explanation };
  });
  const correctCount = scored.filter(s => s.isCorrect).length;
  const score = Math.round((correctCount / quiz.questions.length) * 100);
  const attempt = { id:uuidv4(), completedAt:new Date(), score, totalQuestions:quiz.questions.length, timeSpent:Number(req.body.timeSpent||0) };
  quiz.attempts.push(attempt);
  await quiz.save();
  res.json({ success:true, data:{ attempt, gradedQuestions:scored }, message:'Quiz attempt submitted' });
});

// ── User profile update ───────────────────────────────────────────
const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => { ensureDir(UPLOAD_DIR); cb(null, UPLOAD_DIR); },
    filename: (_req, file, cb) => cb(null, `avatar-${Date.now()}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) return cb(null, true);
    cb(new Error('Only image files are allowed for avatars.'));
  }
});

app.put('/api/user/profile', authenticate, async (req, res) => {
  try {
    const { name } = req.body;
    const updates = {};
    if (name && String(name).trim()) updates.name = String(name).trim();
    const user = await UserModel.findByIdAndUpdate(req.user.id, updates, { new: true }).lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { password: _p, ...safe } = user;
    safe.id = user._id.toString();
    return res.json({ success: true, data: { user: safe }, message: 'Profile updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.put('/api/user/password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ success: false, error: 'Both current and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    const user = await UserModel.findById(req.user.id).select('+password');
    if (!user || !(await bcrypt.compare(currentPassword, user.password)))
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to update password' });
  }
});

app.post('/api/user/avatar', authenticate, avatarUpload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No image uploaded' });
    const avatarUrl = `/uploads/${req.file.filename}`;
    const user = await UserModel.findByIdAndUpdate(req.user.id, { avatar: avatarUrl }, { new: true }).lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const { password: _p, ...safe } = user;
    safe.id = user._id.toString();
    return res.json({ success: true, data: { user: safe, avatarUrl }, message: 'Avatar updated' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to upload avatar' });
  }
});

// ── Serve document file by document ID ────────────────────────────
app.get('/api/documents/:id/file', authenticate, async (req, res) => {
  try {
    const doc = await DocModel.findOne({ _id: req.params.id, userId: req.user.id }).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'Document not found' });
    if (!doc.filePath || !fs.existsSync(doc.filePath))
      return res.status(404).json({ success: false, error: 'File not found on disk' });
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName)}"`);
    res.sendFile(path.resolve(doc.filePath));
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to serve file' });
  }
});
app.post('/api/chat/message', authenticate, async (req, res) => {
  const msg = String(req.body.message || '').trim();
  if (!msg) return res.status(400).json({ success:false, error:'Message is required' });
  const noteId = req.body.noteId;
  const conversationHistory = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];

  const allNotes = await NoteModel.find({ userId: req.user.id }).lean();
  const targetNotes = noteId
    ? allNotes.filter(n => n._id.toString() === noteId)
    : allNotes.slice(0, 2);

  // Build rich context: prefer rawContent (full extracted text), fall back to sections
  const ctx = targetNotes.map(n => {
    const docText = n.rawContent && n.rawContent.trim()
      ? n.rawContent.slice(0, 12000)   // send up to 12k chars of original text
      : (n.sections || []).map(s => `[${s.title}]\n${s.content}`).join('\n\n');
    return `Document: "${n.title}" (${n.fileName})\n${'─'.repeat(50)}\n${docText}`;
  });

  const reply = await generateChatReply(msg, ctx, conversationHistory);
  res.json({ success:true, data:{ reply } });
});

// ── Streaming chat endpoint (SSE) ─────────────────────────────────
app.post('/api/chat/stream', authenticate, async (req, res) => {
  const msg = String(req.body.message || '').trim();
  if (!msg) return res.status(400).json({ success:false, error:'Message is required' });

  const noteId = req.body.noteId;
  const conversationHistory = Array.isArray(req.body.history) ? req.body.history.slice(-10) : [];

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering
  res.flushHeaders();

  const send = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!process.env.OPENAI_API_KEY) {
      // No API key — send a helpful non-static response
      const fallback = generateFallbackReply(msg);
      // Stream it word by word for consistent UX
      const words = fallback.split(' ');
      for (const word of words) {
        send({ token: word + ' ' });
        await new Promise(r => setTimeout(r, 30));
      }
      send({ done: true });
      return res.end();
    }

    const allNotes = await NoteModel.find({ userId: req.user.id }).lean();
    const targetNotes = noteId
      ? allNotes.filter(n => n._id.toString() === noteId)
      : allNotes.slice(0, 2);

    const ctx = targetNotes.map(n => {
      const docText = n.rawContent && n.rawContent.trim()
        ? n.rawContent.slice(0, 12000)
        : (n.sections || []).map(s => `[${s.title}]\n${s.content}`).join('\n\n');
      return `Document: "${n.title}" (${n.fileName})\n${'─'.repeat(50)}\n${docText}`;
    });

    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      systemInstruction:
        'You are an expert AI tutor embedded in Lectomate, an AI-powered study assistant. ' +
        'Your job is to help students understand their uploaded documents deeply and accurately. ' +
        '\n\nCORE RULES:\n' +
        '- Base all answers on the provided document context. Quote or cite specific parts when relevant.\n' +
        '- Be educational: explain WHY and HOW, not just WHAT.\n' +
        '- Use clear formatting: short paragraphs, **bold** for key terms, bullet points (- item) for lists.\n' +
        '- If asked to quiz the student, generate 3-5 specific questions from the document.\n' +
        '- If asked to summarize, give a structured summary with the main points.\n' +
        '- Never say "I cannot answer" or "I don\'t have access" — always provide value.\n' +
        '- Keep responses focused and concise (2-4 paragraphs max unless a detailed explanation is needed).\n' +
        '- You can answer ANY general question, not just document-related ones.',
      generationConfig: { temperature: 0.7, topP: 0.9 },
    });

    const ctxBlock = ctx.length > 0
      ? `STUDENT DOCUMENTS:\n${'─'.repeat(40)}\n${ctx.join('\n\n' + '─'.repeat(40) + '\n\n')}\n${'─'.repeat(40)}\n\n`
      : '';

    // Build proper Gemini chat history
    const geminiHistory = conversationHistory.slice(-8).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }],
    }));

    const chat = model.startChat({ history: geminiHistory });

    const fullMessage = conversationHistory.length === 0
      ? `${ctxBlock}${msg}`
      : msg;

    // Stream the response token by token
    const streamResult = await chat.sendMessageStream(fullMessage);

    for await (const chunk of streamResult.stream) {
      const chunkText = chunk.text();
      if (chunkText) {
        send({ token: chunkText });
      }
    }

    send({ done: true });
    res.end();

  } catch (err) {
    console.error('Stream chat error:', err.message);
    send({ error: 'AI response failed. Please try again.' });
    send({ done: true });
    res.end();
  }
});

app.get('/api/chat/suggestions', authenticate, (_req, res) => {
  res.json({ success:true, data:{ suggestions:['Summarize my latest document','Generate flashcards','Create a quiz','Explain this topic'] } });
});

// ── Error handling ────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
    return res.status(400).json({ success:false, error:`File too large. Max: ${formatFileSize(MAX_FILE_SIZE)}.` });
  if (err && err.message && err.message.startsWith('Unsupported file type'))
    return res.status(400).json({ success:false, error: err.message });
  console.error('Server error:', err);
  return res.status(500).json({ success:false, error: err.message || 'Internal server error' });
});

app.use((_req, res) => res.status(404).json({ success:false, error:'Route not found' }));

// ── Start server ──────────────────────────────────────────────────
(async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');
    ensureDir(UPLOAD_DIR);
    // Must listen on 0.0.0.0 for Render (not just localhost)
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📊 Health: http://0.0.0.0:${PORT}/health`);
      console.log(`🌍 NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
})();
