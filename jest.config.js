/** jest.config.js */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts'],
  // setup-env.ts lives in __tests__ but is not a suite — without this, jest fails it
  // with "Your test suite must contain at least one test".
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/src/__tests__/setup-env.ts'],
  // Runs before any module import, so the app boots against biosustain_test and never
  // against a DATABASE_URL inherited from the environment.
  setupFiles: ['<rootDir>/src/__tests__/setup-env.ts'],
};
