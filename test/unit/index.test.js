process.env.CSL_LOG_LEVEL = 'info'

const Test = require('tapes')(require('tape'))
const Sinon = require('sinon')
const Winston = require('winston')
const Proxyquire = require('proxyquire')
const Logger = require('../../src/index')
const config = require('../../src/lib/config')
const stringify = require('safe-stable-stringify')
const { SENSITIVE_KEY_EXCLUSIONS } = require('../../src/lib/constants')

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
    const logger = Logger.child({ a: 1 })
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === 'Message -\t' + stringify(
      { a: 1 },
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
    const logger = Logger.child({ a: obj2 })
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === 'Message -\t' + stringify(
      { a: obj2 },
      null,
      config.jsonStringifySpacing) + '\n')
    assert.end()
  })

  loggerTest.test('logger without context formats message properly', function (assert) {
    const logger = Logger.child()
    logger.info('Message')
    assert.ok(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1] === 'Message\n')
    assert.end()
  })

  loggerTest.test('console stream logs expected errors at error level', function (assert) {
    const logger = Logger.child()
    const error = new Error('test')
    error.expected = true
    logger.error('Message', error)
    assert.ok(process.stdout.write.firstCall.args[0].includes('error'), 'expected error is logged at error level')
    assert.end()
  })

  loggerTest.test('redacts sensitive keys in context', function (assert) {
    const logger = Logger.child({
      password: 'supersecret',
      token: 'abc123',
      nested: { apiKey: 'shouldBeRedacted', normal: 'notRedacted' }
    })
    logger.info('Sensitive info')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes('"password":"[REDACTED]"'), 'password is redacted')
    assert.ok(output.includes('"token":"[REDACTED]"'), 'token is redacted')
    assert.ok(output.includes('"apiKey":"[REDACTED]"'), 'apiKey is redacted')
    assert.ok(output.includes('"normal":"notRedacted"'), 'normal is not redacted')
    assert.end()
  })

  loggerTest.test('redacts sensitive values in context', function (assert) {
    const logger = Logger.child({
      info: 'my password is hunter2',
      another: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // JWT
      bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c', // Bearer token
      normal: 'safe',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
      rsaPrivateKey: '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA7...\n-----END RSA PRIVATE KEY-----',
      ecPrivateKey: '-----BEGIN EC PRIVATE KEY-----\nMHcCAQEEIB...\n-----END EC PRIVATE KEY-----',
      certificate: '-----BEGIN CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIEb...\n-----END CERTIFICATE-----',
      caCertificate: '-----BEGIN CA CERTIFICATE-----\nMIIDdzCCAl+gAwIBAgIEb...\n-----END CA CERTIFICATE-----',
      jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    })
    logger.info('Sensitive values')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes('"info":"my password is hunter2"'), 'password in value is not redacted')
    assert.ok(output.includes('"another":"[REDACTED]"'), 'JWT is redacted')
    assert.ok(output.includes('"bearer":"[REDACTED]"'), 'Bearer token is redacted')
    assert.ok(output.includes('"normal":"safe"'), 'normal is not redacted')
    assert.ok(output.includes('"privateKey":"[REDACTED]"'), 'PEM private key is redacted')
    assert.ok(output.includes('"rsaPrivateKey":"[REDACTED]"'), 'RSA private key is redacted')
    assert.ok(output.includes('"ecPrivateKey":"[REDACTED]"'), 'EC private key is redacted')
    assert.ok(output.includes('"certificate":"[REDACTED]"'), 'Certificate is redacted')
    assert.ok(output.includes('"caCertificate":"[REDACTED]"'), 'CA Certificate is redacted')
    assert.ok(output.includes('"jwt":"[REDACTED]"'), 'JWT pattern is redacted')
    assert.end()
  })

  loggerTest.test('does not redact non-sensitive keys/values', function (assert) {
    const logger = Logger.child({
      foo: 'bar',
      hello: 'world'
    })
    logger.info('Non-sensitive')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes('"foo":"bar"'), 'foo is not redacted')
    assert.ok(output.includes('"hello":"world"'), 'hello is not redacted')
    assert.end()
  })

  loggerTest.test('redacts sensitive info in arrays', function (assert) {
    const logger = Logger.child({
      arr: [
        { password: '1234' },
        { token: 'abcd' },
        { normal: 'ok' }
      ]
    })
    logger.info('Sensitive in array')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes('"password":"[REDACTED]"'), 'password in array is redacted')
    assert.ok(output.includes('"token":"[REDACTED]"'), 'token in array is redacted')
    assert.ok(output.includes('"normal":"ok"'), 'normal in array is not redacted')
    assert.end()
  })
  loggerTest.test('does not redact keys in SENSITIVE_KEY_EXCLUSIONS', function (assert) {
    // Import SENSITIVE_KEY_EXCLUSIONS directly for test
    // Pick a key from the exclusions list, or add a dummy if empty
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      [excludedKey]: 'shouldNotBeRedacted',
      password: 'shouldBeRedacted'
    })
    logger.info('Testing exclusions')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes(`"${excludedKey}":"shouldNotBeRedacted"`), `${excludedKey} is not redacted`)
    assert.ok(output.includes('"password":"[REDACTED]"'), 'password is redacted')
    assert.end()
  })

  loggerTest.test('does not redact nested keys in SENSITIVE_KEY_EXCLUSIONS', function (assert) {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      nested: {
        [excludedKey]: 'nestedNotRedacted',
        token: 'shouldBeRedacted'
      }
    })
    logger.info('Nested exclusions')
    const output = process.stdout.write.firstCall.args[0]
    assert.ok(output.includes(`"${excludedKey}":"nestedNotRedacted"`), `nested ${excludedKey} is not redacted`)
    assert.ok(output.includes('"token":"[REDACTED]"'), 'token is redacted')
    assert.end()
  })

  loggerTest.end()
})
