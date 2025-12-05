/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'

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
    config.expectedErrorLevel = 'info'
    sandbox.restore()
  })

  test('expected errors are logged at console when open telemetry is not active', () => {
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    expect(process.stdout.write.firstCall.args[0]).toContain('error')
  })

  test('expected errors are not logged at console when expectedErrorLevel is false', () => {
    config.expectedErrorLevel = false
    error.expected = 'test.1001'
    context.with(propagation.setBaggage(
      context.active(),
      propagation.createBaggage({ errorExpect: { value: 'test.1001' } })
    ), () => {
      logger.error('test error', error)
    })
    expect(process.stdout.write.notCalled).toBe(true)
  })
})
