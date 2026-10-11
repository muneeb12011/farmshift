'use client';

import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { RotationScenario } from '@/types';

interface ScenarioComparisonProps {
  scenarios: RotationScenario[];
  /** Metrics of continuing the current crop (from the backend). */
  baseline: RotationScenario['metrics'];
}

const metricLabels: Record<string, string> = {
  waterDemand: 'Water Demand',
  soilHealth: 'Soil Health',
  climateCompatibility: 'Climate Compat.',
  cropDiversity: 'Crop Diversity',
  nutrientPressure: 'Nutrient Pressure',
  environmentalResilience: 'Env. Resilience',
};

const scenarioColors = ['#063D91', '#65C18C', '#E7B75B'];

/* eslint-disable @typescript-eslint/no-explicit-any */
function ComparisonTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="px-3 py-2 rounded-lg text-xs"
      style={{
        background: 'rgba(11, 23, 26, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
      }}
    >
      <p className="font-medium mb-1" style={{ color: '#F5F7F2' }}>{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} style={{ color: p.color }} className="font-mono">
          {p.name}: {p.value}%
        </p>
      ))}
    </div>
  );
}

export default function ScenarioComparison({ scenarios, baseline }: ScenarioComparisonProps) {
  // Radar chart data
  const radarData = Object.keys(metricLabels).map((key) => {
    const point: Record<string, string | number> = {
      metric: metricLabels[key],
      'Current Plan': baseline[key as keyof typeof baseline],
    };
    scenarios.forEach((s, i) => {
      point[s.name.split(':')[0].trim()] = s.metrics[key as keyof typeof s.metrics];
    });
    return point;
  });

  // Bar chart data
  const barData = Object.keys(metricLabels).map((key) => {
    const point: Record<string, string | number> = {
      metric: metricLabels[key],
    };
    scenarios.forEach((s) => {
      point[s.name.split(':')[0].trim()] = s.metrics[key as keyof typeof s.metrics];
    });
    point['Current Plan'] = baseline[key as keyof typeof baseline];
    return point;
  });

  return (
    <div className="space-y-8">
      {/* Radar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-1" style={{ color: '#F5F7F2' }}>
          Scenario Comparison
        </h3>
        <p className="text-xs mb-6" style={{ color: '#6B7F79' }}>
          Relative comparison based on available inputs - Higher is generally better
        </p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="rgba(255,255,255,0.06)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fontSize: 11, fill: '#9BAAA5' }}
              />
              <Radar
                name="Current Plan"
                dataKey="Current Plan"
                stroke="#E06C5A"
                fill="#E06C5A"
                fillOpacity={0.1}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              {scenarios.map((s, i) => (
                <Radar
                  key={s.id}
                  name={s.name.split(':')[0].trim()}
                  dataKey={s.name.split(':')[0].trim()}
                  stroke={scenarioColors[i]}
                  fill={scenarioColors[i]}
                  fillOpacity={0.08}
                  strokeWidth={2}
                />
              ))}
              <Legend
                wrapperStyle={{ fontSize: '12px', color: '#9BAAA5' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Bar Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="card p-6"
      >
        <h3 className="text-lg font-semibold mb-1" style={{ color: '#F5F7F2' }}>
          Metric Breakdown
        </h3>
        <p className="text-xs mb-6" style={{ color: '#6B7F79' }}>
          Side-by-side comparison of key environmental and agronomic metrics
        </p>

        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="metric"
                tick={{ fontSize: 10, fill: '#6B7F79' }}
                stroke="rgba(255,255,255,0.06)"
                interval={0}
                angle={-20}
                textAnchor="end"
                height={60}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7F79' }}
                stroke="rgba(255,255,255,0.06)"
                domain={[0, 100]}
              />
              <Tooltip content={<ComparisonTooltip />} />
              <Bar dataKey="Current Plan" fill="#E06C5A" radius={[4, 4, 0, 0]} opacity={0.6} />
              {scenarios.map((s, i) => (
                <Bar
                  key={s.id}
                  dataKey={s.name.split(':')[0].trim()}
                  fill={scenarioColors[i]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Comparison Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="card overflow-hidden"
      >
        <div className="p-6 pb-4">
          <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
            Detailed Comparison
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th className="text-left px-6 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: '#6B7F79' }}>
                  Metric
                </th>
                <th className="text-center px-4 py-3 font-medium text-xs uppercase tracking-wider" style={{ color: '#E06C5A' }}>
                  Current Plan
                </th>
                {scenarios.map((s, i) => (
                  <th
                    key={s.id}
                    className="text-center px-4 py-3 font-medium text-xs uppercase tracking-wider"
                    style={{ color: scenarioColors[i] }}
                  >
                    {s.name.split(':')[0].trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(metricLabels).map(([key, label]) => (
                <tr
                  key={key}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-3 font-medium" style={{ color: '#9BAAA5' }}>
                    {label}
                  </td>
                  <td className="text-center px-4 py-3 font-mono" style={{ color: '#E06C5A' }}>
                    {baseline[key as keyof typeof baseline]}%
                  </td>
                  {scenarios.map((s, i) => {
                    const val = s.metrics[key as keyof typeof s.metrics];
                    const currentVal = baseline[key as keyof typeof baseline];
                    const isBetter = key === 'waterDemand' || key === 'nutrientPressure'
                      ? val < currentVal
                      : val > currentVal;
                    return (
                      <td
                        key={s.id}
                        className="text-center px-4 py-3 font-mono font-medium"
                        style={{ color: isBetter ? '#65C18C' : '#E7B75B' }}
                      >
                        {val}%
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
