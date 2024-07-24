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
    const { level } = Logger
    const spy = jest.spyOn(Logger, level)
    log[level]('info')
    expect(spy).toHaveBeenCalled()
  })

  test('should NOT call Logger.debug if Logger.level > debug', () => {
    const spy = jest.spyOn(Logger, 'debug')
    log.debug('test')
    expect(spy).not.toHaveBeenCalled()
  })

  test('should log meta data', () => {
    const spy = jest.spyOn(Logger, 'info')
    const meta = { a: Date.now() }
    log.info('test', meta)
    expect(spy.mock.lastCall[0]).toContain(JSON.stringify(meta))
  })

  test('should have access to async context', async () => {
    const spy = jest.spyOn(Logger, 'info')
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
    const spy = jest.spyOn(Logger, 'warn')

    log.setLevel(newLevel)
    expect(log.mlLogger.level).toBe(level)
    expect(spy).toHaveBeenCalled()
  })
})
