const pino = require('pino')
const UdpTransport = require('../UdpTransport')

const ASYNC_MIN_LENGTH = 4096
const ASYNC_PERIODIC_FLUSH_MS = 1000

// Writers are shared per destination across roots in this module instance so that loggerFactory()
// roots don't open one fd/stream each (v11 opened a File transport per factory call). The async
// console writer MUST be a single shared stream: independent buffered writers on fd 1 could
// interleave mid-line.
const fileWriters = new Map()
let asyncConsoleWriter = null

function asyncOptions (base) {
  // pino.destination auto-registers an on-exit flushSync for sync:false streams, so lines are
  // not lost on normal process exit; a direct signal kill without a handler can still drop the tail
  return { ...base, sync: false, minLength: ASYNC_MIN_LENGTH, periodicFlush: ASYNC_PERIODIC_FLUSH_MS }
}

function getFileWriter (options, logSync) {
  const filename = options?.filename
  if (!filename) throw new Error('CSL: LOG_TRANSPORT=file requires TRANSPORT_FILE_OPTIONS.filename')
  const key = `${logSync ? 'sync' : 'async'}:${filename}`
  let writer = fileWriters.get(key)
  if (!writer) {
    writer = pino.destination(logSync
      ? { dest: filename, sync: true, mkdir: true }
      : asyncOptions({ dest: filename, mkdir: true }))
    fileWriters.set(key, writer)
  }
  return writer
}

function makeConsole (logSync) {
  if (logSync) {
    return {
      name: 'console',
      // resolved per call so test spies on process.stdout.write observe every line
      log (line) { process.stdout.write(line) }
    }
  }
  if (!asyncConsoleWriter) {
    asyncConsoleWriter = pino.destination(asyncOptions({ fd: 1 }))
  }
  const writer = asyncConsoleWriter
  return {
    name: 'console',
    log (line) { writer.write(line) },
    flushSync () { writer.flushSync() }
  }
}

function makeFile (options, logSync) {
  const writer = getFileWriter(options, logSync)
  return {
    name: 'file',
    level: options?.level,
    log (line) { writer.write(line) },
    flushSync () { writer.flushSync() }
  }
}

function makeUdp (options) {
  const udp = new UdpTransport(options)
  return {
    name: 'udp',
    level: options?.level,
    log (line, rec) { udp.log(line, rec) }
  }
}

/**
 * Builds raw transport descriptors ({ name, level?, log(line, rec), flushSync?() }) from config.
 * LOG_TRANSPORT: 'console' (default) | 'file' | an object map { name: { transport|type, ...options } }
 * (the README documented `type` while v11 read `transport`; v12 accepts both).
 * CSL_LOG_SYNC=false (D2/P2) switches console/file writers to buffered asynchronous mode.
 */
function createTransports (config) {
  const { logTransport, transportFileOptions } = config
  const logSync = config.logSync !== false
  if (logTransport === 'file') return [makeFile(transportFileOptions, logSync)]
  if (logTransport !== null && typeof logTransport === 'object') {
    return Object.entries(logTransport).map(([name, spec]) => {
      const { transport, type, ...options } = spec || {}
      const kind = transport || type || name
      if (kind === 'console') return makeConsole(logSync)
      if (kind === 'file') return makeFile(options, logSync)
      if (kind === 'udp') return makeUdp(options)
      throw new Error(`CSL: unsupported LOG_TRANSPORT kind '${kind}' (supported: console, file, udp)`)
    })
  }
  return [makeConsole(logSync)]
}

module.exports = { createTransports }
