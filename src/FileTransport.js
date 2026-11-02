const { transports: { File } } = require('winston')
const textFormat = require('./textFormat')

module.exports = class FileTransport extends File {
  constructor (options) {
    super({
      format: textFormat({ colorize: false }),
      ...options
    })
  }
}
