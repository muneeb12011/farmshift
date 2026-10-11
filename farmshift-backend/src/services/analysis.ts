import { CROP_IDS, resolveCrop } from '../domain/crops.js';
import {
  DEFAULT_PRIORITIES,
  DEFAULT_SOIL,
  type FarmProfileInput,
  type ProfileOverride,
  type ResolvedProfile,
} from '../domain/schemas.js';
import { summarise } from '../engine/summary.js';
import { AppError } from '../lib/errors.js';
import type { Services } from './container.js';

export function toResolvedProfile(p: FarmProfileInput): ResolvedProfile {
  const crop = resolveCrop(p.currentCrop);
  if (!crop) throw AppError.unprocessable(`Unknown crop "${p.currentCrop}"`, { validCrops: CROP_IDS });
  return { soil: p.soil, currentCropId: crop.id, waterAvailability: p.waterAvailability, irrigationType: p.irrigationType, priorities: p.priorities };
}

/** Canonical crop display name, or 422. */
export function canonicalCropName(idOrName: string): string {
  const c = resolveCrop(idOrName);
  if (!c) throw AppError.unprocessable(`Unknown crop "${idOrName}"`, { validCrops: CROP_IDS });
  return c.name;
}

export interface AnalysisTarget {
  lat: number;
  lon: number;
  farmId?: string;
  profile: FarmProfileInput;
}

/**
 * Resolve "which place and which farm profile" from a request: a farmId (stored profile, optionally
 * overridden) or a bare location (defaults, optionally overridden). Exactly one of the two is required.
 */
export async function resolveTarget(
  svc: Services,
  userId: string | undefined,
  input: { farmId?: string; location?: { lat: number; lon: number }; profile?: ProfileOverride },
): Promise<AnalysisTarget> {
  if (!!input.farmId === !!input.location) {
    throw AppError.validation('Provide exactly one of "farmId" or "location"');
  }
  let lat: number, lon: number;
  let base: FarmProfileInput = {
    soil: DEFAULT_SOIL,
    currentCrop: 'Wheat',
    waterAvailability: 'Moderate',
    irrigationType: 'Mixed',
    priorities: DEFAULT_PRIORITIES,
  };
  if (input.farmId) {
    const farm = await svc.farms.getReadable(input.farmId, userId);
    lat = farm.lat;
    lon = farm.lon;
    const stored = await svc.farms.getProfile(farm.id);
    if (stored) base = stored;
  } else {
    lat = input.location!.lat;
    lon = input.location!.lon;
  }
  const o = input.profile;
  const profile: FarmProfileInput = {
    soil: { ...base.soil, ...(o?.soil ?? {}) },
    currentCrop: o?.currentCrop ?? base.currentCrop,
    waterAvailability: o?.waterAvailability ?? base.waterAvailability,
    irrigationType: o?.irrigationType ?? base.irrigationType,
    priorities: { ...base.priorities, ...(o?.priorities ?? {}) },
  };
  return { lat, lon, farmId: input.farmId, profile };
}

export async function loadEnvironment(svc: Services, lat: number, lon: number) {
  const bundle = await svc.environment.getBundle(lat, lon);
  return { bundle, summary: summarise(bundle) };
}

export const RANGE_DAYS: Record<string, number> = { '30d': 30, '6m': 182, '1y': 365, '5y': 1826 };
