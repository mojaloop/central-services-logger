/* eslint-env jest */
const stringify = require('safe-stable-stringify')
const { redactDeep } = require('../../../src/lib/redact')
const { SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS, SENSITIVE_KEY_EXCLUSIONS } = require('../../../src/lib/constants')

// The v11 implementation: redaction as a stringify replacer (copied verbatim from the old ConsoleTransport)
function v11Replacer (key, value) {
  const lowerKey = key.toLowerCase()
  if (SENSITIVE_KEY_EXCLUSIONS.includes(lowerKey)) return value
  if (SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub)) ||
      (typeof value === 'string' && SENSITIVE_VALUE_PATTERNS.some(p => p.test(value)))) {
    return '[REDACTED]'
  }
  return value
}

const equivalent = (input) =>
  expect(stringify(redactDeep(input), null, 0)).toBe(stringify(input, v11Replacer, 0))

describe('redactDeep is byte-equivalent to the v11 stringify replacer', () => {
  test('flat sensitive keys and values', () => {
    equivalent({
      password: 'supersecret',
      token: 'abc',
      normal: 'ok',
      bearer: 'Bearer abc.def',
      jwt: 'eyJa.eyJb.c',
      count: 3,
      nothing: null
    })
  })

  test('nested objects, arrays and excluded keys', () => {
    equivalent({
      context: { password: 'redacted-inside-excluded?', plain: 1 },
      stack: 'Error: x\n  at y (Bearer abc)',
      nested: { apiKey: 'x', deeper: [{ client_secret: 'y' }, 'plain', 42] },
      arr: [{ password: '1234' }, { normal: 'ok' }]
    })
  })

  test('sensitive string values inside arrays', () => {
    equivalent({ list: ['safe', 'eyJhbGciOi.eyJzdWIi.SflKxwRJ', 'Bearer tok'] })
  })

  test('cycles render as [Circular] in the same positions', () => {
    const obj1 = { a: 1 }
    const obj2 = { obj1 }
    obj1.newobj2 = obj2
    equivalent({ a: obj2 })
  })

  test('shared (non-cyclic) references serialise twice on both sides', () => {
    const shared = { s: 1 }
    equivalent({ x: shared, y: shared })
  })

  test('Dates and toJSON objects pass through', () => {
    equivalent({ when: new Date(0), buf: Buffer.from('ab') })
  })

  test('undefined values are preserved for the blob-emptiness check', () => {
    const out = redactDeep({ u: undefined, v: 1 })
    expect('u' in out).toBe(true)
    expect(out.u).toBeUndefined()
  })

  test('clean objects are returned by reference — zero allocations (D2/P3 scan-then-clone)', () => {
    const clean = { a: 1, nested: { b: 'x' }, list: [1, 'two', { c: 3 }] }
    expect(redactDeep(clean)).toBe(clean)
    const dirtyKey = { password: 'p' }
    expect(redactDeep(dirtyKey)).not.toBe(dirtyKey)
    const dirtyDeep = { outer: { inner: { apiKey: 'k' } } }
    expect(redactDeep(dirtyDeep)).not.toBe(dirtyDeep)
    const dirtyValue = { note: 'Bearer abc.def' }
    expect(redactDeep(dirtyValue).note).toBe('[REDACTED]')
  })

  test('input objects are never mutated', () => {
    const input = { password: 'secret', nested: { token: 't' } }
    redactDeep(input)
    expect(input.password).toBe('secret')
    expect(input.nested.token).toBe('t')
  })
})
