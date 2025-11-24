process.env.CSL_LOG_LEVEL = 'info'

const Sinon = require('sinon')
const Winston = require('winston')
const { SENSITIVE_KEY_EXCLUSIONS } = require('../../src/lib/constants')
const config = require('../../src/lib/config')
const stringify = require('safe-stable-stringify')

describe('logger', () => {
  let sandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
    // Clear module cache
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/src/') || key.includes('winston')) {
        delete require.cache[key]
      }
    })
  })

  it('configure Winston', () => {
    const Logger = require('../../src/index')
    expect(Logger).toBeDefined()
    expect(typeof Logger.info).toBe('function')
    expect(typeof Logger.error).toBe('function')
    expect(typeof Logger.debug).toBe('function')
    expect(typeof Logger.warn).toBe('function')
    expect(Winston.transports.Console).toBeDefined()
  })

  it('log debug level', () => {
    const Logger = require('../../src/index')
    expect(() => Logger.debug('test %s', 'me')).not.toThrow()
  })

  it('log error level, when filtered out', () => {
    // This test is about filtering - when customLevels is set, it should still log error
    const Logger = require('../../src/index')
    expect(() => Logger.error('test %s', 'me')).not.toThrow()
  })

  it('log info level', () => {
    const Logger = require('../../src/index')
    const infoMessage = 'things are happening'
    expect(() => Logger.info(infoMessage)).not.toThrow()
  })

  it('log warn level', () => {
    const Logger = require('../../src/index')
    const warnMessage = 'something bad is happening'
    expect(() => Logger.warn(warnMessage)).not.toThrow()
  })

  it('log error level', () => {
    const Logger = require('../../src/index')
    const errorMessage = 'there was an exception'
    const ex = new Error()
    expect(() => Logger.error(errorMessage, ex)).not.toThrow()
  })
})

describe('contextual logger', () => {
  let sandbox
  let Logger
  let capturedOutput = []
  let originalWrite

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    capturedOutput = []

    // Clear the module cache first
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/src/') || key.includes('winston')) {
        delete require.cache[key]
      }
    })

    // Capture stdout.write before loading winston
    originalWrite = process.stdout.write.bind(process.stdout)
    process.stdout.write = function (chunk, encoding, callback) {
      if (chunk) {
        capturedOutput.push(chunk.toString())
      }
      return originalWrite(chunk, encoding, callback)
    }

    // Now require the logger with our spy in place
    Logger = require('../../src/index')
  })

  afterEach(() => {
    process.stdout.write = originalWrite
    sandbox.restore()
  })

  it('logger with context formats message properly', (done) => {
    const logger = Logger.child({ a: 1 })
    logger.info('Message')

    // Give Winston time to write
    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('Message')
      expect(output).toContain(stringify({ a: 1 }, null, config.jsonStringifySpacing))
      done()
    }, 10)
  })

  it('handles circular references gracefully', (done) => {
    const obj1 = {
      a: 1
    }
    const obj2 = {
      obj1
    }
    obj1.newobj2 = obj2
    const logger = Logger.child({ a: obj2 })
    logger.info('Message')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('Message')
      expect(output).toContain('[Circular]')
      done()
    }, 10)
  })

  it('logger without context formats message properly', (done) => {
    const logger = Logger.child()
    logger.info('Message')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('Message')
      // Should not have context separator
      expect(output).not.toContain(' -\t')
      done()
    }, 10)
  })

  it('console stream logs expected errors at error level', (done) => {
    const logger = Logger.child()
    const error = new Error('test')
    error.expected = true
    logger.error('Message', error)

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('error')
      expect(output).toContain('Message')
      done()
    }, 10)
  })

  it('redacts sensitive keys in context', (done) => {
    const logger = Logger.child({
      password: 'supersecret',
      token: 'abc123',
      nested: { apiKey: 'shouldBeRedacted', normal: 'notRedacted' }
    })
    logger.info('Sensitive info')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('"password":"[REDACTED]"')
      expect(output).toContain('"token":"[REDACTED]"')
      expect(output).toContain('"apiKey":"[REDACTED]"')
      expect(output).toContain('"normal":"notRedacted"')
      done()
    }, 10)
  })

  it('redacts sensitive values in context', (done) => {
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

    setTimeout(() => {
      const output = capturedOutput.join('')
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
      done()
    }, 10)
  })

  it('does not redact non-sensitive keys/values', (done) => {
    const logger = Logger.child({
      foo: 'bar',
      hello: 'world'
    })
    logger.info('Non-sensitive')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('"foo":"bar"')
      expect(output).toContain('"hello":"world"')
      done()
    }, 10)
  })

  it('redacts sensitive info in arrays', (done) => {
    const logger = Logger.child({
      arr: [
        { password: '1234' },
        { token: 'abcd' },
        { normal: 'ok' }
      ]
    })
    logger.info('Sensitive in array')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain('"password":"[REDACTED]"')
      expect(output).toContain('"token":"[REDACTED]"')
      expect(output).toContain('"normal":"ok"')
      done()
    }, 10)
  })

  it('does not redact keys in SENSITIVE_KEY_EXCLUSIONS', (done) => {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      [excludedKey]: 'shouldNotBeRedacted',
      password: 'shouldBeRedacted'
    })
    logger.info('Testing exclusions')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain(`"${excludedKey}":"shouldNotBeRedacted"`)
      expect(output).toContain('"password":"[REDACTED]"')
      done()
    }, 10)
  })

  it('does not redact nested keys in SENSITIVE_KEY_EXCLUSIONS', (done) => {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS.length > 0 ? SENSITIVE_KEY_EXCLUSIONS[0] : 'notRedactedKey'
    const logger = Logger.child({
      nested: {
        [excludedKey]: 'nestedNotRedacted',
        token: 'shouldBeRedacted'
      }
    })
    logger.info('Nested exclusions')

    setTimeout(() => {
      const output = capturedOutput.join('')
      expect(output).toContain(`"${excludedKey}":"nestedNotRedacted"`)
      expect(output).toContain('"token":"[REDACTED]"')
      done()
    }, 10)
  })
})
