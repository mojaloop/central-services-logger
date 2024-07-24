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

  test('should have access to async context', async () => {
    const spy = jest.spyOn(log.mlLogger, 'info')
    const data = { x: Date.now() }
    const promise = new Promise((resolve) => {
      asyncStorage.enterWith(data)
      setTimeout(resolve, 500)
    })
    log.info('test')
    expect(spy.mock.lastCall[0]).toContain(JSON.stringify(data))
    await promise
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

  test('should create completely independent instances using .child() method', () => {
    const log1 = loggerFactory('L1')
    const log2 = loggerFactory('L2')
    expect(log1).not.toEqual(log2)
    expect(log1.mlLogger).not.toEqual(log2.mlLogger)
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

  test('should call underlying lmLogger methods based on logLevel', () => {
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
