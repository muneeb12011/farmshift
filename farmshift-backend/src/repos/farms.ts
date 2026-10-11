import type { SqlAdapter } from '../db/adapter.js';
import { AppError } from '../lib/errors.js';
import { newId } from '../lib/ids.js';
import { DEFAULT_PRIORITIES, DEFAULT_SOIL, type FarmProfileInput, type FieldLocation } from '../domain/schemas.js';

export interface FarmRecord extends FieldLocation {
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoredProfile {
  soil: FarmProfileInput['soil'];
  currentCrop: string;
  waterAvailability: FarmProfileInput['waterAvailability'];
  irrigationType: FarmProfileInput['irrigationType'];
  priorities: FarmProfileInput['priorities'];
  updatedAt: string;
}

const mapFarm = (r: Record<string, unknown>): FarmRecord => ({
  id: r.id as string,
  ownerId: (r.owner_id as string | null) ?? null,
  label: r.label as string,
  lat: Number(r.lat),
  lon: Number(r.lon),
  area: Number(r.area_ha),
  createdAt: new Date(Number(r.created_at)).toISOString(),
  updatedAt: new Date(Number(r.updated_at)).toISOString(),
});

const mapProfile = (r: Record<string, unknown>): StoredProfile => ({
  soil: JSON.parse(r.soil_json as string),
  currentCrop: r.current_crop as string,
  waterAvailability: r.water_availability as StoredProfile['waterAvailability'],
  irrigationType: r.irrigation_type as StoredProfile['irrigationType'],
  priorities: JSON.parse(r.priorities_json as string),
  updatedAt: new Date(Number(r.updated_at)).toISOString(),
});

export class FarmsRepo {
  constructor(private db: SqlAdapter) {}

  /** Demo farms plus (when a user is given) that user's own farms. */
  async list(userId?: string): Promise<FarmRecord[]> {
    const rows = userId
      ? await this.db.all('SELECT * FROM farms WHERE owner_id IS NULL OR owner_id = ? ORDER BY (owner_id IS NOT NULL), created_at, label', [userId])
      : await this.db.all('SELECT * FROM farms WHERE owner_id IS NULL ORDER BY created_at, label');
    return rows.map(mapFarm);
  }

  async get(id: string): Promise<FarmRecord | undefined> {
    const r = await this.db.get('SELECT * FROM farms WHERE id = ?', [id]);
    return r ? mapFarm(r) : undefined;
  }

  /** Readable by demo farms and the owner. */
  async getReadable(id: string, userId?: string): Promise<FarmRecord> {
    const f = await this.get(id);
    if (!f || (f.ownerId !== null && f.ownerId !== userId)) throw AppError.notFound('Farm');
    return f;
  }

  /** Writable only by the owner; demo farms are immutable. */
  async getWritable(id: string, userId: string): Promise<FarmRecord> {
    const f = await this.get(id);
    if (!f || (f.ownerId !== null && f.ownerId !== userId)) throw AppError.notFound('Farm');
    if (f.ownerId === null) throw AppError.forbidden('Demo farms are read-only');
    return f;
  }

  async create(ownerId: string | null, input: { id?: string; label: string; lat: number; lon: number; area: number }): Promise<FarmRecord> {
    const id = input.id ?? newId('farm');
    const now = Date.now();
    await this.db.run('INSERT INTO farms (id, owner_id, label, lat, lon, area_ha, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
      id,
      ownerId,
      input.label.trim(),
      input.lat,
      input.lon,
      input.area,
      now,
      now,
    ]);
    return (await this.get(id))!;
  }

  async update(id: string, patch: Partial<{ label: string; lat: number; lon: number; area: number }>): Promise<FarmRecord> {
    const cur = await this.get(id);
    if (!cur) throw AppError.notFound('Farm');
    await this.db.run('UPDATE farms SET label = ?, lat = ?, lon = ?, area_ha = ?, updated_at = ? WHERE id = ?', [
      patch.label?.trim() ?? cur.label,
      patch.lat ?? cur.lat,
      patch.lon ?? cur.lon,
      patch.area ?? cur.area,
      Date.now(),
      id,
    ]);
    return (await this.get(id))!;
  }

  async delete(id: string): Promise<void> {
    await this.db.run('DELETE FROM farms WHERE id = ?', [id]);
  }

