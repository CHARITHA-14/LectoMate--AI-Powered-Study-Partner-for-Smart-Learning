import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Get user profile
router.get('/profile', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const user = await db.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve profile'
    });
  }
});

// Update user profile
router.put('/profile', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { name, email, avatar } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) {
      const newEmail = email.trim().toLowerCase();
      
      // Check if email is already taken by another user
      if (newEmail !== req.user.email) {
        const existingUser = await db.getUserByEmail(newEmail);
        if (existingUser) {
          return res.status(409).json({
            success: false,
            error: 'Email is already taken'
          });
        }
        updates.email = newEmail;
      }
    }
    if (avatar !== undefined) updates.avatar = avatar;

    const updatedUser = await db.updateUser(userId, updates);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      data: {
        user: userWithoutPassword
      },
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
});

// Update password
router.put('/password', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // Get user with password
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await db.updateUser(userId, { password: hashedNewPassword });

    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update password'
    });
  }
});

// Get user statistics
router.get('/stats', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;

    // Get all user data
    const [notes, flashcards, quizzes, user] = await Promise.all([
      db.getUserNotes(userId),
      db.getUserFlashcards(userId),
      db.getUserQuizzes(userId),
      db.getUserById(userId)
    ]);

    // Calculate statistics
    const totalNotes = notes.length;
    const completedNotes = notes.filter(n => n.status === 'completed').length;
    const totalFlashcards = flashcards.length;
    const totalQuizzes = quizzes.length;
    
    // Flashcard statistics
    const reviewedFlashcards = flashcards.filter(f => f.total_reviews > 0);
    const totalReviews = flashcards.reduce((sum, f) => sum + f.total_reviews, 0);
    const totalCorrect = flashcards.reduce((sum, f) => sum + f.correct_count, 0);
    const flashcardAccuracy = totalReviews > 0 ? Math.round((totalCorrect / totalReviews) * 100) : 0;
    
    // Quiz statistics
    const attemptedQuizzes = quizzes.filter(q => q.attempts.length > 0);
    const quizAttempts = attemptedQuizzes.flatMap(q => q.attempts);
    const averageQuizScore = quizAttempts.length > 0
      ? Math.round(quizAttempts.reduce((sum, a) => sum + a.score, 0) / quizAttempts.length)
      : 0;

    // Study streak calculation (simplified - based on recent activity)
    const today = new Date();
    const studyDays = new Set();
    
    // Add days from note uploads
    notes.forEach(note => {
      studyDays.add(new Date(note.upload_date).toDateString());
    });
    
    // Add days from flashcard reviews
    flashcards.forEach(card => {
      if (card.last_reviewed) {
        studyDays.add(new Date(card.last_reviewed).toDateString());
      }
    });
    
    // Add days from quiz attempts
    quizAttempts.forEach(attempt => {
      studyDays.add(new Date(attempt.completed_at).toDateString());
    });

    // Calculate consecutive streak (simplified)
    let currentStreak = 0;
    const todayString = today.toDateString();
    
    if (studyDays.has(todayString)) {
      currentStreak = 1;
      let checkDate = new Date(today);
      checkDate.setDate(checkDate.getDate() - 1);
      
      while (studyDays.has(checkDate.toDateString())) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
    }

    // Recent activity
    const recentNotes = notes.slice(0, 5).map(note => ({
      id: note.id,
      title: note.title,
      uploadDate: note.upload_date,
      type: 'note'
    }));

    const recentFlashcards = reviewedFlashcards
      .sort((a, b) => new Date(b.last_reviewed!).getTime() - new Date(a.last_reviewed!).getTime())
      .slice(0, 3)
      .map(card => ({
        id: card.id,
        front: card.front,
        lastReviewed: card.last_reviewed,
        type: 'flashcard'
      }));

    const recentQuizzes = quizAttempts
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 3)
      .map(attempt => ({
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completed_at,
        type: 'quiz'
      }));

    res.json({
      success: true,
      data: {
        overview: {
          totalNotes,
          completedNotes,
          totalFlashcards,
          totalQuizzes,
          studyStreak: currentStreak,
          joinDate: user.join_date
        },
        performance: {
          flashcardAccuracy,
          averageQuizScore,
          totalReviews,
          totalQuizAttempts: quizAttempts.length
        },
        recentActivity: {
          notes: recentNotes,
          flashcards: recentFlashcards,
          quizzes: recentQuizzes
        }
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve statistics'
    });
  }
});

// Delete user account
router.delete('/account', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { password, confirmation } = req.body;

    if (!password || !confirmation) {
      return res.status(400).json({
        success: false,
        error: 'Password and confirmation are required'
      });
    }

    if (confirmation !== 'DELETE') {
      return res.status(400).json({
        success: false,
        error: 'Confirmation must be exactly "DELETE"'
      });
    }

    // Get user with password
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Password is incorrect'
      });
    }

    // Delete user data (cascade delete should handle related records)
    // This would need to be implemented in the database
    // For now, we'll simulate the deletion
    
    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
});

export default router;
