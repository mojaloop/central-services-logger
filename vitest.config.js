const { defineConfig } = require('vitest/config')

module.exports = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'test/jest/**/*.test.js',
      'test/unit/**/*.test.js',
      'test/unit/**/*.otel.js'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90
      },
      exclude: [
        'node_modules',
        'test',
        'coverage',
        '*.config.js',
        'test-runner.js'
      ],
      include: [
        'src/**/*.js'
      ],
      excludeNodeModules: true,
      all: true,
      clean: true,
      skipFull: false,
      watermarks: {
        lines: [90, 95],
        functions: [90, 95],
        branches: [90, 95],
        statements: [90, 95]
      }
    },
    reporters: ['default', 'junit'],
    outputFile: {
      junit: './test/results/xunit.xml'
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
