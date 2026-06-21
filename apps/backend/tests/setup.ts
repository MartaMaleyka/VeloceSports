import { cleanDatabase, runMigrations, seedTestData, teardownDatabase } from './helpers.js';

beforeAll(async () => {
  await runMigrations();
  await cleanDatabase();
  await seedTestData();
}, 60000);

afterAll(async () => {
  await teardownDatabase();
});
