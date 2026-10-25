// SOURCE OF TRUTH: /shared/timing.js. Do not edit copies under services/*/shared — run "make sync".

/**
 * Adds 'Server-Timing: app;dur=<ms>' to every response, so a client (curl -i, the frontend,
 * browser dev tools) can separate time spent in this server from time spent on the network.
 */
function serverTiming(_req, res, next) {
    const startedAt = process.hrtime.bigint()
    const originalWriteHead = res.writeHead

    // Headers can only be set before they are sent, so we hook the moment they go out.
    res.writeHead = function writeHeadWithTiming(...args) {
        const ms = Number(process.hrtime.bigint() - startedAt) / 1e6
        res.setHeader('Server-Timing', `app;dur=${ms.toFixed(1)}`)
        return originalWriteHead.apply(this, args)
    }
    next()
}

module.exports = { serverTiming }
