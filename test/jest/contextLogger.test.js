/* eslint-env jest */
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
    expect(spy.mock.lastCall[0]).toContain(JSON.stringify(meta))
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
    expect(spy.mock.lastCall[0]).toContain(data.x)
    await promise
    expect(spy.mock.lastCall[0]).toContain(data.x)
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
    const [[first], [second]] = spy.mock.calls
    expect(first).toContain(JSON.stringify({ ms: ms2, ...data2 }))
    expect(second).toContain(JSON.stringify({ ms: ms1, ...data1 }))
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
})
