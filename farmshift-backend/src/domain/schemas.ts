import { z } from 'zod';

/**
 * Wire schemas. The shapes named in the FarmShift frontend (`src/types/index.ts`) are reproduced
 * field-for-field so responses are drop-in compatible; backend-only additions are optional extras.
 */

export const SOIL_TYPES = ['Sandy Loam', 'Clay', 'Silt', 'Loam', 'Clay Loam', 'Sandy Clay'] as const;
export const DRAINAGE = ['Well-drained', 'Moderately drained', 'Poorly drained'] as const;
export const LEVELS = ['Low', 'Medium', 'High'] as const;
export const WATER_AVAILABILITY = ['High', 'Moderate', 'Limited'] as const;
export const IRRIGATION_TYPES = ['Irrigated', 'Rain-fed', 'Mixed'] as const;
export const DATE_RANGES = ['30d', '6m', '1y', '5y'] as const;

export const Trend = z.enum(['increasing', 'decreasing', 'stable']);

export const LatSchema = z.coerce.number().min(-90).max(90);
export const LonSchema = z.coerce.number().min(-180).max(180);

export const FieldLocationSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lon: z.number(),
  label: z.string(),
  area: z.number(),
});

export const EnvironmentDataPointSchema = z.object({
  date: z.string(),
  temperatureC: z.number(),
  precipitationMm: z.number(),
  soilMoisturePercent: z.number(),
  ndvi: z.number(),
  evapotranspirationMm: z.number(),
});

const metricBlock = z.object({
  current: z.number(),
  trend: Trend,
  historical: z.number(),
  source: z.string(),
});

export const EnvironmentMetaSchema = z.object({
  location: z.object({ lat: z.number(), lon: z.number(), elevationM: z.number() }),
  period: z.object({ start: z.string(), end: z.string() }),
  generatedAt: z.string(),
  climate: z.object({
    provider: z.enum(['nasa-power', 'synthetic']),
    stale: z.boolean(),
    fetchedAt: z.string(),
  }),
  vegetation: z.object({
    provider: z.enum(['modis-mod13q1', 'phenology-model']),
    quality: z.enum(['observed', 'partial', 'estimated']),
  }),
  warnings: z.array(z.string()),
});

export const EnvironmentSummarySchema = z.object({
  temperature: metricBlock.extend({ anomaly: z.number() }),
  rainfall: metricBlock.extend({ anomalyPercent: z.number() }),
  soilMoisture: metricBlock,
  vegetation: metricBlock,
  waterStress: z.object({
    level: z.enum(['Low', 'Moderate', 'High', 'Critical']),
    source: z.string(),
    /** 0..1 composite index behind `level` (backend extra). */
    score: z.number().optional(),
  }),
  meta: EnvironmentMetaSchema.optional(),
});

export const CropInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  waterDemand: z.enum(['Low', 'Medium', 'High']),
  season: z.string(),
  rootingDepth: z.string(),
  nutrientDemand: z.enum(LEVELS),
  growingDays: z.number(),
  icon: z.string(),
  color: z.string(),
});

export const SoilProfileSchema = z.object({
  soilType: z.enum(SOIL_TYPES),
  ph: z.number().min(3.5).max(10),
  organicMatter: z.number().min(0).max(20),
  nitrogen: z.enum(LEVELS),
  phosphorus: z.enum(LEVELS),
  potassium: z.enum(LEVELS),
  drainage: z.enum(DRAINAGE),
});

export const FarmerPrioritiesSchema = z.object({
  waterConservation: z.number().min(0).max(10),
  soilHealth: z.number().min(0).max(10),
  yieldStability: z.number().min(0).max(10),
  climateResilience: z.number().min(0).max(10),
  cropDiversity: z.number().min(0).max(10),
  lowerInputRequirement: z.number().min(0).max(10),
});

export const DEFAULT_SOIL: z.infer<typeof SoilProfileSchema> = {
  soilType: 'Sandy Loam',
  ph: 6.8,
  organicMatter: 2.4,
  nitrogen: 'Medium',
  phosphorus: 'Medium',
  potassium: 'High',
  drainage: 'Well-drained',
};

export const DEFAULT_PRIORITIES: z.infer<typeof FarmerPrioritiesSchema> = {
  waterConservation: 7,
  soilHealth: 6,
  yieldStability: 5,
  climateResilience: 8,
  cropDiversity: 4,
  lowerInputRequirement: 6,
};

