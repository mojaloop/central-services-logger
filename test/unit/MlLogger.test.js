/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'

const Sinon = require('sinon')
const Logger = require('../../src/index')

const ISO_RE = /^\d{4}-\d{2}-\d{2}T[\d:.]+Z - /

/** Captures stdout lines and returns them with the timestamp stripped. */
function capture (fn) {
  const lines = []
  const original = process.stdout.write
  process.stdout.write = (chunk) => { lines.push(chunk); return true }
  try {
    fn()
  } finally {
    process.stdout.write = original
  }
  return lines.map(l => l.replace(ISO_RE, ''))
}

function parseLine (line) {
  const [head, blob] = line.split(' -\t')
  // eslint-disable-next-line no-control-regex
  const match = head.match(/^\u001b\[\d+m(\w+)\u001b\[39m: ([\s\S]*)/)
  return {
    level: match[1],
    message: blob === undefined ? match[2].replace(/\n$/, '') : match[2],
    blob: blob === undefined ? undefined : JSON.parse(blob)
  }
}

afterEach(() => {
  Logger.level = 'info'
  Logger.silent = false
  Logger.transports.forEach(t => { t.level = undefined; t.silent = false })
  Logger.resync()
})

describe('argument shapes (v11 winston parity, measured 2026-09-02)', () => {
  test('meta object is merged; meta.message is appended; meta.level dropped', () => {
    const [line] = capture(() => Logger.info('append', { message: 'M2', c: 3, level: 'nope' }))
    const rec = parseLine(line)
    expect(rec.message).toBe('append M2')
    expect(rec.blob).toEqual({ c: 3 })
  })

  test('meta.time stays in the legacy blob; meta.timestamp is dropped (v12 fix: no longer replaces the line timestamp)', () => {
    const lines = capture(() => {
      Logger.info('meta-time', { time: 'TIME-META', b: 2 })
      Logger.info('meta-ts', { timestamp: 'TS-META', a: 1 })
    })
    expect(parseLine(lines[0]).blob).toEqual({ b: 2, time: 'TIME-META' })
    expect(parseLine(lines[1]).blob).toEqual({ a: 1 })
  })

  test('(message, Error) appends err.message and hoists enumerables + stack + raw cause', () => {
    const err = new Error('boom')
    err.code = 'E1'
    err.extra = 'vis'
    err.cause = new Error('inner')
    const [line] = capture(() => Logger.error('failed', err))
    const rec = parseLine(line)
    expect(rec.level).toBe('error')
    expect(rec.message).toBe('failed boom')
    expect(rec.blob.code).toBe('E1')
    expect(rec.blob.extra).toBe('vis')
    expect(rec.blob.stack).toContain('Error: boom')
    expect(rec.blob.cause).toEqual({}) // raw Error serialises to enumerables only, as in v11
  })

  test('bare Error gets a real message and stack (v12 fix: v11 printed "undefined" without the stack)', () => {
    const err = new Error('boom')
    err.code = 'E1'
    const [line] = capture(() => Logger.error(err))
    const rec = parseLine(line)
    expect(rec.message).toBe('boom')
    expect(rec.blob.code).toBe('E1')
    expect(rec.blob.stack).toContain('Error: boom')
  })

  test('single object without message becomes meta (v12 fix: v11 printed "[object Object]")', () => {
    const [line] = capture(() => Logger.info({ k2: 2 }))
    const rec = parseLine(line)
    expect(rec.message).toBe('')
    expect(rec.blob).toEqual({ k2: 2 })
  })

  test('printf tokens interpolate and a trailing object becomes meta (v12 fix: v11 dropped both)', () => {
    const [line] = capture(() => Logger.info('tokens %s %d', 'a', 5, { tail: true }))
    const rec = parseLine(line)
    expect(rec.message).toBe('tokens a 5')
    expect(rec.blob).toEqual({ tail: true })
  })

  test('primitive meta is dropped; null and empty calls render as v11 did; array meta spreads indices', () => {
    const lines = capture(() => {
      Logger.info('primitive', 42)
      Logger.info(null)
      Logger.info()
      Logger.info('arr', [1, 'two'])
    })
    expect(parseLine(lines[0])).toMatchObject({ message: 'primitive', blob: undefined })
    expect(parseLine(lines[1]).message).toBe('null')
    expect(parseLine(lines[2]).message).toBe('')
    expect(parseLine(lines[3]).blob).toEqual({ 0: 1, 1: 'two' })
  })

  test('all nine levels render with the v11 ANSI colours', () => {
    Logger.level = 'silly'
    const expected = {
      error: '31', warn: '33', audit: '35', trace: '37', info: '32', perf: '32', verbose: '36', debug: '34', silly: '35'
    }
    const lines = capture(() => Object.keys(expected).forEach(l => Logger[l]('X')))
    Object.entries(expected).forEach(([level, colour], i) => {
      expect(lines[i]).toBe(`\u001b[${colour}m${level}\u001b[39m: X\n`)
    })
  })

  test('log(level, ...) behaves like the level method; unknown levels warn to stderr and drop', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const lines = capture(() => {
      Logger.log('info', 'via-log', { z: 1 })
      Logger.log('nope-level', 'x')
    })
    expect(lines).toHaveLength(1)
    expect(parseLine(lines[0])).toMatchObject({ message: 'via-log', blob: { z: 1 } })
    expect(errSpy).toHaveBeenCalledWith('[csl] Unknown logger level: nope-level')
    errSpy.mockRestore()
  })
})

describe('child loggers', () => {
  test('bindings merge under call meta (meta wins) and accumulate through nesting', () => {
    const ch = Logger.child({ a: 'bind', b: 'bind' })
    const ch2 = ch.child({ c: 3 })
    const lines = capture(() => {
      ch.info('prec', { b: 'meta' })
      ch2.info('nested')
    })
    expect(parseLine(lines[0]).blob).toEqual({ a: 'bind', b: 'meta' })
    expect(parseLine(lines[1]).blob).toEqual({ a: 'bind', b: 'bind', c: 3 })
  })

  test('bindings are redacted at child() time', () => {
    const ch = Logger.child({ password: 'hunter2', ok: 'fine' })
    const [line] = capture(() => ch.info('x'))
    expect(parseLine(line).blob).toEqual({ password: '[REDACTED]', ok: 'fine' })
  })

  test('push is a deprecated alias of child', () => {
    expect(Logger.push).toBe(Logger.child)
    const ch = Logger.push({ p: 1 })
    const [line] = capture(() => ch.info('via-push'))
    expect(parseLine(line).blob).toEqual({ p: 1 })
  })

  test('spies installed on the parent observe calls made through children (winston prototype-chain parity)', () => {
    const spy = jest.spyOn(Logger, 'info')
    Logger.silent = true // keep the observed call quiet
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
    expect(ch.isDebugEnabled).toBe(false)
  })
})

describe('winston-era runtime controls', () => {
  test('is*Enabled are writable own data properties (direct assignment, as ALS/quoting tests do)', () => {
    Logger.isDebugEnabled = jest.fn(() => true)
    expect(typeof Logger.isDebugEnabled).toBe('function')
    Logger.resync()
    expect(Logger.isDebugEnabled).toBe(false)
  })

  test('sinon can stub the whole logger object', () => {
    const sandbox = Sinon.createSandbox()
    sandbox.stub(Logger)
    const lines = capture(() => Logger.info('stubbed away'))
    expect(lines).toHaveLength(0)
    expect(Logger.info.called).toBe(true)
    sandbox.restore()
  })

  test('Logger.level setter re-computes flags; unknown levels warn and are ignored', () => {
    expect(Logger.isDebugEnabled).toBe(false)
    Logger.level = 'debug'
    expect(Logger.level).toBe('debug')
    expect(Logger.isDebugEnabled).toBe(true)
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    Logger.level = 'bogus'
    expect(Logger.level).toBe('debug')
    expect(errSpy).toHaveBeenCalled()
    errSpy.mockRestore()
  })

  test('a transport level can widen beyond the root level (als-oracle-pathfinder pattern)', () => {
    expect(Logger.isDebugEnabled).toBe(false)
    Logger.transports[0].level = 'debug'
    expect(Logger.isDebugEnabled).toBe(true)
    const lines = capture(() => Logger.debug('widened'))
    expect(lines).toHaveLength(1)
  })

  test('Logger.silent and transport silent both suppress output', () => {
    Logger.silent = true
    expect(capture(() => Logger.info('quiet'))).toHaveLength(0)
    expect(Logger.isInfoEnabled).toBe(false)
    Logger.silent = false
    Logger.transports[0].silent = true
    expect(capture(() => Logger.info('quiet'))).toHaveLength(0)
  })

  test('transports expose name; levels map and id are present', () => {
    expect(Logger.transports[0].name).toBe('console')
    expect(Logger.levels).toEqual({ error: 0, warn: 1, audit: 2, trace: 3, info: 4, perf: 5, verbose: 6, debug: 7, silly: 8 })
    expect(typeof Logger.id).toBe('number')
  })
})
