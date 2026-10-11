import { afterEach } from 'vitest';
import { closeAllApps } from './helpers.js';

afterEach(async () => {
  await closeAllApps();
});
