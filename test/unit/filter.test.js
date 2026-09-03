/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'
process.env.LOG_FILTER = 'error, warn'

const Logger = require('../../src/index')
const { loggerFactory } = require('../../src/contextLogger')

afterAll(() => {
  delete process.env.LOG_FILTER
})

function capture (fn) {
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

describe('LOG_FILTER whitelist', () => {
  test('non-whitelisted level methods emit nothing', () => {
    const lines = capture(() => {
      Logger.info('filtered out')
      Logger.error('kept')
      Logger.warn('kept too')
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('kept')
  })

  test('is*Enabled and isLevelEnabled honour the filter (v12 fix: v11 reported true for filtered levels)', () => {
    expect(Logger.isErrorEnabled).toBe(true)
    expect(Logger.isWarnEnabled).toBe(true)
    expect(Logger.isInfoEnabled).toBe(false)
    expect(Logger.isDebugEnabled).toBe(false)
    expect(Logger.isLevelEnabled('info')).toBe(false)
    expect(Logger.isLevelEnabled('error')).toBe(true)
  })

  test('log() is filtered as well', () => {
    expect(capture(() => Logger.log('info', 'x'))).toHaveLength(0)
    expect(capture(() => Logger.log('error', 'x'))).toHaveLength(1)
  })

  test('ContextLogger flags follow the filter', () => {
    const log = loggerFactory('F')
    expect(log.isErrorEnabled).toBe(true)
    expect(log.isInfoEnabled).toBe(false)
    expect(capture(() => log.info('gone'))).toHaveLength(0)
    expect(capture(() => log.error('there'))).toHaveLength(1)
  })
})
