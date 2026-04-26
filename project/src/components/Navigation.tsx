import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Home, Upload, BookOpen, Brain, ClipboardCheck, MessageCircle, LogOut, User } from 'lucide-react';
import { API_BASE_URL } from '../config/api';

interface NavigationProps {
  onLogout: () => void;
}

const navItems = [
  { path: '/dashboard',  label: 'Dashboard',  icon: Home },
  { path: '/upload',     label: 'Upload',      icon: Upload },
  { path: '/notes',      label: 'Notes',       icon: BookOpen },
  { path: '/flashcards', label: 'Flashcards',  icon: Brain },
  { path: '/quiz',       label: 'Quiz',        icon: ClipboardCheck },
  { path: '/chat',       label: 'AI Chat',     icon: MessageCircle },
];

export const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const { user } = useUser();
  const navigate  = useNavigate();
  const location  = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">

          {/* Logo */}
          <div className="flex items-center">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-shrink-0 text-2xl font-bold text-gray-900 hover:opacity-80 transition-opacity"
            >
              Lecto<span className="text-blue-600">mate</span>
            </button>

            {/* Desktop nav */}
            <div className="hidden md:flex ml-10 space-x-1">
              {navItems.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 ${
                    isActive(path)
                      ? 'text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={17} className="mr-1.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => navigate('/profile')}
              className={`flex items-center text-sm rounded-md px-3 py-2 transition-colors ${
                isActive('/profile')
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {user?.avatar ? (
                <img
                  src={`${API_BASE_URL}${user.avatar}`}
                  alt={user.name}
                  className="w-6 h-6 rounded-full object-cover mr-1.5"
                />
              ) : (
                <User size={16} className="mr-1.5" />
              )}
              {user?.name || 'Student'}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center text-sm text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-2 rounded-md transition-colors"
            >
              <LogOut size={16} className="mr-1.5" />
              Logout
            </button>
          </div>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-gray-200">
        <div className="flex overflow-x-auto py-2 px-4 space-x-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center min-w-0 flex-shrink-0 px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 ${
                isActive(path)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Icon size={16} className="mb-0.5" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  );
};