  async getProfile(farmId: string): Promise<StoredProfile | undefined> {
    const r = await this.db.get('SELECT * FROM farm_profiles WHERE farm_id = ?', [farmId]);
    return r ? mapProfile(r) : undefined;
  }

  async upsertProfile(farmId: string, p: FarmProfileInput): Promise<StoredProfile> {
    await this.db.run(
      `INSERT INTO farm_profiles (farm_id, soil_json, current_crop, water_availability, irrigation_type, priorities_json, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(farm_id) DO UPDATE SET
         soil_json = excluded.soil_json, current_crop = excluded.current_crop,
         water_availability = excluded.water_availability, irrigation_type = excluded.irrigation_type,
         priorities_json = excluded.priorities_json, updated_at = excluded.updated_at`,
      [farmId, JSON.stringify(p.soil), p.currentCrop, p.waterAvailability, p.irrigationType, JSON.stringify(p.priorities), Date.now()],
    );
    return (await this.getProfile(farmId))!;
  }

  /** Idempotent and safe under concurrent startup of several instances (ON CONFLICT DO NOTHING). */
  async seedDemo(): Promise<void> {
    const demo: { farm: FieldLocation; profile: FarmProfileInput }[] = [
      {
        farm: { id: 'green-valley', lat: 34.02, lon: 71.58, label: 'Green Valley Farm', area: 12.4 },
        profile: { soil: DEFAULT_SOIL, currentCrop: 'Wheat', waterAvailability: 'Moderate', irrigationType: 'Mixed', priorities: DEFAULT_PRIORITIES },
      },
      {
        farm: { id: 'indus-basin', lat: 30.2, lon: 71.47, label: 'Indus Basin Wheat-Rice Field', area: 18.6 },
        profile: {
          soil: { soilType: 'Clay Loam', ph: 7.8, organicMatter: 1.1, nitrogen: 'Low', phosphorus: 'Medium', potassium: 'Medium', drainage: 'Moderately drained' },
          currentCrop: 'Wheat', waterAvailability: 'Moderate', irrigationType: 'Irrigated',
          priorities: { waterConservation: 8, soilHealth: 7, yieldStability: 7, climateResilience: 7, cropDiversity: 5, lowerInputRequirement: 5 },
        },
      },
      {
        farm: { id: 'midwest-corn', lat: 41.88, lon: -87.63, label: 'Midwest Corn Belt', area: 24.2 },
        profile: {
          soil: { soilType: 'Silt', ph: 6.5, organicMatter: 3.8, nitrogen: 'Medium', phosphorus: 'High', potassium: 'High', drainage: 'Moderately drained' },
          currentCrop: 'Maize', waterAvailability: 'High', irrigationType: 'Rain-fed',
          priorities: { waterConservation: 4, soilHealth: 7, yieldStability: 8, climateResilience: 6, cropDiversity: 6, lowerInputRequirement: 6 },
        },
      },
      {
        farm: { id: 'kenya-dryland', lat: -1.29, lon: 36.82, label: 'Dryland Sorghum Field', area: 8.1 },
        profile: {
          soil: { soilType: 'Sandy Clay', ph: 6.2, organicMatter: 1.6, nitrogen: 'Low', phosphorus: 'Low', potassium: 'Medium', drainage: 'Well-drained' },
          currentCrop: 'Millet', waterAvailability: 'Limited', irrigationType: 'Rain-fed',
          priorities: { waterConservation: 9, soilHealth: 8, yieldStability: 8, climateResilience: 9, cropDiversity: 6, lowerInputRequirement: 8 },
        },
      },
    ];
    const now = Date.now();
    for (const { farm, profile } of demo) {
      await this.db.run(
        'INSERT INTO farms (id, owner_id, label, lat, lon, area_ha, created_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?) ON CONFLICT (id) DO NOTHING',
        [farm.id, farm.label, farm.lat, farm.lon, farm.area, now, now],
      );
      await this.db.run(
        `INSERT INTO farm_profiles (farm_id, soil_json, current_crop, water_availability, irrigation_type, priorities_json, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT (farm_id) DO NOTHING`,
        [farm.id, JSON.stringify(profile.soil), profile.currentCrop, profile.waterAvailability, profile.irrigationType, JSON.stringify(profile.priorities), now],
      );
    }
  }
}
