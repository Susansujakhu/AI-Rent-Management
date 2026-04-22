const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(async () => {
  // Custom servers don't auto-run instrumentation.ts — call it manually
  if (!dev) {
    process.env.NEXT_RUNTIME = process.env.NEXT_RUNTIME || 'nodejs'
    try {
      const { register } = require('./.next/server/instrumentation.js')
      if (typeof register === 'function') {
        console.error('[server] Calling instrumentation register()...')
        await register()
        console.error('[server] Instrumentation register() completed')
      } else {
        console.error('[server] instrumentation.js has no register export')
      }
    } catch (err) {
      console.error('[server] Instrumentation failed:', err.message)
    }
  }

  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error:', req.url, err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
