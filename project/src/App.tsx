import React, { useState } from 'react';
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { UserProvider, useUser } from './context/UserContext';
import { Navigation } from './components/Navigation';
import { Dashboard } from './components/Dashboard';
import { DocumentUpload } from './components/DocumentUpload';
import { NotesViewer } from './components/NotesViewer';
import { FlashcardSystem } from './components/FlashcardSystem';
import { QuizSystem } from './components/QuizSystem';
import { ChatbotInterface } from './components/ChatbotInterface';
import { AuthModal } from './components/AuthModal';
import { StudentProfile } from './components/StudentProfile';

// Map URL paths → ViewType strings (kept for Navigation active-state highlighting)
export const ROUTES = {
  home:       '/home',
  upload:     '/upload',
  notes:      '/notes',
  flashcards: '/flashcards',
  quiz:       '/quiz',
  chat:       '/chat',
  profile:    '/profile',
} as const;

// Guard: redirect unauthenticated users to /home (landing)
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/home" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function AppContent() {
  const { user, loading, logout } = useUser();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleLogin = () => {
    setShowAuthModal(false);
    // Go to the page they were trying to reach, or dashboard
    const from = (location.state as any)?.from?.pathname || ROUTES.home;
    navigate(from, { replace: true });
  };

  const handleLogout = () => {
    logout();
    navigate(ROUTES.home, { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation only shown when logged in and not on landing */}
      {user && <Navigation onLogout={handleLogout} />}

      <Routes>
        {/* ── Landing / home ─────────────────────────────── */}
        <Route
          path="/home"
          element={
            user ? (
              <Navigate to={ROUTES.home} replace />
            ) : (
              <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-teal-50 flex items-center justify-center">
                <div className="text-center max-w-2xl mx-auto px-6">
                  <h1 className="text-6xl font-bold text-gray-900 mb-6">
                    Lecto<span className="text-blue-600">mate</span>
                  </h1>
                  <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                    Your AI-powered learning companion. Upload documents, generate smart notes,
                    create flashcards, take quizzes, and get instant help through our intelligent chatbot.
                  </p>
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-blue-700 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
                  >
                    Get Started
                  </button>
                </div>
                {showAuthModal && (
                  <AuthModal onClose={() => setShowAuthModal(false)} onLogin={handleLogin} />
                )}
              </div>
            )
          }
        />

        {/* ── Authenticated routes ────────────────────────── */}
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/upload"    element={<RequireAuth><DocumentUpload /></RequireAuth>} />
        <Route path="/notes"     element={<RequireAuth><NotesViewer /></RequireAuth>} />
        <Route path="/flashcards" element={<RequireAuth><FlashcardSystem /></RequireAuth>} />
        <Route path="/quiz"      element={<RequireAuth><QuizSystem /></RequireAuth>} />
        <Route path="/chat"      element={<RequireAuth><ChatbotInterface /></RequireAuth>} />
        <Route path="/profile"   element={<RequireAuth><StudentProfile /></RequireAuth>} />

        {/* ── Redirects ───────────────────────────────────── */}
        <Route path="/" element={<Navigate to={user ? '/dashboard' : '/home'} replace />} />
        <Route path="*" element={<Navigate to={user ? '/dashboard' : '/home'} replace />} />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
