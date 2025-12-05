/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'

const { loggerFactory, asyncStorage, ContextLogger } = require('../../src/contextLogger')
const Logger = require('../../src/index.js')

describe('contextLogger Tests -->', () => {
  let log

  beforeEach(() => {
    log = loggerFactory()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should create ContextLogger instance', () => {
    expect(log).toBeInstanceOf(ContextLogger)
  })

  test('should call Logger if Logger.level === called log method', () => {
    const { level } = log.mlLogger
    const spy = jest.spyOn(log.mlLogger, level)
    log[level]('info')
    expect(spy).toHaveBeenCalled()
  })

  test('should NOT call Logger.debug if Logger.level > debug', () => {
    const spy = jest.spyOn(Logger, 'debug')
    log.debug('test')
    expect(spy).not.toHaveBeenCalled()
  })

  test('should log meta data', () => {
    const spy = jest.spyOn(log.mlLogger, 'info')
    const meta = { a: Date.now() }
    log.info('test', meta)
    expect(spy.mock.lastCall[1]).toMatchObject(meta)
  })

  const createPromiseWithAsyncStorage = (data, ms = 500) => {
    return new Promise((resolve) => {
      asyncStorage.enterWith(data)
      setTimeout(() => {
        log.info('inside createPromiseWithAsyncStorage...', { ms })
        resolve()
      }, ms)
    })
  }

  test('should have access to async context inside and after a promise', async () => {
    const spy = jest.spyOn(log.mlLogger, 'info')
    const data = { x: String(Date.now()) }
    const promise = createPromiseWithAsyncStorage(data)
    log.info('test')
    expect(spy.mock.lastCall[1]).toMatchObject(data)
    await promise
    expect(spy.mock.lastCall[1]).toMatchObject(data)
  })

  test('should have access to different async contexts independently', async () => {
    const spy = jest.spyOn(log.mlLogger, 'info')

    const data1 = { x1: '1' }
    const ms1 = 1000
    const promise1 = createPromiseWithAsyncStorage(data1, ms1)

    const data2 = { x2: '22' }
    const ms2 = 200
    const promise2 = createPromiseWithAsyncStorage(data2, ms2)

    await Promise.all([promise1, promise2])
    const [[, first], [, second]] = spy.mock.calls
    expect(first).toMatchObject({ ms: ms2, ...data2 })
    expect(second).toMatchObject({ ms: ms1, ...data1 })
  })

  test('should set new logLevel', () => {
    const newLevel = 'warn'
    expect(log.mlLogger.level).not.toBe(newLevel)

    log.setLevel(newLevel)
    expect(log.mlLogger.level).toBe(newLevel)
  })

  test('should not set unsupported logLevel, and output warning', () => {
    const newLevel = 'xxx'
    const { level } = log.mlLogger
    const spy = jest.spyOn(log.mlLogger, 'warn')

    log.setLevel(newLevel)
    expect(log.mlLogger.level).toBe(level)
    expect(spy).toHaveBeenCalled()
  })

  test('should create completely independent instances using loggerFactory', () => {
    const log1 = loggerFactory('L1')
    const log2 = loggerFactory('L2')
    expect(log1).not.toEqual(log2)
    expect(log1.mlLogger).not.toEqual(log2.mlLogger)
  })

  test('should create independent instances using .child() method, but with the same underlying mlLogger', () => {
    const log1 = log.child()
    const log2 = log.child()
    expect(log1).not.toBe(log2)
    expect(log1.mlLogger).toEqual(log2.mlLogger)
  })

  test('should set logLevel completely independently for different children', () => {
    const log1 = loggerFactory('L1')
    const log2 = loggerFactory('L2')

    expect(log1.mlLogger.level).toBe('info')
    expect(log1.mlLogger.isLevelEnabled('debug')).toBe(false)

    expect(log2.mlLogger.level).toBe('info')
    expect(log2.mlLogger.isLevelEnabled('warn')).toBe(true)

    log1.setLevel('debug')
    log2.setLevel('warn')

    expect(log1.mlLogger.level).toBe('debug')
    expect(log1.mlLogger.isLevelEnabled('debug')).toBe(true)

    expect(log2.mlLogger.level).toBe('warn')
    expect(log2.mlLogger.isLevelEnabled('warn')).toBe(true)
  })

  test('should call underlying mlLogger methods based on logLevel', () => {
    const log1 = loggerFactory('L1')
    const log2 = loggerFactory('L2')
    const spyDebug1 = jest.spyOn(log1.mlLogger, 'debug')
    const spyWarn2 = jest.spyOn(log2.mlLogger, 'warn')

    log1.debug('debug')
    expect(spyDebug1).not.toHaveBeenCalled()

    log2.warn('warn')
    expect(spyWarn2).toHaveBeenCalled()

    log1.setLevel('debug')
    log2.setLevel('warn')

    log1.debug('debug2')
    expect(spyDebug1).toHaveBeenCalled()

    log2.warn('warn')
    expect(spyWarn2).toHaveBeenCalledTimes(2)
  })

  test('should log Axios error response data', () => {
    const err = new Error('HttpError')
    err.response = {
      data: {
        code: '1001',
        message: 'test error'
      }
    }
    const spy = jest.spyOn(log.mlLogger, 'error')
    log.error('http error: ', err)
    expect(spy.mock.calls[0][1].httpErrorResponse).toEqual(err.response.data)
  })

  describe('all log level methods', () => {
    let sillyLog

    beforeEach(() => {
      sillyLog = loggerFactory('testContext')
      sillyLog.setLevel('silly') // Enable all log levels
    })

    test('should call verbose method when level is enabled', () => {
      const spy = jest.spyOn(sillyLog.mlLogger, 'verbose')
      sillyLog.verbose('verbose message', { key: 'value' })
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toBe('verbose message')
      expect(spy.mock.calls[0][1]).toMatchObject({ context: 'testContext', key: 'value' })
    })

    test('should call silly method when level is enabled', () => {
      const spy = jest.spyOn(sillyLog.mlLogger, 'silly')
      sillyLog.silly('silly message', { detail: 'info' })
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toBe('silly message')
      expect(spy.mock.calls[0][1]).toMatchObject({ context: 'testContext', detail: 'info' })
    })

    test('should call audit method when level is enabled', () => {
      const spy = jest.spyOn(sillyLog.mlLogger, 'audit')
      sillyLog.audit('audit message', { action: 'login' })
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toBe('audit message')
      expect(spy.mock.calls[0][1]).toMatchObject({ context: 'testContext', action: 'login' })
    })

    test('should call trace method when level is enabled', () => {
      const spy = jest.spyOn(sillyLog.mlLogger, 'trace')
      sillyLog.trace('trace message', { traceId: '123' })
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toBe('trace message')
      expect(spy.mock.calls[0][1]).toMatchObject({ context: 'testContext', traceId: '123' })
    })

    test('should call perf method when level is enabled', () => {
      const spy = jest.spyOn(sillyLog.mlLogger, 'perf')
      sillyLog.perf('perf message', { duration: 100 })
      expect(spy).toHaveBeenCalled()
      expect(spy.mock.calls[0][0]).toBe('perf message')
      expect(spy.mock.calls[0][1]).toMatchObject({ context: 'testContext', duration: 100 })
    })

    test('should not call verbose when level is higher', () => {
      sillyLog.setLevel('info') // verbose is level 6, info is level 4
      const spy = jest.spyOn(sillyLog.mlLogger, 'verbose')
      sillyLog.verbose('should not appear')
      expect(spy).not.toHaveBeenCalled()
    })

    test('should not call silly when level is higher', () => {
      sillyLog.setLevel('debug') // silly is level 8, debug is level 7
      const spy = jest.spyOn(sillyLog.mlLogger, 'silly')
      sillyLog.silly('should not appear')
      expect(spy).not.toHaveBeenCalled()
    })

    test('should not call audit when level is higher', () => {
      sillyLog.setLevel('warn') // audit is level 2, warn is level 1
      const spy = jest.spyOn(sillyLog.mlLogger, 'audit')
      sillyLog.audit('should not appear')
      expect(spy).not.toHaveBeenCalled()
    })

    test('should not call trace when level is higher', () => {
      sillyLog.setLevel('audit') // trace is level 3, audit is level 2
      const spy = jest.spyOn(sillyLog.mlLogger, 'trace')
      sillyLog.trace('should not appear')
      expect(spy).not.toHaveBeenCalled()
    })

    test('should not call perf when level is higher', () => {
      sillyLog.setLevel('info') // perf is level 5, info is level 4
      const spy = jest.spyOn(sillyLog.mlLogger, 'perf')
      sillyLog.perf('should not appear')
      expect(spy).not.toHaveBeenCalled()
    })
  })
})
