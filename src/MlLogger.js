'use strict'

const pino = require('pino')
const config = require('./lib/config')
const { allLevels, LEVEL_VALUES, LEVEL_NAMES } = require('./lib/constants')
const { redactDeep, containsSensitive } = require('./lib/redact')
const { createDestination } = require('./lib/transports')

// Internal state lives under Symbols — invisible to sinon's stub-walk and jest's automock recursion.
// NEVER convert these to ES `#` private fields: children are Object.create(parent) and never run the
// constructor, so `#`-field access through the prototype chain throws; Symbol/own-prop reads do not.
const kRoot = Symbol('csl.root')
const kPino = Symbol('csl.pino')
const kLevel = Symbol('csl.level')
const kSilent = Symbol('csl.silent')
const kFilter = Symbol('csl.filter')
const kTransports = Symbol('csl.transports')
const kFlush = Symbol('csl.flush')
const kEnabled = Symbol('csl.enabled')

let idCounter = 0

const capitalized = LEVEL_NAMES.map(name => name.charAt(0).toUpperCase() + name.slice(1))

/**
 * Errors are handed to pino's standard `err` serializer untouched (fast path) unless their
 * enumerable own props carry sensitive material — then a redacted plain-object copy goes instead.
 */
function safeErr (err) {
  if (!containsSensitive({ ...err })) return err
  return redactDeep({ ...err, type: err.name, message: err.message, stack: err.stack })
}

/**
 * D3 (pino-native) dispatch: flip the historical csl call convention (message, meta, ...) onto
 * pino's native (mergingObject, message, ...interpolation) and get out of the way.
 * No legacy renderer, no bindings merge (context/bindings live in pino chindings), no
 * per-call expected-error handling (that moved to ContextLogger, where context exists).
 */
function dispatch (self, levelName, args) {
  const root = self[kRoot]
  if (!root[kEnabled][levelName]) return self
  const p = self[kPino]
  const message = args[0]

  if (args.length < 2) {
    if (message === null || typeof message !== 'object') {
      p[levelName](message ?? '')
    } else if (message instanceof Error) {
      p[levelName](safeErr(message)) // pino: Error first arg → errorKey + msg from err.message
    } else {
      p[levelName](redactDeep(message))
    }
    return self
  }

  const meta = args[1]
  if (meta === null || typeof meta !== 'object') {
    // (message, ...interpolation) — pino-native printf handling, extras without tokens dropped
    p[levelName](...args)
    return self
  }
  const payload = meta instanceof Error ? { err: safeErr(meta) } : redactDeep(meta)
  if (args.length === 2) p[levelName](payload, message)
  else p[levelName](payload, message, ...args.slice(2))
  return self
}

class MlLogger {
  constructor ({ level, filter }) {
    this[kRoot] = this
    this[kSilent] = false
    this[kFilter] = filter || null
    if (allLevels[level] === undefined) {
      console.error(`[csl] Unknown LOG_LEVEL '${level}', falling back to 'info'`)
      level = 'info'
    }
    this[kLevel] = level
    const destination = createDestination(config)
    this[kTransports] = destination.descriptors
    this[kFlush] = destination.flushSync
    this[kPino] = pino({
      // pino's own level stays pinned open and the wrapper gates via cached flags:
      // pino children snapshot their level methods at creation, which would break csl's
      // family-wide setLevel semantics; the wrapper gate costs a cached boolean read (~ns).
      level: 'silly',
      customLevels: LEVEL_VALUES,
      useOnlyCustomLevels: true,
      messageKey: 'message',
      base: null,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: { level: (label) => ({ level: label }) }
    }, destination.stream)
    this.id = ++idCounter
    this.levels = allLevels
    this.resync()
  }

  resync () {
    const root = this[kRoot]
    const filter = root[kFilter]
    const levelValue = allLevels[root[kLevel]]
    const enabled = {}
    for (let i = 0; i < LEVEL_NAMES.length; i++) {
      const name = LEVEL_NAMES[i]
      enabled[name] = !root[kSilent] &&
        (!filter || filter.has(name)) &&
        allLevels[name] <= levelValue
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
      // pino-native child: bindings are redacted once and serialised once (chindings)
      child[kPino] = this[kPino].child(redactDeep(bindings))
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
    this[kRoot][kFlush]()
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
