import { loadEnv } from './config/env.js';
import { buildApp } from './app.js';
import { scheduleMaintenance, warmDemoFarms } from './services/maintenance.js';

const env = loadEnv();
const { app, services } = await buildApp(env);
const stopMaintenance = scheduleMaintenance(services, app.log);
app.addHook('onClose', async () => stopMaintenance());

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  try {
    await app.close();
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, 'error during shutdown');
    process.exit(1);
  }
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  void warmDemoFarms(services, app.log); // background; does not delay readiness
  app.log.info(`FarmShift API ready: docs at http://localhost:${env.PORT}/docs (provider=${env.ENV_PROVIDER})`);
} catch (err) {
  app.log.error({ err }, 'failed to start');
  process.exit(1);
}
