'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Winston = require('winston')
const Proxyquire = require('proxyquire')
const Logger = require('../../src/index')
const config = require('../../src/lib/config')
const stringify = require('safe-stable-stringify')

Test('logger', function (loggerTest) {
  let sandbox
  let addMethod
  let logMethod
  let isLevelEnabledMethod

  loggerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.stub(Winston, 'createLogger')
    addMethod = Sinon.stub()
    logMethod = Sinon.stub()
    isLevelEnabledMethod = Sinon.stub()
    addMethod.returns({ log: logMethod })
    Winston.createLogger.returns({
      add: addMethod,
      isLevelEnabled: isLevelEnabledMethod
    })
    t.end()
  })

  loggerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  loggerTest.test('configure Winston', function (assert) {
    assert.ok(Winston.transports.Console, Sinon.match({ timestamp: true, colorize: true }))
    assert.end()
  })

  loggerTest.test('log debug level', function (assert) {
    Logger.debug('test %s', 'me')
    assert.ok(Sinon.match('debug', 'test me'))
    assert.end()
  })

  loggerTest.test('log error level, when filtered out', function (assert) {
    // Arrange
    const customConfig = {
      ...config,
      customLevels: 'info, debug'
    }
    const LoggerProxy = Proxyquire('../../src/index', {
      './lib/config': customConfig
    })

    // Act
    LoggerProxy.error('test %s', 'me')

    // Assert
    assert.ok(Sinon.match('error', 'test me'))
    assert.end()
  })

  loggerTest.test('log info level', function (assert) {
    const infoMessage = 'things are happening'
    Logger.info(infoMessage)
    assert.ok(Sinon.match('info', infoMessage))
    assert.end()
  })

  loggerTest.test('log warn level', function (assert) {
    const warnMessage = 'something bad is happening'
    Logger.warn(warnMessage)
    assert.ok(Sinon.match('warn', warnMessage))
    assert.end()
  })

  loggerTest.test('log error level', function (assert) {
    const errorMessage = 'there was an exception'
    const ex = new Error()
    Logger.error(errorMessage, ex)
    assert.ok(Sinon.match('error', errorMessage))
    assert.end()
  })

  loggerTest.end()
})

Test('contextual logger', function (loggerTest) {
  let sandbox

  loggerTest.beforeEach(t => {
    sandbox = Sinon.createSandbox()
    sandbox.spy(process.stdout, 'write')
    t.end()
  })

  loggerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  loggerTest.test('logger with context formats message properly', function (assert) {
    const logger = Logger.child({ context: { a: 1 } })
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === stringify(
      { a: 1, message: 'Message' },
      null,
      config.jsonStringifySpacing) + '\n')
    assert.end()
  })

  loggerTest.test('handles circular references gracefully', function (assert) {
    const obj1 = {
      a: 1
    }
    const obj2 = {
      obj1
    }
    obj1.newobj2 = obj2
    const logger = Logger.child({ context: { a: obj2 } })
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === stringify(
      { a: obj2, message: 'Message' },
      null,
      config.jsonStringifySpacing) + '\n')
    assert.end()
  })

  loggerTest.test('logger without context formats message properly', function (assert) {
    const logger = Logger.child()
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === '"Message"\n')
    assert.end()
  })

  loggerTest.end()
})
