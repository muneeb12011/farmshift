import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { ARCHETYPES, ENGINE_VERSION } from '../engine/index.js';
import type { Services } from '../services/container.js';

export async function healthRoutes(app: FastifyInstance, svc: Services) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/health', { schema: { tags: ['system'], summary: 'Liveness probe', response: { 200: z.object({ status: z.literal('ok'), uptimeSeconds: z.number() }) } } }, async () => ({
    status: 'ok' as const,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  r.get(
    '/ready',
    {
      schema: {
        tags: ['system'],
        summary: 'Readiness probe (database reachable; reports provider configuration)',
        response: { 200: z.object({ status: z.literal('ready'), database: z.literal('ok'), engineVersion: z.string(), providers: z.object({ environment: z.string(), ndvi: z.boolean(), llmNarration: z.boolean() }) }) },
      },
    },
    async () => {
      await svc.sql.ping();
      return {
        status: 'ready' as const,
        database: 'ok' as const,
        engineVersion: ENGINE_VERSION,
        providers: { environment: svc.env.ENV_PROVIDER, ndvi: svc.env.NDVI_ENABLED, llmNarration: svc.narrator.enabled },
      };
    },
  );
}

export async function metaRoutes(app: FastifyInstance) {
  const r = app.withTypeProvider<ZodTypeProvider>();

  r.get('/meta/sources', { schema: { tags: ['meta'], summary: 'Data sources, methods and their limits', response: { 200: z.any() } } }, async () => ({
    dataSources: [
      {
        id: 'nasa-power',
        name: 'NASA POWER daily point API (AG community)',
        provides: ['air temperature (mean/max/min)', 'corrected precipitation', 'relative humidity', 'wind at 2 m', 'surface shortwave radiation', 'root-zone soil wetness (GWETROOT, 0-1)'],
        notes: 'Reanalysis/satellite-derived on a ~0.5° grid (MERRA-2, CERES). Soil wetness is a model product, not SMAP. Publishes with a lag of a few days.',
        url: 'https://power.larc.nasa.gov/docs/services/api/',
      },
      {
        id: 'modis-mod13q1',
        name: 'MODIS Terra MOD13Q1 NDVI via ORNL DAAC REST subset service',
        provides: ['NDVI, 250 m, 16-day composites at the field point'],
        notes: 'Linearly interpolated to daily. Dates before the observed span use a day-of-year climatology; if the service is unreachable a phenology model is used and labelled "estimated".',
        url: 'https://modis.ornl.gov/data/modis_webservice.html',
      },
      {
        id: 'synthetic',
        name: 'Synthetic climate model',
        provides: ['plausible latitude-driven climate'],
        notes: 'Offline/last-resort fallback only. Never observations; every response using it carries a warning.',
      },
    ],
    methods: [
      { id: 'et0', name: 'Reference evapotranspiration', method: 'FAO-56 Penman-Monteith, daily step, G = 0', reference: 'Allen et al. 1998, FAO I&D Paper 56' },
      { id: 'effective-rain', name: 'Effective rainfall', method: 'USDA Soil Conservation Service method, scaled to the crop window' },
      { id: 'crop-water', name: 'Crop water requirement', method: 'ETc = ET0 × season-average Kc; relative yield = 1 − Ky(1 − supply ratio)', reference: 'FAO I&D Papers 33 and 56' },
      { id: 'water-stress', name: 'Water stress level', method: 'Composite of root-zone wetness deficit (45%), 30-day climatic deficit 1 − P/ET0 (35%) and rainfall anomaly (20%): <0.25 Low, <0.5 Moderate, <0.75 High, else Critical' },
    ],
    limits: [
      'Scenario scores rank rotations; they are not yield, profit or guarantee predictions.',
      'The agronomy knowledge base uses first-order, region-agnostic parameters. Local varieties, markets, pests and soils will differ.',
    ],
  }));

  r.get('/meta/engine', { schema: { tags: ['meta'], summary: 'Scenario engine version, archetypes and metric definitions', response: { 200: z.any() } } }, async () => ({
    version: ENGINE_VERSION,
    archetypes: ARCHETYPES.map((a) => ({ id: a.id, letter: a.letter, label: a.label, blurb: a.blurb })),
    metrics: {
      waterDemand: '0-100, higher = thirstier. 50% mean crop ET / 900 mm + 50% mean irrigation need / 700 mm.',
      soilHealth: '0-100. Residue input, N credit, ground cover, rooting-depth contrast and pest/disease break, adjusted for starting organic matter.',
      climateCompatibility: '0-100. Season temperature response, water-limited yield, heat-stress days, soil pH and drainage fit.',
      cropDiversity: '0-100. Distinct crops and plant families in the cycle.',
      nutrientPressure: '0-100, higher = more fertiliser N needed after legume credit.',
      environmentalResilience: '0-100. Drought tolerance (weighted by local aridity), diversity, water supply cover, ground cover, heat suitability.',
    },
    overallScore: 'Priority-weighted mean of six components (farmer priorities 0-10 normalised to weights), minus a penalty for water-limited crop slots.',
  }));
}
