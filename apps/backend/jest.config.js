/** @type {import('jest').Config} */
const isCI = process.env.GITHUB_ACTIONS || process.env.CI;

export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  testMatch: isCI ? [] : ['**/tests/**/*.test.ts'],
  setupFiles: isCI ? [] : ['<rootDir>/tests/env.ts'],
  setupFilesAfterEnv: isCI ? [] : ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
};
