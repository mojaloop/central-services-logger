/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'
process.env.CSL_LOG_SYNC = 'true' // spy process.stdout.write per line

const Sinon = require('sinon')
const Logger = require('../../src/index')
const { SENSITIVE_KEY_EXCLUSIONS } = require('../../src/lib/constants')

describe('logger', () => {
  test('configures the logger with a console destination', () => {
    expect(Logger.transports).toBeDefined()
    expect(Logger.transports.length).toBeGreaterThan(0)
    expect(Logger.transports[0].name).toBe('console')
  })

  test('log debug level', () => {
    expect(() => Logger.debug('test %s', 'me')).not.toThrow()
  })

  test('log info level', () => {
    expect(() => Logger.info('things are happening')).not.toThrow()
  })

  test('log warn level', () => {
    expect(() => Logger.warn('something bad is happening')).not.toThrow()
  })

  test('log error level', () => {
    const ex = new Error()
    expect(() => Logger.error('there was an exception', ex)).not.toThrow()
  })

  test('log error level with filtered customLevels', () => {
    jest.resetModules()
    process.env.LOG_FILTER = 'info, debug'

    const FilteredLogger = require('../../src/index')
    expect(() => FilteredLogger.error('test %s', 'me')).not.toThrow()

    delete process.env.LOG_FILTER
  })
})

describe('contextual logger (pino-native json output)', () => {
  let sandbox

  const lastRecord = () => JSON.parse(process.stdout.write.lastCall.args[0])

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
    sandbox.spy(process.stdout, 'write')
  })

  afterEach(() => {
    sandbox.restore()
  })

  test('child bindings land in every record via chindings', () => {
    const logger = Logger.child({ a: 1 })
    logger.info('Message')
    const rec = lastRecord()
    expect(rec.level).toBe('info')
    expect(rec.message).toBe('Message')
    expect(rec.a).toBe(1)
    expect(rec.time).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
  })

  test('handles circular references gracefully', () => {
    const obj1 = { a: 1 }
    const obj2 = { obj1 }
    obj1.newobj2 = obj2
    const logger = Logger.child({ a: obj2 })
    expect(() => logger.info('Message')).not.toThrow()
    expect(process.stdout.write.lastCall.args[0]).toContain('"message":"Message"')
  })

  test('child without bindings logs plain records', () => {
    const logger = Logger.child()
    logger.info('Message')
    const rec = lastRecord()
    expect(rec.message).toBe('Message')
    expect(Object.keys(rec).sort()).toEqual(['level', 'message', 'time'])
  })

  test('errors are rendered by the pino err serializer', () => {
    const logger = Logger.child()
    const error = new Error('test')
    error.expected = true
    logger.error('Message', error)
    const rec = lastRecord()
    expect(rec.level).toBe('error')
    expect(rec.err.message).toBe('test')
    expect(rec.err.stack).toContain('Error: test')
    expect(rec.err.expected).toBe(true)
  })

  test('redacts sensitive keys in bindings', () => {
    const logger = Logger.child({
      password: 'supersecret',
      token: 'abc123',
      nested: { apiKey: 'shouldBeRedacted', normal: 'notRedacted' }
    })
    logger.info('Sensitive info')
    const output = process.stdout.write.lastCall.args[0]
    expect(output).toContain('"password":"[REDACTED]"')
    expect(output).toContain('"token":"[REDACTED]"')
    expect(output).toContain('"apiKey":"[REDACTED]"')
    expect(output).toContain('"normal":"notRedacted"')
  })

  test('redacts sensitive values in bindings and meta', () => {
    const logger = Logger.child({
      bearer: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
      normal: 'safe'
    })
    logger.info('Sensitive values', { jwt: 'eyJhbGciOi.eyJzdWIiOi.SflKxwRJSM' })
    const output = process.stdout.write.lastCall.args[0]
    expect(output).toContain('"bearer":"[REDACTED]"')
    expect(output).toContain('"privateKey":"[REDACTED]"')
    expect(output).toContain('"jwt":"[REDACTED]"')
    expect(output).toContain('"normal":"safe"')
  })

  test('redacts sensitive info in arrays but not exclusions', () => {
    const excludedKey = SENSITIVE_KEY_EXCLUSIONS[0]
    const logger = Logger.child({
      arr: [{ password: '1234' }, { normal: 'ok' }],
      [excludedKey]: 'shouldNotBeRedacted'
    })
    logger.info('Sensitive in array')
    const output = process.stdout.write.lastCall.args[0]
    expect(output).toContain('"password":"[REDACTED]"')
    expect(output).toContain('"normal":"ok"')
    expect(output).toContain(`"${excludedKey}":"shouldNotBeRedacted"`)
  })
})
