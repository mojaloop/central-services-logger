module.exports = {
  verbose: true,
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
  testMatch: ['<rootDir>/test/jest/**/*.test.js']
  // todo: rewrite all existing tests to use jest (instead of Tape)
}
