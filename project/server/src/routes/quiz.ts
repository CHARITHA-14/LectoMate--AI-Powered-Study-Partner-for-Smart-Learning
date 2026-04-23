import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Get all user quizzes (optionally filtered by note)
router.get('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { noteId } = req.query;
    
    const quizzes = await db.getUserQuizzes(userId, noteId as string);

    const formattedQuizzes = quizzes.map(quiz => ({
      id: quiz.id,
      noteId: quiz.note_id,
      title: quiz.title,
      questions: quiz.questions,
      createdAt: quiz.created_at,
      attempts: quiz.attempts,
      totalQuestions: quiz.questions.length,
      bestScore: quiz.attempts.length > 0 
        ? Math.max(...quiz.attempts.map(a => a.score))
        : null,
      lastAttempt: quiz.attempts.length > 0
        ? new Date(Math.max(...quiz.attempts.map(a => new Date(a.completed_at).getTime())))
        : null
    }));

    res.json({
      success: true,
      data: {
        quizzes: formattedQuizzes
      }
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quizzes'
    });
  }
});

// Get single quiz
router.get('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.id;

    const quizzes = await db.getUserQuizzes(userId);
    const quiz = quizzes.find(q => q.id === quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    const formattedQuiz = {
      id: quiz.id,
      noteId: quiz.note_id,
      title: quiz.title,
      questions: quiz.questions,
      createdAt: quiz.created_at,
      attempts: quiz.attempts,
      totalQuestions: quiz.questions.length,
      bestScore: quiz.attempts.length > 0 
        ? Math.max(...quiz.attempts.map(a => a.score))
        : null,
      lastAttempt: quiz.attempts.length > 0
        ? new Date(Math.max(...quiz.attempts.map(a => new Date(a.completed_at).getTime())))
        : null
    };

    res.json({
      success: true,
      data: {
        quiz: formattedQuiz
      }
    });
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve quiz'
    });
  }
});

// Create new quiz
router.post('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const { noteId, title, questions } = req.body;

    // Validation
    if (!noteId || !title || !questions || !Array.isArray(questions)) {
      return res.status(400).json({
        success: false,
        error: 'Note ID, title, and questions array are required'
      });
    }

    if (questions.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Quiz must have at least one question'
      });
    }

    // Validate each question
    for (const question of questions) {
      if (!question.question || !question.correctAnswer || !question.explanation || !question.difficulty) {
        return res.status(400).json({
          success: false,
          error: 'Each question must have question text, correct answer, explanation, and difficulty'
        });
      }

      if (!['multiple-choice', 'true-false', 'short-answer'].includes(question.type)) {
        return res.status(400).json({
          success: false,
          error: 'Question type must be multiple-choice, true-false, or short-answer'
        });
      }

      if (question.type === 'multiple-choice' && (!question.options || !Array.isArray(question.options) || question.options.length < 2)) {
        return res.status(400).json({
          success: false,
          error: 'Multiple-choice questions must have at least 2 options'
        });
      }

      if (!['easy', 'medium', 'hard'].includes(question.difficulty)) {
        return res.status(400).json({
          success: false,
          error: 'Question difficulty must be easy, medium, or hard'
        });
      }
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

    const newQuiz = await db.createQuiz({
      id: uuidv4(),
      user_id: userId,
      note_id: noteId,
      title: title.trim(),
      questions: questions.map((q: any, index: number) => ({
        ...q,
        id: q.id || `q-${index + 1}`
      })),
      created_at: new Date(),
      attempts: []
    });

    const formattedQuiz = {
      id: newQuiz.id,
      noteId: newQuiz.note_id,
      title: newQuiz.title,
      questions: newQuiz.questions,
      createdAt: newQuiz.created_at,
      attempts: newQuiz.attempts,
      totalQuestions: newQuiz.questions.length,
      bestScore: null,
      lastAttempt: null
    };

    res.status(201).json({
      success: true,
      data: {
        quiz: formattedQuiz
      },
      message: 'Quiz created successfully'
    });
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create quiz'
    });
  }
});

