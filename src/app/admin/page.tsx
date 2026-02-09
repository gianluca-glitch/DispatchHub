'use client';

import { useState } from 'react';
import { AdminLogs } from '@/components/admin/admin-logs';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setAuthenticated(true);
      } else {
        const json = await res.json();
        setError(json.error ?? 'Invalid password');
      }
    } catch {
      setError('Connection failed');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
        <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4">
          <div className="text-center">
            <div className="w-10 h-10 bg-amber rounded flex items-center justify-center mx-auto mb-3">
              <span className="text-black font-bold font-mono text-sm">DH</span>
            </div>
            <h1 className="text-text-0 text-lg font-semibold">Admin Access</h1>
            <p className="text-text-3 text-sm mt-1">Enter password to view activity logs</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full h-11 px-3 rounded bg-surface-1 border border-border text-text-0 text-sm placeholder:text-text-3 focus:outline-none focus:border-amber"
            autoFocus
          />
          {error && <p className="text-danger text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded bg-amber text-black font-medium text-sm hover:bg-amber/90 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0">
      <header className="bg-surface-0 border-b border-border px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-amber rounded flex items-center justify-center">
          <span className="text-black font-bold font-mono text-sm">DH</span>
        </div>
        <h1 className="text-text-0 font-semibold">Activity Monitor</h1>
      </header>
      <AdminLogs />
    </div>
  );
}
