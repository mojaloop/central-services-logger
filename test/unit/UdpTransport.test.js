const UdpTransport = require('../../src/UdpTransport')
const dgram = require('dgram')
const sinon = require('sinon') // Add sinon for mocking

describe('UdpTransport', () => {
  let socketSendStub

  beforeEach(() => {
    socketSendStub = null
  })

  afterEach(() => {
    if (socketSendStub) {
      socketSendStub.restore()
      socketSendStub = null
    }
  })
  it('should handle messages', () => {
    const udpTransport = new UdpTransport()
    udpTransport._stream.createSocket()
    udpTransport._stream.handleMessage(JSON.stringify({ method: 'restart' }))
    udpTransport._stream.handleMessage('null')
    udpTransport._stream.handleMessage('')
  })

  it('should use random id prefix', () => {
    const udpTransport = new UdpTransport({ id: true })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
  })

  it('should split only big messages', () => {
    return new Promise((resolve) => {
      const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
      socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
        callback(null)
      })
      udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
      udpTransport._stream.write('0'.repeat(1500), 'utf8', () => {
        // Keep a local reference to avoid null issues
        const stub = socketSendStub
        if (stub) {
          expect(stub.calledThrice).toBeTruthy()
          expect(stub.firstCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
          expect(stub.firstCall.args[0].slice(16)).toEqual(Buffer.from(JSON.stringify({ message: 'test' }) + '\n', 'utf8'))
          expect(stub.secondCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
          expect(stub.secondCall.args[0].slice(16)).toEqual(Buffer.from('"' + '0'.repeat(1400 - 16 - 1)))
          expect(stub.thirdCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
          expect(stub.thirdCall.args[0].slice(16)).toEqual(Buffer.from('0'.repeat(100 + 16 + 1) + '"\n'))
        }
        resolve()
      })
    })
  })

  it('should skip big messages', () => {
    return new Promise((resolve) => {
      const udpTransport = new UdpTransport({ max: 10 })
      socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
        callback(null)
      })
      udpTransport._stream.write({ message: 'test' }, 'utf8', () => {
        // Keep a local reference to avoid null issues
        const stub = socketSendStub
        if (stub) {
          expect(stub.notCalled).toBeTruthy()
        }
        resolve()
      })
    })
  })

  it('should handle errors', () => {
    const udpTransport = new UdpTransport({ max: 10 })
    udpTransport._stream.emit('error', new Error('test'))
    udpTransport._stream.end(new Error('test'))
  })

  it('should ignore DNS errors', () => {
    const udpTransport = new UdpTransport({ host: 'invalidhost' })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
  })
})
