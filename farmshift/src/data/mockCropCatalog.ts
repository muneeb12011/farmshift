// ============================================
// FARMSHIFT - CROP CATALOG
// Zero emojis, scientific and agronomic metadata
// ============================================

import { CropInfo } from '@/types';

export const cropCatalog: CropInfo[] = [
  {
    id: 'wheat',
    name: 'Wheat',
    waterDemand: 'Medium',
    season: 'Rabi (Winter)',
    rootingDepth: '1.0 - 1.5 m',
    nutrientDemand: 'Medium',
    growingDays: 120,
    icon: 'Wheat',
    color: '#E7B75B',
  },
  {
    id: 'maize',
    name: 'Maize',
    waterDemand: 'High',
    season: 'Kharif (Summer)',
    rootingDepth: '1.0 - 1.7 m',
    nutrientDemand: 'High',
    growingDays: 100,
    icon: 'Sprout',
    color: '#F59E0B',
  },
  {
    id: 'rice',
    name: 'Rice',
    waterDemand: 'High',
    season: 'Kharif (Summer)',
    rootingDepth: '0.5 - 0.6 m',
    nutrientDemand: 'High',
    growingDays: 135,
    icon: 'Leaf',
    color: '#86EFAC',
  },
  {
    id: 'soybean',
    name: 'Soybean',
    waterDemand: 'Medium',
    season: 'Kharif (Summer)',
    rootingDepth: '0.6 - 1.3 m',
    nutrientDemand: 'Low',
    growingDays: 100,
    icon: 'Bean',
    color: '#65C18C',
  },
  {
    id: 'millet',
    name: 'Millet',
    waterDemand: 'Low',
    season: 'Kharif (Summer)',
    rootingDepth: '1.0 - 2.0 m',
    nutrientDemand: 'Low',
    growingDays: 75,
    icon: 'Sprout',
    color: '#D4A574',
  },
  {
    id: 'cotton',
    name: 'Cotton',
    waterDemand: 'High',
    season: 'Kharif (Summer)',
    rootingDepth: '1.0 - 1.7 m',
    nutrientDemand: 'High',
    growingDays: 160,
    icon: 'Flower2',
    color: '#F5F5F5',
  },
  {
    id: 'chickpea',
    name: 'Chickpea',
    waterDemand: 'Low',
    season: 'Rabi (Winter)',
    rootingDepth: '0.6 - 1.0 m',
    nutrientDemand: 'Low',
    growingDays: 95,
    icon: 'Bean',
    color: '#C4A35A',
  },
  {
    id: 'barley',
    name: 'Barley',
    waterDemand: 'Low',
    season: 'Rabi (Winter)',
    rootingDepth: '1.0 - 1.5 m',
    nutrientDemand: 'Medium',
    growingDays: 110,
    icon: 'Wheat',
    color: '#A3BE8C',
  },
  {
    id: 'cover_crop',
    name: 'Cover Crop',
    waterDemand: 'Low',
    season: 'Year-round',
    rootingDepth: '0.3 - 1.0 m',
    nutrientDemand: 'Low',
    growingDays: 60,
    icon: 'Leaf',
    color: '#4EC4B1',
  },
];

export function getCropByName(name: string): CropInfo | undefined {
  return cropCatalog.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

export function getCropCatalog(): CropInfo[] {
  return cropCatalog;
}
