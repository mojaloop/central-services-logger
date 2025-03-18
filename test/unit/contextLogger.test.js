process.env.CSL_LOG_LEVEL = 'info'

const Sinon = require('sinon')
const { propagation, context } = require('@opentelemetry/api')
const Test = require('tapes')(require('tape'))

const { ContextLogger } = require('../../src/contextLogger')
const config = require('../../src/lib/config')

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
    config.expectedErrorLevel = 'info'
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
    assert.ok(process.stdout.write.firstCall.args[0].includes('error'), 'expected error is logged at error level')
    assert.end()
  })
  loggerTest.test('expected errors are not logged at console when expectedErrorLevel is false', function (assert) {
    config.expectedErrorLevel = false
    error.expected = 'test.1001'
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
