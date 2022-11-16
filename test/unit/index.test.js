'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Winston = require('winston')
const Proxyquire = require('proxyquire')
const Logger = require('../../src/index')
const config = require('../../src/lib/config')

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
    t.end()
  })

  loggerTest.afterEach(t => {
    sandbox.restore()
    t.end()
  })

  loggerTest.test('contextual logger formats with context properly', function (assert) {
    const logger = Logger.child({ context: { a: 1 } })
    sandbox.spy(process.stdout, 'write')

    logger.info('Message')

    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === '{ a: 1, message: \'Message\' }\n')
    assert.end()
  })

  loggerTest.test('contextual logger formats without context properly', function (assert) {
    const logger = Logger.child()
    sandbox.spy(process.stdout, 'write')
    logger.info('Message')

    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === 'Message\n')
    assert.end()
  })

  loggerTest.end()
})
