/** @type {import('jest').Config} */
const isCI = !!(process.env.GITHUB_ACTIONS || process.env.CI);

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
  testMatch: isCI ? ['<rootDir>/__no_tests_in_ci__'] : ['<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: isCI ? ['<rootDir>'] : [],
  setupFiles: isCI ? [] : ['<rootDir>/tests/env.ts'],
  setupFilesAfterEnv: isCI ? [] : ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/config/**',
    '!src/scripts/**',
  ],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
