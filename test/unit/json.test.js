/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'
process.env.CSL_LOG_FORMAT = 'json'

const Logger = require('../../src/index')

afterAll(() => {
  delete process.env.CSL_LOG_FORMAT
})

function captureRaw (fn) {
  const lines = []
  const original = process.stdout.write
  process.stdout.write = (chunk) => { lines.push(chunk); return true }
  try {
    fn()
  } finally {
    process.stdout.write = original
  }
  return lines
}

describe('CSL_LOG_FORMAT=json', () => {
  test('emits one-line pino JSON with level label, ISO time and messageKey "message"', () => {
    const [line] = captureRaw(() => Logger.info('hello', { a: 1 }))
    expect(line.endsWith('\n')).toBe(true)
    const rec = JSON.parse(line)
    expect(rec.level).toBe('info')
    expect(rec.message).toBe('hello')
    expect(rec.a).toBe(1)
    expect(rec.time).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/)
    expect(rec.pid).toBeUndefined()
    expect(rec.hostname).toBeUndefined()
  })

  test('a meta `time` key is dropped so the record has no duplicate keys', () => {
    const [line] = captureRaw(() => Logger.info('t', { time: 'T-META', b: 2 }))
    expect(line.match(/"time":/g)).toHaveLength(1)
    const rec = JSON.parse(line)
    expect(rec.b).toBe(2)
    expect(rec.time).toMatch(/Z$/)
  })

  test('bindings and meta are redacted before serialisation', () => {
    const child = Logger.child({ password: 'x' })
    const [line] = captureRaw(() => child.warn('w', { token: 'y', ok: 1 }))
    const rec = JSON.parse(line)
    expect(rec.level).toBe('warn')
    expect(rec.password).toBe('[REDACTED]')
    expect(rec.token).toBe('[REDACTED]')
    expect(rec.ok).toBe(1)
  })

  test('errors carry message and stack in the record', () => {
    const err = new Error('boom')
    const [line] = captureRaw(() => Logger.error('failed', err))
    const rec = JSON.parse(line)
    expect(rec.message).toBe('failed boom')
    expect(rec.stack).toContain('Error: boom')
  })
})
