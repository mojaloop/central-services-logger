process.env.OTEL_LOGS_EXPORTER = 'none'
process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_TRACES_SAMPLER = 'always_off'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'
process.env.CSL_LOG_LEVEL = 'info'

require('@opentelemetry/auto-instrumentations-node/register')

const Sinon = require('sinon')
const { propagation, context } = require('@opentelemetry/api')

const { ContextLogger } = require('../../src/contextLogger')
const config = require('../../src/lib/config')

describe('logger', () => {
  let sandbox
  const error = new Error('test error')
  error.apiErrorCode = { code: 1001 }
  const logger = new ContextLogger('test')

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    sandbox.spy(process.stdout, 'write')
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('errors are logged at console', () => {
    logger.error('test error', error)
    expect(process.stdout.write.calledOnce).toBeTruthy()
  })

  it('expected errors are not logged at console when open telemetry is active', () => {
    config.expectedErrorLevel = false
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    expect(process.stdout.write.notCalled).toBeTruthy()
  })

  it('expected errors are logged at info level at console when open telemetry is active and expectedErrorLevel=info', () => {
    config.expectedErrorLevel = 'info'
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    expect(process.stdout.write.firstCall.args[0].includes('info')).toBeTruthy()
  })
})
