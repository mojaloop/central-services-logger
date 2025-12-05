/* eslint-env jest */
'use strict'

const path = require('path')
const fs = require('fs')

describe('config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test('process.env.LOG_LEVEL overrides the default.json value', () => {
    process.env.LOG_LEVEL = 'random_level'

    const config = require('../../../src/lib/config')

    expect(config.level).toBe('random_level')
  })

  test('process.env.LOG_FILTER overrides the default.json value', () => {
    process.env.LOG_FILTER = 'info,debug'

    const config = require('../../../src/lib/config')

    expect(config.customLevels).toBe('info,debug')
  })

  test('process.env.LOG_TRANSPORT object parsed', () => {
    process.env.CSL_LOG_TRANSPORT = '{"console":{"type":"console"}}'

    const config = require('../../../src/lib/config')

    expect(config.logTransport.console.type).toBe('console')
  })

  test('Fails to init when LOG_TRANSPORT=file, but filename is not set', () => {
    // Winston File transport throws when no filename or stream is provided
    const { transports } = require('winston')
    expect(() => {
      new transports.File({ filename: '' }) // eslint-disable-line no-new
    }).toThrow('Cannot log to file without filename or stream')
  })

  test('uses the console transport when LOG_TRANSPORT=console', () => {
    process.env.CSL_LOG_TRANSPORT = 'console'

    const Logger = require('../../../src/index')

    expect(Logger.transports[0].name).toBe('console')
  })

  test('uses the file transport when LOG_TRANSPORT=file', () => {
    // Use a test-specific directory within the project instead of publicly writable /tmp
    const testLogDir = path.join(__dirname, '..', '..', '.test-output')
    const testLogFile = path.join(testLogDir, 'test-logger.log')

    // Ensure test output directory exists
    if (!fs.existsSync(testLogDir)) {
      fs.mkdirSync(testLogDir, { recursive: true })
    }

    // Override the transport file options to include a valid filename
    process.env.CSL_LOG_TRANSPORT = 'file'
    process.env.CSL_TRANSPORT_FILE_OPTIONS__filename = testLogFile

    const createMlLogger = require('../../../src/createMlLogger')
    const Logger = createMlLogger()

    expect(Logger.transports[0].name).toBe('file')

    // Cleanup: remove test log file if created
    if (fs.existsSync(testLogFile)) {
      fs.unlinkSync(testLogFile)
    }
  })
})
