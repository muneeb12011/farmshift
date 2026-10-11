'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, ChevronDown, Database, Lightbulb, Shield } from 'lucide-react';
import { RotationScenario } from '@/types';

interface AIInsightPanelProps {
  scenario: RotationScenario;
}

export default function AIInsightPanel({ scenario }: AIInsightPanelProps) {
  const [expanded, setExpanded] = useState(false);

  const whyMatters = [
    'Soil moisture is currently below historical average.',
    'Water availability is limited.',
    `${scenario.name.split(':')[1]?.trim() || 'This scenario'} addresses key priorities.`,
    'The rotation introduces crop diversity.',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="card overflow-hidden"
    >
      {/* Header */}
      <div
        className="px-6 py-4 flex items-center gap-3"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 61, 145, 0.15), rgba(78, 196, 177, 0.05))',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(6, 61, 145, 0.2)' }}
        >
          <Brain size={18} style={{ color: '#063D91' }} />
        </div>
        <div>
          <h3 className="text-sm font-semibold" style={{ color: '#F5F7F2' }}>
            FarmShift AI Insights
          </h3>
          <p className="text-xs" style={{ color: '#6B7F79' }}>
            An explanation of the available data and scenario differences.
          </p>
        </div>
      </div>

      {/* AI Explanation */}
      <div className="p-6">
        <div
          className="p-4 rounded-lg mb-5"
          style={{
            background: 'rgba(6, 61, 145, 0.05)',
            border: '1px solid rgba(6, 61, 145, 0.1)',
          }}
        >
          <p className="text-sm leading-relaxed" style={{ color: '#F5F7F2' }}>
            &ldquo;{scenario.aiExplanation}&rdquo;
          </p>
        </div>

        {/* Why This Matters */}
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={14} style={{ color: '#E7B75B' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#E7B75B' }}>
              Why This Matters
            </span>
          </div>
          <ul className="space-y-2">
            {whyMatters.map((point, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#9BAAA5' }}>
                <span
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: '#4EC4B1' }}
                />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Expandable data section */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 text-sm font-medium transition-colors w-full"
          style={{ color: '#063D91' }}
        >
          <Database size={14} />
          View Data Behind This Insight
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={14} />
          </motion.div>
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div
                className="mt-4 p-4 rounded-lg space-y-3"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.04)',
                }}
              >
                {Object.entries(scenario.metrics).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="font-medium capitalize" style={{ color: '#9BAAA5' }}>
                      {key.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="font-mono" style={{ color: '#F5F7F2' }}>
                      {value}%
                    </span>
                  </div>
                ))}
                <div className="pt-3 mt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <div className="flex flex-wrap gap-1">
                    {scenario.dataSourcesUsed.map((ds) => (
                      <span key={ds} className="data-badge">{ds}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Transparency note */}
      <div
        className="px-6 py-3 flex items-center gap-2 text-xs"
        style={{
          background: 'rgba(255,255,255,0.02)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          color: '#6B7F79',
        }}
      >
        <Shield size={12} />
        AI insights are generated from available data. They are intended to support, not replace, informed decision-making.
      </div>
    </motion.div>
  );
}
