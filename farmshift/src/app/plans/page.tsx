'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Trash2 } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { deletePlan, fetchPlans, type SavedPlan } from '@/services/api';
import { useAuthStore } from '@/store/auth';

export default function PlansPage() {
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [plans, setPlans] = useState<SavedPlan[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!user) {
      setPlans(null);
      return;
    }
    let cancelled = false;
    fetchPlans().then(
      (r) => !cancelled && setPlans(r.items),
      (e: unknown) => !cancelled && setError(e instanceof Error ? e.message : 'Could not load plans'),
    );
    return () => {
      cancelled = true;
    };
  }, [user]);

  const remove = async (id: string) => {
    try {
      await deletePlan(id);
      setPlans((p) => p?.filter((x) => x.id !== id) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete plan');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />
      <main className="pt-24 pb-12 px-4 md:px-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#F5F7F2' }}>
          My Plans
        </h1>
        <p className="text-sm mb-8" style={{ color: '#9BAAA5' }}>
          Rotation plans you saved from the Scenarios page.
        </p>

        {error && (
          <p className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}>
            {error}
          </p>
        )}

        {!hydrated ? (
          <Loader2 className="animate-spin mx-auto mt-16" style={{ color: '#063D91' }} />
        ) : !user ? (
          <div className="card p-8 text-center">
            <p className="mb-4" style={{ color: '#9BAAA5' }}>
              Sign in to see your saved plans.
            </p>
            <Link href="/login?next=/plans" className="btn-primary no-underline">
              Sign in
            </Link>
          </div>
        ) : plans === null ? (
          <Loader2 className="animate-spin mx-auto mt-16" style={{ color: '#063D91' }} />
        ) : plans.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="mb-4" style={{ color: '#9BAAA5' }}>
              No saved plans yet. Open a scenario and choose “Save as a plan”.
            </p>
            <Link href="/scenarios" className="btn-primary no-underline">
              Go to Scenarios
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {plans.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="card p-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-semibold" style={{ color: '#F5F7F2' }}>
                    {p.name}
                  </h2>
                  <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
                    {p.crops.join(' → ')}
                  </p>
                  <p className="text-xs mt-2 font-mono" style={{ color: '#6B7F79' }}>
                    {p.overallScore !== null ? `Score ${p.overallScore}/100 · ` : ''}Saved {new Date(p.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <button onClick={() => void remove(p.id)} aria-label={`Delete ${p.name}`} className="p-2 rounded-lg" style={{ color: '#E06C5A', background: 'transparent', cursor: 'pointer' }}>
                  <Trash2 size={16} />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
