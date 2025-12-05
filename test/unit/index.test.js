/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'

const Sinon = require('sinon')
const Logger = require('../../src/index')
const config = require('../../src/lib/config')
const stringify = require('safe-stable-stringify')
const { SENSITIVE_KEY_EXCLUSIONS } = require('../../src/lib/constants')

describe('logger', () => {
  test('configure Winston with Console transport', () => {
    expect(Logger.transports).toBeDefined()
    expect(Logger.transports.length).toBeGreaterThan(0)
  })

  test('log debug level', () => {
    expect(() => Logger.debug('test %s', 'me')).not.toThrow()
  })

  test('log info level', () => {
    const infoMessage = 'things are happening'
    expect(() => Logger.info(infoMessage)).not.toThrow()
  })

  test('log warn level', () => {
    const warnMessage = 'something bad is happening'
    expect(() => Logger.warn(warnMessage)).not.toThrow()
  })

  test('log error level', () => {
    const errorMessage = 'there was an exception'
    const ex = new Error()
    expect(() => Logger.error(errorMessage, ex)).not.toThrow()
  })

  test('log error level with filtered customLevels', () => {
    jest.resetModules()
    process.env.LOG_FILTER = 'info, debug'

    const FilteredLogger = require('../../src/index')
    expect(() => FilteredLogger.error('test %s', 'me')).not.toThrow()

    delete process.env.LOG_FILTER
  })
})

describe('contextual logger', () => {
  let sandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    sandbox.spy(process.stdout, 'write')
  })

  afterEach(() => {
    sandbox.restore()
  })

  test('logger with context formats message properly', () => {
    const logger = Logger.child({ a: 1 })
    logger.info('Message')
    expect(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1]).toBe(
      'Message -\t' + stringify({ a: 1 }, null, config.jsonStringifySpacing) + '\n'
    )
  })

  test('handles circular references gracefully', () => {
    const obj1 = { a: 1 }
    const obj2 = { obj1 }
    obj1.newobj2 = obj2
    const logger = Logger.child({ a: obj2 })
    logger.info('Message')
    expect(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1]).toBe(
      'Message -\t' + stringify({ a: obj2 }, null, config.jsonStringifySpacing) + '\n'
    )
  })

  test('logger without context formats message properly', () => {
    const logger = Logger.child()
    logger.info('Message')
    expect(process.stdout.write.firstCall.args[0].split('info\x1B[39m: ')[1]).toBe('Message\n')
  })

  test('console stream logs expected errors at error level', () => {
    const logger = Logger.child()
    const error = new Error('test')
    error.expected = true
    logger.error('Message', error)
    expect(process.stdout.write.firstCall.args[0]).toContain('error')
  })

  test('redacts sensitive keys in context', () => {
    const logger = Logger.child({
      password: 'supersecret',
      token: 'abc123',
      nested: { apiKey: 'shouldBeRedacted', normal: 'notRedacted' }
    })
    logger.info('Sensitive info')
    const output = process.stdout.write.firstCall.args[0]
    expect(output).toContain('"password":"[REDACTED]"')
    expect(output).toContain('"token":"[REDACTED]"')
    expect(output).toContain('"apiKey":"[REDACTED]"')
    expect(output).toContain('"normal":"notRedacted"')
  })

  test('redacts sensitive values in context', () => {
    const logger = Logger.child({
      info: 'my password is hunter2',
      another: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
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
    expect(output).toContain('"info":"my password is hunter2"')
    expect(output).toContain('"another":"[REDACTED]"')
    expect(output).toContain('"bearer":"[REDACTED]"')
    expect(output).toContain('"normal":"safe"')
    expect(output).toContain('"privateKey":"[REDACTED]"')
    expect(output).toContain('"rsaPrivateKey":"[REDACTED]"')
    expect(output).toContain('"ecPrivateKey":"[REDACTED]"')
    expect(output).toContain('"certificate":"[REDACTED]"')
    expect(output).toContain('"caCertificate":"[REDACTED]"')
    expect(output).toContain('"jwt":"[REDACTED]"')
  })

  test('does not redact non-sensitive keys/values', () => {
    const logger = Logger.child({
      foo: 'bar',
      hello: 'world'
    })
    logger.info('Non-sensitive')
    const output = process.stdout.write.firstCall.args[0]
    expect(output).toContain('"foo":"bar"')
    expect(output).toContain('"hello":"world"')
  })

  test('redacts sensitive info in arrays', () => {
    const logger = Logger.child({
      arr: [
        { password: '1234' },
        { token: 'abcd' },
        { normal: 'ok' }
      ]
    })
    logger.info('Sensitive in array')
    const output = process.stdout.write.firstCall.args[0]
    expect(output).toContain('"password":"[REDACTED]"')
    expect(output).toContain('"token":"[REDACTED]"')
    expect(output).toContain('"normal":"ok"')
  })

  test('does not redact keys in SENSITIVE_KEY_EXCLUSIONS', () => {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      [excludedKey]: 'shouldNotBeRedacted',
      password: 'shouldBeRedacted'
    })
    logger.info('Testing exclusions')
    const output = process.stdout.write.firstCall.args[0]
    expect(output).toContain(`"${excludedKey}":"shouldNotBeRedacted"`)
    expect(output).toContain('"password":"[REDACTED]"')
  })

  test('does not redact nested keys in SENSITIVE_KEY_EXCLUSIONS', () => {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      nested: {
        [excludedKey]: 'nestedNotRedacted',
        token: 'shouldBeRedacted'
      }
    })
    logger.info('Nested exclusions')
    const output = process.stdout.write.firstCall.args[0]
    expect(output).toContain(`"${excludedKey}":"nestedNotRedacted"`)
    expect(output).toContain('"token":"[REDACTED]"')
  })
})
