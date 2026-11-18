const { transports: { Http } } = require('winston')

module.exports = class HttpTransport extends Http {
  constructor (options) {
    super(options)
    this.inFlight = 0
    this.whenIdle = null
  }

  _doRequest (options, callback, auth, path) {
    this.inFlight++
    super._doRequest(options, (error, res) => {
      this.inFlight--
      callback(error, res)
      if (!this.inFlight && this.whenIdle) this.whenIdle()
    }, auth, path)
  }

  _final (callback) {
    if (this.batchOptions.length) this._doBatchRequest(this.batchCallback, this.auth, this.path)
    if (!this.inFlight) return callback()
    this.whenIdle = callback
  }
}
