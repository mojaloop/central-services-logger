'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Proxyquire = require('proxyquire')

const config = require('../../../src/lib/config')

Test('config', (configTest) => {
  const sandbox = Sinon.createSandbox()

  configTest.afterEach(t => {
    delete process.env.LOG_LEVEL
    delete process.env.LOG_FILTER
    delete process.env.LOG_TRANSPORT
    sandbox.restore()

    t.end()
  })

  configTest.test('process.env.LOG_LEVEL overrides the default.json value', assert => {
    // Arrange
    process.env.LOG_LEVEL = 'random_level'

    // Act
    const config = Proxyquire('../../../src/lib/config', {})

    // Assert
    assert.equal(config.level, 'random_level', 'Log levels match')
    assert.end()
  })

  configTest.test('process.env.LOG_FILTER overrides the default.json value', assert => {
    // Arrange
    process.env.LOG_FILTER = 'info,debug'

    // Act
    const config = Proxyquire('../../../src/lib/config', {})

    // Assert
    assert.equal(config.customLevels, 'info,debug', 'Log levels match')
    assert.end()
  })

  configTest.test('process.env.LOG_TRANSPORT object parsed', assert => {
    // Arrange
    process.env.CSL_LOG_TRANSPORT = '{"console":{"type":"console"}}'

    // Act
    const config = Proxyquire('../../../src/lib/config', {})
    console.log(config)
    // Assert
    assert.equal(config.logTransport.console.type, 'console', 'Object parsed correctly')
    assert.end()
  })

  configTest.test('Fails to init when LOG_TRANSPORT=file, but filename is not set', assert => {
    // Arrange
    const customConfig = {
      ...config,
      logTransport: 'file',
      transportFileOptions: {
        ...config.transportFileOptions,
        filename: ''
      }
    }

    // Act
    try {
      const createMlLogger = Proxyquire('../../../src/createMlLogger', {
        './lib/config': customConfig
      })
      createMlLogger()
      assert.fail('should have thrown error')
    } catch (err) {
      // Assert
      assert.ok(Sinon.match(err, 'Error: Cannot log to file without filename or stream'))
    }

    // Assert
    assert.end()
  })

  configTest.test('uses the console transport when LOG_TRANSPORT=console', assert => {
    // Arrange
    const customConfig = {
      ...config,
      logTransport: 'console'
    }

    // Act
    const LoggerProxy = Proxyquire('../../../src/index', {
      './lib/config': customConfig
    })

    // Assert
    assert.equal(LoggerProxy.transports[0].name, 'console', 'Transport is console')
    assert.end()
  })

  configTest.test('uses the file transport when LOG_TRANSPORT=file', assert => {
    // Arrange
    const customConfig = {
      ...config,
      logTransport: 'file',
      transportFileOptions: {
        ...config.transportFileOptions,
        filename: '/tmp/test'
      }
    }

    // Act
    const createMlLogger = Proxyquire('../../../src/createMlLogger', {
      './lib/config': customConfig
    })
    const LoggerProxy = createMlLogger()

    // Assert
    assert.equal(LoggerProxy.transports[0].name, 'file', 'Transport is file')
    assert.end()
  })

  configTest.end()
})
