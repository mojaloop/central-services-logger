const otel = require('@opentelemetry/semantic-conventions')

const exceptionDto = (err = {}) => ({
  attributes: {
    [otel.ATTR_EXCEPTION_TYPE]: err.name,
    [otel.ATTR_EXCEPTION_MESSAGE]: err.message,
    [otel.ATTR_EXCEPTION_STACKTRACE]: err.stack,
    [otel.ATTR_ERROR_TYPE]: err.code
    // 'error.user_message': 'Operation failed, contact provider'
  }
})

module.exports = {
  exceptionDto
}
