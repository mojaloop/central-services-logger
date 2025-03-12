const udp = require('dgram')
const stream = require('node:stream')
const crypto = require('crypto')
const winston = require('winston')

class UdpStream extends stream.Writable {
  constructor (config) {
    super({ autoDestroy: true, ...config })
    this.config = config
    this.host = this.config.host
    this.port = this.config.port
    this.max = this.config.max
    this.createSocket()
  }

  // Create an optional random id for the stream in case of proxying
  createId () {
    if (this.config.id === true) {
      return crypto.randomBytes(16)
    } else if (this.config.id) {
      return Buffer.from(this.config.id, 'hex')
    } else return Buffer.alloc(0)
  }

  createSocket () {
    if (this.socket) {
      this.socket.close()
    }
    this.socket = udp.createSocket(this.config.type || 'udp4')
    this.socket.unref()
    this.id = this.createId()
    this.mtu = this.config.mtu - this.id.length
    this.socket.on('message', this.handleMessage.bind(this))
    this.on('error', () => console.error) // ignore udp errors
  }

  handleMessage (msg) {
    try {
      msg = JSON.parse(msg.toString('utf8'))
      if (msg && msg.method === 'restart') this.id = this.createId()
    } catch (e) {
      // ignore invalid messages
    }
  }

  _write (message, encoding, done) {
    message = Buffer.from(JSON.stringify(message) + '\n', encoding)

    if (this.max && message && message.length > this.max) {
      done()
      return
    }
    const id = this.id.subarray()
    const send = (start, length, cb) => {
      this.socket.send(Buffer.concat([id, message.slice(start, start + length)]), this.port, this.host, cb)
    }
    const callback = err => {
      if (err) {
        console.error(err)
        this.createSocket()
      }
      done()
    }
    const sendFrame = (start, length) => {
      if (start + length >= message.length) {
        send(start, message.length - start, callback)
      } else {
        send(start, length, err => {
          if (err) {
            callback(err)
          } else {
            setImmediate(() => sendFrame(start + length, length))
          }
        })
      }
    }
    sendFrame(0, this.mtu)
  }

  _destroy (error, callback) {
    this.socket.close(err => callback && callback(err || error))
  }
}

module.exports = class UdpTransport extends winston.transports.Stream {
  constructor (config) {
    super({
      stream: new UdpStream({
        objectMode: true,
        host: 'localhost',
        port: 5170,
        id: false,
        max: 4096,
        mtu: 1400,
        ...config
      })
    })
  }
}
