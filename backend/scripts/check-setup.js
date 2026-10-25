// Pre-work check: can this machine reach your MongoDB (Atlas) cluster?
// Usage: npm run check:setup
const mongoose = require('mongoose')

try {
    process.loadEnvFile()
} catch {
    // handled below
}

async function main() {
    const uri = process.env.MONGODB_URI
    if (!uri) {
        fail('MONGODB_URI is missing.', 'Add your Atlas connection string to .env as MONGODB_URI=...')
    }

    console.log('1. Connecting (10 s timeout)...')
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })

    const admin = mongoose.connection.db.admin()
    const { version } = await admin.serverInfo()
    const hello = await admin.command({ hello: 1 })
    console.log(`2. Server version ${version}`)
    console.log(
        hello.setName
            ? `   Replica set "${hello.setName}" with ${hello.hosts?.length ?? '?'} members (transactions will work)`
            : '   WARNING: not a replica set. Transactions (rentals stage) will fail.'
    )

    console.log('3. Insert, read and delete one document in a temporary collection...')
    const collection = mongoose.connection.db.collection('setup_check_tmp')
    const { insertedId } = await collection.insertOne({ checked_at: new Date() })
    const found = await collection.findOne({ _id: insertedId })
    await collection.drop()
    if (!found) throw new Error('Inserted document could not be read back')

    console.log(`✅ Setup OK. Database "${mongoose.connection.name}" is reachable and writable.`)
    await mongoose.disconnect()
}

/** Map common connection errors to a fix. Never print the URI (it contains the password). */
function explain(error) {
    const message = String(error?.message ?? error)
    if (message.includes('querySrv') || message.includes('ENOTFOUND')) {
        fail(message, 'DNS could not resolve the cluster. Corporate DNS/VPN often blocks SRV lookups: try another network, or use the standard (non-SRV, mongodb://) connection string from Atlas.')
    }
    if (/auth/i.test(message)) {
        fail(message, 'Authentication failed. Check the database user and password; URL-encode special characters in the password (e.g. @ → %40).')
    }
    if (/Server selection timed out|timed out/i.test(message)) {
        fail(message, 'Could not reach the cluster. Add your IP in Atlas > Network Access, and check that no VPN/firewall blocks port 27017.')
    }
    fail(message, 'Unexpected error. Check MONGODB_URI in .env (see docs/setup.md).')
}

function fail(problem, fix) {
    console.error(`❌ ${problem}\n   Fix: ${fix}`)
    process.exit(1)
}

main().catch(explain)