/** Profile as sent by clients; `currentCrop` accepts a catalog id ("cover_crop") or name ("Cover Crop"). */
export const FarmProfileInputSchema = z.object({
  soil: SoilProfileSchema.default(DEFAULT_SOIL),
  currentCrop: z.string().min(1).default('Wheat'),
  waterAvailability: z.enum(WATER_AVAILABILITY).default('Moderate'),
  irrigationType: z.enum(IRRIGATION_TYPES).default('Mixed'),
  priorities: FarmerPrioritiesSchema.default(DEFAULT_PRIORITIES),
});

export type FieldLocation = z.infer<typeof FieldLocationSchema>;
export type EnvironmentDataPoint = z.infer<typeof EnvironmentDataPointSchema>;
export type EnvironmentSummary = z.infer<typeof EnvironmentSummarySchema>;
export type EnvironmentMeta = z.infer<typeof EnvironmentMetaSchema>;
export type CropInfo = z.infer<typeof CropInfoSchema>;
export type SoilProfile = z.infer<typeof SoilProfileSchema>;
export type FarmerPriorities = z.infer<typeof FarmerPrioritiesSchema>;
export type FarmProfileInput = z.infer<typeof FarmProfileInputSchema>;
export type DateRange = (typeof DATE_RANGES)[number];

/** Profile after crop resolution; what the engine consumes. */
export interface ResolvedProfile {
  soil: SoilProfile;
  currentCropId: string;
  waterAvailability: (typeof WATER_AVAILABILITY)[number];
  irrigationType: (typeof IRRIGATION_TYPES)[number];
  priorities: FarmerPriorities;
}

export const ScenarioMetricsSchema = z.object({
  waterDemand: z.number(),
  soilHealth: z.number(),
  climateCompatibility: z.number(),
  cropDiversity: z.number(),
  nutrientPressure: z.number(),
  environmentalResilience: z.number(),
});
export type ScenarioMetrics = z.infer<typeof ScenarioMetricsSchema>;

// ---------------------------------------------------------------------------------------------
// Scenario wire schema (frontend `RotationScenario` + backend extras)
// ---------------------------------------------------------------------------------------------

export const SlotOutSchema = z.object({
  cycleIndex: z.number(),
  crop: z.string(),
  season: z.string(),
  sowing: z.string(),
  growingDays: z.number(),
  seasonMeanTempC: z.number(),
  seasonRainMm: z.number(),
  cropWaterNeedMm: z.number(),
  irrigationNeedMm: z.number(),
  waterSupplyRatio: z.number(),
  relativeYield: z.number(),
  nitrogenCreditKgHa: z.number(),
  netNitrogenKgHa: z.number(),
  climateCompatibility: z.number(),
  flags: z.array(z.string()),
});

export const ScenarioOutSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  crops: z.array(z.string()),
  metrics: ScenarioMetricsSchema,
  tradeoffs: z.object({ advantages: z.array(z.string()), disadvantages: z.array(z.string()) }),
  aiExplanation: z.string(),
  tags: z.array(z.string()),
  overallScore: z.number(),
  dataSourcesUsed: z.array(z.string()),
  archetype: z.string(),
  sequence: z.array(SlotOutSchema),
  insights: z.object({ whyThisMatters: z.array(z.string()) }),
  versusCurrent: ScenarioMetricsSchema.extend({ overallScore: z.number() }),
  warnings: z.array(z.string()),
  details: z.object({
    meanIrrigationNeedMm: z.number(),
    meanNetNitrogenKgHa: z.number(),
    meanRelativeYield: z.number(),
    diseaseBreak: z.number(),
    productivityIndex: z.number(),
  }),
  narration: z.enum(['template', 'llm']),
});

export const BaselineSchema = z.object({
  crops: z.array(z.string()),
  metrics: ScenarioMetricsSchema,
  overallScore: z.number(),
});

// ---------------------------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------------------------

export const LocationSchema = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) });

/** Partial profile merged over the stored farm profile (or defaults). */
export const ProfileOverrideSchema = z.object({
  soil: SoilProfileSchema.partial().optional(),
  currentCrop: z.string().min(1).optional(),
  waterAvailability: z.enum(WATER_AVAILABILITY).optional(),
  irrigationType: z.enum(IRRIGATION_TYPES).optional(),
  priorities: FarmerPrioritiesSchema.partial().optional(),
});
export type ProfileOverride = z.infer<typeof ProfileOverrideSchema>;

export const PaginationQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
