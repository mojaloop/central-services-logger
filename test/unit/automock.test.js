/* eslint-env jest */
// quoting-service (and others) rely on `jest.mock('@mojaloop/central-services-logger')` automocking
// the default export — the mock must expose every level method plus child/push/log as mock functions.
jest.mock('../../src/index')

const Logger = require('../../src/index')

describe('jest automock shape', () => {
  test('level methods, child, push, log and isLevelEnabled are mock functions', () => {
    const methods = ['error', 'warn', 'audit', 'trace', 'info', 'perf', 'verbose', 'debug', 'silly', 'child', 'push', 'log', 'isLevelEnabled', 'flush', 'resync']
    for (const method of methods) {
      expect(jest.isMockFunction(Logger[method])).toBe(true)
    }
  })

  test('boolean flags and plain values survive automocking', () => {
    expect(typeof Logger.isDebugEnabled).toBe('boolean')
    expect(typeof Logger.isErrorEnabled).toBe('boolean')
    expect(typeof Logger.id).toBe('number')
    expect(Logger.levels).toBeDefined()
  })

  test('partial factory mocks with only a couple of methods keep working', () => {
    // transaction-requests-service pattern: jest.mock(..., () => ({ info: jest.fn(), debug: jest.fn() }))
    jest.isolateModules(() => {
      jest.doMock('../../src/index', () => ({ info: jest.fn(), debug: jest.fn() }))
      const Partial = require('../../src/index')
      expect(() => Partial.info('x')).not.toThrow()
      expect(Partial.info).toHaveBeenCalled()
    })
  })
})
