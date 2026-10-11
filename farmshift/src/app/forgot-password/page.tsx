'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { requestPasswordReset } from '@/services/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true); // same message whether or not the account exists
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
          <h1 className="text-2xl font-bold mb-1" style={{ color: '#F5F7F2' }}>
            Reset your password
          </h1>
          {sent ? (
            <>
              <p className="text-sm my-6" style={{ color: '#9BAAA5' }}>
                If an account exists for <strong style={{ color: '#F5F7F2' }}>{email}</strong>, we have emailed a reset link. It works once and expires in an hour. Check your spam folder if it does not arrive.
              </p>
              <Link href="/login" className="btn-primary no-underline justify-center w-full">
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm mb-6" style={{ color: '#9BAAA5' }}>
                Enter your account email and we will send you a link to choose a new password.
              </p>
              <form onSubmit={submit} className="space-y-4">
                <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
                {error && (
                  <p className="text-sm px-3 py-2 rounded-lg" style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}>
                    {error}
                  </p>
                )}
                <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
                  {busy && <Loader2 size={16} className="animate-spin" />}
                  Send reset link
                </button>
              </form>
              <Link href="/login" className="mt-5 block text-sm text-center no-underline" style={{ color: '#9BAAA5' }}>
                Back to sign in
              </Link>
            </>
          )}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
