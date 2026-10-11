'use client';

import React from 'react';
import {
  Wheat,
  Sprout,
  Leaf,
  Bean,
  Flower2,
  Nut,
  Sparkles,
  Layers,
  CircleDot,
  TreeDeciduous,
} from 'lucide-react';

interface CropIconProps {
  name?: string;
  icon?: string;
  color?: string;
  size?: number;
  className?: string;
  showBadge?: boolean;
}

export default function CropIcon({
  name = '',
  icon = '',
  color = '#65C18C',
  size = 20,
  className = '',
  showBadge = false,
}: CropIconProps) {
  const normalized = (icon || name).toLowerCase();

  const getIcon = () => {
    if (normalized.includes('wheat') || normalized.includes('barley') || normalized.includes('grain')) {
      return <Wheat size={size} style={{ color }} />;
    }
    if (normalized.includes('maize') || normalized.includes('corn')) {
      return <Sprout size={size} style={{ color }} />;
    }
    if (normalized.includes('rice') || normalized.includes('paddy')) {
      return <Leaf size={size} style={{ color }} />;
    }
    if (normalized.includes('soybean') || normalized.includes('chickpea') || normalized.includes('pulse') || normalized.includes('bean')) {
      return <Bean size={size} style={{ color }} />;
    }
    if (normalized.includes('cotton') || normalized.includes('sunflower') || normalized.includes('flower')) {
      return <Flower2 size={size} style={{ color }} />;
    }
    if (normalized.includes('millet') || normalized.includes('sorghum')) {
      return <Sprout size={size} style={{ color }} />;
    }
    if (normalized.includes('cover') || normalized.includes('clover') || normalized.includes('alfalfa')) {
      return <Leaf size={size} style={{ color }} />;
    }
    if (normalized.includes('groundnut') || normalized.includes('peanut') || normalized.includes('nut')) {
      return <Nut size={size} style={{ color }} />;
    }
    // Default fallback
    return <Leaf size={size} style={{ color }} />;
  };

  if (showBadge) {
    return (
      <div
        className={`inline-flex items-center justify-center rounded-lg transition-all ${className}`}
        style={{
          width: size * 1.8,
          height: size * 1.8,
          background: `${color}18`,
          border: `1px solid ${color}35`,
        }}
      >
        {getIcon()}
      </div>
    );
  }

  return <span className={`inline-flex items-center justify-center ${className}`}>{getIcon()}</span>;
}
