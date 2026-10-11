// ============================================
// FARMSHIFT — ZUSTAND STORES
// ============================================

import { create } from 'zustand';
import { FieldLocation, SoilProfile, FarmerPriorities, MapLayer, DateRange } from '@/types';
import { defaultFarm } from '@/data/mockFarms';

// ---- Field Store ----
interface FieldState {
  selectedField: FieldLocation;
  setSelectedField: (field: FieldLocation) => void;
}

export const useFieldStore = create<FieldState>((set) => ({
  selectedField: defaultFarm,
  setSelectedField: (field) => set({ selectedField: field }),
}));

// ---- Farm Profile Store ----
interface FarmProfileState {
  soilProfile: SoilProfile;
  currentCrop: string;
  waterAvailability: 'High' | 'Moderate' | 'Limited';
  irrigationType: 'Irrigated' | 'Rain-fed' | 'Mixed';
  priorities: FarmerPriorities;
  setupComplete: boolean;
  setSoilProfile: (soil: SoilProfile) => void;
  setCurrentCrop: (crop: string) => void;
  setWaterAvailability: (wa: 'High' | 'Moderate' | 'Limited') => void;
  setIrrigationType: (it: 'Irrigated' | 'Rain-fed' | 'Mixed') => void;
  setPriorities: (priorities: FarmerPriorities) => void;
  setSetupComplete: (complete: boolean) => void;
}

export const useFarmProfileStore = create<FarmProfileState>((set) => ({
  soilProfile: {
    soilType: 'Sandy Loam',
    ph: 6.8,
    organicMatter: 2.4,
    nitrogen: 'Medium',
    phosphorus: 'Medium',
    potassium: 'High',
    drainage: 'Well-drained',
  },
  currentCrop: 'Wheat',
  waterAvailability: 'Moderate',
  irrigationType: 'Mixed',
  priorities: {
    waterConservation: 7,
    soilHealth: 6,
    yieldStability: 5,
    climateResilience: 8,
    cropDiversity: 4,
    lowerInputRequirement: 6,
  },
  setupComplete: false,
  setSoilProfile: (soil) => set({ soilProfile: soil }),
  setCurrentCrop: (crop) => set({ currentCrop: crop }),
  setWaterAvailability: (wa) => set({ waterAvailability: wa }),
  setIrrigationType: (it) => set({ irrigationType: it }),
  setPriorities: (priorities) => set({ priorities }),
  setSetupComplete: (complete) => set({ setupComplete: complete }),
}));

// ---- UI Store ----
interface UIState {
  activeMapLayers: MapLayer[];
  selectedDateRange: DateRange;
  sidebarOpen: boolean;
  toggleMapLayer: (layer: MapLayer) => void;
  setDateRange: (range: DateRange) => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeMapLayers: ['boundary', 'vegetation'],
  selectedDateRange: '1y',
  sidebarOpen: true,
  toggleMapLayer: (layer) =>
    set((state) => ({
      activeMapLayers: state.activeMapLayers.includes(layer)
        ? state.activeMapLayers.filter((l) => l !== layer)
        : [...state.activeMapLayers, layer],
    })),
  setDateRange: (range) => set({ selectedDateRange: range }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));

// ---- Scenario Store ----
interface ScenarioState {
  selectedScenarios: string[];
  scenariosGenerated: boolean;
  toggleScenario: (id: string) => void;
  setScenariosGenerated: (generated: boolean) => void;
}

export const useScenarioStore = create<ScenarioState>((set) => ({
  selectedScenarios: [],
  scenariosGenerated: false,
  toggleScenario: (id) =>
    set((state) => ({
      selectedScenarios: state.selectedScenarios.includes(id)
        ? state.selectedScenarios.filter((s) => s !== id)
        : [...state.selectedScenarios, id],
    })),
  setScenariosGenerated: (generated) => set({ scenariosGenerated: generated }),
}));
