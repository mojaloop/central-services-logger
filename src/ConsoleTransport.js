const { transports: { Console } } = require('winston')
const textFormat = require('./textFormat')

module.exports = class ConsoleTransport extends Console {
  constructor (options) {
    super({
      format: textFormat(),
      ...options
    })
  }
}
