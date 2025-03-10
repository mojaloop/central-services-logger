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

  udpTransportTest.test('should use random configured prefix', (test) => {
    const udpTransport = new UdpTransport({ id: '00112233445566778899aabbccddeeff' })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})
    udpTransport._stream.write({ bigmessage: '0'.repeat(1500) }, 'utf8', () => {})

    test.end()
  })

  udpTransportTest.test('should skip big messages', (test) => {
    const udpTransport = new UdpTransport({ max: 10 })
    udpTransport._stream.write({ message: 'test' }, 'utf8', () => {})

    test.end()
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

  udpTransportTest.test('should send correct UDP data', (test) => {
    const udpTransport = new UdpTransport()
    const socketSendStub = sinon.stub(dgram.Socket.prototype, 'send').callsFake((msg, port, host, callback) => {
      callback(null)
    })

    const message = { message: 'test' }
    udpTransport._stream.write(message, 'utf8', () => {
      const sentMessage = Buffer.from(JSON.stringify(message) + '\n', 'utf8')
      test.ok(socketSendStub.calledOnce, 'socket.send should be called once')
      test.deepEqual(socketSendStub.firstCall.args[0].slice(udpTransport._stream.id.length), sentMessage, 'sent message should match the expected message')
      socketSendStub.restore()
      test.end()
    })
  })

  udpTransportTest.end()
})
