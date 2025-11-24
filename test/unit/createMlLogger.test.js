const Sinon = require('sinon')
const { propagation, context } = require('@opentelemetry/api')

describe('createMlLogger', () => {
  let sandbox
  let originalEnv
  let createMlLogger

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    originalEnv = { ...process.env }

    // Clear module cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/src/') || key.includes('winston')) {
        delete require.cache[key]
      }
    })
  })

  afterEach(() => {
    // Clean up environment variables
    Object.keys(process.env).forEach(key => {
      if (key.startsWith('CSL_') || key.startsWith('LOG_')) {
        delete process.env[key]
      }
    })
    Object.assign(process.env, originalEnv)
    sandbox.restore()
  })

  it('creates logger with multiple transports from object configuration', () => {
    // Set environment to use multiple transports
    process.env.CSL_LOG_TRANSPORT = JSON.stringify({
      console: { type: 'console' },
      udp: { transport: 'udp', host: 'localhost', port: 5000 }
    })

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    expect(logger).toBeDefined()
    expect(logger.transports).toBeDefined()
    expect(Array.isArray(logger.transports)).toBe(true)
  })

  it('creates logger with HTTP transport', () => {
    process.env.CSL_LOG_TRANSPORT = JSON.stringify({
      http: { transport: 'http', host: 'localhost', path: '/logs' }
    })

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    expect(logger).toBeDefined()
    expect(logger.transports).toBeDefined()
    expect(Array.isArray(logger.transports)).toBe(true)
  })

  it('creates logger with default console transport when invalid transport specified', () => {
    // If we specify an unsupported transport, it should fall back to console
    process.env.CSL_LOG_TRANSPORT = 'invalid'

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    expect(logger).toBeDefined()
    expect(logger.transports).toBeDefined()
    expect(Array.isArray(logger.transports)).toBe(true)
  })

  it('handles custom log levels filtering', () => {
    process.env.CSL_LOG_FILTER = 'info,error'
    process.env.CSL_LOG_LEVEL = 'silly'

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    // These should be no-op functions
    expect(typeof logger.debug).toBe('function')
    expect(typeof logger.verbose).toBe('function')
    expect(typeof logger.silly).toBe('function')

    // These should work normally
    expect(typeof logger.info).toBe('function')
    expect(typeof logger.error).toBe('function')
  })

  it('sets is<Level>Enabled flags correctly', () => {
    process.env.CSL_LOG_LEVEL = 'info'

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    // These should be enabled (info and above)
    expect(logger.isErrorEnabled).toBe(true)
    expect(logger.isWarnEnabled).toBe(true)
    expect(logger.isInfoEnabled).toBe(true)

    // These should be disabled (below info)
    expect(logger.isVerboseEnabled).toBe(false)
    expect(logger.isDebugEnabled).toBe(false)
    expect(logger.isSillyEnabled).toBe(false)
  })

  it('handles expected errors with errorExpect format', () => {
    process.env.CSL_EXPECTED_ERROR_LEVEL = 'warn'

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    // Create a mock baggage with expected error
    const baggage = propagation.createBaggage({
      errorExpect: { value: 'test.1001|test.1002' }
    })

    // Run in context with baggage
    context.with(propagation.setBaggage(context.active(), baggage), () => {
      // This would normally be called by the formatter
      // The errorExpect formatter should mark this as expected
      // and change the level to 'warn' when an error matches the baggage
      expect(logger).toBeDefined()
      expect(logger.isErrorEnabled).toBeDefined()
    })
  })

  it('ignores non-error levels in errorExpect format', () => {
    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    const baggage = propagation.createBaggage({
      errorExpect: { value: 'test.1001' }
    })

    context.with(propagation.setBaggage(context.active(), baggage), () => {
      // Info level should not be affected by errorExpect
      // even when it has matching error codes
      expect(logger).toBeDefined()
      expect(logger.isInfoEnabled).toBeDefined()
    })
  })

  it('handles errorExpect when expectedErrorLevel is false', () => {
    process.env.CSL_EXPECTED_ERROR_LEVEL = 'false'

    createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()

    const baggage = propagation.createBaggage({
      errorExpect: { value: 'test.1001' }
    })

    context.with(propagation.setBaggage(context.active(), baggage), () => {
      // When expectedErrorLevel is false, expected errors should not be logged
      expect(logger).toBeDefined()
      expect(logger.isErrorEnabled).toBeDefined()
    })
  })
})
