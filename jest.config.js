module.exports = {
  verbose: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/contextLogger.js',
    '!src/createMlLogger.js'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      functions: 90,
      branches: 90,
      lines: 90
    }
  },
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary'],
  coverageProvider: 'v8',
  testMatch: [
    '<rootDir>/test/jest/**/*.test.js',
    '<rootDir>/test/unit/**/*.test.js',
    '<rootDir>/test/unit/**/*.otel.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ],
  testEnvironment: 'node'
}
