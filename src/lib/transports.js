const pino = require('pino')
const UdpTransport = require('../UdpTransport')
const { LEVEL_VALUES } = require('./constants')

const ASYNC_MIN_LENGTH = 4096
const ASYNC_PERIODIC_FLUSH_MS = 1000

// Destination streams are shared per target across roots in this module instance so that
// loggerFactory() roots don't open one fd each. The async console writer MUST be a single
// shared stream: independent buffered writers on fd 1 could interleave mid-line.
const writers = new Map()

function destinationOptions (base, logSync) {
  return logSync
    ? { ...base, sync: true }
    : { ...base, sync: false, minLength: ASYNC_MIN_LENGTH, periodicFlush: ASYNC_PERIODIC_FLUSH_MS }
}

function getWriter (key, make) {
  let writer = writers.get(key)
  if (!writer) {
    writer = make()
    writers.set(key, writer)
  }
  return writer
}

function consoleStream (logSync) {
  // D3 (pino-native): pino writes straight to the destination — no metadata sink, no renderer.
  // Async (the default): a shared buffered sonic-boom on fd 1 (auto on-exit flushSync).
  // Sync (CSL_LOG_SYNC=true): per-line process.stdout.write, resolved per call so test
  // spies/patches on process.stdout.write observe every record.
  if (logSync) {
    return getWriter('console:sync', () => ({ write (line) { process.stdout.write(line); return true } }))
  }
  return getWriter('console:async', () => pino.destination(destinationOptions({ fd: 1 }, false)))
}

function fileStream (options, logSync) {
  const filename = options?.filename
  if (!filename) throw new Error('CSL: LOG_TRANSPORT=file requires TRANSPORT_FILE_OPTIONS.filename')
  return getWriter(`file:${logSync}:${filename}`, () => pino.destination(destinationOptions({ dest: filename, mkdir: true }, logSync)))
}

function udpStream (options) {
  // receives the serialised json line (string) per record
  return new UdpTransport(options)._stream
}

const kinds = {
  console: (options, logSync) => consoleStream(logSync),
  file: (options, logSync) => fileStream(options, logSync),
  udp: (options) => udpStream(options)
}

/**
 * Builds the pino destination for this build: a single stream, or pino.multistream for the
 * LOG_TRANSPORT object map (per-transport `level` is handled natively by multistream).
 * Returns { stream, descriptors, flushSync } — descriptors back the deprecated `transports`
 * shim (name + inert writable level/silent; use Logger.level / Logger.silent instead).
 */
function createDestination (config) {
  const { logTransport, transportFileOptions } = config
  const logSync = config.logSync === true

  const specs = logTransport === 'file'
    ? [{ name: 'file', kind: 'file', options: transportFileOptions }]
    : (logTransport !== null && typeof logTransport === 'object')
        ? Object.entries(logTransport).map(([name, spec]) => {
          const { transport, type, level, ...options } = spec || {}
          const kind = transport || type || name
          if (!kinds[kind]) throw new Error(`CSL: unsupported LOG_TRANSPORT kind '${kind}' (supported: ${Object.keys(kinds).join(', ')})`)
          return { name: kind, kind, level, options }
        })
        : [{ name: 'console', kind: 'console', options: undefined }]

  const streams = specs.map(s => ({ level: s.level, stream: kinds[s.kind](s.options, logSync) }))
  const stream = streams.length === 1 && !streams[0].level
    ? streams[0].stream
    : pino.multistream(streams.map(s => ({ level: s.level || 'silly', stream: s.stream })), { levels: LEVEL_VALUES, dedupe: false })

  const descriptors = specs.map(s => ({ name: s.name, level: s.level, silent: false }))
  const flushSync = () => streams.forEach(s => { s.stream.flushSync?.() })

  return { stream, descriptors, flushSync }
}

module.exports = { createDestination }
