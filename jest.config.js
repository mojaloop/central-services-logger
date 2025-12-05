module.exports = {
  verbose: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '**/src/**/**/*.js'
  ],
  coverageThreshold: {
    global: {
      statements: 90,
      functions: 90,
      branches: 90,
      lines: 90
    }
  },
  testMatch: [
    '<rootDir>/test/jest/**/*.test.js',
    '<rootDir>/test/unit/**/*.test.js'
  ],
  testPathIgnorePatterns: [
    '/node_modules/'
  ]
}
