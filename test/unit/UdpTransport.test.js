const UdpTransport = require('../../src/UdpTransport')
const dgram = require('dgram')
const sinon = require('sinon') // Add sinon for mocking
const Test = require('tapes')(require('tape'))

Test('UdpTransport', (udpTransportTest) => {
  udpTransportTest.test('should handle messages', (test) => {
    const udpTransport = new UdpTransport()
    udpTransport._stream.createSocket()
    udpTransport._stream.handleMessage(JSON.stringify({ method: 'restart' }))
    udpTransport._stream.handleMessage('null')
    udpTransport._stream.handleMessage('')

    test.end()
  })

  udpTransportTest.test('should use random id prefix', (test) => {
    const udpTransport = new UdpTransport({ id: true })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})

    test.end()
  })

  udpTransportTest.test('should split only big messages', (test) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(null)
    })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
    udpTransport._stream.write('0'.repeat(1500), 'utf8', () => {
      test.ok(socketSendStub.calledThrice, 'socket.send should be called thrice')
      test.deepEqual(socketSendStub.firstCall.args[0].slice(0, 16), Buffer.from('00112233445566778899aabbccddeeff', 'hex'), 'match the expected id')
      test.deepEqual(socketSendStub.firstCall.args[0].slice(16), Buffer.from(JSON.stringify({ message: 'test' }) + '\n', 'utf8'), 'match the full message')
      test.deepEqual(socketSendStub.secondCall.args[0].slice(0, 16), Buffer.from('00112233445566778899aabbccddeeff', 'hex'), 'match the expected id')
      test.deepEqual(socketSendStub.secondCall.args[0].slice(16), Buffer.from('"' + '0'.repeat(1400 - 16 - 1)), 'match first part of the message')
      test.deepEqual(socketSendStub.thirdCall.args[0].slice(0, 16), Buffer.from('00112233445566778899aabbccddeeff', 'hex'), 'match the expected id')
      test.deepEqual(socketSendStub.thirdCall.args[0].slice(16), Buffer.from('0'.repeat(100 + 16 + 1) + '"\n'), 'match the second part of the message')
      socketSendStub.restore()
      test.end()
    })
  })

  udpTransportTest.test('should skip big messages', (test) => {
    const udpTransport = new UdpTransport({ max: 10 })
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(null)
    })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {
      test.ok(socketSendStub.notCalled, 'socket.send should not be called')
      socketSendStub.restore()
      test.end()
    })
  })

  udpTransportTest.test('should handle errors', (test) => {
    const udpTransport = new UdpTransport({ max: 10 })
    udpTransport._stream.emit('error', new Error('test'))
    udpTransport._stream.end(new Error('test'))
    test.end()
  })

  udpTransportTest.test('should ignore DNS errors', (test) => {
    const udpTransport = new UdpTransport({ host: 'invalidhost' })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})

    test.end()
  })

  udpTransportTest.end()
})
