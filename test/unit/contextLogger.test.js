process.env.CSL_LOG_LEVEL = 'info'

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
    config.expectedErrorLevel = 'info'
    process.stdout.write = originalWrite
    sandbox.restore()
  })

  it('expected errors are logged at console when open telemetry is not active', (done) => {
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('error')
      expect(output).toContain('test error')
      done()
    }, 10)
  })

  it('expected errors are not logged at console when expectedErrorLevel is false', (done) => {
    config.expectedErrorLevel = false
    error.expected = 'test.1001'
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })

    setTimeout(() => {
      const output = capturedOutput.join('')
      // When expectedErrorLevel is false, error should not be logged
      expect(output).toBe('')
      done()
    }, 10)
  })
})
