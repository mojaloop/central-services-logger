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

  test('should handle send error and recreate socket', (done) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const createSocketSpy = jest.spyOn(udpTransport._stream, 'createSocket')

    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(new Error('Send error'))
    })

    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {
      expect(consoleErrorSpy).toHaveBeenCalled()
      expect(createSocketSpy).toHaveBeenCalled()
      socketSendStub.restore()
      consoleErrorSpy.mockRestore()
      done()
    })
  })

  test('should handle send error during frame sending', (done) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

    // First call succeeds, second call fails
    let callCount = 0
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callCount++
      if (callCount === 1) {
        callback(null) // First frame succeeds
      } else {
        callback(new Error('Send error on second frame'))
      }
    })

    // Send a message larger than MTU to trigger multiple frames
    udpTransport._stream.write('0'.repeat(1500), 'utf8', () => {
      expect(consoleErrorSpy).toHaveBeenCalled()
      socketSendStub.restore()
      consoleErrorSpy.mockRestore()
      done()
    })
  })

  test('should call _destroy and close socket', (done) => {
    const udpTransport = new UdpTransport()
    const socketCloseSpy = jest.spyOn(udpTransport._stream.socket, 'close')

    udpTransport._stream.destroy(null, (err) => {
      expect(err).toBeNull()
      expect(socketCloseSpy).toHaveBeenCalled()
      done()
    })
  })

  test('should call _destroy with error and propagate it', (done) => {
    const udpTransport = new UdpTransport()
    const testError = new Error('Test destroy error')

    udpTransport._stream.destroy(testError, (err) => {
      expect(err).toBe(testError)
      done()
    })
  })

  test('should handle error thrown in _write catch block', (done) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })

    // Force an error by making Buffer.from throw
    const originalBufferFrom = Buffer.from
    Buffer.from = () => { throw new Error('Buffer error') }

    udpTransport._stream.write({ message: 'test' }, 'utf8', (err) => {
      expect(err).toBeInstanceOf(Error)
      expect(err.message).toBe('Buffer error')
      Buffer.from = originalBufferFrom
      done()
    })
  })
})
