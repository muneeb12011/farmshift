'use client';

import { motion } from 'framer-motion';
import { ArrowRight, Droplets, Leaf, Sun, Layers, Check, AlertTriangle } from 'lucide-react';
import { RotationScenario } from '@/types';
import { getCropByName } from '@/data/mockCropCatalog';
import CropIcon from '@/components/ui/CropIcon';

interface ScenarioCardProps {
  scenario: RotationScenario;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  delay?: number;
}

export default function ScenarioCard({
  scenario,
  isSelected = false,
  onSelect,
  delay = 0,
}: ScenarioCardProps) {
  const metricBars = [
    { label: 'Water Demand', value: scenario.metrics.waterDemand, icon: Droplets, color: '#063D91', inverted: true },
    { label: 'Soil Health', value: scenario.metrics.soilHealth, icon: Leaf, color: '#65C18C' },
    { label: 'Climate Compat.', value: scenario.metrics.climateCompatibility, icon: Sun, color: '#E7B75B' },
    { label: 'Resilience', value: scenario.metrics.environmentalResilience, icon: Layers, color: '#4EC4B1' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="card relative overflow-hidden cursor-pointer"
      style={{
        borderColor: isSelected ? '#063D91' : undefined,
        boxShadow: isSelected ? '0 0 30px rgba(6, 61, 145, 0.2)' : undefined,
      }}
      onClick={() => onSelect?.(scenario.id)}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div
          className="absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: '#063D91' }}
        >
          <Check size={14} color="white" />
        </div>
      )}

      <div className="p-6">
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#6B7F79' }}>
              Scenario Overview
            </span>
          </div>
          <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
            {scenario.name}
          </h3>
          <p className="text-sm mt-1" style={{ color: '#9BAAA5' }}>
            {scenario.description}
          </p>
        </div>

        {/* Crop sequence */}
        <div className="flex items-center gap-2 mb-5 flex-wrap">
          {scenario.crops.map((cropName, idx) => {
            const crop = getCropByName(cropName);
            return (
              <div key={cropName} className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2"
                  style={{
                    background: `${crop?.color || '#4EC4B1'}15`,
                    border: `1px solid ${crop?.color || '#4EC4B1'}30`,
                    color: crop?.color || '#4EC4B1',
                  }}
                >
                  <CropIcon name={cropName} icon={crop?.icon} color={crop?.color} size={15} />
                  <span>{cropName}</span>
                </div>
                {idx < scenario.crops.length - 1 && (
                  <ArrowRight size={14} style={{ color: '#6B7F79' }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Metrics */}
        <div className="space-y-3 mb-5">
          {metricBars.map((metric) => (
            <div key={metric.label}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <metric.icon size={13} style={{ color: metric.color }} />
                  <span className="text-xs font-medium" style={{ color: '#9BAAA5' }}>
                    {metric.label}
                  </span>
                </div>
                <span className="text-xs font-mono font-medium" style={{ color: '#F5F7F2' }}>
                  {metric.inverted ? `${100 - metric.value}%` : `${metric.value}%`}
                </span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${metric.inverted ? 100 - metric.value : metric.value}%` }}
                  transition={{ duration: 0.8, delay: delay + 0.3 }}
                  className="h-full rounded-full"
                  style={{ background: metric.color }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {scenario.tags.map((tag) => (
            <span key={tag} className="data-badge-green text-xs px-2 py-0.5 rounded font-mono" style={{ fontSize: '0.65rem' }}>
              {tag}
            </span>
          ))}
        </div>

        {/* Trade-offs preview */}
        <div className="pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="space-y-1.5">
            {scenario.tradeoffs.advantages.slice(0, 2).map((adv, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#65C18C' }}>
                <Check size={12} className="mt-0.5 shrink-0" />
                {adv}
              </div>
            ))}
            {scenario.tradeoffs.disadvantages.slice(0, 1).map((dis, i) => (
              <div key={i} className="flex items-start gap-2 text-xs" style={{ color: '#E7B75B' }}>
                <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                {dis}
              </div>
            ))}
          </div>
        </div>

        {/* Data sources */}
        <div className="mt-4 pt-3 flex flex-wrap gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {scenario.dataSourcesUsed.map((ds) => (
            <span key={ds} className="data-badge">
              {ds}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
