/* eslint-env jest */
const http = require('node:http')
const HttpTransport = require('../../src/HttpTransport')

const events = Object.freeze({ data: 'data', end: 'end', finish: 'finish', warn: 'warn' })

describe('HttpTransport', () => {
  let server
  let port
  let requests
  let paths
  let respond

  const createTransport = options => new HttpTransport({ host: '127.0.0.1', port, ...options })
  const finished = transport => new Promise(resolve => transport.once(events.finish, resolve))
  const log = (transport, message) => transport.log({ level: 'info', message }, () => {})

  beforeEach(async () => {
    requests = []
    paths = []
    respond = res => res.end('{}')
    server = http.createServer((req, res) => {
      let body = ''
      req.on(events.data, chunk => { body += chunk })
      req.on(events.end, () => {
        requests.push(JSON.parse(body))
        paths.push(req.url)
        respond(res)
      })
    })
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    port = server.address().port
  })

  afterEach(async () => {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  })

  test('finishes only after every request has its response', async () => {
    const held = []
    let bothArrived
    const arrived = new Promise(resolve => { bothArrived = resolve })
    respond = res => {
      held.push(res)
      if (held.length === 2) bothArrived()
    }
    const transport = createTransport()
    let transportFinished = false
    const done = finished(transport).then(() => { transportFinished = true })
    log(transport, 'first')
    log(transport, 'second')
    transport.end()

    await arrived
    await new Promise(resolve => setImmediate(resolve))
    expect(transportFinished).toBe(false)
    held.forEach(res => res.end('{}'))
    await done

    expect(requests.map(record => record.message)).toEqual(['first', 'second'])
  })

  test('finishes at once with nothing in flight', async () => {
    const transport = createTransport()
    const done = finished(transport)
    transport.end()
    await done

    expect(requests).toEqual([])
  })

  test('sends a waiting batch when it ends', async () => {
    const transport = createTransport({ batch: true, batchCount: 10, batchInterval: 60000, path: 'logs' })
    const done = finished(transport)
    const messages = ['a', 'b', 'c']
    messages.forEach(message => log(transport, message))
    transport.end()
    await done

    expect(requests).toHaveLength(1)
    expect(requests[0].map(record => record.message)).toEqual(messages)
    expect(paths).toEqual(['/logs'])
  })

  test('reports a failed request as a warning and still finishes', async () => {
    respond = res => {
      res.statusCode = 500
      res.end('{}')
    }
    const transport = createTransport()
    const warned = new Promise(resolve => transport.once(events.warn, resolve))
    const done = finished(transport)
    log(transport, 'refused')
    transport.end()

    expect((await warned).message).toBe('Invalid HTTP Status Code: 500')
    await done
  })
})
