import { describe, expect, it } from 'vitest';
import { effectiveRainMonthly, effectiveRainWindow, et0PenmanMonteith, extraterrestrialRadiation, satVapourPressure } from '../src/engine/et0.js';
import { trapezoid, slope } from '../src/lib/math.js';
import { windowStats, resample, toSeriesPoints, anomalyTrend, anomalies } from '../src/engine/climate.js';
import { generateSyntheticClimate } from '../src/providers/synthetic.js';
import { estimateNdvi } from '../src/providers/ndvi-model.js';
import type { ClimateBundle } from '../src/engine/climate.js';

describe('FAO-56 Penman-Monteith (checked against FAO Irrigation & Drainage Paper 56 worked examples)', () => {
  it('Example 18, Brussels 6 July: ET0 ≈ 3.9 mm/day', () => {
    const et0 = et0PenmanMonteith({ tMax: 21.5, tMin: 12.3, ea: 1.409, u2: 2.078, rs: 22.07, latDeg: 50.8, doy: 187, elevationM: 100 });
    expect(et0).toBeGreaterThan(3.83);
    expect(et0).toBeLessThan(3.95);
  });
  it('Example 8: Ra at 20°S on 3 September = 32.2 MJ m-2 day-1', () => {
    expect(extraterrestrialRadiation(-20, 246)).toBeCloseTo(32.2, 1);
  });
  it('Example 3: saturation vapour pressure at 24.5 °C ≈ 3.075 kPa', () => {
    expect(satVapourPressure(24.5)).toBeCloseTo(3.075, 2);
  });
  it('handles polar night without NaN', () => {
    const et0 = et0PenmanMonteith({ tMax: -15, tMin: -25, rh: 80, u2: 2, rs: 0.5, latDeg: 80, doy: 355, elevationM: 0 });
    expect(Number.isFinite(et0)).toBe(true);
    expect(et0).toBeGreaterThanOrEqual(0);
  });
  it('is monotonic in temperature and wind for a dry atmosphere', () => {
    const base = { tMax: 30, tMin: 18, rh: 40, u2: 2, rs: 20, latDeg: 30, doy: 180, elevationM: 100 };
    expect(et0PenmanMonteith({ ...base, tMax: 36, tMin: 24 })).toBeGreaterThan(et0PenmanMonteith(base));
    expect(et0PenmanMonteith({ ...base, u2: 4 })).toBeGreaterThan(et0PenmanMonteith(base));
  });
});

describe('effective rainfall (USDA SCS)', () => {
  it('matches the published curve', () => {
    expect(effectiveRainMonthly(0)).toBe(0);
    expect(effectiveRainMonthly(100)).toBeCloseTo(84, 5);
    expect(effectiveRainMonthly(250)).toBeCloseTo(150, 5);
    // the two branches of the curve meet at 250 mm
    expect(effectiveRainMonthly(250.001)).toBeCloseTo(effectiveRainMonthly(249.999), 2);
    expect(effectiveRainMonthly(300)).toBeCloseTo(155, 5);
  });
  it('never exceeds rainfall and is scale-consistent over windows', () => {
    for (const p of [5, 40, 120, 400]) expect(effectiveRainWindow(p, 120)).toBeLessThanOrEqual(p);
    expect(effectiveRainWindow(0, 100)).toBe(0);
  });
});

describe('math helpers', () => {
  it('trapezoid response', () => {
    expect(trapezoid(5, 10, 15, 25, 35)).toBe(0);
    expect(trapezoid(12.5, 10, 15, 25, 35)).toBeCloseTo(0.5);
    expect(trapezoid(20, 10, 15, 25, 35)).toBe(1);
    expect(trapezoid(30, 10, 15, 25, 35)).toBeCloseTo(0.5);
    expect(trapezoid(40, 10, 15, 25, 35)).toBe(0);
  });
  it('slope of a line', () => expect(slope([1, 3, 5, 7])).toBeCloseTo(2));
});

