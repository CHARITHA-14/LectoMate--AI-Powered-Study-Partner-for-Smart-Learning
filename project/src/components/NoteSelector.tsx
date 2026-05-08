import React from 'react';
import { useUser } from '../context/UserContext';
import { BookOpen, Calendar, Tag, ArrowRight, FileText } from 'lucide-react';

interface NoteSelectorProps {
  title: string;
  description: string;
  onNoteSelect: (noteId: string) => void;
  onBack: () => void;
  actionType: 'flashcards' | 'quiz';
}

export const NoteSelector: React.FC<NoteSelectorProps> = ({ 
  title, 
  description, 
  onNoteSelect, 
  onBack,
  actionType 
}) => {
  const { notes, getFlashcardsByNoteId, getQuizzesByNoteId } = useUser();

  const getActionCount = (noteId: string) => {
    if (actionType === 'flashcards') {
      return getFlashcardsByNoteId(noteId).length;
    } else {
      return getQuizzesByNoteId(noteId).length;
    }
  };

  const getActionText = (count: number) => {
    if (actionType === 'flashcards') {
      return count === 1 ? '1 flashcard' : `${count} flashcards`;
    } else {
      return count === 1 ? '1 quiz' : `${count} quizzes`;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={onBack}
          className="flex items-center text-blue-600 hover:text-blue-800 mb-4 transition-colors"
        >
          <ArrowRight size={16} className="mr-1 rotate-180" />
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
        <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500">{description}</p>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12">
          <FileText size={64} className="mx-auto text-gray-400 dark:text-gray-500 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Documents Yet</h3>
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-6">
            Upload your first document to start creating {actionType === 'flashcards' ? 'flashcards' : 'quizzes'}.
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Upload Document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => {
            const actionCount = getActionCount(note.id);
            return (
              <div
                key={note.id}
                className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200 cursor-pointer transform hover:scale-105"
                onClick={() => onNoteSelect(note.id)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2">
                        {note.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-3">{note.fileName}</p>
                    </div>
                    <BookOpen size={24} className="text-blue-600 flex-shrink-0" />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      <Calendar size={14} className="mr-2" />
                      Uploaded {note.uploadDate.toLocaleDateString()}
                    </div>
                    
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      <FileText size={14} className="mr-2" />
                      {note.fileSize}
                    </div>

                    {note.tags.length > 0 && (
                      <div className="flex items-center">
                        <Tag size={14} className="text-gray-400 dark:text-gray-500 mr-2" />
                        <div className="flex flex-wrap gap-1">
                          {note.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs font-medium text-blue-800 bg-blue-100 rounded-full"
                            >
                              {tag}
                            </span>
                          ))}
                          {note.tags.length > 2 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">
                              +{note.tags.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
                        {actionCount > 0 ? getActionText(actionCount) : `No ${actionType} yet`}
                      </span>
                      <div className="flex items-center text-blue-600">
                        <span className="text-sm font-medium mr-1">
                          {actionType === 'flashcards' ? 'Study' : 'Take Quiz'}
                        </span>
                        <ArrowRight size={14} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {notes.length > 0 && (
        <div className="mt-8 text-center">
          <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500 mb-4">
            Don't see the document you're looking for?
          </p>
          <button
            onClick={onBack}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-950 transition-colors"
          >
            Upload New Document
          </button>
        </div>
      )}
    </div>
  );
};