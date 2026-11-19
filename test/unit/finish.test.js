/* eslint-env jest */
const { spawn } = require('node:child_process')
const dgram = require('node:dgram')
const fs = require('node:fs')
const http = require('node:http')
const os = require('node:os')
const path = require('node:path')
const { PassThrough } = require('node:stream')
const winston = require('winston')
const UdpTransport = require('../../src/UdpTransport')

const streamEvents = Object.freeze({ close: 'close', data: 'data', error: 'error', finish: 'finish', message: 'message' })
const loggerPath = JSON.stringify(require.resolve('../../src/index'))

describe('finish', () => {
  let lifecycle

  const createLoggerWith = transport => {
    const logger = winston.createLogger({ transports: [transport] })
    lifecycle.register(logger)
    return logger
  }

  const createLogger = () => {
    const records = []
    const stream = new PassThrough({ objectMode: true })
    stream.on(streamEvents.data, record => records.push(record.message))
    return { logger: createLoggerWith(new winston.transports.Stream({ stream })), records }
  }

  const settled = promise => promise.then(() => 'resolved', error => error)

  const fakeTimeouts = () => jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] })

  beforeEach(() => {
    jest.isolateModules(() => {
      lifecycle = require('../../src/lib/finish')
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  test('ends every logger and resolves once they have written their records', async () => {
    const loggers = [createLogger(), createLogger()]
    const finished = []
    loggers.forEach(({ logger }, index) => {
      logger.once(streamEvents.finish, () => finished.push(index))
      logger.info(`record ${index}`)
    })

    await lifecycle.finish()

    expect(finished.sort()).toEqual([0, 1])
    expect(loggers.map(({ records }) => records)).toEqual([['record 0'], ['record 1']])
  })

  test('passes every record to the transports before it ends them', async () => {
    const received = []
    const transport = new (class extends winston.Transport {
      log (info, callback) {
        received.push(info.message)
        setImmediate(callback)
      }
    })()
    const logger = createLoggerWith(transport)
    const errors = []
    logger.on(streamEvents.error, error => errors.push(error))
    transport.on(streamEvents.error, error => errors.push(error))
    const records = Array.from({ length: 200 }, (_, index) => `record ${index}`)
    records.forEach(message => logger.info(message))

    await lifecycle.finish()

    expect(errors).toEqual([])
    expect(received).toEqual(records)
  })

  test('writes records logged after it to stderr, at the logger level, without throwing', async () => {
    const writeSync = jest.spyOn(fs, 'writeSync').mockImplementation(() => {})
    const { logger, records } = createLogger()
    await lifecycle.finish()

    expect(() => logger.info('late', { password: 'secret' })).not.toThrow()
    logger.debug('below the level')

    expect(records).toEqual([])
    expect(writeSync).toHaveBeenCalledTimes(1)
    expect(writeSync.mock.calls[0][0]).toBe(2)
    expect(writeSync.mock.calls[0][1]).toMatch(/ - info: late -\t\{"password":"\[REDACTED\]"\}\n$/)
  })

  test('resolves at once when every logger is closed', async () => {
    const { logger } = createLogger()
    logger.close()

    await expect(lifecycle.finish()).resolves.toBeUndefined()
  })

  test('rejects when a logger fails to end', async () => {
    const { logger } = createLogger()
    const endError = new Error('end failed')
    jest.spyOn(logger, 'end').mockImplementation(() => { throw endError })

    await expect(lifecycle.finish()).rejects.toBe(endError)
  })

  test('rejects once the transports make no progress for the stall time', async () => {
    fakeTimeouts()
    createLoggerWith(new (class extends winston.Transport { log () {} })()).info('never written')

    const outcome = settled(lifecycle.finish())
    await jest.advanceTimersByTimeAsync(lifecycle.FINISH_STALL_MS - 1)
    const early = await Promise.race([outcome, Promise.resolve('pending')])
    await jest.advanceTimersByTimeAsync(1)

    expect(early).toBe('pending')
    expect(await outcome).toEqual(expect.objectContaining({ message: expect.stringContaining('no progress') }))
  })

  test('waits for transports that keep making progress past the stall time', async () => {
    fakeTimeouts()
    const step = lifecycle.FINISH_STALL_MS - 1
    const sent = []
    jest.spyOn(dgram.Socket.prototype, 'send').mockImplementation((datagram, port, host, callback) => {
      setTimeout(() => {
        sent.push(JSON.parse(datagram).message)
        callback(null)
      }, step)
    })
    const logger = createLoggerWith(new UdpTransport({ host: '127.0.0.1', mtu: 65000, max: 65000 }))
    const queued = ['first', 'second', 'third', 'fourth']
    queued.forEach(message => logger.info(message))

    const outcome = settled(lifecycle.finish())
    for (let datagram = 0; datagram < queued.length; datagram++) await jest.advanceTimersByTimeAsync(step)

    expect(await outcome).toBe('resolved')
    expect(sent).toEqual(queued)
  })
})

describe('a process that finishes the logger', () => {
  const children = new Set()
  const sockets = new Set()
  const { CSL_LOG_TRANSPORT, ...env } = process.env

  const run = (script, extraEnv = {}) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', script], { env: { ...env, ...extraEnv } })
    children.add(child)
    let stderr = ''
    child.stderr.on(streamEvents.data, chunk => { stderr += chunk })
    child.on(streamEvents.error, reject)
    child.on(streamEvents.close, code => resolve({ code, stderr }))
  })

  const count = (text, part) => text.split(part).length - 1

  const withLogFile = async use => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-finish-'))
    try {
      return await use(path.join(dir, 'combined.log'))
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }

  afterEach(() => {
    children.forEach(child => child.kill())
    children.clear()
    sockets.forEach(socket => socket.close())
    sockets.clear()
  })

  test('writes every pending record to the file transport', () => withLogFile(async filename => {
    const { code } = await run(`
      const Logger = require(${loggerPath})
      for (let i = 0; i < 2000; i++) Logger.info('pending record ' + i)
      Logger.finish().then(() => process.exit(0))
    `, { CSL_LOG_TRANSPORT: 'file', CSL_TRANSPORT_FILE_OPTIONS__filename: filename })

    expect(code).toBe(0)
    expect(count(fs.readFileSync(filename, 'utf8'), ': pending record ')).toBe(2000)
  }))

  test('lets an uncaught exception handler write its crash record before it exits', () => withLogFile(async filename => {
    const { code } = await run(`
      const Logger = require(${loggerPath})
      process.on('uncaughtException', async error => {
        Logger.error('crashed', error)
        await Logger.finish()
        process.exit(2)
      })
      for (let i = 0; i < 2000; i++) Logger.info('pending record ' + i)
      setImmediate(() => { throw new Error('fatal to file') })
    `, { CSL_LOG_TRANSPORT: 'file', CSL_TRANSPORT_FILE_OPTIONS__filename: filename })
    const written = fs.readFileSync(filename, 'utf8')

    expect(code).toBe(2)
    expect(count(written, ': pending record ')).toBe(2000)
    expect(count(written, 'crashed fatal to file')).toBe(1)
  }))

  test('delivers every http record before it resolves', async () => {
    let received = 0
    const server = http.createServer((req, res) => {
      req.resume()
      req.on('end', () => {
        received++
        res.end('{}')
      })
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const { code, stderr } = await run(`
        const Logger = require(${loggerPath})
        for (let i = 0; i < 2000; i++) Logger.info('pending record ' + i)
        Logger.finish().then(() => process.exit(0))
      `, { CSL_LOG_TRANSPORT: JSON.stringify({ http: { host: '127.0.0.1', port: server.address().port, path: '/' } }) })

      expect(stderr).not.toContain('write after end')
      expect(code).toBe(0)
      expect(received).toBe(2000)
    } finally {
      server.closeAllConnections()
      await new Promise(resolve => server.close(resolve))
    }
  })

  test('sends a record split across datagrams before it resolves', async () => {
    const receiver = dgram.createSocket('udp4')
    sockets.add(receiver)
    const received = []
    const complete = new Promise(resolve => receiver.on(streamEvents.message, datagram => {
      received.push(datagram)
      if (Buffer.concat(received).toString().endsWith('\n')) resolve(JSON.parse(Buffer.concat(received)))
    }))
    await new Promise(resolve => receiver.bind(0, '127.0.0.1', resolve))
    const { port } = receiver.address()

    const [{ code }, record] = await Promise.all([
      run(`
        const Logger = require(${loggerPath})
        Logger.info('x'.repeat(1000))
        Logger.finish().then(() => process.exit(0))
      `, { CSL_LOG_TRANSPORT: JSON.stringify({ udp: { host: '127.0.0.1', port, mtu: 100, max: 1048576 } }) }),
      complete
    ])

    expect(code).toBe(0)
    expect(received.length).toBeGreaterThan(1)
    expect(record).toMatchObject({ level: 'info', message: 'x'.repeat(1000) })
  })
})
