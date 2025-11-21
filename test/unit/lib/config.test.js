'use strict'

const Sinon = require('sinon')

describe('config', () => {
  const sandbox = Sinon.createSandbox()
  let originalEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    // Clear module cache before each test
    jest.resetModules()
  })

  afterEach(() => {
    process.env = originalEnv
    sandbox.restore()
  })

  it('process.env.LOG_LEVEL overrides the default.json value', () => {
    // Arrange
    process.env.LOG_LEVEL = 'random_level'

    // Act
    jest.resetModules()
    const config = require('../../../src/lib/config')

    // Assert
    expect(config.level).toBe('random_level')
  })

  it('process.env.LOG_FILTER overrides the default.json value', () => {
    // Arrange
    process.env.LOG_FILTER = 'info,debug'

    // Act
    jest.resetModules()
    const config = require('../../../src/lib/config')

    // Assert
    expect(config.customLevels).toBe('info,debug')
  })

  it('process.env.LOG_TRANSPORT object parsed', () => {
    // Arrange
    process.env.CSL_LOG_TRANSPORT = '{"console":{"type":"console"}}'

    // Act
    jest.resetModules()
    const config = require('../../../src/lib/config')

    // Assert
    expect(config.logTransport.console.type).toBe('console')
  })

  it('Fails to init when LOG_TRANSPORT=file, but filename is not set', () => {
    // Act & Assert
    expect(() => {
      jest.resetModules()
      // Mock the config to have file transport without filename
      jest.doMock('../../../src/lib/config', () => ({
        level: 'info',
        customLevels: '',
        expectedErrorLevel: 'info',
        logTransport: 'file',
        transportFileOptions: {
          filename: ''
        },
        jsonStringifySpacing: 0
      }))
      const createMlLogger = require('../../../src/createMlLogger')
      createMlLogger()
    }).toThrow('Cannot log to file without filename or stream')
  })

  it('uses the file transport when LOG_TRANSPORT=file', () => {
    // Act
    jest.resetModules()
    jest.unmock('../../../src/lib/config')
    // Mock the config to have file transport with filename
    jest.doMock('../../../src/lib/config', () => ({
      level: 'info',
      customLevels: '',
      logTransport: 'file',
      transportFileOptions: {
        filename: '/tmp/test',
        json: false,
        timestamp: true,
        prettyPrint: true,
        colorize: true
      },
      jsonStringifySpacing: 0,
      expectedErrorLevel: 'info'
    }))
    const createMlLogger = require('../../../src/createMlLogger')
    const Logger = createMlLogger()

    // Assert
    expect(Logger.transports[0].name).toBe('file')
  })

  it('uses the console transport when LOG_TRANSPORT=console', () => {
    // Reset all mocks and modules first
    jest.resetModules()
    jest.unmock('../../../src/lib/config')

    // Arrange
    delete process.env.CSL_LOG_TRANSPORT
    delete process.env.CSL_LOG_LEVEL
    delete process.env.LOG_TRANSPORT
    delete process.env.LOG_LEVEL
    process.env.CSL_LOG_TRANSPORT = 'console'
    process.env.CSL_LOG_LEVEL = 'info'

    // Act
    const Logger = require('../../../src/index')

    // Assert
    expect(Logger.transports[0].name).toBe('console')
  })
})
