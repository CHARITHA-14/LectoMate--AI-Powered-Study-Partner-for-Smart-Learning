import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate, optionalAuth } from '../middleware/auth';
import { generateChatResponse } from '../services/aiService';
import { ApiResponse } from '../types';

const router = express.Router();

// Send chat message
router.post('/message', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { message, noteId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Get user's notes for context — if noteId provided, use only that note
    const allNotes = await db.getUserNotes(userId);
    const userNotes = noteId
      ? allNotes.filter((n: any) => n.id === noteId)
      : allNotes;

    // Generate AI response
    const botResponse = await generateChatResponse(message.trim(), userNotes);

    // Ensure we always have a response
    const finalResponse = botResponse && botResponse.trim().length > 0
      ? botResponse
      : "I'm here to help! Could you rephrase your question or ask about a specific topic from your documents?";

    // Create message objects
    const userMessage = {
      id: uuidv4(),
      text: message.trim(),
      sender: 'user' as const,
      timestamp: new Date(),
      type: 'text' as const
    };

    const botMessage = {
      id: uuidv4(),
      text: finalResponse,
      sender: 'bot' as const,
      timestamp: new Date(),
      type: 'text' as const
    };

    res.json({
      success: true,
      data: {
        reply: finalResponse,
        messages: [userMessage, botMessage]
      },
      message: 'Message processed successfully'
    });
  } catch (error) {
    console.error('Chat message error:', error);
    // Always return a usable response, never a bare error
    res.json({
      success: true,
      data: {
        reply: "I'm having trouble connecting right now. Please try again in a moment.",
        messages: []
      }
    });
  }
});

// Get chat suggestions
router.get('/suggestions', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const userNotes = await db.getUserNotes(userId);
    
    // Generate contextual suggestions based on user's notes
    const suggestions = generateContextualSuggestions(userNotes);

    res.json({
      success: true,
      data: {
        suggestions
      }
    });
  } catch (error) {
    console.error('Get suggestions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get suggestions'
    });
  }
});

// Get quick help topics
router.get('/help-topics', optionalAuth, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const helpTopics = [
      {
        id: 'explain-concepts',
        title: 'Explain Concepts',
        description: 'Get detailed explanations of complex topics from your documents',
        icon: '📚'
      },
      {
        id: 'generate-questions',
        title: 'Generate Practice Questions',
        description: 'Create custom practice questions based on your study materials',
        icon: '❓'
      },
      {
        id: 'create-flashcards',
        title: 'Create Flashcards',
        description: 'Generate flashcards for better memorization and review',
        icon: '🃏'
      },
      {
        id: 'summarize-notes',
        title: 'Summarize Notes',
        description: 'Get concise summaries of your lengthy study materials',
        icon: '📝'
      },
      {
        id: 'study-tips',
        title: 'Study Tips',
        description: 'Receive personalized study strategies and tips',
        icon: '💡'
      },
      {
        id: 'clarify-doubts',
        title: 'Clarify Doubts',
        description: 'Get answers to specific questions and clear confusion',
        icon: '🔍'
      }
    ];

    res.json({
      success: true,
      data: {
        helpTopics
      }
    });
  } catch (error) {
    console.error('Get help topics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get help topics'
    });
  }
});

// Get study recommendations
router.get('/recommendations', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    
    // Get user's study data
    const [notes, flashcards, quizzes] = await Promise.all([
      db.getUserNotes(userId),
      db.getUserFlashcards(userId),
      db.getUserQuizzes(userId)
    ]);

    const recommendations = generateStudyRecommendations(notes, flashcards, quizzes);

    res.json({
      success: true,
      data: {
        recommendations
      }
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get recommendations'
    });
  }
});

// Chat with document context
router.post('/chat-with-document', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { message, noteId } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: 'Note ID is required'
      });
    }

    // Get specific note for context
    const userNotes = await db.getUserNotes(userId);
    const specificNote = userNotes.find(note => note.id === noteId);

    if (!specificNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Generate AI response with specific document context
    const botResponse = await generateChatResponse(
      `Regarding the document "${specificNote.title}": ${message.trim()}`,
      [specificNote]
    );

    // Create message objects
    const userMessage = {
      id: uuidv4(),
      text: message.trim(),
      sender: 'user' as const,
      timestamp: new Date(),
      type: 'document-ref' as const,
      noteId: specificNote.id,
      noteTitle: specificNote.title
    };

    const botMessage = {
      id: uuidv4(),
      text: botResponse,
      sender: 'bot' as const,
      timestamp: new Date(),
      type: 'document-ref' as const,
      noteId: specificNote.id,
      noteTitle: specificNote.title
    };

    res.json({
      success: true,
      data: {
        messages: [userMessage, botMessage],
        note: {
          id: specificNote.id,
          title: specificNote.title
        }
      },
      message: 'Message processed successfully'
    });
  } catch (error) {
    console.error('Chat with document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Helper functions
const generateContextualSuggestions = (notes: any[]): string[] => {
  const suggestions = [
    "Explain the main concepts in my documents",
    "Generate practice questions for my recent notes",
    "Create flashcards from my study materials",
    "Summarize my notes on key topics",
    "Help me understand difficult concepts",
    "What should I study next?"
  ];

  // Add specific suggestions based on note titles
  if (notes.length > 0) {
    const recentNote = notes[0];
    suggestions.push(`Explain ${recentNote.title}`);
    suggestions.push(`Generate questions about ${recentNote.title}`);
  }

  return suggestions.slice(0, 6);
};

const generateStudyRecommendations = (notes: any[], flashcards: any[], quizzes: any[]) => {
  const recommendations = [];

  // Analyze study patterns and provide recommendations
  if (notes.length === 0) {
    recommendations.push({
      type: 'upload',
      title: 'Start by uploading documents',
      description: 'Upload your study materials to generate AI-powered notes, flashcards, and quizzes.',
      priority: 'high'
    });
  }

  if (notes.length > 0 && flashcards.length === 0) {
    recommendations.push({
      type: 'flashcards',
      title: 'Create flashcards for better retention',
      description: 'Flashcards are excellent for memorizing key concepts and terms.',
      priority: 'medium'
    });
  }

  if (notes.length > 0 && quizzes.length === 0) {
    recommendations.push({
      type: 'quiz',
      title: 'Test your knowledge with quizzes',
      description: 'Take quizzes to assess your understanding and identify knowledge gaps.',
      priority: 'medium'
    });
  }

  // Check for flashcards that need review
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dueForReview = flashcards.filter(f => 
    !f.last_reviewed || new Date(f.last_reviewed) < oneDayAgo
  );

  if (dueForReview.length > 0) {
    recommendations.push({
      type: 'review',
      title: 'Review your flashcards',
      description: `You have ${dueForReview.length} flashcards due for review.`,
      priority: 'medium'
    });
  }

  // Check quiz performance
  const recentQuizzes = quizzes.filter(q => q.attempts.length > 0);
  if (recentQuizzes.length > 0) {
    const averageScore = recentQuizzes.reduce((sum, quiz) => {
      const bestScore = Math.max(...quiz.attempts.map((a: any) => a.score));
      return sum + bestScore;
    }, 0) / recentQuizzes.length;

    if (averageScore < 70) {
      recommendations.push({
        type: 'improve',
        title: 'Focus on weak areas',
        description: 'Your quiz scores suggest reviewing difficult topics would be beneficial.',
        priority: 'low'
      });
    }
  }

  return recommendations;
};

export default router;
