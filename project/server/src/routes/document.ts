import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth';
import { processDocument } from '../services/documentProcessor';
import { ApiResponse } from '../types';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${extension}`);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF, DOC, DOCX, TXT, PPT, and PPTX files are allowed.'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760') // 10MB default
  }
});

// Upload document
router.post('/upload', authenticate, upload.single('file'), async (req: any, res: express.Response<ApiResponse>) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const file = req.file;
    const userId = req.user.id;

    // Save document to database
    const { data: document } = await db.createDocument({
      id: uuidv4(),
      user_id: userId,
      file_name: file.filename,
      original_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      file_path: file.path,
      uploaded_at: new Date(),
      processed: false
    });

    // Start async processing, passing original filename for proper title generation
    processDocument(document.id, userId, file.path, file.originalname).catch(error => {
      console.error('Document processing error:', error);
    });

    res.status(201).json({
      success: true,
      data: {
        document: {
          id: document.id,
          originalName: document.original_name,
          fileSize: document.file_size,
          mimeType: document.mime_type,
          uploadedAt: document.uploaded_at,
          processed: document.processed
        }
      },
      message: 'Document uploaded successfully. Processing started...'
    });
  } catch (error) {
    console.error('Document upload error:', error);
    
    // Clean up uploaded file if error occurred
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: 'Document upload failed'
    });
  }
});

// Get user documents
router.get('/', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const userId = req.user.id;
    const documents = await db.getUserDocuments(userId);

    const formattedDocuments = documents.map(doc => ({
      id: doc.id,
      originalName: doc.original_name,
      fileSize: doc.file_size,
      mimeType: doc.mime_type,
      uploadedAt: doc.uploaded_at,
      processed: doc.processed
    }));

    res.json({
      success: true,
      data: {
        documents: formattedDocuments
      }
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documents'
    });
  }
});

// Delete document
router.delete('/:id', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    // Get document details to delete file
    const documents = await db.getUserDocuments(userId);
    const document = documents.find(doc => doc.id === documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Delete from database
    await db.deleteDocument(documentId, userId);

    // Delete file from filesystem
    if (fs.existsSync(document.file_path)) {
      fs.unlinkSync(document.file_path);
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

// Get document processing status
router.get('/:id/status', authenticate, async (req: any, res: express.Response<ApiResponse>) => {
  try {
    const documentId = req.params.id;
    const userId = req.user.id;

    const documents = await db.getUserDocuments(userId);
    const document = documents.find(doc => doc.id === documentId);

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: {
        id: document.id,
        processed: document.processed,
        uploadedAt: document.uploaded_at
      }
    });
  } catch (error) {
    console.error('Get document status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get document status'
    });
  }
});

export default router;
