/* eslint-env jest */
const UdpTransport = require('../../src/UdpTransport')
const dgram = require('dgram')
const sinon = require('sinon')

describe('UdpTransport', () => {
  test('should handle messages', () => {
    const udpTransport = new UdpTransport()
    udpTransport._stream.createSocket()
    udpTransport._stream.handleMessage(JSON.stringify({ method: 'restart' }))
    udpTransport._stream.handleMessage('null')
    udpTransport._stream.handleMessage('')
    expect(true).toBe(true) // Verifies no exception thrown
  })

  test('should use random id prefix', () => {
    const udpTransport = new UdpTransport({ id: true })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
    expect(true).toBe(true) // Verifies no exception thrown
  })

  test('should split only big messages', (done) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(null)
    })

    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
    udpTransport._stream.write('0'.repeat(1500), 'utf8', () => {
      expect(socketSendStub.calledThrice).toBe(true)
      expect(socketSendStub.firstCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
      expect(socketSendStub.firstCall.args[0].slice(16)).toEqual(Buffer.from(JSON.stringify({ message: 'test' }) + '\n', 'utf8'))
      expect(socketSendStub.secondCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
      expect(socketSendStub.secondCall.args[0].slice(16)).toEqual(Buffer.from('"' + '0'.repeat(1400 - 16 - 1)))
      expect(socketSendStub.thirdCall.args[0].slice(0, 16)).toEqual(Buffer.from('00112233445566778899aabbccddeeff', 'hex'))
      expect(socketSendStub.thirdCall.args[0].slice(16)).toEqual(Buffer.from('0'.repeat(100 + 16 + 1) + '"\n'))
      socketSendStub.restore()
      done()
    })
  })

  test('should skip big messages', (done) => {
    const udpTransport = new UdpTransport({ max: 10 })
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(null)
    })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {
      expect(socketSendStub.notCalled).toBe(true)
      socketSendStub.restore()
      done()
    })
  })

  test('should handle errors', () => {
    const udpTransport = new UdpTransport({ max: 10 })
    udpTransport._stream.emit('error', new Error('test'))
    udpTransport._stream.end(new Error('test'))
    expect(true).toBe(true) // Verifies no exception thrown
  })

  test('should ignore DNS errors', () => {
    const udpTransport = new UdpTransport({ host: 'invalidhost' })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
    expect(true).toBe(true) // Verifies no exception thrown
  })
})
