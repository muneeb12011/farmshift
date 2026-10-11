import type { CropAgronomy } from '../domain/crops.js';
import type { MonthlyClimatology } from './climate.js';

const MONTH_START_DOY = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const wrap = (doy: number) => ((doy - 1 + 365) % 365) + 1;

/**
 * Sowing day-of-year for a crop's season label at this latitude.
 *
 *  - Subtropics (15–35°): Rabi sown ~1 Nov, Kharif ~15 Jun (Indo-Gangetic calendar).
 *  - Temperate (≥35°): winter crops ~10 Oct, summer crops ~5 May.
 *  - Tropics (<15°): no thermal winter, so seasons follow rainfall: Kharif ("main season") starts with the
 *    wettest 4-month block, Rabi ("second season") with the second-wettest non-overlapping block.
 *  - Southern hemisphere: calendar shifted by half a year.
 * "Year-round" crops (cover crops) are placed in the Rabi (off-season) window.
 */
export function sowingDoy(crop: CropAgronomy, lat: number, monthly: MonthlyClimatology): number {
  const absLat = Math.abs(lat);
  const summer = crop.season.startsWith('Kharif');
  const shift = lat < 0 ? 182 : 0;

  if (absLat < 15) {
    const blocks = monthly.precip.map((_, m) => [0, 1, 2, 3].reduce((s, k) => s + monthly.precip[(m + k) % 12]!, 0));
    let best = 0;
    blocks.forEach((v, m) => {
      if (v > blocks[best]!) best = m;
    });
    let second = -1;
    blocks.forEach((v, m) => {
      const d = Math.min((m - best + 12) % 12, (best - m + 12) % 12);
      if (d >= 4 && (second === -1 || v > blocks[second]!)) second = m;
    });
    if (second === -1) second = (best + 6) % 12;
    return MONTH_START_DOY[summer ? best : second]!;
  }

  const base = absLat >= 35 ? (summer ? 125 : 283) : summer ? 166 : 305;
  return wrap(base + shift);
}

export function doyLabel(doy: number): string {
  let m = 11;
  for (let i = 0; i < 12; i++) {
    if (doy < (MONTH_START_DOY[i + 1] ?? 366)) {
      m = i;
      break;
    }
  }
  return `${MONTH_NAMES[m]} ${String(doy - MONTH_START_DOY[m]! + 1).padStart(2, '0')}`;
}
