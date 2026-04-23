import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { 
  Upload, 
  BookOpen, 
  Brain, 
  ClipboardCheck, 
  MessageCircle,
  TrendingUp,
  Clock,
  Target
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const { user, notes, flashcards, quizzes } = useUser();
  const navigate = useNavigate();

  const quickActions = [
    { path: '/upload',     title: 'Upload Document',  description: 'Upload a new document to generate notes and study materials', icon: Upload,        color: 'bg-blue-500',   hoverColor: 'hover:bg-blue-600' },
    { path: '/notes',      title: 'Review Notes',     description: 'Access your generated notes and highlights',                   icon: BookOpen,      color: 'bg-green-500',  hoverColor: 'hover:bg-green-600' },
    { path: '/flashcards', title: 'Study Flashcards', description: 'Review flashcards with spaced repetition',                     icon: Brain,         color: 'bg-purple-500', hoverColor: 'hover:bg-purple-600' },
    { path: '/quiz',       title: 'Take Quiz',        description: 'Test your knowledge with AI-generated quizzes',                icon: ClipboardCheck,color: 'bg-orange-500', hoverColor: 'hover:bg-orange-600' },
    { path: '/chat',       title: 'AI Chat',          description: 'Get instant help from our AI assistant',                       icon: MessageCircle, color: 'bg-teal-500',   hoverColor: 'hover:bg-teal-600' },
  ];

  const totalQuizAttempts = quizzes.reduce((sum, quiz) => sum + quiz.attempts.length, 0);
  
  const stats = [
    { label: 'Documents Processed', value: notes.length.toString(), icon: BookOpen, color: 'text-blue-600' },
    { label: 'Flashcards Created', value: flashcards.length.toString(), icon: Brain, color: 'text-purple-600' },
    { label: 'Quizzes Completed', value: totalQuizAttempts.toString(), icon: Target, color: 'text-orange-600' },
    { label: 'Study Streak', value: `${user?.studyStreak || 0} days`, icon: TrendingUp, color: 'text-green-600' }
  ];

  const recentActivity = [
    ...notes.slice(0, 3).map(note => ({
      title: note.title,
      type: 'Document uploaded',
      time: getTimeAgo(note.uploadDate)
    })),
    ...quizzes.slice(0, 2).map(quiz => ({
      title: quiz.title,
      type: quiz.attempts.length > 0 ? 'Quiz completed' : 'Quiz created',
      time: getTimeAgo(quiz.attempts[quiz.attempts.length - 1]?.completedAt || quiz.createdAt)
    }))
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 4);

  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    
    return date.toLocaleDateString();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome back{user?.name ? `, ${user.name.split(' ')[0]}` : ''}!</h1>
        <p className="text-gray-600">Continue your learning journey with AI-powered tools.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center">
                <div className={`p-2 rounded-lg bg-opacity-10 ${stat.color.replace('text-', 'bg-')}`}>
                  <Icon size={24} className={stat.color} />
                </div>
                <div className="ml-4">
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  <p className="text-sm text-gray-600">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 transform hover:scale-105 text-left"
              >
                <div className={`inline-flex p-3 rounded-lg text-white ${action.color} ${action.hoverColor} transition-colors mb-4`}>
                  <Icon size={24} />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{action.title}</h3>
                <p className="text-gray-600">{action.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                <div className="flex-shrink-0">
                  <Clock size={16} className="text-gray-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-sm text-gray-600">{activity.type}</p>
                </div>
                <div className="text-xs text-gray-500">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};