process.env.OTEL_LOGS_EXPORTER = 'none'
process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_TRACES_SAMPLER = 'always_off'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'

require('@opentelemetry/auto-instrumentations-node/register')

const Sinon = require('sinon')
const Test = require('tapes')(require('tape'))
const { ContextLogger } = require('../../src/contextLogger')
const { propagation, context } = require('@opentelemetry/api')

Test('logger', function (loggerTest) {
  let sandbox
  const error = new Error('test error')
  error.apiErrorCode = { code: 1001 }
  const logger = new ContextLogger('test')
  loggerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.spy(process.stdout, 'write')
    t.end()
  })
  loggerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })
  loggerTest.test('errors are logged at console', function (assert) {
    logger.error('test error', error)
    assert.ok(process.stdout.write.calledOnce, 'error is logged')
    assert.end()
  })
  loggerTest.test('expected errors are not logged at console when open telemetry is active', function (assert) {
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    assert.ok(process.stdout.write.notCalled, 'expected error is not logged')
    assert.end()
  })
  loggerTest.end()
})
