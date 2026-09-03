'use strict'

const pino = require('pino')
const config = require('./lib/config')
const { allLevels, LEVEL_VALUES, LEVEL_LABELS, LEVEL_NAMES } = require('./lib/constants')
const { normaliseArgs } = require('./lib/args')
const { redactDeep } = require('./lib/redact')
const { applyErrorExpect } = require('./lib/errorExpect')
const { renderLegacyLine } = require('./lib/legacyFormat')

// Internal state lives under Symbols — invisible to sinon's stub-walk and jest's automock recursion.
// NEVER convert these to ES `#` private fields: children are Object.create(parent) and never run the
// constructor, so `#`-field access through the prototype chain throws; Symbol/own-prop reads do not.
const kRoot = Symbol('csl.root')
const kPino = Symbol('csl.pino')
const kBindings = Symbol('csl.bindings')
const kLevel = Symbol('csl.level')
const kSilent = Symbol('csl.silent')
const kFilter = Symbol('csl.filter')
const kTransports = Symbol('csl.transports')
const kMode = Symbol('csl.mode')
const kEnabled = Symbol('csl.enabled')
const kRaw = Symbol('csl.rawTransport')

let idCounter = 0

const capitalized = LEVEL_NAMES.map(name => name.charAt(0).toUpperCase() + name.slice(1))

function levelPassesTransports (root, levelName) {
  const value = allLevels[levelName]
  for (const t of root[kTransports]) {
    if (!t.silent && value <= allLevels[t.level ?? root[kLevel]]) return true
  }
  return false
}

/**
 * A transport descriptor: `name` for identification, writable `level`/`silent` (winston-compatible
 * runtime controls — changing them recomputes the root's is*Enabled flags), and `log(line, rec)`.
 */
function wrapTransport (raw, root) {
  const handle = { name: raw.name, [kRaw]: raw }
  let level = raw.level
  let silent = false
  Object.defineProperties(handle, {
    level: {
      enumerable: true,
      get () { return level },
      set (value) { level = value; root.resync() }
    },
    silent: {
      enumerable: true,
      get () { return silent },
      set (value) { silent = !!value; root.resync() }
    }
  })
  handle.log = (line, rec) => raw.log(line, rec)
  if (raw.flushSync) handle.flushSync = () => raw.flushSync()
  return handle
}

function createSink (root) {
  const sink = {
    [Symbol.for('pino.metadata')]: true,
    write (jsonLine) {
      const levelName = LEVEL_LABELS[sink.lastLevel] || 'info'
      const rec = {
        levelName,
        // pino.stdTimeFunctions.isoTime hands the sink the ISO string still wrapped in JSON quotes
        time: typeof sink.lastTime === 'string' ? sink.lastTime.slice(1, -1) : new Date(sink.lastTime || Date.now()).toISOString(),
        message: sink.lastMsg === undefined || sink.lastMsg === null ? '' : sink.lastMsg,
        meta: sink.lastObj
      }
      const line = root[kMode] === 'json' ? jsonLine : renderLegacyLine(rec, config.jsonStringifySpacing)
      const value = allLevels[levelName]
      for (const t of root[kTransports]) {
        if (!t.silent && value <= allLevels[t.level ?? root[kLevel]]) t.log(line, rec)
      }
      return true
    },
    flushSync () {
      for (const t of root[kTransports]) t.flushSync?.()
    }
  }
  return sink
}

