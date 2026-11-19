/* eslint-env jest */
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const loggerEvents = Object.freeze({ finish: 'finish' })

describe('file transport', () => {
  let dir

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'csl-file-transport-'))
  })

  afterEach(() => {
    delete process.env.CSL_LOG_TRANSPORT
    delete process.env.CSL_TRANSPORT_FILE_OPTIONS__filename
    fs.rmSync(dir, { recursive: true, force: true })
  })

  const writeThroughLogger = async (transportConfig, filename) => {
    process.env.CSL_LOG_TRANSPORT = transportConfig
    process.env.CSL_TRANSPORT_FILE_OPTIONS__filename = filename
    let createMlLogger
    jest.isolateModules(() => {
      createMlLogger = require('../../src/createMlLogger')
    })
    const logger = createMlLogger()
    logger.info('written to file', { password: 'secret', detail: 'kept' })
    await new Promise(resolve => {
      logger.once(loggerEvents.finish, resolve)
      logger.end()
    })
    return fs.readFileSync(filename, 'utf8').split('\n').filter(Boolean)
  }

  const expectFormatted = lines => {
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatch(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z - info: written to file -\t/)
    expect(lines[0]).toContain('"password":"[REDACTED]"')
    expect(lines[0]).toContain('"detail":"kept"')
  }

  test('writes formatted records when the file transport is selected', async () => {
    const filename = path.join(dir, 'combined.log')
    expectFormatted(await writeThroughLogger('file', filename))
  })

  test('writes formatted records for a file entry in a transport map', async () => {
    const filename = path.join(dir, 'mapped.log')
    expectFormatted(await writeThroughLogger(JSON.stringify({ combined: { transport: 'file', filename } }), filename))
  })
})
