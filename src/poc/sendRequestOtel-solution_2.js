/**
 * Solution 1: Winston Instrumentation logHook
 *
 * ============================================================================
 * RESULTS:
 * ============================================================================
 *
 * HTTP attributes in logs: NO (with significant caveats - see below)
 *
 * Working features:
 * - trace_id, span_id, trace_flags ARE injected into logs automatically
 * - logHook IS called when logging inside an active span
 * - HTTP span attributes ARE collected by HTTP instrumentation (visible in exported spans)
 *
 * LIMITATION (core problem):
 * The logHook receives the "currently active span" at log time, which is NOT
 * the HTTP span. The HTTP span is created by @opentelemetry/instrumentation-http
 * and is either:
 *   - A child span of the current context (when wrapped in a parent span)
 *   - Already ended (when logging after await response)
 *
 * When logging inside a parent span that wraps an HTTP call:
 *   - Active span = parent span (e.g., "my-http-request")
 *   - Parent span has NO HTTP attributes (empty {})
 *   - HTTP span = child span "GET" with all HTTP attrs, but NOT accessible via logHook
 *
 * When logging after HTTP request completes:
 *   - HTTP span is already ended
 *   - No active span, so logHook is not called at all
 *
 * APPROACHES TRIED:
 * 1. Direct span.attributes access - span has no HTTP attributes (different span)
 * 2. HTTP requestHook + AsyncLocalStorage - can't propagate store from hooks
 * 3. HTTP requestHook + Baggage - context is immutable, can't modify from hooks
 *
 * CONCLUSION:
 * The Winston instrumentation's logHook is NOT suitable for injecting HTTP
 * span attributes because it only has access to the active span at log time,
 * not the HTTP instrumentation's span.
 *
 */

// Must be FIRST - before any other requires
process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = 'http,winston'
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http'
process.env.OTEL_LOGS_EXPORTER = 'none'
// process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'

const { NodeSDK } = require('@opentelemetry/sdk-node')
const { WinstonInstrumentation } = require('@opentelemetry/instrumentation-winston')
const { HttpInstrumentation } = require('@opentelemetry/instrumentation-http')

/**
 * logHook - Called for each log record when inside an active span.
 *
 * @param {Span} span - The currently active span (NOT the HTTP span!)
 * @param {Object} record - The log record (already has trace_id, span_id, trace_flags)
 */
const logHook = (span, record) => {
  // The span here is the active span at log time
  // If logging inside a custom span, this is that span (not the HTTP span)
  // The HTTP span would be a child span, not accessible here

  const ctx = span.spanContext()
  const attrs = span.attributes
  console.log({ ctx, attrs, record })

  record.ctx = ctx
  record.attrs = attrs
}

const sdk = new NodeSDK({
  serviceName: 'http-span-attrs-POC-2',
  instrumentations: [
    new WinstonInstrumentation({
      logHook,
      disableLogCorrelation: false, // Enable trace_id, span_id injection
      disableLogSending: true // Don't send logs to OTLP
    }),
    new HttpInstrumentation()
  ]
})

sdk.start()

const axios = require('axios')
const { trace } = require('@opentelemetry/api')
const { loggerFactory } = require('../contextLogger')

const log = loggerFactory('HTTP-SOLUTION-1')
const tracer = trace.getTracer('solution-1-test')

log.info('=== Solution 1: Winston logHook Test ===')

const sendRequest = async () => {
  return tracer.startActiveSpan('test-span', async (parentSpan) => {
    try {
      log.info('Before HTTP request (inside parent span)')

      const getting = axios.get('https://httpbin.org/get')
      log.info('right after sending request')

      const response = await getting

      // This log will have trace_id, span_id but NOT http.* attributes
      // because the active span is 'test-span', not the HTTP 'GET' span
      log.info('After HTTP request', {
        status: response.status,
        note: 'HTTP attrs NOT present - see file header for explanation'
      })

      parentSpan.end()
      return response
    } catch (err) {
      log.error('Request failed', err)
      parentSpan.recordException(err)
      parentSpan.end()
      throw err
    }
  })
}

sendRequest()
  .then(() => {
    console.log('\n=== Test Complete ===')
    console.log('Check logs above: trace_id/span_id present, but NO http.* attributes')
  })
  .finally(() => {
    setTimeout(() => sdk.shutdown(), 1000)
  })
