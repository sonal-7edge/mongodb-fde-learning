// Load .env when running on the host. In Docker the variables come from `--env-file` instead.
try {
    process.loadEnvFile()
} catch {
    // no .env file: fine, use the environment as it is
}

const mongoose = require('mongoose')
const { buildApp } = require('./app.js')

const port = Number(process.env.PORT ?? 3004)

async function main() {
    for (const name of ['MONGODB_URI', 'STAGE']) {
        if (!process.env[name]) {
            console.error(`${name} is not set.`)
            process.exit(1)
        }
    }

    // Build first: this checks JWT_SECRET before we spend time connecting.
    const app = buildApp()

    // One connection pool for the whole app (Atlas M0 allows 500 connections).
    await mongoose.connect(process.env.MONGODB_URI, { maxPoolSize: 20, serverSelectionTimeoutMS: 10_000 })
    console.log(`Connected to MongoDB database "${mongoose.connection.name}" (STAGE=${process.env.STAGE})`)

    const server = app.listen(port, () => console.log(`movie-store listening on http://localhost:${port}`))

    // Docker sends SIGTERM on `docker stop`; close cleanly so in-flight requests finish.
    for (const signal of ['SIGTERM', 'SIGINT']) {
        process.on(signal, async () => {
            server.close()
            await mongoose.disconnect()
            process.exit(0)
        })
    }
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
