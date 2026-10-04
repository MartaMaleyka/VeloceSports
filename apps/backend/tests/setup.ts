import { cleanDatabase, runMigrations, seedTestData, teardownDatabase } from './helpers.js';

declare global {
  var testDatabaseAvailable: boolean;
}

global.testDatabaseAvailable = false;

beforeAll(async () => {
  try {
    await runMigrations();
    await cleanDatabase();
    await seedTestData();
    global.testDatabaseAvailable = true;
  } catch (error) {
    global.testDatabaseAvailable = false;
    console.warn('⚠️  Test database not available. Integration tests will be skipped.');
    console.warn(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}, 60000);

afterAll(async () => {
  if (global.testDatabaseAvailable) {
    try {
      await teardownDatabase();
    } catch (error) {
      console.warn('Error during teardown:', error);
    }
  }
});