function dispatch (self, levelName, args) {
  const root = self[kRoot]
  if (!root[kEnabled][levelName]) return self

  const bindings = self[kBindings]
  const arg0 = args[0]

  // D2/P3 fast path: a bare primitive message with no bindings needs no normalisation,
  // no expected-error handling (that requires meta) and no redaction
  if (args.length < 2 && bindings === undefined && (arg0 === null || typeof arg0 !== 'object')) {
    root[kPino][levelName](arg0 === undefined ? '' : String(arg0))
    return self
  }

  let { message, meta } = normaliseArgs(args)
  let effectiveLevel = levelName

  if (meta && (levelName === 'error' || levelName === 'warn')) {
    const outcome = applyErrorExpect(meta)
    if (outcome.drop) return self
    if (outcome.meta) meta = outcome.meta
    if (outcome.level) {
      effectiveLevel = outcome.level
      // the re-levelled record still has to pass a transport at its new level (LOG_FILTER
      // only gates the original method call, as in v11)
      if (!levelPassesTransports(root, effectiveLevel)) return self
    }
  }

  if (meta) meta = redactDeep(meta)
  // normaliseArgs always returns an owned copy for meta, and stored bindings are pre-redacted,
  // so either can be handed to pino directly — merge only when both sides exist (D2/P3)
  let merged = meta === undefined
    ? bindings
    : (bindings === undefined ? meta : Object.assign({}, bindings, meta))

  if (merged && root[kMode] === 'json' && 'time' in merged) {
    // pino serialises its own `time`; a meta `time` key would produce duplicate JSON keys
    merged = { ...merged }
    delete merged.time
  }

  const pinoRoot = root[kPino]
  if (merged === undefined) pinoRoot[effectiveLevel](message)
  else pinoRoot[effectiveLevel](merged, message)
  return self
}

class MlLogger {
  constructor ({ level, filter, mode, transports }) {
    this[kRoot] = this
    this[kSilent] = false
    this[kFilter] = filter || null
    this[kMode] = mode === 'json' ? 'json' : 'legacy'
    if (allLevels[level] === undefined) {
      console.error(`[csl] Unknown LOG_LEVEL '${level}', falling back to 'info'`)
      level = 'info'
    }
    this[kLevel] = level
    this[kTransports] = transports.map(raw => wrapTransport(raw, this))
    this[kPino] = pino({
      level: 'silly', // pino never gates — the wrapper is the gate (winston's transport levels can widen)
      customLevels: LEVEL_VALUES,
      useOnlyCustomLevels: true,
      messageKey: 'message',
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) }
    }, createSink(this))
    this.id = ++idCounter
    this.levels = allLevels
    this.resync()
  }

  resync () {
    const root = this[kRoot]
    const filter = root[kFilter]
    const enabled = {}
    for (let i = 0; i < LEVEL_NAMES.length; i++) {
      const name = LEVEL_NAMES[i]
      enabled[name] = !root[kSilent] &&
        (!filter || filter.has(name)) &&
        levelPassesTransports(root, name)
      root[`is${capitalized[i]}Enabled`] = enabled[name]
    }
    root[kEnabled] = enabled
    return root
  }

  isLevelEnabled (levelName) {
    return this[kRoot][kEnabled][levelName] === true
  }

  child (bindings) {
    const child = Object.create(this)
    if (bindings !== null && typeof bindings === 'object') {
      const cleaned = Object.assign({}, this[kBindings], bindings)
      delete cleaned.level
      delete cleaned.message
      child[kBindings] = redactDeep(cleaned)
    }
    return child
  }

  log (levelName, ...args) {
    if (allLevels[levelName] === undefined) {
      console.error(`[csl] Unknown logger level: ${levelName}`)
      return this
    }
    return dispatch(this, levelName, args)
  }

  flush () {
    for (const t of this[kRoot][kTransports]) t.flushSync?.()
  }
}

for (let i = 0; i < LEVEL_NAMES.length; i++) {
  const name = LEVEL_NAMES[i]
  MlLogger.prototype[name] = function (...args) {
    return dispatch(this, name, args)
  }
}

// deprecated alias kept for compatibility: sdk-standard-components exposes push() as child(),
// and several consumers' tests spy on Logger.push (winston's stream push used to leak here)
MlLogger.prototype.push = MlLogger.prototype.child

Object.defineProperties(MlLogger.prototype, {
  level: {
    get () { return this[kRoot][kLevel] },
    set (value) {
      if (allLevels[value] === undefined) {
        console.error(`[csl] Unknown logger level: ${value}`)
        return
      }
      const root = this[kRoot]
      root[kLevel] = value
      root.resync()
    }
  },
  silent: {
    get () { return this[kRoot][kSilent] },
    set (value) {
      const root = this[kRoot]
      root[kSilent] = !!value
      root.resync()
    }
  },
  transports: {
    get () { return this[kRoot][kTransports] }
  }
})

module.exports = { MlLogger }
