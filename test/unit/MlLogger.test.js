/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'
process.env.CSL_LOG_SYNC = 'true' // per-line writes so the capture below sees each record

const Sinon = require('sinon')
const Logger = require('../../src/index')

/** Captures stdout json lines. */
function capture (fn) {
  const lines = []
  const original = process.stdout.write
  process.stdout.write = (chunk) => { lines.push(chunk); return true }
  try {
    fn()
  } finally {
    process.stdout.write = original
  }
  return lines.map(l => JSON.parse(l))
}

afterEach(() => {
  Logger.level = 'info'
  Logger.silent = false
  Logger.resync()
})

describe('pino-native argument mapping', () => {
  test('(message, meta) flips onto pino natively; meta keys land inline', () => {
    const [rec] = capture(() => Logger.info('hello', { a: 1, nested: { b: 2 } }))
    expect(rec).toMatchObject({ level: 'info', message: 'hello', a: 1, nested: { b: 2 } })
  })

  test('(message, Error) nests under the err serializer with type/message/stack + enumerables', () => {
    const err = new Error('boom')
    err.code = 'E1'
    const [rec] = capture(() => Logger.error('failed', err))
    expect(rec.message).toBe('failed')
    expect(rec.err.type).toBe('Error')
    expect(rec.err.message).toBe('boom')
    expect(rec.err.stack).toContain('Error: boom')
    expect(rec.err.code).toBe('E1')
  })

  test('bare Error becomes err + message from err.message (pino-native)', () => {
    const [rec] = capture(() => Logger.error(new Error('boom')))
    expect(rec.message).toBe('boom')
    expect(rec.err.stack).toContain('Error: boom')
  })

  test('an Error carrying sensitive enumerables is redacted before serialisation', () => {
    const err = new Error('boom')
    err.password = 'hunter2'
    err.ok = 'fine'
    const [rec] = capture(() => Logger.error('failed', err))
    expect(rec.err.password).toBe('[REDACTED]')
    expect(rec.err.ok).toBe('fine')
    expect(rec.err.message).toBe('boom')
  })

  test('single object logs as the merging object', () => {
    const [rec] = capture(() => Logger.info({ k2: 2 }))
    expect(rec.k2).toBe(2)
    expect(rec.message).toBeUndefined()
  })

  test('printf tokens interpolate natively; extras without tokens are dropped', () => {
    const recs = capture(() => {
      Logger.info('tokens %s %d', 'a', 5)
      Logger.info('no tokens', 'dropped')
    })
    expect(recs[0].message).toBe('tokens a 5')
    expect(recs[1].message).toBe('no tokens')
  })

  test('meta is redacted (scan-then-clone) before pino sees it', () => {
    const meta = { token: 'secret', plain: 1 }
    const [rec] = capture(() => Logger.warn('w', meta))
    expect(rec.token).toBe('[REDACTED]')
    expect(rec.plain).toBe(1)
    expect(meta.token).toBe('secret') // caller object untouched
  })

  test('undefined/empty calls do not throw', () => {
    const recs = capture(() => {
      Logger.info()
      Logger.info(null)
    })
    expect(recs[0].message).toBe('')
    expect(recs[1].message).toBe('')
  })

  test('log(level, ...) behaves like the level method; unknown levels warn and drop', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const recs = capture(() => {
      Logger.log('info', 'via-log', { z: 1 })
      Logger.log('nope-level', 'x')
    })
    expect(recs).toHaveLength(1)
    expect(recs[0]).toMatchObject({ message: 'via-log', z: 1 })
    expect(errSpy).toHaveBeenCalledWith('[csl] Unknown logger level: nope-level')
    errSpy.mockRestore()
  })
})

describe('native child loggers (chindings)', () => {
  test('bindings serialise once and appear in every record; call meta layers on top', () => {
    const ch = Logger.child({ a: 'bind' })
    const ch2 = ch.child({ c: 3 })
    const recs = capture(() => {
      ch.info('one', { b: 'meta' })
      ch2.info('two')
    })
    expect(recs[0]).toMatchObject({ a: 'bind', b: 'meta' })
    expect(recs[1]).toMatchObject({ a: 'bind', c: 3 })
  })

  test('bindings are redacted at child() time', () => {
    const ch = Logger.child({ password: 'hunter2', ok: 'fine' })
    const [rec] = capture(() => ch.info('x'))
    expect(rec.password).toBe('[REDACTED]')
    expect(rec.ok).toBe('fine')
  })

  test('push is a deprecated alias of child', () => {
    expect(Logger.push).toBe(Logger.child)
  })

  test('spies installed on the parent observe calls made through children (wrapper prototype chain)', () => {
    const spy = jest.spyOn(Logger, 'info')
    Logger.silent = true
    Logger.child({ c: 1 }).info('seen')
    expect(spy).toHaveBeenCalledWith('seen')
    spy.mockRestore()
  })

  test('is*Enabled flags are inherited by children and stubbed values are visible through them', () => {
    const sandbox = Sinon.createSandbox()
    const ch = Logger.child({ c: 1 })
    expect(ch.isDebugEnabled).toBe(false)
    sandbox.stub(Logger, 'isDebugEnabled').value(true)
    expect(ch.isDebugEnabled).toBe(true)
    sandbox.restore()
  })
})

describe('runtime controls', () => {
  test('is*Enabled are writable own data properties', () => {
    Logger.isDebugEnabled = jest.fn(() => true)
    expect(typeof Logger.isDebugEnabled).toBe('function')
    Logger.resync()
    expect(Logger.isDebugEnabled).toBe(false)
  })

  test('sinon can stub the whole logger object', () => {
    const sandbox = Sinon.createSandbox()
    sandbox.stub(Logger)
    const recs = capture(() => Logger.info('stubbed away'))
    expect(recs).toHaveLength(0)
    expect(Logger.info.called).toBe(true)
    sandbox.restore()
  })

  test('Logger.level setter re-computes flags; unknown levels warn and are ignored', () => {
    expect(Logger.isDebugEnabled).toBe(false)
    Logger.level = 'debug'
    expect(Logger.isDebugEnabled).toBe(true)
    expect(capture(() => Logger.debug('visible'))).toHaveLength(1)
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    Logger.level = 'bogus'
    expect(Logger.level).toBe('debug')
    errSpy.mockRestore()
  })

  test('Logger.silent suppresses output and flags', () => {
    Logger.silent = true
    expect(capture(() => Logger.info('quiet'))).toHaveLength(0)
    expect(Logger.isInfoEnabled).toBe(false)
  })

  test('transports shim exposes descriptors; levels map and id are present', () => {
    expect(Logger.transports[0].name).toBe('console')
    expect(Logger.levels).toEqual({ error: 0, warn: 1, audit: 2, trace: 3, info: 4, perf: 5, verbose: 6, debug: 7, silly: 8 })
    expect(typeof Logger.id).toBe('number')
    expect(() => Logger.flush()).not.toThrow()
  })
})
