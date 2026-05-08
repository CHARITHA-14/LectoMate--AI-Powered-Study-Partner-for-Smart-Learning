import React, { useState, useRef } from 'react';
import { useUser } from '../context/UserContext';
import {
  Mail, Calendar, BookOpen, Brain, ClipboardCheck,
  Award, TrendingUp, Settings, Edit3, Camera,
  X, Eye, EyeOff, Check, Loader2,
} from 'lucide-react';

const API = 'http://localhost:3001/api';

export const StudentProfile: React.FC = () => {
  const { user, notes, flashcards, quizzes, loadUserData } = useUser();

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName]       = useState(user?.name || '');
  const [nameLoading, setNameLoading]     = useState(false);
  const [nameError, setNameError]         = useState('');

  const avatarInputRef                    = useRef<HTMLInputElement>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError]     = useState('');

  const [showSettings, setShowSettings]   = useState(false);
  const [settingsName, setSettingsName]   = useState(user?.name || '');
  const [currentPw, setCurrentPw]         = useState('');
  const [newPw, setNewPw]                 = useState('');
  const [confirmPw, setConfirmPw]         = useState('');
  const [showCurPw, setShowCurPw]         = useState(false);
  const [showNewPw, setShowNewPw]         = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');
  const [settingsError, setSettingsError]     = useState('');

  if (!user) return null;

  const tok = () => localStorage.getItem('lectomate_token') || '';

  const totalFlashcardsStudied = flashcards.reduce((s, c) => s + c.totalReviews, 0);
  const totalQuizAttempts      = quizzes.reduce((s, q) => s + q.attempts.length, 0);
  const averageQuizScore       = quizzes.length > 0
    ? Math.round(quizzes.reduce((s, q) => {
        const avg = q.attempts.length > 0
          ? q.attempts.reduce((a, att) => a + att.score, 0) / q.attempts.length : 0;
        return s + avg;
      }, 0) / quizzes.length)
    : 0;

  const recentActivity = [
    ...notes.slice(0, 3).map(n => ({ type: 'document', title: n.title, date: n.uploadDate, action: 'Uploaded document' })),
    ...quizzes.slice(0, 2).map(q => ({
      type: 'quiz', title: q.title,
      date: q.attempts[q.attempts.length - 1]?.completedAt || q.createdAt,
      action: q.attempts.length > 0 ? 'Completed quiz' : 'Created quiz',
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  // Avatar upload
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError('Image must be under 5 MB.'); return; }
    setAvatarLoading(true); setAvatarError('');
    const form = new FormData();
    form.append('avatar', file);
    try {
      const res  = await fetch(`${API}/user/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${tok()}` }, body: form });
      const data = await res.json();
      if (data.success) { await loadUserData(); }
      else { setAvatarError(data.error || 'Upload failed.'); }
    } catch { setAvatarError('Network error.'); }
    finally { setAvatarLoading(false); e.target.value = ''; }
  };

  // Inline name save
  const handleSaveName = async () => {
    if (!editedName.trim()) { setNameError('Name cannot be empty.'); return; }
    setNameLoading(true); setNameError('');
    try {
      const res  = await fetch(`${API}/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
        body: JSON.stringify({ name: editedName.trim() }),
      });
      const data = await res.json();
      if (data.success) { await loadUserData(); setIsEditingName(false); }
      else { setNameError(data.error || 'Failed to update.'); }
    } catch { setNameError('Network error.'); }
    finally { setNameLoading(false); }
  };

  // Settings modal save
  const handleSettingsSave = async () => {
    setSettingsError(''); setSettingsSuccess('');
    if (!settingsName.trim()) { setSettingsError('Name cannot be empty.'); return; }
    if (newPw && newPw.length < 6) { setSettingsError('New password must be at least 6 characters.'); return; }
    if (newPw && newPw !== confirmPw) { setSettingsError('Passwords do not match.'); return; }
    if (newPw && !currentPw) { setSettingsError('Enter your current password to change it.'); return; }
    setSettingsLoading(true);
    try {
      if (settingsName.trim() !== user.name) {
        const res  = await fetch(`${API}/user/profile`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ name: settingsName.trim() }),
        });
        const data = await res.json();
        if (!data.success) { setSettingsError(data.error || 'Failed to update name.'); setSettingsLoading(false); return; }
      }
      if (newPw) {
        const res  = await fetch(`${API}/user/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok()}` },
          body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
        });
        const data = await res.json();
        if (!data.success) { setSettingsError(data.error || 'Failed to update password.'); setSettingsLoading(false); return; }
      }
      await loadUserData();
      setSettingsSuccess('Settings saved successfully!');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch { setSettingsError('Network error. Please try again.'); }
    finally { setSettingsLoading(false); }
  };

  const openSettings = () => {
    setSettingsName(user.name);
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setSettingsError(''); setSettingsSuccess('');
    setShowSettings(true);
  };

  const avatarSrc = user.avatar ? `http://localhost:3001${user.avatar}` : null;
  const initials  = user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Student Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 dark:text-gray-500">Manage your account and track your learning progress.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Profile card */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center mb-6">

              {/* Avatar */}
              <div className="relative inline-block mb-4">
                {avatarSrc ? (
                  <img src={avatarSrc} alt={user.name}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-md" />
                ) : (
                  <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-teal-500 rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-md">
                    {initials}
                  </div>
                )}
                <button
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarLoading}
                  className="absolute bottom-0 right-0 w-8 h-8 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title="Upload profile photo"
                >
                  {avatarLoading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                </button>
                <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              {avatarError && <p className="text-xs text-red-500 mb-2">{avatarError}</p>}

              {/* Name */}
              {isEditingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveName()}
                    className="text-lg font-bold text-gray-900 dark:text-white text-center border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 w-full focus:ring-2 focus:ring-blue-500 outline-none"
                    autoFocus
                  />
                  {nameError && <p className="text-xs text-red-500">{nameError}</p>}
                  <div className="flex justify-center gap-2">
                    <button onClick={handleSaveName} disabled={nameLoading}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1">
                      {nameLoading ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Save
                    </button>
                    <button onClick={() => { setEditedName(user.name); setIsEditingName(false); setNameError(''); }}
                      className="px-3 py-1 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-50 dark:bg-gray-950 transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
                    <button onClick={() => { setEditedName(user.name); setIsEditingName(true); }}
                      className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500 transition-colors">
                      <Edit3 size={15} />
                    </button>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 dark:text-gray-500 text-sm">{user.email}</p>
                </div>
              )}
            </div>

            {/* Info rows */}
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400 dark:text-gray-500">
              <div className="flex items-center gap-3"><Mail size={15} /><span>{user.email}</span></div>
              <div className="flex items-center gap-3"><Calendar size={15} /><span>Joined {user.joinDate.toLocaleDateString()}</span></div>
              <div className="flex items-center gap-3"><TrendingUp size={15} /><span>{user.studyStreak} day study streak</span></div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={openSettings}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium"
              >
                <Settings size={16} /> Account Settings
              </button>
            </div>
          </div>
        </div>

        {/* Stats + Activity */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <BookOpen size={22} className="text-blue-600" />, value: notes.length, label: 'Documents' },
              { icon: <Brain size={22} className="text-purple-600" />, value: flashcards.length, label: 'Flashcards' },
              { icon: <ClipboardCheck size={22} className="text-orange-600" />, value: totalQuizAttempts, label: 'Quiz Attempts' },
              { icon: <Award size={22} className="text-green-600" />, value: `${averageQuizScore}%`, label: 'Avg Score' },
            ].map((stat, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <div className="flex justify-center mb-2">{stat.icon}</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Learning Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Study Activity</h4>
                <div className="space-y-2.5 text-sm">
                  {[
                    ['Total Flashcards Studied', totalFlashcardsStudied],
                    ['Documents Uploaded', notes.length],
                    ['Quizzes Completed', totalQuizAttempts],
                  ].map(([label, val]) => (
                    <div key={label as string} className="flex justify-between items-center">
                      <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Performance</h4>
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Average Quiz Score</span>
                    <span className="font-semibold text-green-600">{averageQuizScore}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Study Streak</span>
                    <span className="font-semibold text-blue-600">{user.studyStreak} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">Total Flashcards</span>
                    <span className="font-semibold text-purple-600">{flashcards.length}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Recent Activity</h3>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">No activity yet. Start by uploading a document!</p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((activity, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 hover:bg-gray-50 dark:bg-gray-950 rounded-lg transition-colors">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${activity.type === 'document' ? 'bg-blue-100' : 'bg-orange-100'}`}>
                      {activity.type === 'document'
                        ? <BookOpen size={15} className="text-blue-600" />
                        : <ClipboardCheck size={15} className="text-orange-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{activity.action}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500 truncate">{activity.title}</p>
                    </div>
                    <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{activity.date.toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Account Settings Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings size={18} className="text-gray-600 dark:text-gray-400 dark:text-gray-500" /> Account Settings
              </h2>
              <button onClick={() => setShowSettings(false)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Display name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Display Name</label>
                <input
                  type="text"
                  value={settingsName}
                  onChange={e => setSettingsName(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="Your name"
                />
              </div>

              {/* Email (read-only) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  className="w-full px-3 py-2.5 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-gray-50 dark:bg-gray-950 text-gray-500 dark:text-gray-400 dark:text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Email cannot be changed.</p>
              </div>

              {/* Divider */}
              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Change Password <span className="text-xs font-normal text-gray-400 dark:text-gray-500">(leave blank to keep current)</span></p>

                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type={showCurPw ? 'text' : 'password'}
                      value={currentPw}
                      onChange={e => setCurrentPw(e.target.value)}
                      placeholder="Current password"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button type="button" onClick={() => setShowCurPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      {showCurPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPw ? 'text' : 'password'}
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="New password (min 6 chars)"
                      className="w-full px-3 py-2.5 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:text-gray-400 dark:text-gray-500">
                      {showNewPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  <input
                    type="password"
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="Confirm new password"
                    className="w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Feedback */}
              {settingsError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <span className="mt-0.5 flex-shrink-0">âš </span><span>{settingsError}</span>
                </div>
              )}
              {settingsSuccess && (
                <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                  <Check size={15} className="flex-shrink-0" /><span>{settingsSuccess}</span>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={() => setShowSettings(false)}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-950 transition-colors text-sm font-medium">
                Cancel
              </button>
              <button onClick={handleSettingsSave} disabled={settingsLoading}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {settingsLoading ? <><Loader2 size={14} className="animate-spin" /> Savingâ€¦</> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
