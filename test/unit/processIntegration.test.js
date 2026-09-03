/* eslint-env jest */
// Spawn-based end-to-end checks: uncaught-exception parity and OTel log-sending (multistream wrap).
const { spawnSync } = require('node:child_process')
const path = require('node:path')

const ROOT = path.join(__dirname, '..', '..')

function runNode (script, env = {}) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: ROOT,
    env: { ...process.env, CSL_LOG_LEVEL: 'info', ...env },
    encoding: 'utf8',
    timeout: 30_000
  })
}

describe('uncaught exception handling (winston exceptionHandlers + exitOnError:false parity)', () => {
  const crashScript = `
    const Logger = require('./src/index')
    setTimeout(() => { throw new Error('crash-test') }, 10)
    setTimeout(() => { console.log('SURVIVED') }, 100)
  `

  test('the exception is logged once through the logger and the process keeps running (exit 0)', () => {
    const res = runNode(crashScript)
    expect(res.status).toBe(0)
    const occurrences = res.stdout.split('uncaughtException: crash-test').length - 1
    expect(occurrences).toBe(1)
    expect(res.stdout).toContain('"exception":true')
    expect(res.stdout).toContain('SURVIVED')
    // v11 printed a stray second line containing just 'undefined' — fixed
    expect(res.stdout).not.toMatch(/^undefined$/m)
  })

  test('CSL_HANDLE_EXCEPTIONS=false restores default Node crash behaviour', () => {
    const res = runNode(crashScript, { CSL_HANDLE_EXCEPTIONS: 'false' })
    expect(res.status).not.toBe(0)
    expect(res.stdout).not.toContain('uncaughtException')
    expect(res.stderr).toContain('crash-test')
  })

  test('one process listener regardless of how many loggerFactory() roots exist (v11 leaked one per factory)', () => {
    const res = runNode(`
      const before = process.listenerCount('uncaughtException')
      const { loggerFactory } = require('./src/contextLogger')
      loggerFactory('a'); loggerFactory('b'); loggerFactory('c')
      require('./src/index')
      console.log('delta=' + (process.listenerCount('uncaughtException') - before))
    `)
    expect(res.stdout).toContain('delta=1')
  })
})

describe('asynchronous writes (the pino-native default)', () => {
  test('every buffered line arrives after natural exit (on-exit flush)', () => {
    const res = runNode(`
      const Logger = require('./src/index')
      for (let i = 0; i < 500; i++) Logger.info('async-line ' + i)
    `, { CSL_LOG_SYNC: 'false' })
    expect(res.status).toBe(0)
    expect((res.stdout.match(/async-line /g) || []).length).toBe(500)
    expect(res.stdout).toContain('async-line 499')
  })

  test('Logger.flush() drains the buffer on demand (line survives a SIGKILL issued after the flush)', () => {
    const res = runNode(`
      const Logger = require('./src/index')
      Logger.info('before-flush')
      Logger.flush()
      process.kill(process.pid, 'SIGKILL')
    `, { CSL_LOG_SYNC: 'false' })
    expect(res.stdout).toContain('before-flush')
  })

  test('CSL_LOG_SYNC=true opts back into per-line process.stdout.write', () => {
    const res = runNode(`
      const Logger = require('./src/index')
      const writes = []
      process.stdout.write = new Proxy(process.stdout.write, { apply (t, a, args) { writes.push(args[0]); return true } })
      Logger.info('sync-spy-check')
      console.error('spied=' + writes.filter(w => String(w).includes('sync-spy-check')).length)
    `, { CSL_LOG_SYNC: 'true' })
    expect(res.stderr).toContain('spied=1')
  })
})

describe('OTel log sending (instrumentation-pino multistream wrap)', () => {
  test('legacy line still renders when the sink is wrapped for log sending', () => {
    const res = runNode(`
      require('@opentelemetry/auto-instrumentations-node/register')
      const Logger = require('./src/index')
      Logger.info('otel-multistream-check', { probe: 1 })
    `, {
      OTEL_LOGS_EXPORTER: 'console',
      OTEL_TRACES_EXPORTER: 'none',
      OTEL_METRICS_EXPORTER: 'none',
      OTEL_NODE_RESOURCE_DETECTORS: 'none'
    })
    expect(res.status).toBe(0)
    // the legacy line reached stdout through the metadata sink…
    // eslint-disable-next-line no-control-regex
    expect(res.stdout).toMatch(/"message":"otel-multistream-check"/)
    expect(res.stdout).toMatch(/"probe":1/)
    // …and the same record reached the OTel console log exporter (proves the multistream wrap is active)
    expect(res.stdout.split('otel-multistream-check').length - 1).toBeGreaterThanOrEqual(2)
  }, 60_000)
})
