import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { NoteSelector } from './NoteSelector';
import { 
  Brain, RotateCcw, CheckCircle, X, ArrowLeft, ArrowRight, Shuffle, Settings
} from 'lucide-react';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  difficulty: 'easy' | 'medium' | 'hard';
  lastReviewed?: Date;
  correctCount: number;
  totalReviews: number;
}

export const FlashcardSystem: React.FC = () => {
  const { getFlashcardsByNoteId, notes, loadUserData } = useUser();
  const navigate = useNavigate();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyMode, setStudyMode] = useState<'review' | 'learn' | 'test'>('review');
  const [reviewingCard, setReviewingCard] = useState(false);

  if (!selectedNoteId) {
    return (
      <NoteSelector
        title="Study Flashcards"
        description="Choose a document to study flashcards from your uploaded materials."
        onNoteSelect={setSelectedNoteId}
        onBack={() => navigate('/dashboard')}
        actionType="flashcards"
      />
    );
  }

  const flashcards = getFlashcardsByNoteId(selectedNoteId);
  const selectedNote = notes.find(note => note.id === selectedNoteId);

  // If no flashcards exist for this note, show empty state
  if (flashcards.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <Brain size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Flashcards Yet</h3>
          <p className="text-gray-600 mb-6">
            Flashcards for "{selectedNote?.title}" haven't been generated yet.
          </p>
          <div className="space-x-4">
            <button
              onClick={() => setSelectedNoteId(null)}
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Choose Different Document
            </button>
            <button
              onClick={() => navigate('/notes')}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Generate Flashcards
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentCard = flashcards[currentCardIndex];

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
  };

  const handlePrevious = () => {
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    setCurrentCardIndex(Math.floor(Math.random() * flashcards.length));
  };

  const handleReview = async (rating: 'hard' | 'good' | 'easy') => {
    if (reviewingCard) return;
    setReviewingCard(true);

    const token = localStorage.getItem('lectomate_token');
    if (token) {
      try {
        await fetch(`http://localhost:3001/api/flashcards/${currentCard.id}/review`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ correct: rating === 'easy' || rating === 'good' }),
        });
        // Refresh flashcard stats in background
        loadUserData();
      } catch (err) {
        console.error('Failed to record flashcard review:', err);
      }
    }

    // Advance to next card
    setIsFlipped(false);
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
    setReviewingCard(false);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAccuracyPercentage = (card: Flashcard) => {
    return card.totalReviews > 0 ? Math.round((card.correctCount / card.totalReviews) * 100) : 0;
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => setSelectedNoteId(null)}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Document Selection
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {selectedNote?.title} - Flashcards
        </h1>
        <p className="text-gray-600">
          Study flashcards generated from your document with spaced repetition.
        </p>
      </div>

      {/* Study Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <div className="flex items-center space-x-2">
              <Brain size={20} className="text-purple-600" />
              <span className="font-semibold text-gray-900">{selectedNote?.title}</span>
            </div>
            <div className="text-sm text-gray-600">
              Card {currentCardIndex + 1} of {flashcards.length}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            
            
            <button
              onClick={handleShuffle}
              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            >
              <Shuffle size={20} />
            </button>
            
          </div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="mb-6">
        <div className="relative">
          <div 
            className="bg-white rounded-xl shadow-lg border border-gray-200 min-h-[400px] flex flex-col cursor-pointer transform transition-transform duration-200 hover:scale-105"
            onClick={handleFlip}
          >
            <div className="p-8 flex-1 flex flex-col justify-center">
              <div className="text-center">
                <div className="mb-4 flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentCard.difficulty)}`}>
                    {currentCard.difficulty.toUpperCase()}
                  </span>
                  <div className="text-sm text-gray-500">
                    Accuracy: {getAccuracyPercentage(currentCard)}%
                  </div>
                </div>
                
                {!isFlipped ? (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Question</h3>
                    <p className="text-lg text-gray-700 leading-relaxed">{currentCard.front}</p>
                    <div className="mt-8 text-sm text-gray-500">Click to reveal answer</div>
                  </div>
                ) : (
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Answer</h3>
                    <p className="text-lg text-gray-700 leading-relaxed">{currentCard.back}</p>
                    <div className="mt-8 text-sm text-gray-500">Click to flip back</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Flip indicator */}
          <div className="absolute top-4 right-4">
            <RotateCcw size={20} className="text-gray-400" />
          </div>
        </div>
      </div>

      {/* Navigation and Response Buttons */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          {/* Navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handlePrevious}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ArrowLeft size={16} className="mr-1" />
              Previous
            </button>
            
            <button
              onClick={handleNext}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-900 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Next
              <ArrowRight size={16} className="ml-1" />
            </button>
          </div>

          {/* Response Buttons (shown after flip) */}
          {isFlipped && (
            <div className="flex items-center space-x-3">
              <span className="text-sm text-gray-600 mr-2">How well did you know this?</span>
              <button 
                onClick={() => handleReview('hard')}
                disabled={reviewingCard}
                className="flex items-center px-3 py-2 text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <X size={16} className="mr-1" />
                Hard
              </button>
              <button 
                onClick={() => handleReview('good')}
                disabled={reviewingCard}
                className="flex items-center px-3 py-2 text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw size={16} className="mr-1" />
                Good
              </button>
              <button 
                onClick={() => handleReview('easy')}
                disabled={reviewingCard}
                className="flex items-center px-3 py-2 text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} className="mr-1" />
                Easy
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Study Statistics */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-2">Cards Reviewed</h4>
          <p className="text-2xl font-bold text-purple-600">24</p>
          <p className="text-sm text-gray-600">Today</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-2">Average Accuracy</h4>
          <p className="text-2xl font-bold text-green-600">87%</p>
          <p className="text-sm text-gray-600">This week</p>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-2">Study Streak</h4>
          <p className="text-2xl font-bold text-blue-600">7</p>
          <p className="text-sm text-gray-600">Days</p>
        </div>
      </div>
    </div>
  );
};