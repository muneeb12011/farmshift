'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Satellite,
  Layers,
  Radio,
  Activity,
  Compass,
} from 'lucide-react';

interface Feed {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  sensor: string;
  res: string;
  band: string;
}

const feeds: Feed[] = [
  {
    id: 'orbit',
    title: 'NASA Earth Orbit Telemetry',
    subtitle: 'MODIS & PACE satellite Earth observation scan',
    image: '/nasa-satellite-orbit.jpg',
    sensor: 'PACE / OCI Spectrometer',
    res: '1.0 km',
    band: '340 - 890 nm',
  },
  {
    id: 'multispectral',
    title: 'Multispectral Field Index',
    subtitle: 'Harmonized Landsat-Sentinel agricultural parcel reflectance',
    image: '/satellite-spectrum.jpg',
    sensor: 'MSI / OLI-2 Multispectral',
    res: '10 - 30 m',
    band: 'Red / NIR / SWIR',
  },
  {
    id: 'crop-rotation',
    title: 'Precision Agroecosystem Canopy',
    subtitle: 'Aerial multispectral crop boundary and irrigation tracking',
    image: '/crop-rotation-landscape.jpg',
    sensor: 'Airborne Hyperspectral AVIRIS',
    res: '3.2 m',
    band: '400 - 2500 nm',
  },
  {
    id: 'soil',
    title: 'In-Situ Rootzone Telemetry',
    subtitle: 'Calibrated SMAP subsurface moisture & nutrient sensor probe',
    image: '/soil-sensor-telemetry.jpg',
    sensor: 'SMAP L-band Radar / In-Situ TDR',
    res: 'Point Telemetry',
    band: '1.41 GHz L-Band',
  },
];

export default function CinematicMediaStream({
  className = '',
  initialFeedId = 'multispectral',
}: {
  className?: string;
  initialFeedId?: string;
}) {
  const [activeFeedId, setActiveFeedId] = useState(initialFeedId);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeString, setTimeString] = useState('');

  const currentFeed = feeds.find((f) => f.id === activeFeedId) || feeds[0];

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(
        now.toISOString().replace('T', ' ').substring(0, 19) + ' UTC'
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`card overflow-hidden relative shadow-2xl ${className}`}
      style={{
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: '#071014',
      }}
    >
      {/* Viewport Canvas */}
      <div className="relative w-full h-[340px] md:h-[420px] overflow-hidden bg-black select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeed.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="absolute inset-0 w-full h-full"
          >
            <div
              className={`w-full h-full relative ${
                isPlaying ? 'animate-ken-burns' : ''
              }`}
            >
              <Image
                src={currentFeed.image}
                alt={currentFeed.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 1200px) 100vw, 1200px"
              />
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Scanline light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div
            className="w-full h-24 animate-scanline"
            style={{
              background:
                'linear-gradient(180deg, transparent, rgba(6, 61, 145, 0.15), rgba(101, 193, 140, 0.12), transparent)',
            }}
          />
        </div>

        {/* Subtle vignette */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at center, transparent 50%, rgba(7, 16, 20, 0.85) 100%)',
          }}
        />

        {/* Header HUD overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-10">
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium pointer-events-auto"
              style={{
                background: 'rgba(7, 16, 20, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(10px)',
                color: '#F5F7F2',
              }}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE SATELLITE STREAM</span>
            </div>

            <div
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono pointer-events-auto"
              style={{
                background: 'rgba(7, 16, 20, 0.75)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#9BAAA5',
              }}
            >
              <Radio size={12} style={{ color: '#063D91' }} />
              <span>{timeString}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-lg text-xs font-mono transition-all"
              style={{
                background: 'rgba(7, 16, 20, 0.85)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                color: '#F5F7F2',
                backdropFilter: 'blur(10px)',
              }}
              title={isPlaying ? 'Pause Motion' : 'Resume Motion'}
            >
              {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            </button>
          </div>
        </div>

        {/* Bottom HUD metadata */}
        <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3 pointer-events-none z-10">
          <div
            className="p-3.5 rounded-xl pointer-events-auto max-w-lg"
            style={{
              background: 'rgba(7, 16, 20, 0.88)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Satellite size={14} style={{ color: '#063D91' }} />
              <h3 className="text-sm font-semibold text-white leading-tight">
                {currentFeed.title}
              </h3>
            </div>
            <p className="text-xs mb-2.5 leading-relaxed" style={{ color: '#9BAAA5' }}>
              {currentFeed.subtitle}
            </p>
            <div className="flex items-center gap-4 text-[10px] font-mono" style={{ color: '#6B7F79' }}>
              <span>
                SENSOR: <span className="text-white">{currentFeed.sensor}</span>
              </span>
              <span>
                RES: <span className="text-emerald-400">{currentFeed.res}</span>
              </span>
              <span className="hidden md:inline">
                BAND: <span className="text-amber-300">{currentFeed.band}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Feed selector tabs */}
      <div
        className="p-3 border-t grid grid-cols-2 md:grid-cols-4 gap-2"
        style={{
          background: 'rgba(11, 23, 26, 0.95)',
          borderColor: 'rgba(255, 255, 255, 0.08)',
        }}
      >
        {feeds.map((feed) => {
          const isActive = feed.id === activeFeedId;
          return (
            <button
              key={feed.id}
              onClick={() => setActiveFeedId(feed.id)}
              className="p-2.5 rounded-xl text-left transition-all duration-200"
              style={{
                background: isActive ? 'rgba(6, 61, 145, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                border: `1px solid ${isActive ? '#063D91' : 'rgba(255, 255, 255, 0.06)'}`,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold" style={{ color: isActive ? '#F5F7F2' : '#9BAAA5' }}>
                  {feed.id === 'orbit' && 'Orbital Scan'}
                  {feed.id === 'multispectral' && 'NDVI Spectral'}
                  {feed.id === 'crop-rotation' && 'Field Canopy'}
                  {feed.id === 'soil' && 'Soil Sensor'}
                </span>
                {isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                )}
              </div>
              <p className="text-[10px] font-mono truncate" style={{ color: '#6B7F79' }}>
                {feed.sensor.split('/')[0]}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
