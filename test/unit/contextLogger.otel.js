process.env.OTEL_LOGS_EXPORTER = 'none'
process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_TRACES_SAMPLER = 'always_off'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'
process.env.CSL_LOG_LEVEL = 'info'

require('@opentelemetry/auto-instrumentations-node/register')

const Sinon = require('sinon')
const { propagation, context } = require('@opentelemetry/api')

const config = require('../../src/lib/config')

describe('logger', () => {
  let sandbox
  let ContextLogger
  let logger
  let capturedOutput = []
  let originalWrite
  const error = new Error('test error')
  error.apiErrorCode = { code: 1001 }

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    capturedOutput = []

    // Clear the module cache to force re-initialization
    delete require.cache[require.resolve('../../src/contextLogger')]
    delete require.cache[require.resolve('../../src/createMlLogger')]
    delete require.cache[require.resolve('../../src/index')]
    delete require.cache[require.resolve('../../src/ConsoleTransport')]

    // Capture stdout.write before loading winston
    originalWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = function (chunk, encoding, callback) {
      if (chunk) {
        capturedOutput.push(chunk.toString())
      }
      return originalWrite(chunk, encoding, callback)
    }

    // Re-require after setting up the spy
    ContextLogger = require('../../src/contextLogger').ContextLogger
    logger = new ContextLogger('test')
  })

  afterEach(() => {
    process.stdout.write = originalWrite
    config.expectedErrorLevel = 'info'
    sandbox.restore()
  })

  it('errors are logged at console', (done) => {
    logger.error('test error', error)

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('error')
      expect(output).toContain('test error')
      done()
    }, 10)
  })

  it('expected errors are not logged at console when open telemetry is active', (done) => {
    config.expectedErrorLevel = false
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })

    setTimeout(() => {
      const output = capturedOutput.join('')
      // When expectedErrorLevel is false and error is expected, should not be logged
      expect(output).toBe('')
      done()
    }, 10)
  })

  it('expected errors are logged at info level at console when open telemetry is active and expectedErrorLevel=info', (done) => {
    config.expectedErrorLevel = 'info'
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })

    setTimeout(() => {
      const output = capturedOutput.join('')
      // When expectedErrorLevel is 'info', expected errors should be logged at info level
      expect(output).toContain('info')
      expect(output).toContain('test error')
      done()
    }, 10)
  })
})
