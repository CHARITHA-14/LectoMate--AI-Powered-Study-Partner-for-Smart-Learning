import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.OPENAI_API_KEY);
  apiKey: process.env.OPENAI_API_KEY,
});

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

export const generateAIContent = async (text: string): Promise<AIContent> => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      // Fallback to mock content if no API key is provided
      return generateMockContent(text);
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    // Truncate text if it's too long for the API
    const truncatedText = text.length > 15000 ? text.substring(0, 15000) + '...' : text;

    // Generate title and summary
    const titleResponse = await model.generateContent({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are an AI assistant that helps create educational content. Generate a concise, descriptive title for the given document text.'
        },
        {
          role: 'user',
          content: `Generate a title for this document:\n\n${truncatedText.substring(0, 1000)}...`
        }
      ],
      max_tokens: 50,
      temperature: 0.7,
    });

    const title = titleResponse.response.text().trim() || 'Generated Document';

    // Generate structured content
    const contentResponse = await model.generateContent({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `You are an AI educational content creator. Analyze the given text and create structured learning materials. 
          Return a JSON object with the following structure:
          {
            "sections": [
              {
                "title": "Section Title",
                "content": "Detailed explanation",
                "highlights": ["key term 1", "key term 2"]
              }
            ],
            "tags": ["tag1", "tag2", "tag3"],
            "flashcards": [
              {
                "front": "Question or term",
                "back": "Answer or definition",
                "difficulty": "easy|medium|hard"
              }
            ],
            "quiz": {
              "title": "Quiz Title",
              "questions": [
                {
                  "type": "multiple-choice",
                  "question": "Question text",
                  "options": ["Option A", "Option B", "Option C", "Option D"],
                  "correctAnswer": "Correct option",
                  "explanation": "Explanation",
                  "difficulty": "easy|medium|hard"
                }
              ]
            }
          }`
        },
        {
          role: 'user',
          content: `Create learning materials from this text:\n\n${truncatedText}`
        }
      ],
      max_tokens: 2000,
      temperature: 0.7,
    });

    const contentText = contentResponse.response.text();
    
    try {
      const parsedContent = JSON.parse(contentText);
      return {
        title,
        sections: parsedContent.sections || generateDefaultSections(truncatedText),
        tags: parsedContent.tags || ['Generated Document'],
        flashcards: parsedContent.flashcards || generateDefaultFlashcards(truncatedText),
        quiz: parsedContent.quiz
      };
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return generateMockContent(truncatedText, title);
    }
  } catch (error) {
    console.error('AI content generation error:', error);
    return generateMockContent(text);
  }
};

const generateMockContent = (text: string, title?: string): AIContent => {
  const documentTitle = title || 'Generated Document';
  const textPreview = text.substring(0, 500);
  
  return {
    title: documentTitle,
    sections: [
      {
        id: 'summary',
        title: 'Document Summary',
        content: `This document has been processed by our AI system. The content appears to cover important topics related to the subject matter. Key concepts have been identified and extracted for your study convenience.\n\n${textPreview}...`,
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
  // Simple keyword extraction - in a real implementation, you'd use NLP
  const words = text.toLowerCase().match(/\b[a-z]{4,}\b/g) || [];
  const wordFreq: { [key: string]: number } = {};
  
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });
  
  return Object.entries(wordFreq)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
};

const extractTags = (text: string): string[] => {
  const keyTerms = extractKeyTerms(text);
  const tags = ['Generated Document', 'AI Processed'];
  
  // Add some of the key terms as tags
  tags.push(...keyTerms.slice(0, 3));
  
  return tags;
};

const generateDefaultFlashcards = (text: string) => {
  const keyTerms = extractKeyTerms(text);
  
  return keyTerms.slice(0, 5).map((term, index) => ({
    front: `What is ${term}?`,
    back: `${term} is a key concept mentioned in the document. It plays an important role in the subject matter being discussed.`,
    difficulty: (index < 2 ? 'easy' : index < 4 ? 'medium' : 'hard') as 'easy' | 'medium' | 'hard'
  }));
};

const generateDefaultQuizQuestions = (text: string) => {
  const keyTerms = extractKeyTerms(text);
  
  return [
    {
      id: '1',
      type: 'multiple-choice' as const,
      question: `Which of the following best describes the main topic of this document?`,
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
      id: '2',
      type: 'true-false' as const,
      question: `The document discusses important concepts related to ${keyTerms[0] || 'the subject matter'}.`,
      options: ['True', 'False'],
      correctAnswer: 'True',
      explanation: 'Based on the content analysis, this topic is indeed covered in the document.',
      difficulty: 'medium' as const
    },
    {
      id: '3',
      type: 'short-answer' as const,
      question: 'What are the main takeaways from this document?',
      options: undefined,
      correctAnswer: 'The main takeaways include understanding key concepts, their applications, and their importance in the broader context.',
      explanation: 'The document provides comprehensive coverage of important topics and their implications.',
      difficulty: 'hard' as const
    }
  ];
};

export const generateChatResponse = async (userMessage: string, userNotes?: any[]): Promise<string> => {
  const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
  try {
    if (!process.env.OPENAI_API_KEY) {
      return generateFallbackChatResponse(userMessage);
    }

    const contextNotes = userNotes ? userNotes.slice(0, 3).map(note => 
      `Title: ${note.title}\nContent: ${note.sections?.[0]?.content || 'No content available'}`
    ).join('\n\n') : '';

    const messages = [
      {
        role: 'system' as const,
        content: `You are an AI learning assistant for Lectomate. Help students understand concepts from their uploaded documents. 
        Be educational, encouraging, and provide clear explanations. 
        ${contextNotes ? `Here are some relevant notes from the user's documents:\n\n${contextNotes}\n\n` : ''}
        Respond to the user's question based on this context if relevant, otherwise provide general educational guidance.`
      },
      {
        role: 'user' as const,
        content: userMessage
      }
    ];

    const response = await model.generateContent({
      model: 'gpt-3.5-turbo',
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return response.response.text() || generateFallbackChatResponse(userMessage);
  } catch (error) {
    console.error('Chat response generation error:', error);
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
    return "Flashcards are great for active recall and spaced repetition! I can create flashcards based on your documents with key terms and concepts. Would you like me to generate some flashcards for a specific topic?";
  }
  
  return "That's a great question! I'm here to help you understand concepts from your study materials. I can explain topics, generate practice questions, create flashcards, and summarize your notes. What would you like to learn about?";
};
