import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { inject } from 'vitest'

// Load mongoose with Node's require, so tests share the exact instance the CommonJS app uses.
const require = createRequire(import.meta.url)
const mongoose = require('mongoose')

/**
 * Connect mongoose to a fresh, uniquely named database for this test file.
 * Call in beforeAll; call disconnectTestDb in afterAll.
 */
export async function connectTestDb() {
    const dbName = `test_${randomUUID().slice(0, 8)}`
    await mongoose.connect(inject('mongoUri'), { dbName })
    return mongoose.connection
}

/** Drop this file's database and disconnect. */
export async function disconnectTestDb() {
    await mongoose.connection.dropDatabase()
    await mongoose.disconnect()
}

/** Empty every collection but keep indexes (use in beforeEach when tests must not see each other's data). */
export async function clearCollections() {
    const collections = await mongoose.connection.db.collections()
    await Promise.all(collections.map((collection) => collection.deleteMany({})))
}
