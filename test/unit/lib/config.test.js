'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')
const config = require('../../../src/lib/config')

const { removeFromCache } = require('../../util/index')

let sandbox = Sinon.createSandbox()
Test('config', (configTest) => {

  configTest.afterEach(t => {
    delete process.env.LOG_LEVEL
    delete process.env.LOG_FILTER
    sandbox.restore()

    t.end()
  })

  // configTest.test('process.env.LOG_LEVEL overrides the default.json value', assert => {
  //   // Arrange
  //   process.env.LOG_LEVEL = 'random_level'

  //   // Act
  //   const config = Proxyquire('../../../src/lib/config', {})

  //   // Assert
  //   assert.equal(config.level, 'random_level', 'Log levels match')
  //   assert.end()
  // })

  // configTest.test('process.env.LOG_FILTER overrides the default.json value', assert => {
  //   // Arrange
  //   process.env.LOG_FILTER = 'info,debug'

  //   // Act
  //   const config = Proxyquire('../../../src/lib/config', {})

  //   // Assert
  //   assert.equal(config.customLevels, 'info,debug', 'Log levels match')
  //   assert.end()
  // })

  // configTest.test('Fails to init when LOG_TRANSPORT=file, but filename is not set', assert => {
  //   // Arrange
  //   sandbox.mock(config)
  //   config.logTransport = 'file'
    
  //   // Act
  //   try {
  //     const LoggerProxy = Proxyquire('../../../src/index', {})
  //     assert.fail('should have thrown error')
  //   } catch (err) {
  //     // Assert
  //     assert.ok(Sinon.match(err, 'Error: Cannot log to file without filename or stream'))
  //   }

  //   // Assert
  //   delete process.env.LOG_FILTER
  //   assert.end()
  // })


  //TODO: logs to file when LOG_TRANSPORT=file

  configTest.test('logs to console when LOG_TRANSPORT=console', assert => {
    // Arrange
    sandbox.mock(config)
    config.logTransport = 'console'
    const LoggerProxy = Proxyquire('../../../src/index', {})
    
    // Act
    //TODO: mock out the transport somehow?
    LoggerProxy.info('testing 123')

    // Assert
    assert.end()
  })

  configTest.end()
})
