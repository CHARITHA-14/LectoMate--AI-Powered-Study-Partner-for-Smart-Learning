import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { db } from '../config/database';
import { generateAIContent } from './aiService';

export const processDocument = async (documentId: string, userId: string, filePath: string, originalFileName?: string) => {
  try {
    console.log(`Processing document ${documentId} for user ${userId}`);
    
    // Extract text based on file type
    const text = await extractTextFromFile(filePath);
    
    if (!text || text.trim().length === 0) {
      throw new Error('No text content could be extracted from the document');
    }

    // Generate AI-powered content, passing original filename for title fallback
    const aiContent = await generateAIContent(text, originalFileName);

    // Use original filename (without extension) as title if AI didn't produce one
    const noteTitle = aiContent.title && aiContent.title !== 'Document Study Guide'
      ? aiContent.title
      : originalFileName
        ? originalFileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ')
        : aiContent.title;
    
    // Create note from processed content
    const { data: note } = await db.createNote({
      id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: userId,
      title: noteTitle,
      file_name: originalFileName || path.basename(filePath),
      upload_date: new Date(),
      file_size: formatFileSize(fs.statSync(filePath).size),
      status: 'completed',
      sections: aiContent.sections,
      tags: aiContent.tags,
      last_accessed: new Date()
    });

    // Generate flashcards
    if (aiContent.flashcards && aiContent.flashcards.length > 0) {
      for (const flashcard of aiContent.flashcards) {
        await db.createFlashcard({
          id: `fc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          user_id: userId,
          note_id: note.id,
          front: flashcard.front,
          back: flashcard.back,
          difficulty: flashcard.difficulty,
          correct_count: 0,
          total_reviews: 0,
          created_at: new Date()
        });
      }
    }

    // Generate quiz
    if (aiContent.quiz && aiContent.quiz.questions.length > 0) {
      await db.createQuiz({
        id: `quiz-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        note_id: note.id,
        title: aiContent.quiz.title,
        questions: aiContent.quiz.questions,
        created_at: new Date(),
        attempts: []
      });
    }

    // Update document as processed
    await db.updateDocument(documentId, { processed: true });

    // Update user stats
    const { data: user } = await db.getUserById(userId);
    if (user) {
      await db.updateUser(userId, {
        total_documents: user.total_documents + 1,
        total_flashcards: user.total_flashcards + (aiContent.flashcards?.length || 0),
        total_quizzes: user.total_quizzes + (aiContent.quiz ? 1 : 0)
      });
    }

    console.log(`Document ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);
    throw error;
  }
};

const extractTextFromFile = async (filePath: string): Promise<string> => {
  const fileExtension = path.extname(filePath).toLowerCase();
  
  try {
    switch (fileExtension) {
      case '.pdf':
        const pdfBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(pdfBuffer);
        return pdfData.text;
      
      case '.docx':
        const docxBuffer = fs.readFileSync(filePath);
        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
        return docxResult.value;
      
      case '.doc':
        // For .doc files, we might need additional libraries or conversion
        throw new Error('DOC files are not currently supported. Please convert to DOCX or PDF.');
      
      case '.txt':
        return fs.readFileSync(filePath, 'utf-8');
      
      case '.pptx':
        // PowerPoint processing would require additional libraries
        throw new Error('PowerPoint files are not currently supported for text extraction.');
      
      default:
        throw new Error(`Unsupported file type: ${fileExtension}`);
    }
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error('Failed to extract text from document');
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
