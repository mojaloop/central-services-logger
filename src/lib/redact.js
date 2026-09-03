const { SENSITIVE_SUBSTRINGS, SENSITIVE_VALUE_PATTERNS, SENSITIVE_KEY_EXCLUSIONS } = require('./constants')

// Per-key sensitivity decisions are cached: key names repeat heavily across log calls.
// Returns 'excluded' | true | false.
const keyCache = new Map()
const KEY_CACHE_MAX = 10_000

function keySensitivity (key) {
  let cached = keyCache.get(key)
  if (cached === undefined) {
    const lowerKey = key.toLowerCase()
    cached = SENSITIVE_KEY_EXCLUSIONS.includes(lowerKey)
      ? 'excluded'
      : SENSITIVE_SUBSTRINGS.some(sub => lowerKey.includes(sub))
    if (keyCache.size < KEY_CACHE_MAX) keyCache.set(key, cached)
  }
  return cached
}

function isSensitiveValue (val) {
  if (typeof val !== 'string') return false
  return SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(val))
}

/**
 * D2/P3: allocation-free scan — detects whether redaction would change anything at all.
 * The overwhelmingly common case is a clean meta object; scanning first lets redactDeep
 * return the input untouched (zero allocations) and only clone when something matches.
 */
function containsSensitive (value, seen) {
  if (value === null || typeof value !== 'object') return isSensitiveValue(value)
  if (typeof value.toJSON === 'function') return false
  seen = seen || new Set()
  if (seen.has(value)) return false
  seen.add(value)
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (containsSensitive(value[i], seen)) return true
    }
    return false
  }
  for (const key of Object.keys(value)) {
    const sensitivity = keySensitivity(key)
    if (sensitivity === 'excluded') {
      const v = value[key]
      if (v !== null && typeof v === 'object' && containsSensitive(v, seen)) return true
    } else if (sensitivity === true || isSensitiveValue(value[key]) || containsSensitive(value[key], seen)) {
      return true
    }
  }
  return false
}

/**
 * Clone-on-match redactor with the exact semantics of the pre-v12 stringify replacer:
 *  - a key listed in SENSITIVE_KEY_EXCLUSIONS is never redacted itself, but its value is still recursed into
 *  - a key containing any SENSITIVE_SUBSTRINGS (case-insensitive), or a string value matching any
 *    SENSITIVE_VALUE_PATTERNS, becomes '[REDACTED]'
 *  - arrays are recursed element-by-element (index keys are never sensitive)
 *  - objects with a toJSON method (Date, Buffer, ...) pass through untouched — stringify applies toJSON later,
 *    exactly as the replacer path did
 *  - cycles and shared references are preserved (original topology is mirrored in the clone), so
 *    safe-stable-stringify renders '[Circular]' in the same places as before
 * Runs BEFORE the record reaches pino, so JSON output and OTel log-sending never see unredacted data.
 * Since D2/P3 it scans first and returns the input object unchanged when nothing matches.
 */
function redactDeep (value, visited) {
  // Error instances pass through untouched so pino's `err` serializer can render them
  // (dispatch-level safeErr covers directly-passed Errors; see MlLogger.js)
  if (value instanceof Error) return value
  if (visited === undefined && value !== null && typeof value === 'object' && !containsSensitive(value)) {
    return value
  }
  return cloneRedacted(value, visited)
}

function cloneRedacted (value, visited) {
  if (value === null || typeof value !== 'object') {
    return isSensitiveValue(value) ? '[REDACTED]' : value
  }
  if (typeof value.toJSON === 'function') return value

  visited = visited || new Map()
  const seen = visited.get(value)
  if (seen) return seen

  if (Array.isArray(value)) {
    const clone = new Array(value.length)
    visited.set(value, clone)
    for (let i = 0; i < value.length; i++) clone[i] = redactDeep(value[i], visited)
    return clone
  }

  const clone = {}
  visited.set(value, clone)
  for (const key of Object.keys(value)) {
    const v = value[key]
    const sensitivity = keySensitivity(key)
    if (sensitivity === 'excluded') {
      clone[key] = (v !== null && typeof v === 'object') ? redactDeep(v, visited) : v
    } else if (sensitivity === true || isSensitiveValue(v)) {
      clone[key] = '[REDACTED]'
    } else {
      clone[key] = redactDeep(v, visited)
    }
  }
  return clone
}

module.exports = { redactDeep, containsSensitive, keySensitivity, isSensitiveValue }
