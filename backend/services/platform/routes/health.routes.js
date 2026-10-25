const { Router } = require('express')
const mongoose = require('mongoose')
const { name, version } = require('../../../package.json')

const healthRouter = Router()

// GET /health — no token needed (Docker HEALTHCHECK and `make deploy` call it).
// 200 only when MongoDB is connected, so the container is 'unhealthy' if the database is unreachable.
healthRouter.get('/health', (_req, res) => {
    const dbConnected = mongoose.connection.readyState === 1
    res.status(dbConnected ? 200 : 503).json({
        status: dbConnected ? 'ok' : 'degraded',
        db: dbConnected ? 'connected' : 'disconnected',
        app: name,
        version,
    })
})

module.exports = { healthRouter }
