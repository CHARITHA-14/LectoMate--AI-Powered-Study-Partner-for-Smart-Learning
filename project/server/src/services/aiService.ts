import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini AI with the API key
const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY || '');

interface AIContent {
  title: string;
  sections: Array<{
    id: string;
    title: string;
    content: string;
    highlights: string[];
  }>;
  tags: string[];
  flashcards: Array<{
    front: string;
    back: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  quiz?: {
    title: string;
    questions: Array<{
      id: string;
      type: 'multiple-choice' | 'true-false' | 'short-answer';
      question: string;
      options?: string[];
      correctAnswer: string;
      explanation: string;
      difficulty: 'easy' | 'medium' | 'hard';
    }>;
  };
}

export const generateAIContent = async (text: string, originalFileName?: string): Promise<AIContent> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return generateMockContent(text, originalFileName);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    // Truncate text if it's too long for the API
    const truncatedText = text.length > 15000 ? text.substring(0, 15000) + '...' : text;

    // Use original filename as title fallback
    const fileBaseName = originalFileName
      ? originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
      : null;

    // Single prompt to generate all content at once
    const prompt = `You are an AI educational content creator. Analyze the following document text and create comprehensive study materials.

Return ONLY a valid JSON object (no markdown, no code blocks, just raw JSON) with this exact structure:
{
  "title": "A concise descriptive title for this document (2-8 words)",
  "sections": [
    {
      "id": "section-1",
      "title": "Section Title",
      "content": "Detailed explanation of this section (2-4 sentences)",
      "highlights": ["key term 1", "key term 2", "key term 3"]
    }
  ],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "flashcards": [
    {
      "front": "Question or term to memorize",
      "back": "Answer or definition",
      "difficulty": "easy"
    }
  ],
  "quiz": {
    "title": "Quiz title",
    "questions": [
      {
        "id": "q1",
        "type": "multiple-choice",
        "question": "Question text?",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": "Option A",
        "explanation": "Why this is correct",
        "difficulty": "easy"
      }
    ]
  }
}

Requirements:
- Generate 3-5 sections covering the main topics
- Generate 8-12 flashcards covering key concepts, definitions, and important facts
- Generate 5-8 quiz questions (mix of multiple-choice and true-false types)
- For true-false questions, options must be exactly ["True", "False"]
- Difficulty values must be exactly: "easy", "medium", or "hard"
- All content must be directly based on the document text

Document text:
${truncatedText}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    // Strip markdown code blocks if present
    const jsonText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    try {
      const parsed = JSON.parse(jsonText);
      return {
        title: parsed.title || fileBaseName || 'Document Study Guide',
        sections: (parsed.sections || []).map((s: any, i: number) => ({
          id: s.id || `section-${i + 1}`,
          title: s.title || `Section ${i + 1}`,
          content: s.content || '',
          highlights: Array.isArray(s.highlights) ? s.highlights : []
        })),
        tags: Array.isArray(parsed.tags) ? parsed.tags : extractTags(truncatedText),
        flashcards: (parsed.flashcards || []).map((f: any) => ({
          front: f.front || '',
          back: f.back || '',
          difficulty: normalizeDifficulty(f.difficulty)
        })),
        quiz: parsed.quiz ? {
          title: parsed.quiz.title || `${parsed.title || 'Document'} Quiz`,
          questions: (parsed.quiz.questions || []).map((q: any, i: number) => ({
            id: q.id || `q${i + 1}`,
            type: normalizeQuestionType(q.type),
            question: q.question || '',
            options: Array.isArray(q.options) ? q.options : undefined,
            correctAnswer: q.correctAnswer || q.correct_answer || '',
            explanation: q.explanation || '',
            difficulty: normalizeDifficulty(q.difficulty)
          }))
        } : undefined
      };
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('Raw response:', responseText.substring(0, 500));
      return generateMockContent(truncatedText, originalFileName);
    }
  } catch (error) {
    console.error('AI content generation error:', error);
    return generateMockContent(text, originalFileName);
  }
};

const normalizeDifficulty = (value: any): 'easy' | 'medium' | 'hard' => {
  if (value === 'easy' || value === 'medium' || value === 'hard') return value;
  return 'medium';
};

const normalizeQuestionType = (value: any): 'multiple-choice' | 'true-false' | 'short-answer' => {
  if (value === 'true-false' || value === 'short-answer' || value === 'multiple-choice') return value;
  return 'multiple-choice';
};

const generateMockContent = (text: string, originalFileName?: string): AIContent => {
  const fileBaseName = originalFileName
    ? originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
    : null;
  const documentTitle = fileBaseName || 'Document Study Guide';
  const textPreview = text.substring(0, 500);

  return {
    title: documentTitle,
    sections: [
      {
        id: 'summary',
        title: 'Document Summary',
        content: `This document covers important topics related to the subject matter. Key concepts have been identified and extracted for your study convenience.\n\n${textPreview}...`,
        highlights: extractKeyTerms(text)
      },
      {
        id: 'key-points',
        title: 'Key Points',
        content: 'Based on the document content, several important concepts have been identified. These points represent the main ideas and themes that you should focus on for effective learning and retention.',
        highlights: extractKeyTerms(text).slice(0, 3)
      }
    ],
    tags: extractTags(text),
    flashcards: generateDefaultFlashcards(text),
    quiz: {
      title: `${documentTitle} Quiz`,
      questions: generateDefaultQuizQuestions(text)
    }
  };
};

const generateDefaultSections = (text: string) => {
  return [
    {
      id: 'overview',
      title: 'Document Overview',
      content: `This document provides comprehensive information on the subject matter. The content has been analyzed and structured to facilitate better understanding and retention of key concepts.\n\n${text.substring(0, 300)}...`,
      highlights: extractKeyTerms(text).slice(0, 5)
    }
  ];
};

const extractKeyTerms = (text: string): string[] => {
  const stopWords = new Set(['this', 'that', 'with', 'from', 'they', 'have', 'been', 'will', 'were', 'their', 'there', 'what', 'when', 'which', 'your', 'more', 'also', 'into', 'than', 'then', 'some', 'such', 'each', 'most', 'over', 'only', 'both', 'very', 'just', 'about', 'after', 'before', 'these', 'those', 'other', 'would', 'could', 'should']);
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordFreq: { [key: string]: number } = {};

  words.forEach(word => {
    if (!stopWords.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });

  return Object.entries(wordFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
};

const extractTags = (text: string): string[] => {
  const keyTerms = extractKeyTerms(text);
  return keyTerms.slice(0, 5);
};

const generateDefaultFlashcards = (text: string) => {
  const keyTerms = extractKeyTerms(text);

  return keyTerms.slice(0, 6).map((term, index) => ({
    front: `What is ${term}?`,
    back: `${term} is a key concept mentioned in the document. It plays an important role in the subject matter being discussed.`,
    difficulty: (index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard'
  }));
};

const generateDefaultQuizQuestions = (text: string) => {
  const keyTerms = extractKeyTerms(text);

  return [
    {
      id: 'q1',
      type: 'multiple-choice' as const,
      question: 'Which of the following best describes the main topic of this document?',
      options: [
        keyTerms[0] || 'Topic A',
        keyTerms[1] || 'Topic B',
        keyTerms[2] || 'Topic C',
        'All of the above'
      ],
      correctAnswer: 'All of the above',
      explanation: 'The document covers multiple related concepts and topics.',
      difficulty: 'easy' as const
    },
    {
      id: 'q2',
      type: 'true-false' as const,
      question: `The document discusses important concepts related to ${keyTerms[0] || 'the subject matter'}.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'Based on the content analysis, this topic is indeed covered in the document.',
      difficulty: 'medium' as const
    },
    {
      id: 'q3',
      type: 'multiple-choice' as const,
      question: `Which concept is most prominently featured in this document?`,
      options: [
        keyTerms[0] || 'Concept A',
        keyTerms[1] || 'Concept B',
        keyTerms[2] || 'Concept C',
        keyTerms[3] || 'Concept D'
      ],
      correctAnswer: keyTerms[0] || 'Concept A',
      explanation: `${keyTerms[0] || 'This concept'} appears most frequently and is central to the document's content.`,
      difficulty: 'hard' as const
    }
  ];
};

