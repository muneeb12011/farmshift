// ============================================
// FARMSHIFT — MOCK ENVIRONMENT DATA
// ============================================

import { EnvironmentDataPoint, EnvironmentSummary } from '@/types';

// Generate realistic time-series data
function generateTimeSeries(days: number): EnvironmentDataPoint[] {
  const data: EnvironmentDataPoint[] = [];
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Realistic seasonal patterns
    const dayOfYear = Math.floor(
      (date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
    );
    const seasonFactor = Math.sin((dayOfYear / 365) * 2 * Math.PI - Math.PI / 2);

    data.push({
      date: date.toISOString().split('T')[0],
      temperatureC: parseFloat((22 + seasonFactor * 10 + (Math.random() - 0.5) * 4).toFixed(1)),
      precipitationMm: parseFloat(
        Math.max(0, 3 + seasonFactor * 5 + (Math.random() - 0.3) * 8).toFixed(1)
      ),
      soilMoisturePercent: parseFloat(
        Math.max(20, Math.min(90, 55 + seasonFactor * 15 + (Math.random() - 0.5) * 10)).toFixed(1)
      ),
      ndvi: parseFloat(
        Math.max(0.2, Math.min(0.85, 0.55 + seasonFactor * 0.2 + (Math.random() - 0.5) * 0.1)).toFixed(
          2
        )
      ),
      evapotranspirationMm: parseFloat(
        Math.max(1, 4 + seasonFactor * 2 + (Math.random() - 0.5) * 2).toFixed(1)
      ),
    });
  }

  return data;
}

export const timeSeries30d = generateTimeSeries(30);
export const timeSeries6m = generateTimeSeries(180);
export const timeSeries1y = generateTimeSeries(365);
export const timeSeries5y = generateTimeSeries(365 * 5);

export const environmentSummary: EnvironmentSummary = {
  temperature: {
    current: 24.8,
    anomaly: 1.2,
    trend: 'increasing',
    historical: 23.6,
    source: 'NASA POWER',
  },
  rainfall: {
    current: 42,
    anomalyPercent: -12,
    trend: 'decreasing',
    historical: 48,
    source: 'GPM IMERG',
  },
  soilMoisture: {
    current: 68,
    trend: 'decreasing',
    historical: 72,
    source: 'SMAP L4',
  },
  vegetation: {
    current: 0.61,
    trend: 'stable',
    historical: 0.64,
    source: 'MODIS / HLS',
  },
  waterStress: {
    level: 'Moderate',
    source: 'ECOSTRESS',
  },
};

export function getEnvironmentTimeSeries(range: string): EnvironmentDataPoint[] {
  switch (range) {
    case '30d':
      return timeSeries30d;
    case '6m':
      return timeSeries6m;
    case '1y':
      return timeSeries1y;
    case '5y':
      return timeSeries5y;
    default:
      return timeSeries1y;
  }
}

export function getEnvironmentSummary(): EnvironmentSummary {
  return environmentSummary;
}
