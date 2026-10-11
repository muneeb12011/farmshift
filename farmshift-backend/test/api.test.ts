import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { loadEnv } from '../src/config/env.js';
import { fakeUpstream, registerUser, testApp } from './helpers.js';

const J = { 'content-type': 'application/json' };

describe('public API', () => {
  it('health, readiness, docs and OpenAPI', async () => {
    const { app } = await testApp();
    expect((await app.inject('/health')).json().status).toBe('ok');
    expect((await app.inject('/ready')).json()).toMatchObject({ status: 'ready', database: 'ok' });
    const spec = (await app.inject('/openapi.json')).json();
    expect(Object.keys(spec.paths).length).toBeGreaterThan(20);
    expect(spec.paths['/api/v1/scenarios/generate'].post).toBeDefined();
    expect((await app.inject('/docs/')).statusCode).toBe(200);
  });

  it('crops: frontend shape by default, agronomy with detail=full, 404 for unknown', async () => {
    const { app } = await testApp();
    const basic = (await app.inject('/api/v1/crops')).json();
    expect(basic).toHaveLength(9);
    expect(Object.keys(basic[0]).sort()).toEqual(['color', 'growingDays', 'icon', 'id', 'name', 'nutrientDemand', 'rootingDepth', 'season', 'waterDemand']);
    const full = (await app.inject('/api/v1/crops/Cover%20Crop?detail=full')).json();
    expect(full.family).toBe('Mixed');
    expect(full.kcAvg).toBeDefined();
    expect((await app.inject('/api/v1/crops/quinoa')).statusCode).toBe(404);
  });

  it('demo farms are seeded and expose the frontend FieldLocation fields', async () => {
    const { app } = await testApp();
    const farms = (await app.inject('/api/v1/farms')).json();
    expect(farms.map((f: { id: string }) => f.id).sort()).toEqual(['green-valley', 'indus-basin', 'kenya-dryland', 'midwest-corn']);
    expect(farms.find((f: { id: string }) => f.id === 'green-valley')).toMatchObject({ lat: 34.02, lon: 71.58, label: 'Green Valley Farm', area: 12.4, demo: true });
    const profile = (await app.inject('/api/v1/farms/green-valley/profile')).json();
    expect(profile).toMatchObject({ currentCrop: 'Wheat', soil: { soilType: 'Sandy Loam', ph: 6.8 }, priorities: { climateResilience: 8 } });
    expect(profile.field.id).toBe('green-valley');
  });

  it('environment summary/timeseries match frontend shapes and carry provenance headers', async () => {
    const { app } = await testApp();
    const res = await app.inject('/api/v1/farms/green-valley/environment/summary');
    expect(res.headers['x-data-provider']).toBe('synthetic');
    const s = res.json();
    for (const k of ['temperature', 'rainfall', 'soilMoisture', 'vegetation', 'waterStress']) expect(s[k]).toBeDefined();
    expect(s.rainfall).toHaveProperty('anomalyPercent');
    expect(s.meta.warnings.join(' ')).toMatch(/NOT observations/);

    const pts = (await app.inject('/api/v1/environment/timeseries?lat=34&lon=71.5&range=30d')).json();
    expect(pts).toHaveLength(31);
    expect(Object.keys(pts[0]).sort()).toEqual(['date', 'evapotranspirationMm', 'ndvi', 'precipitationMm', 'soilMoisturePercent', 'temperatureC']);
    const five = (await app.inject('/api/v1/environment/timeseries?lat=34&lon=71.5&range=5y')).json();
    expect(five.length).toBeLessThan(300); // weekly by default beyond 1y
    const daily = (await app.inject('/api/v1/environment/timeseries?lat=34&lon=71.5&range=6m&resolution=monthly')).json();
    expect(daily.length).toBeLessThanOrEqual(8);
    const env = (await app.inject('/api/v1/environment/timeseries?lat=34&lon=71.5&range=30d&envelope=true')).json();
    expect(env.points).toHaveLength(31);
    expect(env.meta.climate.provider).toBe('synthetic');
  });

  it('validates inputs with a structured error envelope and request id', async () => {
    const { app } = await testApp();
    const bad = await app.inject('/api/v1/environment/summary?lat=200&lon=0');
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toMatchObject({ code: 'VALIDATION_ERROR', details: [{ path: 'lat' }] });
    expect(bad.json().error.requestId).toBe(bad.headers['x-request-id']);
    expect((await app.inject({ method: 'GET', url: '/api/v1/environment/summary?lat=1&lon=1', headers: { 'x-request-id': 'abc-123' } })).headers['x-request-id']).toBe('abc-123');
    expect((await app.inject('/nope')).json().error.code).toBe('NOT_FOUND');
    const malformed = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: '{bad json' });
    expect(malformed.statusCode).toBe(400);
  });
});

