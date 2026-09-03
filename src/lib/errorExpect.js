const { propagation } = require('@opentelemetry/api')
const { allLevels } = require('./constants')
const config = require('./config')

/**
 * Expected-error handling, driven by the OTel baggage entry set by the caller:
 *   baggage: errorExpect=<context>.<errorCode>|<context>.<errorCode>
 * D3: lives at the ContextLogger layer (the only place a logging context exists — in the
 * pino-native build context travels in chindings, not in the per-call meta).
 * `contextName` is the ContextLogger's string context; `meta` may be a plain object or an Error.
 * Returns { drop?: true, level?: <newLevel> }.
 * config.expectedErrorLevel is read on every call — tests (and operators) mutate it at runtime.
 */
function applyErrorExpect (contextName, meta) {
  if (!meta) return {}
  const suppress = config.expectedErrorLevel === false

  // a record already tagged as expected is suppressed outright
  if (meta.expected && suppress) return { drop: true }

  if (meta.apiErrorCode?.code && contextName) {
    const entry = propagation.getActiveBaggage()?.getEntry('errorExpect')
    if (entry) {
      const expected = `${contextName}.${meta.apiErrorCode.code}`
      if (entry.value.split('|').includes(expected)) {
        if (suppress) return { drop: true }
        if (typeof config.expectedErrorLevel === 'string') {
          if (allLevels[config.expectedErrorLevel] === undefined) return { drop: true }
          return { level: config.expectedErrorLevel, expected }
        }
        return { expected }
      }
    }
  }
  return {}
}

module.exports = { applyErrorExpect }
