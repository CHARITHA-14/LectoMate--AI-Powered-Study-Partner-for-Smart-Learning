import express from 'express';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { ApiResponse } from '../types';

const router = express.Router();

// Get all user notes
router.get('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const notes = await db.getUserNotes(userId);

    const formattedNotes = notes.map(note => ({
      id: note.id,
      title: note.title,
      fileName: note.file_name,
      uploadDate: note.upload_date,
      fileSize: note.file_size,
      status: note.status,
      sections: note.sections,
      tags: note.tags,
      lastAccessed: note.last_accessed
    }));

    res.json({
      success: true,
      data: {
        notes: formattedNotes
      }
    });
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve notes'
    });
  }
});

// Get single note
router.get('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const noteId = req.params.id;
    const userId = req.user.id;

    const notes = await db.getUserNotes(userId);
    const note = notes.find(n => n.id === noteId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Update last accessed
    await db.updateNote(noteId, userId, { last_accessed: new Date() });

    const formattedNote = {
      id: note.id,
      title: note.title,
      fileName: note.file_name,
      uploadDate: note.upload_date,
      fileSize: note.file_size,
      status: note.status,
      sections: note.sections,
      tags: note.tags,
      lastAccessed: note.last_accessed
    };

    res.json({
      success: true,
      data: {
        note: formattedNote
      }
    });
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve note'
    });
  }
});

// Update note
router.put('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const noteId = req.params.id;
    const userId = req.user.id;
    const { title, sections, tags } = req.body;

    // Validate that note belongs to user
    const notes = await db.getUserNotes(userId);
    const existingNote = notes.find(n => n.id === noteId);

    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (sections !== undefined) updates.sections = sections;
    if (tags !== undefined) updates.tags = tags;

    const updatedNote = await db.updateNote(noteId, userId, updates);

    const formattedNote = {
      id: updatedNote.id,
      title: updatedNote.title,
      fileName: updatedNote.file_name,
      uploadDate: updatedNote.upload_date,
      fileSize: updatedNote.file_size,
      status: updatedNote.status,
      sections: updatedNote.sections,
      tags: updatedNote.tags,
      lastAccessed: updatedNote.last_accessed
    };

    res.json({
      success: true,
      data: {
        note: formattedNote
      },
      message: 'Note updated successfully'
    });
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update note'
    });
  }
});

// Delete note
router.delete('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const noteId = req.params.id;
    const userId = req.user.id;

    // Validate that note belongs to user
    const notes = await db.getUserNotes(userId);
    const existingNote = notes.find(n => n.id === noteId);

    if (!existingNote) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    await db.deleteNote(noteId, userId);

    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete note'
    });
  }
});

// Get note statistics
router.get('/stats/summary', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const notes = await db.getUserNotes(userId);

    const totalNotes = notes.length;
    const completedNotes = notes.filter(n => n.status === 'completed').length;
    const processingNotes = notes.filter(n => n.status === 'processing').length;
    
    // Calculate total sections and tags
    const totalSections = notes.reduce((sum, note) => sum + (note.sections?.length || 0), 0);
    const allTags = notes.flatMap(note => note.tags || []);
    const uniqueTags = [...new Set(allTags)];

    res.json({
      success: true,
      data: {
        totalNotes,
        completedNotes,
        processingNotes,
        totalSections,
        uniqueTags: uniqueTags.length,
        recentNotes: notes.slice(0, 5).map(note => ({
          id: note.id,
          title: note.title,
          uploadDate: note.upload_date,
          status: note.status
        }))
      }
    });
  } catch (error) {
    console.error('Get note stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get note statistics'
    });
  }
});

export default router;