describe('bodiless requests that declare JSON', () => {
  it('DELETE and bodiless POST succeed with content-type: application/json; malformed JSON is still 400', async () => {
    const { app } = await testApp();
    const u = await registerUser(app, 'empty@example.com');
    const plan = (await app.inject({ method: 'POST', url: '/api/v1/plans', headers: { ...J, ...u.auth }, payload: { name: 'p', crops: ['wheat'] } })).json();
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/plans/${plan.id}`, headers: { ...J, ...u.auth } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/logout-all', headers: { ...J, ...u.auth } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: '{oops' })).statusCode).toBe(400);
    // a body-requiring route with an empty body is a validation error, not a crash
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J })).statusCode).toBe(400);
  });
});

describe('configuration', () => {
  it('blank values copied from .env.example (KEY=) fall back to defaults instead of crashing', async () => {
    const env = loadEnv({ NODE_ENV: 'development', DATABASE_PATH: ':memory:', LOG_LEVEL: 'silent', ENV_PROVIDER: 'synthetic', JWT_SECRET: '', ANTHROPIC_API_KEY: '', PORT: '' } as NodeJS.ProcessEnv);
    expect(env.JWT_SECRET).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.PORT).toBe(4000);
    const { app, services } = await buildApp(env);
    await app.ready();
    expect(services.narrator.enabled).toBe(false);
    const reg = await app.inject({ method: 'POST', url: '/api/v1/auth/register', payload: { email: 'dev@example.com', password: 'correct horse battery', name: 'Dev' } });
    expect(reg.statusCode).toBe(201); // dev fallback secret signs tokens
  });
  it('production still refuses a blank JWT_SECRET', () => {
    expect(() => loadEnv({ NODE_ENV: 'production', JWT_SECRET: '' } as NodeJS.ProcessEnv)).toThrow(/JWT_SECRET/);
  });
});

describe('CORS', () => {
  const preflight = (app: Awaited<ReturnType<typeof testApp>>['app'], origin: string) =>
    app.inject({ method: 'OPTIONS', url: '/api/v1/scenarios/generate', headers: { origin, 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' } });

  it('development: listed origin and any other localhost port are allowed (next dev may pick :3001); foreign origins are not', async () => {
    const { app } = await testApp({ NODE_ENV: 'development' });
    expect((await preflight(app, 'http://localhost:3000')).headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect((await preflight(app, 'http://localhost:3001')).headers['access-control-allow-origin']).toBe('http://localhost:3001');
    expect((await preflight(app, 'http://127.0.0.1:3005')).headers['access-control-allow-origin']).toBe('http://127.0.0.1:3005');
    expect((await preflight(app, 'https://evil.example')).headers['access-control-allow-origin']).toBeUndefined();
    expect((await preflight(app, 'http://localhost.evil.example')).headers['access-control-allow-origin']).toBeUndefined();
  });
  it('production: strictly the CORS_ORIGINS allow-list', async () => {
    const { app } = await testApp({ NODE_ENV: 'production', CORS_ORIGINS: 'https://app.farmshift.example' });
    expect((await preflight(app, 'https://app.farmshift.example')).headers['access-control-allow-origin']).toBe('https://app.farmshift.example');
    expect((await preflight(app, 'http://localhost:3001')).headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('scenario endpoints', () => {
  it('generate → reopen → one scenario → compare, for an anonymous caller', async () => {
    const { app } = await testApp();
    const gen = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'indus-basin' } });
    expect(gen.statusCode).toBe(200);
    const run = gen.json();
    expect(run.runId).toMatch(/^run_[0-9a-f]{32}$/);
    expect(run.scenarios).toHaveLength(3);
    expect(run.scenarios[0]).toMatchObject({ id: 'scenario-a', name: 'Scenario A: Balanced Productivity' });
    for (const k of ['id', 'name', 'description', 'crops', 'metrics', 'tradeoffs', 'aiExplanation', 'tags', 'overallScore', 'dataSourcesUsed']) expect(run.scenarios[0]).toHaveProperty(k);
    expect(run.baseline.crops).toEqual(['Wheat']);
    expect(run.environment.waterStress.level).toBeDefined();

    expect((await app.inject(`/api/v1/runs/${run.runId}`)).json().scenarios).toHaveLength(3);
    const one = await app.inject(`/api/v1/runs/${run.runId}/scenarios/scenario-b`);
    expect(one.json().id).toBe('scenario-b');
    expect((await app.inject(`/api/v1/runs/${run.runId}/scenarios/zzz`)).statusCode).toBe(404);

    const cmp = (await app.inject({ method: 'POST', url: `/api/v1/runs/${run.runId}/compare`, headers: J, payload: { scenarioIds: ['scenario-a', 'scenario-c'] } })).json();
    expect(cmp.scenarios).toHaveLength(2);
    expect(['scenario-a', 'scenario-c']).toContain(cmp.winners.soilHealth);
    // lower-is-better metrics pick the minimum
    const [a, c] = cmp.scenarios;
    expect(cmp.winners.waterDemand).toBe(a.metrics.waterDemand <= c.metrics.waterDemand ? a.id : c.id);
    expect((await app.inject({ method: 'POST', url: `/api/v1/runs/${run.runId}/compare`, headers: J, payload: { scenarioIds: ['scenario-a'] } })).statusCode).toBe(400);
    expect((await app.inject('/api/v1/runs/run_doesnotexist')).statusCode).toBe(404);
  });

  it('profile overrides merge over the stored profile and change the outcome', async () => {
    const { app } = await testApp();
    const gen = (profile: object) => app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', profile } }).then((r) => r.json());
    const base = await gen({});
    const soilFirst = await gen({ priorities: { soilHealth: 10, waterConservation: 0, yieldStability: 0, climateResilience: 0, cropDiversity: 0, lowerInputRequirement: 0 } });
    expect(JSON.stringify(soilFirst.scenarios.map((s: { overallScore: number }) => s.overallScore))).not.toBe(JSON.stringify(base.scenarios.map((s: { overallScore: number }) => s.overallScore)));
    const maize = await gen({ currentCrop: 'maize' });
    expect(maize.baseline.crops).toEqual(['Maize']);
    expect(maize.scenarios.every((s: { crops: string[] }) => s.crops[0] === 'Maize')).toBe(true);
  });

  it('generate accepts a bare location, options, and rejects bad targets', async () => {
    const { app } = await testApp();
    const ok = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { location: { lat: 41.9, lon: -87.6 }, options: { length: 4, count: 2, excludeCrops: ['rice'] } } });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().scenarios).toHaveLength(2);
    expect(ok.json().scenarios[0].crops).toHaveLength(4);
    const both = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', location: { lat: 1, lon: 1 } } });
    expect(both.statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'nope' } })).statusCode).toBe(404);
    const unknownCrop = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', options: { excludeCrops: ['quinoa'] } } });
    expect(unknownCrop.statusCode).toBe(422);
    expect(unknownCrop.json().error.details.validCrops).toContain('wheat');
    const tooLong = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', options: { length: 9 } } });
    expect(tooLong.statusCode).toBe(400);
  });

  it('evaluate scores a custom rotation and keeps its order', async () => {
    const { app } = await testApp();
    const res = await app.inject({ method: 'POST', url: '/api/v1/scenarios/evaluate', headers: J, payload: { farmId: 'green-valley', rotation: ['Wheat', 'cover crop', 'Soybean'] } });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scenario.crops).toEqual(['Wheat', 'Cover Crop', 'Soybean']);
    expect(body.scenario.name).toBe('Custom Rotation');
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/evaluate', headers: J, payload: { farmId: 'green-valley', rotation: ['wheat', 'quinoa'] } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/api/v1/scenarios/evaluate', headers: J, payload: { farmId: 'green-valley', rotation: [] } })).statusCode).toBe(400);
  });

  it('llm narration without a key degrades with an explicit warning', async () => {
    const { app } = await testApp();
    const r = (await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', narration: 'llm' } })).json();
    expect(r.warnings.join(' ')).toMatch(/ANTHROPIC_API_KEY/);
    expect(r.scenarios[0].narration).toBe('template');
  });

  it('llm narration with a key replaces text only when grounded', async () => {
    const up = fakeUpstream();
    const llm = (async (input: string | URL | Request, init?: RequestInit) => {
      if (!String(input).includes('anthropic')) return up.fetch(input as string, init);
      const facts = JSON.parse(JSON.parse(init!.body as string).messages[0].content);
      const text = JSON.stringify({ aiExplanation: `Overall score ${facts.scenario.overallScore}.`, whyThisMatters: ['a', 'b', 'c', 'd'] });
      return new Response(JSON.stringify({ content: [{ type: 'text', text }] }));
    }) as typeof fetch;
    const { app } = await testApp({ ANTHROPIC_API_KEY: 'sk-test' }, { fetchImpl: llm });
    const r = (await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley', narration: 'llm' } })).json();
    expect(r.scenarios.every((s: { narration: string }) => s.narration === 'llm')).toBe(true);
    expect(r.scenarios[0].aiExplanation).toBe(`Overall score ${r.scenarios[0].overallScore}.`);
  });

  it('upstream outage with ENV_PROVIDER=nasa returns 502, never fabricated data', async () => {
    const up = fakeUpstream();
    up.failAll(true);
    const { app } = await testApp({ ENV_PROVIDER: 'nasa' }, { fetchImpl: up.fetch });
    const res = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley' } });
    expect(res.statusCode).toBe(502);
    expect(res.json().error.code).toBe('UPSTREAM_UNAVAILABLE');
  }, 30_000);

  it('ENV_PROVIDER=auto serves real-path data end to end through the API', async () => {
    const up = fakeUpstream();
    const { app } = await testApp({ ENV_PROVIDER: 'auto', NDVI_ENABLED: 'true', CLIMATE_YEARS: '2', NDVI_YEARS: '1' }, { fetchImpl: up.fetch });
    const res = await app.inject('/api/v1/farms/green-valley/environment/summary');
    expect(res.headers['x-data-provider']).toBe('nasa-power');
    expect(res.json().vegetation.source).toMatch(/MODIS/);
    const gen = (await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley' } })).json();
    expect(gen.scenarios[0].dataSourcesUsed).toEqual(expect.arrayContaining(['NASA POWER (MERRA-2 / CERES)', 'MODIS MOD13Q1 NDVI']));
    expect(up.calls.filter((c) => c.kind === 'nasa')).toHaveLength(1); // second request hit the cache
  });
});

describe('accounts, ownership and plans', () => {
  it('register / login / me with proper failures', async () => {
    const { app } = await testApp();
    const u = await registerUser(app, 'ada@example.com', 'Ada');
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: u.auth })).json()).toMatchObject({ email: 'ada@example.com', name: 'Ada' });
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: J, payload: { email: 'ADA@example.com', password: 'another password', name: 'x' } })).statusCode).toBe(409);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'ada@example.com', password: 'nope nope nope' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'ghost@example.com', password: 'nope nope nope' } })).json().error.message).toBe('Invalid email or password');
    const login = await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'Ada@Example.com', password: 'correct horse battery' } });
    expect(login.statusCode).toBe(200);
    expect(login.json().token).toBeTruthy();
    expect((await app.inject('/api/v1/auth/me')).statusCode).toBe(401);
    expect((await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { authorization: 'Bearer junk' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: J, payload: { email: 'x', password: 'short', name: '' } })).statusCode).toBe(400);
  });

  it('never stores or returns password hashes', async () => {
    const { app } = await testApp();
    const r = await app.inject({ method: 'POST', url: '/api/v1/auth/register', headers: J, payload: { email: 'h@example.com', password: 'correct horse battery', name: 'H' } });
    expect(JSON.stringify(r.json())).not.toMatch(/scrypt|password/i);
  });

  it('login is rate limited', async () => {
    const { app } = await testApp();
    let last = 0;
    for (let i = 0; i < 12; i++) last = (await app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: J, payload: { email: 'a@b.co', password: 'whatever pass' } })).statusCode;
    expect(last).toBe(429);
  });

  it('farm CRUD, profile validation, demo immutability and strict tenant isolation', async () => {
    const { app } = await testApp();
    const ada = await registerUser(app, 'ada@example.com');
    const eve = await registerUser(app, 'eve@example.com');
    expect((await app.inject({ method: 'POST', url: '/api/v1/farms', headers: J, payload: { label: 'x', lat: 1, lon: 1, area: 1 } })).statusCode).toBe(401);

    const created = await app.inject({ method: 'POST', url: '/api/v1/farms', headers: { ...J, ...ada.auth }, payload: { label: 'My plot', lat: 31.5, lon: 74.3, area: 5.5, profile: { currentCrop: 'chickpea', irrigationType: 'Irrigated' } } });
    expect(created.statusCode).toBe(201);
    const farm = created.json();
    expect(farm.demo).toBe(false);

    const prof = (await app.inject({ method: 'GET', url: `/api/v1/farms/${farm.id}/profile`, headers: ada.auth })).json();
    expect(prof.currentCrop).toBe('Chickpea'); // canonicalised
    expect((await app.inject({ method: 'PUT', url: `/api/v1/farms/${farm.id}/profile`, headers: { ...J, ...ada.auth }, payload: { currentCrop: 'quinoa' } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'PUT', url: `/api/v1/farms/${farm.id}/profile`, headers: { ...J, ...ada.auth }, payload: { soil: { ...prof.soil, ph: 15 } } })).statusCode).toBe(400);

    expect((await app.inject({ method: 'PATCH', url: `/api/v1/farms/${farm.id}`, headers: { ...J, ...ada.auth }, payload: { area: 9 } })).json().area).toBe(9);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/farms/${farm.id}`, headers: { ...J, ...ada.auth }, payload: {} })).statusCode).toBe(400);

    // owner sees it in her list; others and anonymous do not
    const ids = async (h?: Record<string, string>) => (await app.inject({ method: 'GET', url: '/api/v1/farms', headers: h })).json().map((f: { id: string }) => f.id);
    expect(await ids(ada.auth)).toContain(farm.id);
    expect(await ids(eve.auth)).not.toContain(farm.id);
    expect(await ids()).not.toContain(farm.id);
    for (const [method, url] of [['GET', `/api/v1/farms/${farm.id}`], ['GET', `/api/v1/farms/${farm.id}/environment/summary`], ['DELETE', `/api/v1/farms/${farm.id}`]] as const) {
      expect((await app.inject({ method, url, headers: eve.auth })).statusCode).toBe(404);
      if (method === 'GET') expect((await app.inject({ method, url })).statusCode).toBe(404);
    }
    const genOther = await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: { ...J, ...eve.auth }, payload: { farmId: farm.id } });
    expect(genOther.statusCode).toBe(404);

    // demo farms are readable by all and immutable
    expect((await app.inject({ method: 'PATCH', url: '/api/v1/farms/green-valley', headers: { ...J, ...ada.auth }, payload: { label: 'hax' } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'DELETE', url: '/api/v1/farms/green-valley', headers: ada.auth })).statusCode).toBe(403);

    expect((await app.inject({ method: 'DELETE', url: `/api/v1/farms/${farm.id}`, headers: ada.auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: `/api/v1/farms/${farm.id}`, headers: ada.auth })).statusCode).toBe(404);
  });

  it('owned runs are private; anonymous runs are reachable only by their unguessable id', async () => {
    const { app } = await testApp();
    const ada = await registerUser(app, 'ada@example.com');
    const eve = await registerUser(app, 'eve@example.com');
    const mine = (await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: { ...J, ...ada.auth }, payload: { farmId: 'green-valley' } })).json();
    expect((await app.inject({ method: 'GET', url: `/api/v1/runs/${mine.runId}`, headers: ada.auth })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: `/api/v1/runs/${mine.runId}`, headers: eve.auth })).statusCode).toBe(404);
    expect((await app.inject(`/api/v1/runs/${mine.runId}`)).statusCode).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/v1/runs', headers: ada.auth })).json().total).toBe(1);
    expect((await app.inject({ method: 'GET', url: '/api/v1/runs', headers: eve.auth })).json().total).toBe(0);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/runs/${mine.runId}`, headers: eve.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/runs/${mine.runId}`, headers: ada.auth })).statusCode).toBe(204);

    const anon = (await app.inject({ method: 'POST', url: '/api/v1/scenarios/generate', headers: J, payload: { farmId: 'green-valley' } })).json();
    expect((await app.inject(`/api/v1/runs/${anon.runId}`)).statusCode).toBe(200);
  });

  it('plans: create with engine snapshot, list, edit (re-score), delete, and isolation', async () => {
    const { app } = await testApp();
    const ada = await registerUser(app, 'ada@example.com');
    const eve = await registerUser(app, 'eve@example.com');
    const h = { ...J, ...ada.auth };
    const p = await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'Plan A', crops: ['wheat', 'chickpea', 'cover crop'], farmId: 'green-valley', notes: 'try it' } });
    expect(p.statusCode).toBe(201);
    const plan = p.json();
    expect(plan.crops).toEqual(['Wheat', 'Chickpea', 'Cover Crop']);
    expect(plan.metrics.soilHealth).toBeGreaterThan(0);
    expect(plan.overallScore).toBeGreaterThan(0);

    const noFarm = (await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'Unscored', crops: ['wheat'] } })).json();
    expect(noFarm.metrics).toBeNull();
    // saved from the scenarios page: the metrics the user saw are stored as-is (validated)
    const m = { waterDemand: 30, soilHealth: 70, climateCompatibility: 80, cropDiversity: 60, nutrientPressure: 25, environmentalResilience: 65 };
    const fromUi = (await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'From UI', crops: ['wheat', 'chickpea'], metrics: m, overallScore: 72 } })).json();
    expect(fromUi.metrics).toEqual(m);
    expect(fromUi.overallScore).toBe(72);
    expect((await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'bad', crops: ['wheat'], metrics: { ...m, soilHealth: 'x' } } })).statusCode).toBe(400);
    await app.inject({ method: 'DELETE', url: `/api/v1/plans/${fromUi.id}`, headers: ada.auth });

    const edited = (await app.inject({ method: 'PATCH', url: `/api/v1/plans/${plan.id}`, headers: h, payload: { crops: ['Wheat', 'Cotton'] } })).json();
    expect(edited.crops).toEqual(['Wheat', 'Cotton']);
    expect(edited.overallScore).not.toBe(plan.overallScore);
    expect((await app.inject({ method: 'PATCH', url: `/api/v1/plans/${plan.id}`, headers: h, payload: { name: 'Renamed' } })).json().overallScore).toBe(edited.overallScore); // rename does not re-score

    const list = (await app.inject({ method: 'GET', url: '/api/v1/plans?limit=1', headers: ada.auth })).json();
    expect(list.total).toBe(2);
    expect(list.items).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/v1/plans?farmId=green-valley', headers: ada.auth })).json().total).toBe(1);

    expect((await app.inject({ method: 'GET', url: `/api/v1/plans/${plan.id}`, headers: eve.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/plans/${plan.id}`, headers: eve.auth })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'bad', crops: ['quinoa'] } })).statusCode).toBe(422);
    expect((await app.inject({ method: 'POST', url: '/api/v1/plans', headers: h, payload: { name: 'priv', crops: ['wheat'], farmId: 'not-a-farm' } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/api/v1/plans/${plan.id}`, headers: ada.auth })).statusCode).toBe(204);
    expect((await app.inject({ method: 'GET', url: '/api/v1/plans', headers: J })).statusCode).toBe(401);
  });
});
