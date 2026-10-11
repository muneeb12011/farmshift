// ============================================
// FARMSHIFT — MOCK ROTATION SCENARIOS
// ============================================

import { RotationScenario } from '@/types';

export const mockScenarios: RotationScenario[] = [
  {
    id: 'scenario-a',
    name: 'Scenario A: Balanced Productivity',
    description:
      'A balanced rotation combining cereal production with legume nitrogen fixation. Strong alignment with selected priorities.',
    crops: ['Wheat', 'Maize', 'Chickpea'],
    metrics: {
      waterDemand: 68,
      soilHealth: 72,
      climateCompatibility: 76,
      cropDiversity: 65,
      nutrientPressure: 58,
      environmentalResilience: 71,
    },
    tradeoffs: {
      advantages: [
        'Balanced water demand across seasons',
        'Legume phase restores soil nitrogen',
        'Strong cereal yield potential',
      ],
      disadvantages: [
        'Moderate overall water requirement',
        'Limited crop diversity',
        'Maize phase has high nutrient demand',
      ],
    },
    aiExplanation:
      'This rotation balances productivity with soil health maintenance. The chickpea phase introduces biological nitrogen fixation, reducing fertilizer dependency for the subsequent wheat crop. However, the maize phase requires careful water management given your field\'s below-average soil moisture levels.',
    tags: ['Balanced', 'Nitrogen Fixer'],
    overallScore: 74,
    dataSourcesUsed: ['NASA POWER', 'SMAP L4', 'MODIS NDVI'],
  },
  {
    id: 'scenario-b',
    name: 'Scenario B: Water Resilient',
    description:
      'Prioritizes water conservation through drought-tolerant crop selection. Estimated lower water demand while maintaining diversity.',
    crops: ['Wheat', 'Millet', 'Chickpea'],
    metrics: {
      waterDemand: 42,
      soilHealth: 78,
      climateCompatibility: 82,
      cropDiversity: 72,
      nutrientPressure: 45,
      environmentalResilience: 85,
    },
    tradeoffs: {
      advantages: [
        'Significantly lower water demand',
        'High climate resilience',
        'Improved soil structure from deep-rooting millet',
      ],
      disadvantages: [
        'Lower potential yield than maize-based rotations',
        'Millet market may be limited in some regions',
        'Requires management of different crop types',
      ],
    },
    aiExplanation:
      'Your selected field shows below-average soil moisture relative to its historical range. Because water conservation is one of your highest priorities, Scenario B features drought-tolerant millet and chickpea, reducing estimated water demand by approximately 38% compared to Scenario A. The deep rooting system of millet also improves soil structure.',
    tags: ['Water Saver', 'Climate Resilient', 'Nitrogen Fixer'],
    overallScore: 81,
    dataSourcesUsed: ['NASA POWER', 'SMAP L4', 'MODIS NDVI', 'ECOSTRESS'],
  },
  {
    id: 'scenario-c',
    name: 'Scenario C: Soil Regenerative',
    description:
      'Maximizes soil restoration through legume inclusion and cover cropping. Estimated strong environmental resilience.',
    crops: ['Wheat', 'Chickpea', 'Cover Crop'],
    metrics: {
      waterDemand: 35,
      soilHealth: 91,
      climateCompatibility: 79,
      cropDiversity: 80,
      nutrientPressure: 28,
      environmentalResilience: 88,
    },
    tradeoffs: {
      advantages: [
        'Excellent soil health restoration',
        'Very low nutrient pressure',
        'Cover crop prevents erosion and builds organic matter',
      ],
      disadvantages: [
        'Cover crop year has no direct economic yield',
        'Requires 3-year planning commitment',
        'Lower total production output',
      ],
    },
    aiExplanation:
      'This rotation prioritizes long-term soil health and environmental sustainability. The cover crop phase, while not generating direct revenue, significantly reduces erosion risk and builds soil organic matter. Combined with chickpea nitrogen fixation, this sequence is estimated to reduce nutrient input requirements by over 50% compared to continuous cereal production.',
    tags: ['Soil Builder', 'Low Input', 'Erosion Control', 'Nitrogen Fixer'],
    overallScore: 78,
    dataSourcesUsed: ['NASA POWER', 'SMAP L4', 'MODIS NDVI', 'Landsat'],
  },
];

export const currentPlanMetrics = {
  waterDemand: 85,
  soilHealth: 45,
  climateCompatibility: 52,
  cropDiversity: 20,
  nutrientPressure: 82,
  environmentalResilience: 38,
};

export function getScenarios(): RotationScenario[] {
  return mockScenarios;
}

export function getScenarioById(id: string): RotationScenario | undefined {
  return mockScenarios.find((s) => s.id === id);
}
