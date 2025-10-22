/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/websocket-server.test.js',
  ],
  transform: {
    '^.+\\.(ts|tsx|js|jsx)$' : ['babel-jest', { configFile: './.babelrc.js' }],
  },
};