// ============================================
// FARMSHIFT — MOCK FARM DATA
// ============================================

import { FieldLocation } from '@/types';

export const demoFarms: FieldLocation[] = [
  {
    id: 'green-valley',
    lat: 34.02,
    lon: 71.58,
    label: 'Green Valley Farm',
    area: 12.4,
  },
  {
    id: 'indus-basin',
    lat: 30.2,
    lon: 71.47,
    label: 'Indus Basin Wheat-Rice Field',
    area: 18.6,
  },
  {
    id: 'midwest-corn',
    lat: 41.88,
    lon: -87.63,
    label: 'Midwest Corn Belt',
    area: 24.2,
  },
  {
    id: 'kenya-dryland',
    lat: -1.29,
    lon: 36.82,
    label: 'Dryland Sorghum Field',
    area: 8.1,
  },
];

export const defaultFarm = demoFarms[0];

export function getFarms(): FieldLocation[] {
  return demoFarms;
}

export function getFarmById(id: string): FieldLocation | undefined {
  return demoFarms.find((f) => f.id === id);
}
