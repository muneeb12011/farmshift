'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { loginAccount, registerAccount } from '@/services/api';
import { useAuthStore } from '@/store/auth';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const user =
        mode === 'login' ? await loginAccount({ email, password }) : await registerAccount({ email, password, name: name.trim() || email.split('@')[0] });
      setUser(user);
      // Only follow same-site relative paths from ?next= (no open redirect).
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && /^\/[^/\\]/.test(next) ? next : '/plans');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />
      <main className="pt-28 pb-16 px-4 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#F5F7F2' }}>
            {mode === 'login' ? 'Sign in' : 'Create an account'}
          </h1>
          <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
            Optional. Everything works without an account; signing in lets you save rotation plans.
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} />
            )}
            <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            <input
              className="input"
              type="password"
              placeholder={mode === 'register' ? 'Password (8+ characters)' : 'Password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {error && (
              <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}>
                {error}
              </p>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              {busy && <Loader2 size={16} className="animate-spin" />}
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {mode === 'login' && (
            <Link href="/forgot-password" className="mt-4 block text-sm text-center no-underline" style={{ color: '#9BAAA5' }}>
              Forgot your password?
            </Link>
          )}

          <button
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="mt-5 text-sm w-full text-center"
            style={{ color: '#9BAAA5', background: 'transparent', cursor: 'pointer' }}
          >
            {mode === 'login' ? 'No account yet? Create one' : 'Already have an account? Sign in'}
          </button>
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
