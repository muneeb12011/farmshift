'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import MetricCard from '@/components/environmental/MetricCard';
import TrendChart from '@/components/environmental/TrendChart';
import { useFieldStore, useUIStore } from '@/store';
import { fetchEnvironmentSummary, fetchEnvironmentTimeSeries } from '@/services/api';
import { EnvironmentSummary, EnvironmentDataPoint } from '@/types';
import { MapPin, ChevronDown, Satellite, Radio, Globe } from 'lucide-react';
import { demoFarms } from '@/data/mockFarms';
import CinematicMediaStream from '@/components/ui/CinematicMediaStream';

// Dynamically import FarmMap to avoid SSR issues with MapLibre
const FarmMap = dynamic(() => import('@/components/map/FarmMap'), {
  ssr: false,
  loading: () => (
    <div
      className="w-full h-full flex items-center justify-center rounded-xl"
      style={{ background: 'var(--color-bg-secondary)', minHeight: '400px' }}
    >
      <div className="text-center">
        <div
          className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3"
          style={{ borderColor: '#063D91', borderTopColor: 'transparent' }}
        />
        <p className="text-sm" style={{ color: '#6B7F79' }}>Loading map...</p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  const selectedField = useFieldStore((s) => s.selectedField);
  const setSelectedField = useFieldStore((s) => s.setSelectedField);
  const selectedDateRange = useUIStore((s) => s.selectedDateRange);
  const setDateRange = useUIStore((s) => s.setDateRange);
  const [envSummary, setEnvSummary] = useState<EnvironmentSummary | null>(null);
  const [timeSeries, setTimeSeries] = useState<EnvironmentDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showFarmSelector, setShowFarmSelector] = useState(false);
  const [mapViewMode, setMapViewMode] = useState<'map' | 'stream'>('map');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [summary, series] = await Promise.all([
          fetchEnvironmentSummary(selectedField),
          fetchEnvironmentTimeSeries(selectedDateRange, selectedField),
        ]);
        if (cancelled) return;
        setEnvSummary(summary);
        setTimeSeries(series);
      } catch (e) {
        if (cancelled) return;
        setEnvSummary(null);
        setTimeSeries([]);
        setLoadError(e instanceof Error ? e.message : 'Failed to load environmental data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedDateRange, selectedField]);

  const handleDateRangeChange = (range: string) => {
    setDateRange(range as any);
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-primary)' }}>
      <Navbar />

      <main className="pt-20 pb-8 px-4 md:px-6 max-w-[1440px] mx-auto">
        {loadError && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-sm"
            style={{ background: 'rgba(224,108,90,0.1)', border: '1px solid rgba(224,108,90,0.3)', color: '#E06C5A' }}
          >
            {loadError}
          </div>
        )}
        {envSummary?.meta?.climate.provider === 'synthetic' && (
          <div
            className="mb-4 px-4 py-3 rounded-lg text-xs"
            style={{ background: 'rgba(231,183,91,0.08)', border: '1px solid rgba(231,183,91,0.25)', color: '#E7B75B' }}
          >
            Showing modelled demo data (live NASA data unavailable). These values are not observations.
          </div>
        )}

        {/* Top bar: Farm selector + controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="relative">
              <button
                onClick={() => setShowFarmSelector(!showFarmSelector)}
                className="flex items-center gap-2 text-lg font-semibold transition-colors"
                style={{ color: '#F5F7F2' }}
              >
                <MapPin size={18} style={{ color: '#FC3D21' }} />
                {selectedField.label}
                <ChevronDown size={16} style={{ color: '#6B7F79' }} />
              </button>

              {showFarmSelector && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute top-full left-0 mt-2 w-72 rounded-xl overflow-hidden z-20"
                  style={{
                    background: 'rgba(11, 23, 26, 0.98)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  {demoFarms.map((farm) => (
                    <button
                      key={farm.id}
                      onClick={() => {
                        setSelectedField(farm);
                        setShowFarmSelector(false);
                      }}
                      className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/[0.04]"
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        color: farm.id === selectedField.id ? '#F5F7F2' : '#9BAAA5',
                      }}
                    >
                      <MapPin size={14} style={{ color: farm.id === selectedField.id ? '#FC3D21' : '#6B7F79' }} />
                      <div>
                        <p className="text-sm font-medium">{farm.label}</p>
                        <p className="text-xs font-mono" style={{ color: '#6B7F79' }}>
                          {farm.lat.toFixed(2)}N, {farm.lon.toFixed(2)}E - {farm.area} ha
                        </p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </div>
            <p className="text-xs font-mono mt-1" style={{ color: '#6B7F79' }}>
              {selectedField.lat.toFixed(2)}N, {selectedField.lon.toFixed(2)}E - {selectedField.area} ha
            </p>
          </div>

        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map & Stream Section (2/3 width) */}
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                <button
                  onClick={() => setMapViewMode('map')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: mapViewMode === 'map' ? '#063D91' : 'transparent',
                    color: mapViewMode === 'map' ? '#FFFFFF' : '#9BAAA5',
                  }}
                >
                  <Globe size={13} />
                  <span>Interactive Satellite Map</span>
                </button>
                <button
                  onClick={() => setMapViewMode('stream')}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                  style={{
                    background: mapViewMode === 'stream' ? '#063D91' : 'transparent',
                    color: mapViewMode === 'stream' ? '#FFFFFF' : '#9BAAA5',
                  }}
                >
                  <Radio size={13} />
                  <span>Telemetry Video Stream</span>
                </button>
              </div>

              <span className="hidden sm:inline text-[11px] font-mono" style={{ color: '#6B7F79' }}>
                {mapViewMode === 'map' ? 'Esri World Imagery / USGS' : 'MODIS / Sentinel Multispectral'}
              </span>
            </div>

            {mapViewMode === 'map' ? (
              <div style={{ height: '480px' }}>
                <FarmMap />
              </div>
            ) : (
              <CinematicMediaStream initialFeedId="multispectral" />
            )}
          </div>

          {/* Environmental summary (1/3 width) */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#6B7F79' }}>
              Environmental Overview
            </h3>

            {loading ? (
              // Skeleton loaders
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-32 rounded-xl" />
              ))
            ) : envSummary ? (
              <>
                <MetricCard
                  title="Temperature"
                  value={envSummary.temperature.current}
                  unit="C"
                  change={`${envSummary.temperature.anomaly > 0 ? '+' : ''}${envSummary.temperature.anomaly}C`}
                  trend={envSummary.temperature.trend}
                  source={envSummary.temperature.source}
                  status="warning"
                  sparklineData={timeSeries.slice(-30).map((d) => d.temperatureC)}
                  delay={0}
                />
                <MetricCard
                  title="Rainfall"
                  value={envSummary.rainfall.current}
                  unit="mm"
                  change={`${envSummary.rainfall.anomalyPercent}%`}
                  trend={envSummary.rainfall.trend}
                  source={envSummary.rainfall.source}
                  status="critical"
                  sparklineData={timeSeries.slice(-30).map((d) => d.precipitationMm)}
                  delay={0.1}
                />
                <MetricCard
                  title="Soil Moisture"
                  value={envSummary.soilMoisture.current}
                  unit="%"
                  change={`${envSummary.soilMoisture.current - envSummary.soilMoisture.historical > 0 ? '+' : ''}${(envSummary.soilMoisture.current - envSummary.soilMoisture.historical).toFixed(0)}%`}
                  trend={envSummary.soilMoisture.trend}
                  source={envSummary.soilMoisture.source}
                  status="neutral"
                  sparklineData={timeSeries.slice(-30).map((d) => d.soilMoisturePercent)}
                  delay={0.2}
                />
                <MetricCard
                  title="Vegetation Condition"
                  value={envSummary.vegetation.current}
                  unit="NDVI"
                  change={`${envSummary.vegetation.current > envSummary.vegetation.historical ? '+' : '-'} from ${envSummary.vegetation.historical}`}
                  trend={envSummary.vegetation.trend}
                  source={envSummary.vegetation.source}
                  status="good"
                  sparklineData={timeSeries.slice(-30).map((d) => d.ndvi)}
                  delay={0.3}
                />
              </>
            ) : (
              <div className="card p-6 text-center">
                <p className="text-sm" style={{ color: '#6B7F79' }}>
                  No environmental data available. Select a farm to begin analysis.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Historical Trends */}
        <div className="mt-8">
          {loading ? (
            <div className="skeleton h-96 rounded-xl" />
          ) : (
            <TrendChart
              data={timeSeries}
              activeMetric="temperatureC"
              dateRange={selectedDateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          )}
        </div>

        {/* Data Source Panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-8 card p-6"
        >
          <h3 className="text-sm font-semibold uppercase tracking-wider mb-4" style={{ color: '#6B7F79' }}>
            Data Sources
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'NASA POWER', desc: 'Climate observations' },
              { name: 'SMAP', desc: 'Soil moisture' },
              { name: 'MODIS / HLS', desc: 'Vegetation' },
              { name: 'ECOSTRESS', desc: 'Evapotranspiration' },
            ].map((ds) => (
              <div key={ds.name} className="flex items-start gap-3">
                <div
                  className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ background: '#063D91' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: '#F5F7F2' }}>{ds.name}</p>
                  <p className="text-xs" style={{ color: '#6B7F79' }}>{ds.desc}</p>

                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