// Submit quiz attempt
router.post('/:id/attempt', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.id;
    const { answers, timeSpent } = req.body;

    // Validate that quiz belongs to user
    const quizzes = await db.getUserQuizzes(userId);
    const quiz = quizzes.find(q => q.id === quizId);

    if (!quiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    if (!answers || !Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        error: 'Answers array is required'
      });
    }

    if (answers.length !== quiz.questions.length) {
      return res.status(400).json({
        success: false,
        error: 'Number of answers must match number of questions'
      });
    }

    // Calculate score
    let correctAnswers = 0;
    const gradedQuestions = quiz.questions.map((question, index) => {
      const userAnswer = answers[index];
      const isCorrect = userAnswer === question.correctAnswer;
      
      if (isCorrect) {
        correctAnswers++;
      }

      return {
        question: question.question,
        userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect,
        explanation: question.explanation
      };
    });

    const score = Math.round((correctAnswers / quiz.questions.length) * 100);

    // Create new attempt
    const newAttempt = {
      id: uuidv4(),
      completed_at: new Date(),
      score,
      total_questions: quiz.questions.length,
      time_spent: timeSpent || 0
    };

    // Update quiz with new attempt
    const updatedAttempts = [...quiz.attempts, newAttempt];
    await db.updateQuiz(quizId, userId, { attempts: updatedAttempts });

    res.json({
      success: true,
      data: {
        attempt: {
          id: newAttempt.id,
          score,
          totalQuestions: quiz.questions.length,
          timeSpent: newAttempt.time_spent,
          completedAt: newAttempt.completed_at
        },
        gradedQuestions,
        summary: {
          correctAnswers,
          totalQuestions: quiz.questions.length,
          score,
          timeSpent: newAttempt.time_spent
        }
      },
      message: 'Quiz attempt submitted successfully'
    });
  } catch (error) {
    console.error('Submit quiz attempt error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit quiz attempt'
    });
  }
});

// Update quiz
router.put('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.id;
    const { title, questions } = req.body;

    // Validate that quiz belongs to user
    const quizzes = await db.getUserQuizzes(userId);
    const existingQuiz = quizzes.find(q => q.id === quizId);

    if (!existingQuiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title.trim();
    if (questions !== undefined) {
      if (!Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Questions must be a non-empty array'
        });
      }
      updates.questions = questions;
    }

    const updatedQuiz = await db.updateQuiz(quizId, userId, updates);

    const formattedQuiz = {
      id: updatedQuiz.id,
      noteId: updatedQuiz.note_id,
      title: updatedQuiz.title,
      questions: updatedQuiz.questions,
      createdAt: updatedQuiz.created_at,
      attempts: updatedQuiz.attempts,
      totalQuestions: updatedQuiz.questions.length,
      bestScore: updatedQuiz.attempts.length > 0 
        ? Math.max(...updatedQuiz.attempts.map(a => a.score))
        : null,
      lastAttempt: updatedQuiz.attempts.length > 0
        ? new Date(Math.max(...updatedQuiz.attempts.map(a => new Date(a.completed_at).getTime())))
        : null
    };

    res.json({
      success: true,
      data: {
        quiz: formattedQuiz
      },
      message: 'Quiz updated successfully'
    });
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update quiz'
    });
  }
});

// Delete quiz
router.delete('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const quizId = req.params.id;
    const userId = req.user.id;

    // Validate that quiz belongs to user
    const quizzes = await db.getUserQuizzes(userId);
    const existingQuiz = quizzes.find(q => q.id === quizId);

    if (!existingQuiz) {
      return res.status(404).json({
        success: false,
        error: 'Quiz not found'
      });
    }

    await db.deleteQuiz(quizId, userId);

    res.json({
      success: true,
      message: 'Quiz deleted successfully'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete quiz'
    });
  }
});

// Get quiz statistics
router.get('/stats/summary', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const quizzes = await db.getUserQuizzes(userId);

    const totalQuizzes = quizzes.length;
    const attemptedQuizzes = quizzes.filter(q => q.attempts.length > 0);
    const totalAttempts = quizzes.reduce((sum, q) => sum + q.attempts.length, 0);
    
    // Calculate average score
    const allAttempts = quizzes.flatMap(q => q.attempts);
    const averageScore = allAttempts.length > 0
      ? Math.round(allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length)
      : 0;

    // Best score across all quizzes
    const bestScore = allAttempts.length > 0
      ? Math.max(...allAttempts.map(a => a.score))
      : null;

    // Recent activity
    const recentAttempts = allAttempts
      .sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())
      .slice(0, 5)
      .map(attempt => ({
        id: attempt.id,
        score: attempt.score,
        completedAt: attempt.completed_at,
        timeSpent: attempt.time_spent
      }));

    // Difficulty distribution
    const allQuestions = quizzes.flatMap(q => q.questions);
    const difficultyStats = {
      easy: allQuestions.filter(q => q.difficulty === 'easy').length,
      medium: allQuestions.filter(q => q.difficulty === 'medium').length,
      hard: allQuestions.filter(q => q.difficulty === 'hard').length
    };

    res.json({
      success: true,
      data: {
        totalQuizzes,
        attemptedQuizzes: attemptedQuizzes.length,
        totalAttempts,
        averageScore,
        bestScore,
        difficultyStats,
        recentAttempts
      }
    });
  } catch (error) {
    console.error('Get quiz stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quiz statistics'
    });
  }
});

export default router;
