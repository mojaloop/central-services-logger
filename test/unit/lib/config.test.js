/* eslint-env jest */
'use strict'

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
    // Override the transport file options to include a valid filename
    process.env.CSL_LOG_TRANSPORT = 'file'
    process.env.CSL_TRANSPORT_FILE_OPTIONS__filename = '/tmp/test-logger.log'

    const createMlLogger = require('../../../src/createMlLogger')
    const Logger = createMlLogger()

    expect(Logger.transports[0].name).toBe('file')
  })
})
