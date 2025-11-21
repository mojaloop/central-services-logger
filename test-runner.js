#!/usr/bin/env node

/**
 * Custom test runner to replace tapes package
 * Uses modern glob API (v10.5.0+) to avoid security vulnerabilities
 */

const path = require('path')
const { glob } = require('glob')

// Get the pattern from command line arguments
const pattern = process.argv[2]

if (!pattern) {
  console.error('Usage: node test-runner.js <glob-pattern>')
  process.exit(1)
}

// Run the glob pattern and require all matching files
async function runTests () {
  try {
    const files = await glob(pattern, { cwd: process.cwd() })

    if (files.length === 0) {
      console.error(`No files found matching pattern: ${pattern}`)
      process.exit(1)
    }

    // Require each test file - this will execute the tests
    files.forEach(file => {
      require(path.resolve(process.cwd(), file))
    })
  } catch (error) {
    console.error('Error running tests:', error)
    process.exit(1)
  }
}

runTests()
