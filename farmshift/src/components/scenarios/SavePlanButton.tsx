'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Bookmark, Check, Loader2 } from 'lucide-react';
import type { RotationScenario } from '@/types';
import { savePlan } from '@/services/api';
import { useAuthStore } from '@/store/auth';

/** Saves the shown scenario (with the metrics the user saw) to their account. Prompts sign-in when anonymous. */
export default function SavePlanButton({ scenario }: { scenario: RotationScenario }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hydrate = useAuthStore((s) => s.hydrate);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);
  useEffect(() => {
    setState('idle');
    setError(null);
  }, [scenario.id]);

  const onClick = async () => {
    if (!user) {
      router.push('/login?next=/scenarios');
      return;
    }
    setState('saving');
    setError(null);
    try {
      await savePlan({ name: scenario.name, crops: scenario.crops, metrics: scenario.metrics, overallScore: scenario.overallScore });
      setState('saved');
    } catch (e) {
      setState('idle');
      setError(e instanceof Error ? e.message : 'Could not save plan');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={onClick}
        disabled={state === 'saving' || state === 'saved'}
        className="btn-secondary"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.5rem 1rem', fontSize: '0.85rem' }}
      >
        {state === 'saving' ? <Loader2 size={15} className="animate-spin" /> : state === 'saved' ? <Check size={15} /> : <Bookmark size={15} />}
        {state === 'saved' ? 'Saved' : user ? `Save “${scenario.name.split(':')[0]}” as a plan` : 'Sign in to save this plan'}
      </button>
      {state === 'saved' && (
        <Link href="/plans" className="text-sm" style={{ color: '#65C18C' }}>
          View my plans
        </Link>
      )}
      {error && (
        <span className="text-sm" style={{ color: '#E06C5A' }}>
          {error}
        </span>
      )}
    </div>
  );
}
