/* eslint-env jest */
process.env.CSL_LOG_LEVEL = 'info'

const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const { register, unregister } = require('../../src/lib/exceptionHandler')
const { createDestination } = require('../../src/lib/transports')
const { loggerFactory } = require('../../src/contextLogger')

describe('exception handler internals', () => {
  afterEach(() => unregister())

  test('registers one listener, re-points the box on re-register, and logs the crash through the current root', () => {
    const before = process.listenerCount('uncaughtException')
    const calls = []
    const root1 = { error: (...args) => calls.push(['root1', ...args]) }
    const root2 = { error: (...args) => calls.push(['root2', ...args]) }

    register(root1)
    register(root2)
    expect(process.listenerCount('uncaughtException')).toBe(before + 1)

    const listener = process.listeners('uncaughtException').at(-1)
    const err = new Error('boom')
    listener(err)

    expect(calls).toHaveLength(1)
    const [owner, message, meta] = calls[0]
    expect(owner).toBe('root2') // last-created root wins
    expect(message).toContain('uncaughtException: boom')
    expect(message).toContain('Error: boom')
    expect(meta.exception).toBe(true)
    expect(meta.error).toBe(err)
    expect(meta.stack).toContain('Error: boom')
    expect(meta.process.pid).toBe(process.pid)
    expect(Array.isArray(meta.os.loadavg)).toBe(true)
  })

  test('a crashing root never crashes the handler; unregister removes the listener', () => {
    const before = process.listenerCount('uncaughtException')
    register({ error: () => { throw new Error('logger broken') } })
    const listener = process.listeners('uncaughtException').at(-1)
    expect(() => listener(new Error('x'))).not.toThrow()
    unregister()
    expect(process.listenerCount('uncaughtException')).toBe(before)
    expect(() => unregister()).not.toThrow()
  })
})

describe('destination factory', () => {
  test('file destination writes lines and flushes; accepts the README `type` alias', () => {
    const file = path.join(os.tmpdir(), `csl-test-${Date.now()}.log`)
    const dest = createDestination({ logTransport: { out: { type: 'file', filename: file } }, logSync: true })
    expect(dest.descriptors[0].name).toBe('file')
    dest.stream.write('{"a":1}\n')
    dest.flushSync()
    expect(fs.readFileSync(file, 'utf8')).toBe('{"a":1}\n')
    fs.unlinkSync(file)
  })

  test('file destination without filename and unknown kinds fail fast', () => {
    expect(() => createDestination({ logTransport: 'file', transportFileOptions: {}, logSync: true }))
      .toThrow('CSL: LOG_TRANSPORT=file requires TRANSPORT_FILE_OPTIONS.filename')
    expect(() => createDestination({ logTransport: { weird: { transport: 'http' } }, logSync: true }))
      .toThrow("CSL: unsupported LOG_TRANSPORT kind 'http'")
  })

  test('udp destination accepts serialised json lines', () => {
    const dest = createDestination({ logTransport: { udp: { transport: 'udp', port: 51701 } }, logSync: true })
    expect(dest.descriptors[0].name).toBe('udp')
    expect(() => dest.stream.write('{"level":"info","message":"m"}\n')).not.toThrow()
  })

  test('a multi-transport map builds a pino multistream with native per-transport levels', () => {
    const file = path.join(os.tmpdir(), `csl-ms-${Date.now()}.log`)
    const dest = createDestination({
      logTransport: { console: { transport: 'console' }, out: { transport: 'file', filename: file, level: 'error' } },
      logSync: true
    })
    expect(dest.descriptors.map(d => d.name)).toEqual(['console', 'file'])
    expect(typeof dest.stream.write).toBe('function')
    fs.existsSync(file) && fs.unlinkSync(file)
  })
})

describe('misc wrapper internals', () => {
  test('an unknown CSL_LOG_LEVEL falls back to info with a warning', () => {
    jest.resetModules()
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    process.env.CSL_LOG_LEVEL = 'bogus'
    const createMlLogger = require('../../src/createMlLogger')
    const logger = createMlLogger()
    expect(logger.level).toBe('info')
    expect(errSpy).toHaveBeenCalledWith("[csl] Unknown LOG_LEVEL 'bogus', falling back to 'info'")
    errSpy.mockRestore()
    process.env.CSL_LOG_LEVEL = 'info'
    jest.resetModules()
  })

  test('flush() is safe on transports without flushSync', () => {
    const Logger = require('../../src/index')
    expect(() => Logger.flush()).not.toThrow()
  })

  test('ContextLogger.isLevelEnabled delegates to the underlying logger', () => {
    const log = loggerFactory('cov')
    expect(log.isLevelEnabled('error')).toBe(true)
    expect(log.isLevelEnabled('silly')).toBe(false)
    log.setLevel('silly')
    expect(log.isLevelEnabled('silly')).toBe(true)
  })
})
