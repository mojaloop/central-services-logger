/* eslint-env jest */
const { spawn } = require('node:child_process')

const streamEvents = Object.freeze({ close: 'close', data: 'data', error: 'error' })
const loggerPath = JSON.stringify(require.resolve('../../src/index'))
const contextLoggerPath = JSON.stringify(require.resolve('../../src/contextLogger'))

describe('a process that uses the logger', () => {
  const children = new Set()
  const { CSL_LOG_TRANSPORT, ...env } = process.env

  const run = script => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { env })
    children.add(child)
    let stdout = ''
    let stderr = ''
    child.stdout.on(streamEvents.data, chunk => { stdout += chunk })
    child.stderr.on(streamEvents.data, chunk => { stderr += chunk })
    child.on(streamEvents.error, reject)
    child.on(streamEvents.close, code => resolve({ code, stdout, stderr }))
  })

  afterEach(() => {
    children.forEach(child => child.kill())
    children.clear()
  })

  test('exits with code 1 on an uncaught exception', async () => {
    const { code, stderr } = await run(`require(${loggerPath}).info('starting'); throw new Error('fatal startup error')`)

    expect(code).toBe(1)
    expect(stderr).toContain('Error: fatal startup error')
  })

  test('exits with code 1 on an unhandled rejection', async () => {
    const { code, stderr } = await run(`require(${loggerPath}); Promise.reject(new Error('fatal rejection'))`)

    expect(code).toBe(1)
    expect(stderr).toContain('Error: fatal rejection')
  })

  test('exits with code 1 while a server keeps the event loop alive', async () => {
    const { code } = await run(`
      const server = require('node:http').createServer()
      require(${loggerPath})
      server.listen(0, () => setImmediate(() => { throw new Error('fatal with a live server') }))
    `)

    expect(code).toBe(1)
  })

  test('adds no process listeners however many context loggers exist', async () => {
    const { code, stdout, stderr } = await run(`
      const events = ['uncaughtException', 'uncaughtExceptionMonitor', 'unhandledRejection']
      const count = () => events.map(event => process.listenerCount(event))
      const before = count()
      const { loggerFactory } = require(${contextLoggerPath})
      Array.from({ length: 12 }, (_, i) => loggerFactory('context' + i))[0].info('created')
      console.log(JSON.stringify({ before, after: count() }))
    `)
    const { before, after } = JSON.parse(stdout.split('\n').find(line => line.startsWith('{"before"')))

    expect(code).toBe(0)
    expect(after).toEqual(before)
    expect(stderr).not.toContain('MaxListenersExceededWarning')
  })
})
