// Simple in-memory database for demo purposes
let users: any[] = [];
let notes: any[] = [];
let flashcards: any[] = [];
let quizzes: any[] = [];
let documents: any[] = [];

// Database helper functions
export const db = {
  // User operations
  async createUser(userData: any) {
    const newUser = { 
      ...userData, 
      id: `user_${Date.now()}`,
      join_date: new Date().toISOString(),
      total_documents: 0,
      total_flashcards: 0,
      total_quizzes: 0,
      study_streak: 0
    };
    users.push(newUser);
    return { data: newUser, error: null };
  },

  async getUserByEmail(email: string) {
    const user = users.find((user) => user.email === email);
    return { data: user, error: user ? null : 'User not found' };
  },

  async getUserById(id: string) {
    const user = users.find((user) => user.id === id);
    return { data: user, error: user ? null : 'User not found' };
  },

  async updateUser(id: string, updates: any) {
    const userIndex = users.findIndex((user) => user.id === id);
    if (userIndex !== -1) {
      users[userIndex] = { ...users[userIndex], ...updates };
      return { data: users[userIndex], error: null };
    }
    return { data: null, error: 'User not found' };
  },

  // Note operations
  async getUserNotes(userId: string) {
    const userNotes = notes.filter((note) => note.user_id === userId);
    return userNotes;
  },

  async createNote(noteData: any) {
    const newNote = {
      ...noteData,
      id: `note_${Date.now()}`,
      upload_date: new Date().toISOString(),
      status: 'completed'
    };
    notes.push(newNote);
    return { data: newNote, error: null };
  },

  async updateNote(id: string, updates: any) {
    const noteIndex = notes.findIndex((note) => note.id === id);
    if (noteIndex !== -1) {
      notes[noteIndex] = { ...notes[noteIndex], ...updates };
      return { data: notes[noteIndex], error: null };
    }
    return { data: null, error: 'Note not found' };
  },

  async deleteNote(id: string) {
    const noteIndex = notes.findIndex((note) => note.id === id);
    if (noteIndex !== -1) {
      notes.splice(noteIndex, 1);
      return { data: { id }, error: null };
    }
    return { data: null, error: 'Note not found' };
  },

  // Flashcard operations
  async getUserFlashcards(userId: string) {
    const userFlashcards = flashcards.filter((card) => card.user_id === userId);
    return userFlashcards;
  },

  async createFlashcard(flashcardData: any) {
    const newFlashcard = {
      ...flashcardData,
      id: `flashcard_${Date.now()}`,
      created_at: new Date().toISOString(),
      correct_count: 0,
      total_reviews: 0,
      last_reviewed: null
    };
    flashcards.push(newFlashcard);
    return { data: newFlashcard, error: null };
  },

  async updateFlashcard(id: string, updates: any) {
    const cardIndex = flashcards.findIndex((card) => card.id === id);
    if (cardIndex !== -1) {
      flashcards[cardIndex] = { ...flashcards[cardIndex], ...updates };
      return { data: flashcards[cardIndex], error: null };
    }
    return { data: null, error: 'Flashcard not found' };
  },

  async deleteFlashcard(id: string) {
    const cardIndex = flashcards.findIndex((card) => card.id === id);
    if (cardIndex !== -1) {
      flashcards.splice(cardIndex, 1);
      return { data: { id }, error: null };
    }
    return { data: null, error: 'Flashcard not found' };
  },

  // Quiz operations
  async getUserQuizzes(userId: string) {
    const userQuizzes = quizzes.filter((quiz) => quiz.user_id === userId);
    return userQuizzes.map(quiz => ({
      ...quiz,
      attempts: quiz.attempts || []
    }));
  },

  async createQuiz(quizData: any) {
    const newQuiz = {
      ...quizData,
      id: `quiz_${Date.now()}`,
      created_at: new Date().toISOString(),
      attempts: []
    };
    quizzes.push(newQuiz);
    return { data: newQuiz, error: null };
  },

  async createQuizAttempt(attemptData: any) {
    const newAttempt = {
      ...attemptData,
      id: `attempt_${Date.now()}`,
      completed_at: new Date().toISOString()
    };
    
    const quizIndex = quizzes.findIndex((quiz) => quiz.id === attemptData.quiz_id);
    if (quizIndex !== -1) {
      if (!quizzes[quizIndex].attempts) {
        quizzes[quizIndex].attempts = [];
      }
      quizzes[quizIndex].attempts.push(newAttempt);
    }
    
    return { data: newAttempt, error: null };
  },

  async updateQuiz(id: string, updates: any) {
    const quizIndex = quizzes.findIndex((quiz) => quiz.id === id);
    if (quizIndex !== -1) {
      quizzes[quizIndex] = { ...quizzes[quizIndex], ...updates };
      return { data: quizzes[quizIndex], error: null };
    }
    return { data: null, error: 'Quiz not found' };
  },

  async deleteQuiz(id: string) {
    const quizIndex = quizzes.findIndex((quiz) => quiz.id === id);
    if (quizIndex !== -1) {
      quizzes.splice(quizIndex, 1);
      return { data: { id }, error: null };
    }
    return { data: null, error: 'Quiz not found' };
  },

  // Document operations
  async createDocument(docData: any) {
    const newDoc = {
      ...docData,
      id: `doc_${Date.now()}`,
      uploaded_at: new Date().toISOString(),
      processed: false
    };
    documents.push(newDoc);
    return { data: newDoc, error: null };
  },

  async getUserDocuments(userId: string) {
    const userDocs = documents.filter((doc) => doc.user_id === userId);
    return userDocs;
  },

  async updateDocument(id: string, updates: any) {
    const docIndex = documents.findIndex((doc) => doc.id === id);
    if (docIndex !== -1) {
      documents[docIndex] = { ...documents[docIndex], ...updates };
      return { data: documents[docIndex], error: null };
    }
    return { data: null, error: 'Document not found' };
  },

  async deleteDocument(id: string) {
    const docIndex = documents.findIndex((doc) => doc.id === id);
    if (docIndex !== -1) {
      documents.splice(docIndex, 1);
      return { data: { id }, error: null };
    }
    return { data: null, error: 'Document not found' };
  }
};
