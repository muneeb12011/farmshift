'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { resetPassword, setSessionHint } from '@/services/api';

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the token from the URL on the client (avoids a Suspense boundary) and remove it from the address bar.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token');
    setToken(t ?? '');
    if (t) window.history.replaceState(null, '', '/reset-password');
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('The two passwords do not match.');
    setBusy(true);
    try {
      await resetPassword(token!, password);
      setSessionHint(false); // the reset signed out every session, including this browser's
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />
      <main className="pt-28 pb-16 px-4 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="card p-8">
          <h1 className="text-2xl font-bold mb-4" style={{ color: '#F5F7F2' }}>
            Choose a new password
          </h1>
          {token === null ? (
            <Loader2 className="animate-spin mx-auto" style={{ color: '#063D91' }} />
          ) : done ? (
            <>
              <p className="text-sm mb-6" style={{ color: '#65C18C' }}>
                Your password has been changed and you have been signed out everywhere.
              </p>
              <Link href="/login" className="btn-primary no-underline justify-center w-full">
                Sign in
              </Link>
            </>
          ) : !token ? (
            <>
              <p className="text-sm mb-6" style={{ color: '#E06C5A' }}>
                This reset link is incomplete. Request a new one.
              </p>
              <Link href="/forgot-password" className="btn-primary no-underline justify-center w-full">
                Request a new link
              </Link>
            </>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <input className="input" type="password" placeholder="New password (8+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
              <input className="input" type="password" placeholder="Repeat new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              {error && (
                <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}>
                  {error}{' '}
                  {/expired|invalid/.test(error) && (
                    <Link href="/forgot-password" style={{ color: '#E7B75B' }}>
                      Request a new link
                    </Link>
                  )}
                </p>
              )}
              <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
                {busy && <Loader2 size={16} className="animate-spin" />}
                Change password
              </button>
            </form>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