describe('synthetic climate', () => {
  const gen = (lat: number, lon: number) => generateSyntheticClimate({ lat, lon, start: '2024-01-01', end: '2025-12-31' });

  it('is deterministic per location and differs between locations', () => {
    const a = gen(30, 70);
    const b = gen(30, 70);
    const c = gen(-20, 30);
    expect(a.daily[100]!.tMean).toBe(b.daily[100]!.tMean);
    expect(a.daily[100]!.tMean).not.toBe(c.daily[100]!.tMean);
  });
  it('is hemisphere-aware: the warmest month flips', () => {
    const month = (d: ReturnType<typeof gen>['daily']) => {
      const m = Array.from({ length: 12 }, (_, i) => d.filter((x) => +x.date.slice(5, 7) === i + 1));
      const mean = m.map((r) => r.reduce((s, x) => s + x.tMean, 0) / r.length);
      return mean.indexOf(Math.max(...mean));
    };
    const north = month(gen(45, 10).daily);
    const south = month(gen(-45, 10).daily);
    expect([5, 6, 7]).toContain(north);
    expect([11, 0, 1]).toContain(south);
  });
  it('produces physically valid values', () => {
    for (const d of gen(34, 71).daily) {
      expect(d.tMax).toBeGreaterThanOrEqual(d.tMin);
      expect(d.precip).toBeGreaterThanOrEqual(0);
      expect(d.soilWetness).toBeGreaterThan(0);
      expect(d.soilWetness).toBeLessThanOrEqual(1);
      expect(d.et0).toBeGreaterThanOrEqual(0);
      expect(d.rh).toBeLessThanOrEqual(98);
    }
  });
});

describe('climate statistics', () => {
  const { daily } = generateSyntheticClimate({ lat: 34, lon: 71, start: '2021-01-01', end: '2025-12-31' });

  it('windowStats wraps year boundaries and aggregates across years', () => {
    const w = windowStats(daily, 305, 120, 32)!; // Nov 1 + 120 d crosses New Year
    expect(w.years).toBeGreaterThanOrEqual(4);
    expect(w.precip).toBeGreaterThan(0);
    expect(w.et0).toBeGreaterThan(0);
    expect(w.heatFraction).toBeGreaterThanOrEqual(0);
    expect(w.heatFraction).toBeLessThanOrEqual(1);
  });
  it('returns null for empty data', () => expect(windowStats([], 1, 30)).toBeNull());

  it('anomalyTrend ignores the seasonal cycle but detects a real drift', () => {
    const seasonalOnly = anomalies(daily, daily.map((d) => d.tMean));
    expect(anomalyTrend(seasonalOnly, 60, 1.5)).toBe('stable');
    const drift = daily.map((d, i) => d.tMean + (i > daily.length - 60 ? (i - (daily.length - 60)) * 0.2 : 0));
    expect(anomalyTrend(anomalies(daily, drift), 60, 0.4)).toBe('increasing');
  });

  it('resample: weekly/monthly shrink the series and preserve mean temperature', () => {
    const bundle = { daily, ndvi: estimateNdvi(daily) } as unknown as ClimateBundle;
    const pts = toSeriesPoints(bundle);
    const weekly = resample(pts, 'weekly');
    const monthly = resample(pts, 'monthly');
    expect(weekly.length).toBeLessThan(pts.length / 6);
    expect(monthly.length).toBe(60);
    const avg = (xs: { temperatureC: number }[]) => xs.reduce((s, x) => s + x.temperatureC, 0) / xs.length;
    expect(Math.abs(avg(monthly) - avg(pts))).toBeLessThan(0.3);
    expect(resample(pts, 'daily')).toHaveLength(pts.length);
  });

  it('phenology NDVI stays in range and is higher in the growing season', () => {
    const nd = estimateNdvi(daily);
    expect(Math.min(...nd)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...nd)).toBeLessThanOrEqual(0.8);
  });
});
