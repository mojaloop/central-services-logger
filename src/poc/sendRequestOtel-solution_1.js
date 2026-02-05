// Auto instrumentation

process.env.OTEL_NODE_ENABLED_INSTRUMENTATIONS = 'http,winston'
process.env.OTEL_SEMCONV_STABILITY_OPT_IN = 'http'
process.env.OTEL_LOGS_EXPORTER = 'none'
// process.env.OTEL_TRACES_EXPORTER = 'console'
process.env.OTEL_METRICS_EXPORTER = 'none'
process.env.OTEL_PROPAGATORS = 'tracecontext,baggage'

require('@opentelemetry/auto-instrumentations-node/register')

const axios = require('axios')
const { trace, context } = require('@opentelemetry/api')
const { loggerFactory } = require('../contextLogger')

const tracer = trace.getTracer('http-client', '1.0.0')
const log = loggerFactory('HTTP')

const httpClient = axios.create()
setupAxiosHttpLogger(httpClient)

const getSpanAttrs = (phase) => {
  const span = trace.getActiveSpan()
  // const spanViaContext = trace.getSpan(context.active())
  if (!span) {
    log.warn('No active span found')
    return null
  }

  const ctx = span.spanContext()
  const attrs = span.attributes

  log.info(`span "${span.name}" [phase: ${phase}]`, { attrs, ctx })
}

const sendRequest = async (url = 'http://localhost:3000/health') => {
  return tracer.startActiveSpan('sendRequest', async (span) => {
    try {
      getSpanAttrs('start')

      const getting = httpClient.get(url)
      getSpanAttrs('right after sending request')

      const response = await getting
      getSpanAttrs('after awaiting response')

      log.info('response data:', response.data)
    } catch (err) {
      getSpanAttrs('in catch')
      log.error('error in sendRequest: ', err)
    }
  })
}

Promise.all([
  // sendRequest(),
  sendRequest('https://httpbin.org/get')
]).then(() => log.info('All fetching is done!'))

function setupAxiosHttpLogger (axiosInstance, options = {}) {
  const reqId = axiosInstance.interceptors.request.use((config) => {
    getSpanAttrs('interceptors.request')
    return config
  }, (error) => Promise.reject(error))

  const resId = axiosInstance.interceptors.response.use(
    (response) => {
      getSpanAttrs('interceptors.response success')
      return response
    },
    (error) => {
      getSpanAttrs('interceptors.response error')
      return Promise.reject(error)
    }
  )

  return {
    ejectInterceptors: () => {
      axiosInstance.interceptors.request.eject(reqId)
      axiosInstance.interceptors.response.eject(resId)
    }
  }
}
