import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Get all user flashcards (optionally filtered by note)
router.get('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.query;
    
    const flashcards = await db.getUserFlashcards(userId, noteId as string);

    const formattedFlashcards = flashcards.map(card => ({
      id: card.id,
      noteId: card.note_id,
      front: card.front,
      back: card.back,
      difficulty: card.difficulty,
      lastReviewed: card.last_reviewed,
      correctCount: card.correct_count,
      totalReviews: card.total_reviews,
      createdAt: card.created_at
    }));

    res.json({
      success: true,
      data: {
        flashcards: formattedFlashcards
      }
    });
  } catch (error) {
    console.error('Get flashcards error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve flashcards'
    });
  }
});

// Get single flashcard
router.get('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const flashcardId = req.params.id;
    const userId = req.user.id;

    const flashcards = await db.getUserFlashcards(userId);
    const flashcard = flashcards.find(f => f.id === flashcardId);

    if (!flashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found'
      });
    }

    const formattedFlashcard = {
      id: flashcard.id,
      noteId: flashcard.note_id,
      front: flashcard.front,
      back: flashcard.back,
      difficulty: flashcard.difficulty,
      lastReviewed: flashcard.last_reviewed,
      correctCount: flashcard.correct_count,
      totalReviews: flashcard.total_reviews,
      createdAt: flashcard.created_at
    };

    res.json({
      success: true,
      data: {
        flashcard: formattedFlashcard
      }
    });
  } catch (error) {
    console.error('Get flashcard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve flashcard'
    });
  }
});

// Create new flashcard
router.post('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { noteId, front, back, difficulty = 'medium' } = req.body;

    // Validation
    if (!noteId || !front || !back) {
      return res.status(400).json({
        success: false,
        error: 'Note ID, front, and back are required'
      });
    }

    if (!['easy', 'medium', 'hard'].includes(difficulty)) {
      return res.status(400).json({
        success: false,
        error: 'Difficulty must be easy, medium, or hard'
      });
    }

    // Verify that the note belongs to the user
    const notes = await db.getUserNotes(userId);
    const noteExists = notes.some(n => n.id === noteId);

    if (!noteExists) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    const newFlashcard = await db.createFlashcard({
      id: uuidv4(),
      user_id: userId,
      note_id: noteId,
      front: front.trim(),
      back: back.trim(),
      difficulty,
      correct_count: 0,
      total_reviews: 0,
      created_at: new Date()
    });

    const formattedFlashcard = {
      id: newFlashcard.id,
      noteId: newFlashcard.note_id,
      front: newFlashcard.front,
      back: newFlashcard.back,
      difficulty: newFlashcard.difficulty,
      lastReviewed: newFlashcard.last_reviewed,
      correctCount: newFlashcard.correct_count,
      totalReviews: newFlashcard.total_reviews,
      createdAt: newFlashcard.created_at
    };

    res.status(201).json({
      success: true,
      data: {
        flashcard: formattedFlashcard
      },
      message: 'Flashcard created successfully'
    });
  } catch (error) {
    console.error('Create flashcard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create flashcard'
    });
  }
});

// Update flashcard
router.put('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const flashcardId = req.params.id;
    const userId = req.user.id;
    const { front, back, difficulty } = req.body;

    // Validate that flashcard belongs to user
    const flashcards = await db.getUserFlashcards(userId);
    const existingFlashcard = flashcards.find(f => f.id === flashcardId);

    if (!existingFlashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found'
      });
    }

    const updates: any = {};
    if (front !== undefined) updates.front = front.trim();
    if (back !== undefined) updates.back = back.trim();
    if (difficulty !== undefined && ['easy', 'medium', 'hard'].includes(difficulty)) {
      updates.difficulty = difficulty;
    }

    const updatedFlashcard = await db.updateFlashcard(flashcardId, userId, updates);

    const formattedFlashcard = {
      id: updatedFlashcard.id,
      noteId: updatedFlashcard.note_id,
      front: updatedFlashcard.front,
      back: updatedFlashcard.back,
      difficulty: updatedFlashcard.difficulty,
      lastReviewed: updatedFlashcard.last_reviewed,
      correctCount: updatedFlashcard.correct_count,
      totalReviews: updatedFlashcard.total_reviews,
      createdAt: updatedFlashcard.created_at
    };

    res.json({
      success: true,
      data: {
        flashcard: formattedFlashcard
      },
      message: 'Flashcard updated successfully'
    });
  } catch (error) {
    console.error('Update flashcard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update flashcard'
    });
  }
});

