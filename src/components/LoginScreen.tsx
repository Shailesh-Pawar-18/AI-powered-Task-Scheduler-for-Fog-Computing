import React, { useState } from 'react';
import { Brain, Lock, LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const LoginScreen: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-xl p-8 space-y-5">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-600 rounded-lg"><Brain className="w-6 h-6" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Admin Login</h1>
            <p className="text-sm text-gray-400">AI Fog Computing Scheduler</p>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-900/20 border border-red-700/50 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span className="text-sm text-red-400">{error}</span>
          </div>
        )}

        <label className="block">
          <span className="text-sm text-gray-400">Username</span>
          <input
            type="text"
            name="username"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            className="mt-1 w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block">
          <span className="text-sm text-gray-400">Password</span>
          <div className="mt-1 relative">
            <Lock className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-9 pr-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <LogIn className="w-4 h-4" />
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
        </button>
      </form>
    </div>
  );
};
