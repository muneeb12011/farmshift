// ============================================
// FARMSHIFT — TYPE DEFINITIONS
// ============================================

export interface FieldLocation {
  id: string;
  lat: number;
  lon: number;
  label: string;
  area: number; // hectares
}

export interface EnvironmentDataPoint {
  date: string;
  temperatureC: number;
  precipitationMm: number;
  soilMoisturePercent: number;
  ndvi: number;
  evapotranspirationMm: number;
}

export interface EnvironmentSummary {
  temperature: {
    current: number;
    anomaly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    historical: number;
    source: string;
  };
  rainfall: {
    current: number;
    anomalyPercent: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    historical: number;
    source: string;
  };
  soilMoisture: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    historical: number;
    source: string;
  };
  vegetation: {
    current: number;
    trend: 'increasing' | 'decreasing' | 'stable';
    historical: number;
    source: string;
  };
  waterStress: {
    level: 'Low' | 'Moderate' | 'High' | 'Critical';
    source: string;
    /** 0..1 composite behind `level` (backend). */
    score?: number;
  };
  /** Data provenance supplied by the backend. */
  meta?: {
    climate: { provider: 'nasa-power' | 'synthetic'; stale: boolean; fetchedAt: string };
    vegetation: { provider: 'modis-mod13q1' | 'phenology-model'; quality: 'observed' | 'partial' | 'estimated' };
    warnings: string[];
  };
}

export interface CropInfo {
  id: string;
  name: string;
  waterDemand: 'Low' | 'Medium' | 'High';
  season: string;
  rootingDepth: string;
  nutrientDemand: 'Low' | 'Medium' | 'High';
  growingDays: number;
  icon: string;
  color: string;
}

export interface SoilProfile {
  soilType: string;
  ph: number;
  organicMatter: number;
  nitrogen: string;
  phosphorus: string;
  potassium: string;
  drainage: string;
}

export interface FarmerPriorities {
  waterConservation: number;
  soilHealth: number;
  yieldStability: number;
  climateResilience: number;
  cropDiversity: number;
  lowerInputRequirement: number;
}

export interface RotationScenario {
  id: string;
  name: string;
  description: string;
  crops: string[];
  metrics: {
    waterDemand: number;
    soilHealth: number;
    climateCompatibility: number;
    cropDiversity: number;
    nutrientPressure: number;
    environmentalResilience: number;
  };
  tradeoffs: {
    advantages: string[];
    disadvantages: string[];
  };
  aiExplanation: string;
  tags: string[];
  overallScore: number;
  dataSourcesUsed: string[];
}

export interface FarmProfile {
  field: FieldLocation;
  soil: SoilProfile;
  currentCrop: string;
  waterAvailability: 'High' | 'Moderate' | 'Limited';
  irrigationType: 'Irrigated' | 'Rain-fed' | 'Mixed';
  priorities: FarmerPriorities;
}

export type DateRange = '30d' | '6m' | '1y' | '5y';

export type MapLayer = 'boundary' | 'vegetation' | 'soilMoisture' | 'temperature' | 'rainfall' | 'waterStress';
