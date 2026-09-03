const { propagation } = require('@opentelemetry/api')
const { allLevels } = require('./constants')
const config = require('./config')

/**
 * Expected-error handling, driven by the OTel baggage entry set by the caller:
 *   baggage: errorExpect=<context>.<errorCode>|<context>.<errorCode>
 * Returns { drop?: true, level?: <newLevel>, meta?: <metaWithExpected> }.
 * config.expectedErrorLevel is read on every call — tests (and operators) mutate it at runtime.
 * Only invoked for error/warn records (winston parity; the 'fatal' branch in v11 was dead code).
 */
function applyErrorExpect (meta) {
  if (!meta) return {}
  const suppress = config.expectedErrorLevel === false

  // a record already tagged as expected (e.g. via ContextLogger.formatError) is suppressed outright
  if (meta.expected && suppress) return { drop: true }

  if (meta.apiErrorCode?.code && meta.context) {
    const entry = propagation.getActiveBaggage()?.getEntry('errorExpect')
    if (entry) {
      const expected = `${meta.context}.${meta.apiErrorCode.code}`
      if (entry.value.split('|').includes(expected)) {
        if (suppress) return { drop: true }
        if (typeof config.expectedErrorLevel === 'string') {
          // an unknown re-level target was silently dropped by v11's transport level check — keep that
          if (allLevels[config.expectedErrorLevel] === undefined) return { drop: true }
          return { level: config.expectedErrorLevel, meta: { ...meta, expected } }
        }
        return { meta: { ...meta, expected } }
      }
    }
  }
  return {}
}

module.exports = { applyErrorExpect }
