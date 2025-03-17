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
  loggerTest.test('expected errors are logged at console when open telemetry is not active', function (assert) {
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    assert.ok(process.stdout.write.calledOnce, 'expected error is logged')
    assert.end()
  })
  loggerTest.end()
})
