/**
 * SOLUTION 3 v2: Simplified HTTP Span Attribute Capture
 *
 * ============================================================================
 * RESULTS: SUCCESS
 * ============================================================================
 *
 * HTTP span attributes automatically included in logs via contextLogger's
 * existing formatLog() method - no modifications to contextLogger.js needed!
 *
 * Log output example:
 * 2026-02-03T19:51:04.238Z - info: After HTTP request completed - {
 *   "context": "HTTP-TEST-V2",
 *   "http.request.method": "GET",
 *   "url.full": "https://httpbin.org/get",
 *   "http.response.status_code": 200,
 *   "duration.ms": 867,
 *   "responseStatus": 200
 * }
 *
 * ============================================================================
 * HOW IT WORKS:
 * ============================================================================
 *
 * 1. SpanProcessor.onEnd() puts HTTP attrs DIRECTLY on asyncStorage store
 * 2. contextLogger.formatLog() already does: { ...store, ...context, ...meta }
 * 3. HTTP attrs are automatically spread into log output
 * 4. No Symbol keys, no getHttpAttrs(), no monkey-patching needed!
 *
 * ============================================================================
 * INTEGRATION:
 * ============================================================================
 *
 * // In your app initialization:
 * const { asyncStorage } = require('@mojaloop/central-services-logger/src/contextLogger')
 * const { createHttpSpanProcessor } = require('./sendRequestOtel-solution_3_v2')
 *
 * const sdk = new NodeSDK({
 *   spanProcessors: [
 *     createHttpSpanProcessor(asyncStorage),
 *     // ... other processors
 *   ],
 *   instrumentations: [new HttpInstrumentation()]
 * })
 *
 * // That's it! HTTP attrs appear in logs automatically.
 *
 * ============================================================================
 */

process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = 'http,winston'
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http'
process.env.OTEL_LOGS_EXPORTER = 'none'
// // process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'

const { NodeSDK } = require('@opentelemetry/sdk-node')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston')

const { trace, SpanKind } = require('@opentelemetry/api')
// const { asyncStorage, loggerFactory } = require('../contextLogger')

const sdk = new NodeSDK({
  serviceName: 'http-span-attrs-POC-3',
  spanProcessors: [
    createHttpSpanProcessor()
  ],
  instrumentations: [
    new HttpInstrumentation(),
    new WinstonInstrumentation({
      disableLogCorrelation: false, // Enable trace_id, span_id injection
      disableLogSending: true // Don't send logs to OTLP
    })
  ]
})

sdk.start()

// Must require axios AFTER sdk.start() for HTTP instrumentation to work
const axios = require('axios')
const { loggerFactory } = require('../contextLogger')

const logger = loggerFactory('HTTP-TEST-V2')

/**
 * Creates an HTTP span processor that stores attributes directly on AsyncLocalStorage store.
 *
 * Since contextLogger.formatLog() already spreads the store into log metadata,
 * HTTP attributes are automatically included in logs without any other changes.
 *
 * @returns {SpanProcessor} OpenTelemetry SpanProcessor instance
 */
function createHttpSpanProcessor () {
  return {
    onStart () {
      // Nothing needed on start - we capture attrs on end when they're complete
    },

    onEnd (span) {
      if (span.kind !== SpanKind.CLIENT) return
      // span.attributes: {
      //   "http.request.method": "GET",
      //   "server.address": "httpbin.org",
      //   "server.port": 443,
      //   "url.full": "https://httpbin.org/get",
      //   "http.response.status_code": 200,
      //   "network.peer.address": "98.91.115.81",
      //   "network.peer.port": 443,
      //   "network.protocol.version": "1.1"
      // }

      const ctx = span.spanContext()
      const attrs = span.attributes
      logger.info('!!!   inside createHttpSpanProcessor', { ctx, attrs })
      console.dir({ ctx, attrs })
    },

    forceFlush () { return Promise.resolve() },
    shutdown () { return Promise.resolve() }
  }
}

async function sendRequest (url = 'https://httpbin.org/get') {
  const tracer = trace.getTracer('solution-3', '1.0.0')

  return tracer.startActiveSpan('http-test-span', async (parentSpan) => {
    try {
      logger.info('Before HTTP request')

      const response = await axios.get(url)

      logger.info('After HTTP request completed', {
        responseStatus: response.status
      })
    } catch (err) {
      logger.error('HTTP request failed', err)
    } finally {
      parentSpan.end()
    }
  })
  // })
}

Promise.all([
  sendRequest()
  // sendRequest('http://localhost:3001')
])
  .then(() => {
    logger.info('[TEST] Test completed!')
    setTimeout(() => {
      sdk.shutdown()
        .then(() => logger.info('[SDK] Shutdown complete'))
        .catch(err => logger.error('[SDK] Shutdown error:', err))
    }, 1000)
  })
  .catch(err => {
    logger.error('[TEST] Test failed:', err)
    sdk.shutdown()
  })

// module.exports = { createHttpSpanProcessor }
