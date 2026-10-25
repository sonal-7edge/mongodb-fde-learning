import { MongoMemoryReplSet } from 'mongodb-memory-server'

/**
 * Starts ONE in-memory MongoDB replica set for the whole test run (a replica set is needed
 * for transactions). Set TEST_MONGODB_URI to run the tests against a real cluster instead.
 * Each test file then uses its own database name (see db.mjs), so files never share data.
 */
export default async function setup({ provide }) {
    if (process.env.TEST_MONGODB_URI) {
        provide('mongoUri', process.env.TEST_MONGODB_URI)
        return
    }
    const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } })
    provide('mongoUri', replSet.getUri())
    return async () => replSet.stop()
}
