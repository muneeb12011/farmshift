'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ScenarioCard from '@/components/scenarios/ScenarioCard';
import ScenarioComparison from '@/components/scenarios/ScenarioComparison';
import AIInsightPanel from '@/components/ai/AIInsightPanel';
import { useScenarioStore } from '@/store';
import { fetchScenarioRun, type ScenarioRun } from '@/services/api';
import { useScenarioRequest } from '@/hooks/useScenarioRequest';
import SavePlanButton from '@/components/scenarios/SavePlanButton';
import {
  BarChart3,
  GitBranch,
  Brain,
  ArrowLeftRight,
  Check,
  AlertTriangle,
  Plus,
  Minus,
  Loader2,
} from 'lucide-react';

type ViewMode = 'scenarios' | 'comparison' | 'tradeoffs' | 'insights';

export default function ScenariosPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('scenarios');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null);
  const selectedScenarios = useScenarioStore((s) => s.selectedScenarios);
  const toggleScenario = useScenarioStore((s) => s.toggleScenario);

  const request = useScenarioRequest();
  const [run, setRun] = useState<ScenarioRun | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setRun(null);
    setError(null);
    fetchScenarioRun(request).then(
      (r) => {
        if (!cancelled) setRun(r);
      },
      (e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to generate scenarios');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [request]);

  const scenarios = run?.scenarios ?? [];
  const selectedScenario = selectedScenarioId
    ? scenarios.find((s) => s.id === selectedScenarioId)
    : (scenarios[1] ?? scenarios[0]); // Default to Scenario B

  const views = [
    { id: 'scenarios' as ViewMode, label: 'Scenarios', icon: GitBranch },
    { id: 'comparison' as ViewMode, label: 'Comparison', icon: BarChart3 },
    { id: 'tradeoffs' as ViewMode, label: 'Trade-offs', icon: ArrowLeftRight },
    { id: 'insights' as ViewMode, label: 'AI Insights', icon: Brain },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-12 px-4 md:px-6 max-w-[1280px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="text-2xl font-bold" style={{ color: '#F5F7F2' }}>
            Crop Rotation Scenarios
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
            Explore, compare, and understand potential crop-rotation strategies for your field.
          </p>
        </motion.div>

        {/* View tabs */}
        <div
          className="flex gap-1 mb-8 p-1 rounded-xl w-fit"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          {views.map((view) => {
            const Icon = view.icon;
            return (
              <button
                key={view.id}
                onClick={() => setViewMode(view.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: viewMode === view.id ? 'rgba(6, 61, 145, 0.15)' : 'transparent',
                  color: viewMode === view.id ? '#F5F7F2' : '#6B7F79',
                }}
              >
                <Icon size={15} />
                {view.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}
          >
            {error}
          </div>
        )}
        {!run && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Loader2 size={36} className="animate-spin" style={{ color: '#063D91' }} />
            <p className="text-sm" style={{ color: '#9BAAA5' }}>
              Analysing your field and building scenarios...
            </p>
          </div>
        )}
        {run?.environment.meta?.climate.provider === 'synthetic' && (
          <div
            className="mb-6 px-4 py-3 rounded-lg text-xs"
            style={{ background: 'rgba(231,183,91,0.08)', border: '1px solid rgba(231,183,91,0.25)', color: '#E7B75B' }}
          >
            Scenarios were computed from modelled demo climate (live NASA data unavailable), not observations.
          </div>
        )}

        {run && selectedScenario && (
          <div className="mb-6">
            <SavePlanButton scenario={selectedScenario} />
          </div>
        )}

        {/* SCENARIOS VIEW */}
        {viewMode === 'scenarios' && run && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenarios.map((scenario, i) => (
              <ScenarioCard
                key={scenario.id}
                scenario={scenario}
                isSelected={selectedScenarios.includes(scenario.id)}
                onSelect={(id) => {
                  toggleScenario(id);
                  setSelectedScenarioId(id);
                }}
                delay={i * 0.15}
              />
            ))}
          </div>
        )}

        {/* COMPARISON VIEW */}
        {viewMode === 'comparison' && run && (
          <ScenarioComparison scenarios={scenarios} baseline={run.baseline.metrics} />
        )}

        {/* TRADE-OFFS VIEW */}
        {viewMode === 'tradeoffs' && run && (
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h2 className="text-xl font-semibold" style={{ color: '#F5F7F2' }}>
                Understand the Trade-offs
              </h2>
              <p className="text-sm mt-2 max-w-lg mx-auto" style={{ color: '#9BAAA5' }}>
                Every rotation strategy involves trade-offs. Understanding them helps make informed decisions.
              </p>
            </motion.div>

            {scenarios.map((scenario, i) => (
              <motion.div
                key={scenario.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.15 }}
                className="card p-6"
              >
                <div className="flex items-start gap-4 mb-5">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-sm font-bold"
                    style={{
                      background: 'rgba(6, 61, 145, 0.15)',
                      color: '#063D91',
                    }}
                  >
                    {String.fromCharCode(65 + i)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold" style={{ color: '#F5F7F2' }}>
                      {scenario.name}
                    </h3>
                    <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
                      {scenario.crops.join(' > ')}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Advantages */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(101, 193, 140, 0.04)',
                      border: '1px solid rgba(101, 193, 140, 0.1)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Plus size={14} style={{ color: '#65C18C' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#65C18C' }}>
                        Advantages
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {scenario.tradeoffs.advantages.map((adv, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#9BAAA5' }}>
                          <Check size={13} className="mt-0.5 shrink-0" style={{ color: '#65C18C' }} />
                          {adv}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Disadvantages */}
                  <div
                    className="p-4 rounded-xl"
                    style={{
                      background: 'rgba(231, 183, 91, 0.04)',
                      border: '1px solid rgba(231, 183, 91, 0.1)',
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Minus size={14} style={{ color: '#E7B75B' }} />
                      <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E7B75B' }}>
                        Potential Trade-offs
                      </span>
                    </div>
                    <ul className="space-y-2">
                      {scenario.tradeoffs.disadvantages.map((dis, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm" style={{ color: '#9BAAA5' }}>
                          <AlertTriangle size={13} className="mt-0.5 shrink-0" style={{ color: '#E7B75B' }} />
                          {dis}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {scenario.tags.map((tag) => (
                    <span key={tag} className="data-badge-green">{tag}</span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* AI INSIGHTS VIEW */}
        {viewMode === 'insights' && run && (
          <div className="max-w-2xl mx-auto space-y-6">
            {/* Scenario selector for insights */}
            <div className="flex gap-2 mb-4">
              {scenarios.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedScenarioId(s.id)}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: selectedScenario?.id === s.id ? 'rgba(6, 61, 145, 0.15)' : 'transparent',
                    color: selectedScenario?.id === s.id ? '#F5F7F2' : '#6B7F79',
                    border: `1px solid ${
                      selectedScenario?.id === s.id ? 'rgba(6, 61, 145, 0.3)' : 'rgba(255,255,255,0.06)'
                    }`,
                  }}
                >
                  Scenario {String.fromCharCode(65 + i)}
                </button>
              ))}
            </div>

            {/* Animated Multispectral Satellite Visual */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl overflow-hidden card relative shadow-xl"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <div className="relative w-full h-[180px] sm:h-[220px] overflow-hidden">
                <div className="w-full h-full relative animate-ken-burns">
                  <Image
                    src="/satellite-spectrum.jpg"
                    alt="Multispectral NDVI false-color satellite observation showing vegetation index grids"
                    fill
                    priority
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 1024px"
                  />
                </div>
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      'linear-gradient(to top, rgba(7, 16, 20, 0.95) 0%, rgba(7, 16, 20, 0.25) 60%, transparent 100%)',
                  }}
                />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400">
                      NASA Harmonized Landsat-Sentinel (HLS)
                    </span>
                    <p className="text-sm font-semibold text-white">
                      Multispectral Phenology &amp; Canopy Calibration
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-xs font-mono" style={{ color: '#9BAAA5' }}>
                    <span className="px-2 py-1 rounded bg-black/50 border border-white/10 text-white">
                      NDVI: 0.64
                    </span>
                    <span className="px-2 py-1 rounded bg-black/50 border border-white/10 text-emerald-400">
                      OPTIMAL CANOPY
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>

            {selectedScenario && <AIInsightPanel scenario={selectedScenario} />}

            {/* About These Insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="card p-6"
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#6B7F79' }}>
                About These Insights
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Observed Data', detail: 'NASA Earth observations', color: '#063D91' },
                  { label: 'User Data', detail: 'Soil and farm information', color: '#4EC4B1' },
                  { label: 'Derived Indicators', detail: 'Calculated environmental metrics', color: '#E7B75B' },
                  { label: 'Scenario Analysis', detail: 'Relative comparison based on available inputs', color: '#65C18C' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: item.color }}
                    />
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#F5F7F2' }}>{item.label}</p>
                      <p className="text-xs" style={{ color: '#6B7F79' }}>{item.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
