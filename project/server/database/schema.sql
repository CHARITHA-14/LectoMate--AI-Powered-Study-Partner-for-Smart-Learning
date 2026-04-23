-- Lectomate Database Schema for Supabase
-- This file contains all the tables and relationships needed for the AI-powered study assistant

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar TEXT,
    join_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    study_streak INTEGER DEFAULT 0,
    total_documents INTEGER DEFAULT 0,
    total_flashcards INTEGER DEFAULT 0,
    total_quizzes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notes table
CREATE TABLE notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_size VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed')),
    sections JSONB NOT NULL DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    last_accessed TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flashcards table
CREATE TABLE flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    difficulty VARCHAR(10) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    last_reviewed TIMESTAMP WITH TIME ZONE,
    correct_count INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quizzes table
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    questions JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Quiz attempts table
CREATE TABLE quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
    total_questions INTEGER NOT NULL,
    time_spent INTEGER NOT NULL, -- in seconds
    answers JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table (optional - for storing chat history)
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL CHECK (sender IN ('user', 'bot')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    type VARCHAR(20) DEFAULT 'text' CHECK (type IN ('text', 'suggestion', 'document-ref')),
    note_id UUID REFERENCES notes(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_documents_user_id ON documents(user_id);
CREATE INDEX idx_notes_user_id ON notes(user_id);
CREATE INDEX idx_notes_status ON notes(status);
CREATE INDEX idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX idx_flashcards_note_id ON flashcards(note_id);
CREATE INDEX idx_flashcards_difficulty ON flashcards(difficulty);
CREATE INDEX idx_quizzes_user_id ON quizzes(user_id);
CREATE INDEX idx_quizzes_note_id ON quizzes(note_id);
CREATE INDEX idx_quiz_attempts_quiz_id ON quiz_attempts(quiz_id);
CREATE INDEX idx_quiz_attempts_user_id ON quiz_attempts(user_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_timestamp ON chat_messages(timestamp);

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notes_updated_at BEFORE UPDATE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_flashcards_updated_at BEFORE UPDATE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_quizzes_updated_at BEFORE UPDATE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid()::text = id::text);

CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid()::text = id::text);

-- Documents policies
CREATE POLICY "Users can view own documents" ON documents
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own documents" ON documents
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own documents" ON documents
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own documents" ON documents
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Notes policies
CREATE POLICY "Users can view own notes" ON notes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own notes" ON notes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own notes" ON notes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own notes" ON notes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Flashcards policies
CREATE POLICY "Users can view own flashcards" ON flashcards
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own flashcards" ON flashcards
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own flashcards" ON flashcards
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own flashcards" ON flashcards
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Quizzes policies
CREATE POLICY "Users can view own quizzes" ON quizzes
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own quizzes" ON quizzes
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update own quizzes" ON quizzes
    FOR UPDATE USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own quizzes" ON quizzes
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Quiz attempts policies
CREATE POLICY "Users can view own quiz attempts" ON quiz_attempts
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own quiz attempts" ON quiz_attempts
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

-- Chat messages policies
CREATE POLICY "Users can view own chat messages" ON chat_messages
    FOR SELECT USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert own chat messages" ON chat_messages
    FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own chat messages" ON chat_messages
    FOR DELETE USING (auth.uid()::text = user_id::text);

-- Functions for updating user stats
CREATE OR REPLACE FUNCTION update_user_stats_on_note_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_documents = total_documents + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_stats_on_note_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_documents = GREATEST(total_documents - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_stats_on_flashcard_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_flashcards = total_flashcards + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_stats_on_flashcard_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_flashcards = GREATEST(total_flashcards - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_stats_on_quiz_insert()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_quizzes = total_quizzes + 1
    WHERE id = NEW.user_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_stats_on_quiz_delete()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE users 
    SET total_quizzes = GREATEST(total_quizzes - 1, 0)
    WHERE id = OLD.user_id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers for automatic stats updates
CREATE TRIGGER update_user_stats_note_insert
    AFTER INSERT ON notes
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_note_insert();

CREATE TRIGGER update_user_stats_note_delete
    AFTER DELETE ON notes
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_note_delete();

CREATE TRIGGER update_user_stats_flashcard_insert
    AFTER INSERT ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_flashcard_insert();

CREATE TRIGGER update_user_stats_flashcard_delete
    AFTER DELETE ON flashcards
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_flashcard_delete();

CREATE TRIGGER update_user_stats_quiz_insert
    AFTER INSERT ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_quiz_insert();

CREATE TRIGGER update_user_stats_quiz_delete
    AFTER DELETE ON quizzes
    FOR EACH ROW EXECUTE FUNCTION update_user_stats_on_quiz_delete();
