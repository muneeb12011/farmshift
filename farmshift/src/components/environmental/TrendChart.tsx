'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { EnvironmentDataPoint } from '@/types';

interface TrendChartProps {
  data: EnvironmentDataPoint[];
  activeMetric: string;
  dateRange: string;
  onDateRangeChange: (range: string) => void;
}

const metricTabs = [
  { key: 'temperatureC', label: 'Temperature', unit: 'C', color: '#E7B75B' },
  { key: 'precipitationMm', label: 'Rainfall', unit: 'mm', color: '#063D91' },
  { key: 'soilMoisturePercent', label: 'Soil Moisture', unit: '%', color: '#4EC4B1' },
  { key: 'ndvi', label: 'Vegetation', unit: 'NDVI', color: '#65C18C' },
];

const dateRanges = ['30d', '6m', '1y', '5y'];

/* eslint-disable @typescript-eslint/no-explicit-any */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="px-3 py-2 rounded-lg text-xs shadow-lg"
      style={{
        background: 'rgba(11, 23, 26, 0.95)',
        border: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <p className="font-mono mb-1" style={{ color: '#6B7F79' }}>
        {label}
      </p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="font-mono font-medium" style={{ color: p.color }}>
          {p.value}
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ data, dateRange, onDateRangeChange }: TrendChartProps) {
  const [activeTab, setActiveTab] = useState(metricTabs[0]);

  // Format x-axis labels based on date range
  const formatXAxis = (date: string) => {
    const d = new Date(date);
    if (dateRange === '30d') return d.toLocaleDateString('en', { day: 'numeric', month: 'short' });
    if (dateRange === '6m') return d.toLocaleDateString('en', { month: 'short' });
    return d.toLocaleDateString('en', { month: 'short', year: '2-digit' });
  };

  // Thin out data points for chart performance
  const chartData = data.filter((_, i) => {
    if (dateRange === '30d') return true;
    if (dateRange === '6m') return i % 3 === 0;
    if (dateRange === '1y') return i % 5 === 0;
    return i % 15 === 0;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="card p-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: '#F5F7F2' }}>
            Historical Trends
          </h3>
          <p className="text-xs mt-1" style={{ color: '#6B7F79' }}>
            Environmental data over time
          </p>
        </div>

        {/* Date range selector */}
        <div
          className="flex rounded-lg overflow-hidden"
          style={{ border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {dateRanges.map((range) => (
            <button
              key={range}
              onClick={() => onDateRangeChange(range)}
              className="px-3 py-1.5 text-xs font-medium transition-all"
              style={{
                background: dateRange === range ? 'rgba(6, 61, 145, 0.2)' : 'transparent',
                color: dateRange === range ? '#F5F7F2' : '#6B7F79',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Metric tabs */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
        {metricTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
            style={{
              background: activeTab.key === tab.key ? `${tab.color}15` : 'transparent',
              color: activeTab.key === tab.key ? tab.color : '#6B7F79',
              border:
                activeTab.key === tab.key
                  ? `1px solid ${tab.color}30`
                  : '1px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={activeTab.color} stopOpacity={0.2} />
                <stop offset="100%" stopColor={activeTab.color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.04)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatXAxis}
              tick={{ fontSize: 11 }}
              stroke="rgba(255,255,255,0.06)"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11 }}
              stroke="rgba(255,255,255,0.06)"
              domain={['auto', 'auto']}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey={activeTab.key}
              stroke={activeTab.color}
              fill="url(#chartGrad)"
              strokeWidth={2}
              dot={false}
              activeDot={{
                r: 4,
                stroke: activeTab.color,
                fill: '#071014',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
