import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { NoteSelector } from './NoteSelector';
import { 
  ClipboardCheck, Clock, CheckCircle, X, Award, BarChart3, RefreshCw, ArrowLeft
} from 'lucide-react';

export const QuizSystem: React.FC = () => {
  const { getQuizzesByNoteId, notes, loadUserData } = useUser();
  const navigate = useNavigate();
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: string]: string }>({});
  const [showResults, setShowResults] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(600);
  const [quizStartTime] = useState<number>(Date.now());

  if (!selectedNoteId) {
    return (
      <NoteSelector
        title="Take Quiz"
        description="Choose a document to take a quiz based on your uploaded materials."
        onNoteSelect={setSelectedNoteId}
        onBack={() => navigate('/dashboard')}
        actionType="quiz"
      />
    );
  }

  const quizzes = getQuizzesByNoteId(selectedNoteId);
  const selectedNote = notes.find(note => note.id === selectedNoteId);

  // Show quiz selection if multiple quizzes exist for this note
  if (!selectedQuizId && quizzes.length > 1) {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Select Quiz</h1>
          <p className="text-gray-600">Choose a quiz for "{selectedNote?.title}"</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {quizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setSelectedQuizId(quiz.id)}
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{quiz.title}</h3>
              <p className="text-gray-600 mb-4">{quiz.questions.length} questions</p>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  {quiz.attempts.length} attempts
                </span>
                <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                  Start Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // If no quizzes exist for this note, show empty state
  if (quizzes.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <ClipboardCheck size={64} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Quizzes Yet</h3>
          <p className="text-gray-600 mb-6">
            Quizzes for "{selectedNote?.title}" haven't been generated yet.
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
              className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              Generate Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuiz = quizzes.find(q => q.id === selectedQuizId) || quizzes[0];
  const quiz = currentQuiz.questions;

  const currentQuestion = quiz[currentQuestionIndex];

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentQuestion.id]: answer
    }));
  };

  const submitQuizAttempt = async (score: { correct: number; total: number; percentage: number }) => {
    const token = localStorage.getItem('lectomate_token');
    if (!token) return;
    try {
      const timeSpent = Math.round((Date.now() - quizStartTime) / 1000);
      // Convert answers object to ordered array matching question order
      const answersArray = quiz.map(q => selectedAnswers[q.id] || '');
      await fetch(`http://localhost:3001/api/quizzes/${currentQuiz.id}/attempt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: answersArray,
          timeSpent,
        }),
      });
      loadUserData();
    } catch (err) {
      console.error('Failed to record quiz attempt:', err);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      const score = calculateScore();
      setShowResults(true);
      submitQuizAttempt(score);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const calculateScore = () => {
    let correct = 0;
    quiz.forEach(question => {
      if (selectedAnswers[question.id] === question.correctAnswer) {
        correct++;
      }
    });
    return {
      correct,
      total: quiz.length,
      percentage: Math.round((correct / quiz.length) * 100)
    };
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy': return 'text-green-600 bg-green-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'hard': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (showResults) {
    const score = calculateScore();
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <div className="mb-4">
            <Award size={64} className={`mx-auto ${getScoreColor(score.percentage)}`} />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Quiz Complete!</h1>
          <p className="text-gray-600">Here are your results</p>
        </div>

        {/* Score Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-8 text-center">
          <div className="mb-6">
            <div className={`text-6xl font-bold ${getScoreColor(score.percentage)} mb-2`}>
              {score.percentage}%
            </div>
            <p className="text-gray-600">
              You got {score.correct} out of {score.total} questions correct
            </p>
          </div>

          <div className="flex justify-center space-x-4 mb-6">
            <button
              onClick={() => {
                setShowResults(false);
                setCurrentQuestionIndex(0);
                setSelectedAnswers({});
                setTimeRemaining(600);
              }}
              className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw size={20} className="mr-2" />
              Retake Quiz
            </button>
            <button
              onClick={() => {
                setSelectedNoteId(null);
                setSelectedQuizId(null);
                setShowResults(false);
                setCurrentQuestionIndex(0);
                setSelectedAnswers({});
              }}
              className="flex items-center px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Choose Different Document
            </button>
          </div>
        </div>

        {/* Detailed Results */}
        <div className="space-y-6">
          {quiz.map((question, index) => {
            const userAnswer = selectedAnswers[question.id];
            const isCorrect = userAnswer === question.correctAnswer;
            
            return (
              <div key={question.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="text-lg font-semibold text-gray-900">
                      Question {index + 1}
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(question.difficulty)}`}>
                      {question.difficulty}
                    </span>
                  </div>
                  {isCorrect ? (
                    <CheckCircle size={24} className="text-green-600" />
                  ) : (
                    <X size={24} className="text-red-600" />
                  )}
                </div>
                
                <p className="text-gray-800 mb-4">{question.question}</p>
                
                <div className="space-y-2 mb-4">
                  {question.options?.map((option, optionIndex) => (
                    <div
                      key={optionIndex}
                      className={`p-3 rounded-lg border ${
                        option === question.correctAnswer
                          ? 'border-green-500 bg-green-50'
                          : option === userAnswer && !isCorrect
                          ? 'border-red-500 bg-red-50'
                          : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{option}</span>
                        {option === question.correctAnswer && (
                          <CheckCircle size={16} className="text-green-600" />
                        )}
                        {option === userAnswer && !isCorrect && (
                          <X size={16} className="text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 mb-2">Explanation</h4>
                  <p className="text-blue-800">{question.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <button
          onClick={() => {
            setSelectedNoteId(null);
            setSelectedQuizId(null);
            setCurrentQuestionIndex(0);
            setSelectedAnswers({});
            setShowResults(false);
          }}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Document Selection
        </button>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {currentQuiz.title}
        </h1>
        <p className="text-gray-600">
          Test your knowledge with questions based on "{selectedNote?.title}".
        </p>
      </div>

      {/* Quiz Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="flex items-center space-x-4 mb-4 sm:mb-0">
            <ClipboardCheck size={24} className="text-orange-600" />
            <div>
              <h3 className="font-semibold text-gray-900">
                Question {currentQuestionIndex + 1} of {quiz.length}
              </h3>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(currentQuestion.difficulty)}`}>
                {currentQuestion.difficulty.toUpperCase()}
              </span>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="flex items-center text-gray-600">
              <Clock size={20} className="mr-2" />
              <span className="font-mono">{formatTime(timeRemaining)}</span>
            </div>
            <div className="flex items-center text-gray-600">
              <BarChart3 size={20} className="mr-2" />
              <span>{Object.keys(selectedAnswers).length}/{quiz.length} answered</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-orange-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestionIndex + 1) / quiz.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Question */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">
          {currentQuestion.question}
        </h2>

        <div className="space-y-3">
          {currentQuestion.options?.map((option, index) => (
            <button
              key={index}
              onClick={() => handleAnswerSelect(option)}
              className={`w-full text-left p-4 rounded-lg border transition-all ${
                selectedAnswers[currentQuestion.id] === option
                  ? 'border-orange-500 bg-orange-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center">
                <div className={`w-4 h-4 rounded-full border-2 mr-3 ${
                  selectedAnswers[currentQuestion.id] === option
                    ? 'border-orange-500 bg-orange-500'
                    : 'border-gray-300'
                }`}>
                  {selectedAnswers[currentQuestion.id] === option && (
                    <div className="w-full h-full rounded-full bg-white scale-50"></div>
                  )}
                </div>
                <span className="text-gray-800">{option}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={handlePrevious}
          disabled={currentQuestionIndex === 0}
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Previous
        </button>

        <div className="text-sm text-gray-600">
          {Object.keys(selectedAnswers).length > 0 && (
            <span>{Object.keys(selectedAnswers).length} questions answered</span>
          )}
        </div>

        <button
          onClick={handleNext}
          disabled={!selectedAnswers[currentQuestion.id]}
          className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {currentQuestionIndex === quiz.length - 1 ? 'Finish Quiz' : 'Next Question'}
        </button>
      </div>
    </div>
  );
};