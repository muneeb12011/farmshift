import { sum } from '../lib/math.js';
import { monthlyClimatology, type ClimateBundle, type MonthlyClimatology } from './climate.js';
import type { ResolvedProfile } from '../domain/schemas.js';

/** Everything the engine needs about one field, derived once per request. */
export interface FieldContext {
  profile: ResolvedProfile;
  bundle: ClimateBundle;
  lat: number;
  monthly: MonthlyClimatology;
  /** Mean annual precipitation / ET0 (mm). */
  annualPrecipMm: number;
  annualEt0Mm: number;
  /** 0 (humid) .. 1 (arid): 1 − P/ET0, clamped. */
  aridity: number;
}

export function buildFieldContext(profile: ResolvedProfile, bundle: ClimateBundle): FieldContext {
  const monthly = monthlyClimatology(bundle.daily);
  const annualPrecipMm = sum(monthly.precip);
  const annualEt0Mm = sum(monthly.et0);
  const aridity = annualEt0Mm > 0 ? Math.min(1, Math.max(0, 1 - annualPrecipMm / annualEt0Mm)) : 0.5;
  return { profile, bundle, lat: bundle.lat, monthly, annualPrecipMm, annualEt0Mm, aridity };
}

export const ENGINE_VERSION = '1.0.0';

