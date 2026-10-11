/**
 * FAO-56 Penman–Monteith reference evapotranspiration (Allen et al., 1998), daily time step.
 * Equation numbers refer to FAO Irrigation and Drainage Paper 56.
 */

const GSC = 0.082; // solar constant, MJ m-2 min-1
const SIGMA = 4.903e-9; // Stefan–Boltzmann, MJ K-4 m-2 day-1

/** Saturation vapour pressure e°(T) in kPa (eq. 11). */
export const satVapourPressure = (tC: number) => 0.6108 * Math.exp((17.27 * tC) / (tC + 237.3));

/** Slope of the saturation vapour pressure curve Δ in kPa/°C (eq. 13). */
export const vapourPressureSlope = (tMean: number) =>
  (4098 * satVapourPressure(tMean)) / (tMean + 237.3) ** 2;

/** Atmospheric pressure in kPa from elevation in m (eq. 7). */
export const atmosphericPressure = (z: number) => 101.3 * ((293 - 0.0065 * z) / 293) ** 5.26;

/** Extraterrestrial radiation Ra in MJ m-2 day-1 (eq. 21). */
export function extraterrestrialRadiation(latDeg: number, doy: number): number {
  const phi = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doy) / 365);
  const delta = 0.409 * Math.sin((2 * Math.PI * doy) / 365 - 1.39);
  // Clamp handles polar day/night where |tanφ·tanδ| > 1.
  const x = Math.min(1, Math.max(-1, -Math.tan(phi) * Math.tan(delta)));
  const ws = Math.acos(x);
  return (
    ((24 * 60) / Math.PI) *
    GSC *
    dr *
    (ws * Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.sin(ws))
  );
}

export interface Et0Input {
  tMax: number;
  tMin: number;
  /** Mean daily temperature; defaults to (tMax+tMin)/2. */
  tMean?: number;
  /** Mean relative humidity %, used when `ea` is not provided. */
  rh?: number;
  /** Actual vapour pressure kPa (overrides rh). */
  ea?: number;
  /** Wind speed at 2 m height, m/s. */
  u2: number;
  /** Incoming shortwave radiation Rs, MJ m-2 day-1. */
  rs: number;
  latDeg: number;
  doy: number;
  elevationM: number;
}

/** Reference crop ET0 in mm/day. Soil heat flux G is taken as 0 at the daily step (eq. 42). */
export function et0PenmanMonteith(i: Et0Input): number {
  const tMean = i.tMean ?? (i.tMax + i.tMin) / 2;
  const delta = vapourPressureSlope(tMean);
  const gamma = 0.000665 * atmosphericPressure(i.elevationM); // eq. 8

  const es = (satVapourPressure(i.tMax) + satVapourPressure(i.tMin)) / 2; // eq. 12
  const ea =
    i.ea ??
    (i.rh !== undefined ? (Math.min(100, Math.max(1, i.rh)) / 100) * es : satVapourPressure(i.tMin)); // eq. 19 / 48

  const ra = extraterrestrialRadiation(i.latDeg, i.doy);
  const rso = (0.75 + 2e-5 * i.elevationM) * ra; // eq. 37
  const rns = (1 - 0.23) * i.rs; // eq. 38
  const ratio = rso > 0 ? Math.min(1, Math.max(0.3, i.rs / rso)) : 0.5;
  const tmaxK = i.tMax + 273.16;
  const tminK = i.tMin + 273.16;
  const rnl = SIGMA * ((tmaxK ** 4 + tminK ** 4) / 2) * (0.34 - 0.14 * Math.sqrt(Math.max(0, ea))) * (1.35 * ratio - 0.35); // eq. 39
  const rn = rns - rnl; // eq. 40

  const u2 = Math.max(0, i.u2);
  const num = 0.408 * delta * rn + gamma * (900 / (tMean + 273)) * u2 * (es - ea);
  const den = delta + gamma * (1 + 0.34 * u2);
  return Math.max(0, num / den);
}

/** Effective rainfall (mm/month) by the USDA Soil Conservation Service method (FAO Irrig. Drain. Paper 24/33). */
export function effectiveRainMonthly(pMonthMm: number): number {
  if (pMonthMm <= 0) return 0;
  return pMonthMm <= 250 ? (pMonthMm * (125 - 0.2 * pMonthMm)) / 125 : 125 + 0.1 * pMonthMm;
}

/** Effective rainfall over an arbitrary window by scaling to a 30.4-day monthly rate. */
export function effectiveRainWindow(totalMm: number, days: number): number {
  if (days <= 0) return 0;
  const monthsEq = days / 30.4;
  return effectiveRainMonthly(totalMm / monthsEq) * monthsEq;
}
