'use strict'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Winston = require('winston')
const Proxyquire = require('proxyquire')

Test('config', (configTest) => {
  let sandbox

  configTest.afterEach(t => {
    delete process.env.LOG_LEVEL
    delete process.env.LOG_FILTER

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


  configTest.end()
})


//
//process.env.LOG_FILTER overrides the default.json value