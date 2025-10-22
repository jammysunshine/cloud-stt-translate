/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['@testing-library/jest-dom', '<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '\\.(css|less|sass|scss)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1', // Adjust if your project uses path aliases
  },
  testMatch: [
    '<rootDir>/src/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/*startup*.test.js',
    '<rootDir>/nextjs*.test.js',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$' : ['babel-jest', { configFile: './.babelrc.js' }],
  },
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\\\.mjs$|@testing-library/react|@testing-library/jest-dom|ws)/)',
  ],
};