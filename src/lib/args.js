const format = require('quick-format-unescaped')

const PRINTF_TOKEN_RE = /%[sdifjoO]/
const PRINTF_TOKEN_RE_G = /%[sdifjoO]/g

/**
 * winston-splat parity for an Error passed as meta: enumerable own props are copied into the
 * context blob, raw `stack` and `cause` are hoisted (cause stays the raw value — a nested Error
 * serialises to its enumerable props, exactly as before). `message` is handled by the caller.
 */
function errorToMeta (err) {
  const meta = Object.assign({}, err)
  if (err.stack) meta.stack = err.stack
  if (err.cause) meta.cause = err.cause
  delete meta.message
  delete meta.level
  delete meta.timestamp
  return meta
}

function objectToMeta (obj) {
  const meta = Object.assign({}, obj)
  delete meta.message
  delete meta.level
  // v12 behaviour change (documented): meta.timestamp no longer replaces the line timestamp; it is dropped.
  delete meta.timestamp
  return meta
}

/**
 * Normalises every supported call shape to { message: string, meta: object|undefined }.
 * Mirrors winston 3 semantics measured on v11 (see test/fixtures), except the documented v12 fixes:
 * bare Error message/stack, object-without-message, and printf interpolation.
 */
function normaliseArgs (args) {
  const arg0 = args[0]

  if (arg0 instanceof Error) {
    // v12 fix: v11 printed 'undefined' and dropped the stack
    return { message: String(arg0.message), meta: errorToMeta(arg0) }
  }

  if (arg0 !== null && typeof arg0 === 'object') {
    // v12 fix: v11 printed '[object Object]' when the object had no message
    const message = arg0.message === undefined ? '' : String(arg0.message)
    return { message, meta: objectToMeta(arg0) }
  }

  let message = arg0 === undefined ? '' : String(arg0)
  let metaArg = args.length > 1 ? args[1] : undefined

  if (args.length > 1 && PRINTF_TOKEN_RE.test(message)) {
    // v12 fix: v11 printed the tokens literally and silently dropped every extra argument
    const tokenCount = (message.match(PRINTF_TOKEN_RE_G) || []).length
    message = format(message, Array.prototype.slice.call(args, 1, 1 + tokenCount))
    metaArg = undefined
    for (let i = 1 + tokenCount; i < args.length; i++) {
      const candidate = args[i]
      if (candidate !== null && typeof candidate === 'object') {
        metaArg = candidate
        break
      }
    }
  }

  if (metaArg === null || metaArg === undefined) return { message, meta: undefined }

  if (metaArg instanceof Error) {
    if (metaArg.message) message += ' ' + metaArg.message
    return { message, meta: errorToMeta(metaArg) }
  }

  if (typeof metaArg === 'object') {
    if (metaArg.message) message += ' ' + metaArg.message
    return { message, meta: objectToMeta(metaArg) }
  }

  // primitive meta without printf tokens is dropped (winston parity)
  return { message, meta: undefined }
}

module.exports = { normaliseArgs, errorToMeta }
