'use client';

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: string;
  changeLabel?: string;
  trend?: 'increasing' | 'decreasing' | 'stable';
  source: string;
  status?: 'good' | 'warning' | 'critical' | 'neutral';
  sparklineData?: number[];
  delay?: number;
}

export default function MetricCard({
  title,
  value,
  unit = '',
  change,
  changeLabel = 'vs historical baseline',
  trend = 'stable',
  source,
  status = 'neutral',
  sparklineData,
  delay = 0,
}: MetricCardProps) {
  const trendIcon = {
    increasing: <TrendingUp size={14} />,
    decreasing: <TrendingDown size={14} />,
    stable: <Minus size={14} />,
  };

  const statusColors = {
    good: '#65C18C',
    warning: '#E7B75B',
    critical: '#E06C5A',
    neutral: '#4EC4B1',
  };

  const trendColors = {
    increasing: '#E7B75B',
    decreasing: '#E06C5A',
    stable: '#65C18C',
  };

  const sparkData = sparklineData?.map((v, i) => ({ v, i })) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="card p-5 relative overflow-hidden group"
    >
      {/* Status indicator */}
      <div
        className="absolute top-0 left-0 w-full h-0.5"
        style={{ background: statusColors[status] }}
      />

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#6B7F79' }}>
          {title}
        </span>
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
          style={{ color: '#6B7F79' }}
          title={`Source: ${source}`}
        >
          <Info size={14} />
        </button>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-bold font-mono tracking-tight" style={{ color: '#F5F7F2' }}>
          {value}
        </span>
        {unit && (
          <span className="text-sm font-mono" style={{ color: '#9BAAA5' }}>
            {unit}
          </span>
        )}
      </div>

      {/* Change */}
      {change && (
        <div className="flex items-center gap-2 mb-3">
          <div
            className="flex items-center gap-1 text-xs font-mono font-medium px-2 py-0.5 rounded-full"
            style={{
              color: trendColors[trend],
              background: `${trendColors[trend]}15`,
            }}
          >
            {trendIcon[trend]}
            {change}
          </div>
          <span className="text-xs" style={{ color: '#6B7F79' }}>
            {changeLabel}
          </span>
        </div>
      )}

      {/* Sparkline */}
      {sparkData.length > 0 && (
        <div className="mt-2 h-10 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`sparkGrad-${title}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={statusColors[status]} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={statusColors[status]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={statusColors[status]}
                fill={`url(#sparkGrad-${title})`}
                strokeWidth={1.5}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Source badge */}
      <div className="mt-3 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <span className="data-badge">{source}</span>
      </div>
    </motion.div>
  );
}