export const generateChatResponse = async (userMessage: string, userNotes?: any[]): Promise<string> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return generateFallbackChatResponse(userMessage);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const contextNotes = userNotes && userNotes.length > 0
      ? userNotes.slice(0, 3).map(note => {
          const content = note.sections?.[0]?.content || note.content || '';
          return `Document: "${note.title}"\nContent: ${content.substring(0, 800)}`;
        }).join('\n\n')
      : '';

    const systemContext = `You are an AI learning assistant for Lectomate, an educational platform. Help students understand concepts from their uploaded documents. Be educational, encouraging, and provide clear explanations. Keep responses concise but informative (2-4 paragraphs max).${contextNotes ? `\n\nHere are the user's study documents for context:\n\n${contextNotes}` : ''}`;

    const prompt = `${systemContext}\n\nStudent question: ${userMessage}\n\nProvide a helpful, educational response:`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    if (!responseText || responseText.length === 0) {
      return generateFallbackChatResponse(userMessage);
    }

    return responseText;
  } catch (error: any) {
    console.error('Chat response generation error:', error?.message || error);
    return generateFallbackChatResponse(userMessage);
  }
};

const generateFallbackChatResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();

  if (lowerMessage.includes('machine learning') || lowerMessage.includes('ml')) {
    return "Machine Learning is a subset of artificial intelligence that enables computers to learn from data without explicit programming. The main types include Supervised Learning (using labeled data), Unsupervised Learning (finding patterns in unlabeled data), and Reinforcement Learning (learning through interaction). Would you like me to explain any of these in more detail?";
  }

  if (lowerMessage.includes('help') || lowerMessage.includes('assist')) {
    return "I'm here to help you learn! I can explain concepts from your documents, generate practice questions, create flashcards, and summarize your notes. What specific topic would you like help with?";
  }

  if (lowerMessage.includes('flashcard')) {
    return "Flashcards are great for active recall and spaced repetition! When you upload a document, I automatically generate flashcards from the key concepts. You can find them in the Flashcards section. Would you like to know more about how to use them effectively?";
  }

  if (lowerMessage.includes('quiz')) {
    return "Quizzes are a great way to test your knowledge! When you upload a document, I automatically generate quiz questions from the content. Head to the Quiz section to test yourself. Would you like tips on how to study more effectively?";
  }

  if (lowerMessage.includes('summarize') || lowerMessage.includes('summary')) {
    return "I can help summarize your study materials! When you upload a document, I automatically create structured notes with key sections and highlights. You can view these in the Notes section. Is there a specific topic you'd like me to explain further?";
  }

  return "That's a great question! I'm here to help you understand concepts from your study materials. I can explain topics, generate practice questions, create flashcards, and summarize your notes. What would you like to learn about today?";
};