// Review flashcard (update progress)
router.post('/:id/review', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const flashcardId = req.params.id;
    const userId = req.user.id;
    const { correct } = req.body;

    if (typeof correct !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'Correct field must be a boolean'
      });
    }

    // Validate that flashcard belongs to user
    const flashcards = await db.getUserFlashcards(userId);
    const existingFlashcard = flashcards.find(f => f.id === flashcardId);

    if (!existingFlashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found'
      });
    }

    const updates = {
      last_reviewed: new Date(),
      total_reviews: existingFlashcard.total_reviews + 1,
      correct_count: existingFlashcard.correct_count + (correct ? 1 : 0)
    };

    const updatedFlashcard = await db.updateFlashcard(flashcardId, userId, updates);

    const formattedFlashcard = {
      id: updatedFlashcard.id,
      noteId: updatedFlashcard.note_id,
      front: updatedFlashcard.front,
      back: updatedFlashcard.back,
      difficulty: updatedFlashcard.difficulty,
      lastReviewed: updatedFlashcard.last_reviewed,
      correctCount: updatedFlashcard.correct_count,
      totalReviews: updatedFlashcard.total_reviews,
      createdAt: updatedFlashcard.created_at
    };

    res.json({
      success: true,
      data: {
        flashcard: formattedFlashcard
      },
      message: 'Flashcard review recorded'
    });
  } catch (error) {
    console.error('Review flashcard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record flashcard review'
    });
  }
});

// Delete flashcard
router.delete('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const flashcardId = req.params.id;
    const userId = req.user.id;

    // Validate that flashcard belongs to user
    const flashcards = await db.getUserFlashcards(userId);
    const existingFlashcard = flashcards.find(f => f.id === flashcardId);

    if (!existingFlashcard) {
      return res.status(404).json({
        success: false,
        error: 'Flashcard not found'
      });
    }

    await db.deleteFlashcard(flashcardId, userId);

    res.json({
      success: true,
      message: 'Flashcard deleted successfully'
    });
  } catch (error) {
    console.error('Delete flashcard error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete flashcard'
    });
  }
});

// Get flashcard statistics
router.get('/stats/summary', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const flashcards = await db.getUserFlashcards(userId);

    const totalFlashcards = flashcards.length;
    const reviewedCards = flashcards.filter(f => f.total_reviews > 0);
    const totalReviews = flashcards.reduce((sum, f) => sum + f.total_reviews, 0);
    const totalCorrect = flashcards.reduce((sum, f) => sum + f.correct_count, 0);
    
    const accuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
    
    const difficultyStats = {
      easy: flashcards.filter(f => f.difficulty === 'easy').length,
      medium: flashcards.filter(f => f.difficulty === 'medium').length,
      hard: flashcards.filter(f => f.difficulty === 'hard').length
    };

    // Cards due for review (simple algorithm: cards not reviewed in last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dueForReview = flashcards.filter(f => 
      !f.last_reviewed || new Date(f.last_reviewed) < oneDayAgo
    ).length;

    res.json({
      success: true,
      data: {
        totalFlashcards,
        reviewedCards: reviewedCards.length,
        totalReviews,
        accuracy,
        difficultyStats,
        dueForReview,
        recentActivity: reviewedCards.slice(0, 5).map(card => ({
          id: card.id,
          front: card.front,
          lastReviewed: card.last_reviewed,
          accuracy: card.total_reviews > 0 ? Math.round((card.correct_count / card.total_reviews) * 100) : 0
        }))
      }
    });
  } catch (error) {
    console.error('Get flashcard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get flashcard statistics'
    });
  }
});

export default router;
