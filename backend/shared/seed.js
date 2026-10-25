// SOURCE OF TRUTH: /shared/seed.js. Do not edit copies under services/*/shared — run "make sync".
const mongoose = require('mongoose')
const { HttpError } = require('./errors')
const { checkStorageBudget } = require('./admin')

/**
 * Insert `count` generated documents in batches, after checking the Atlas Free tier budget.
 *
 * Why batches: one insertMany of 100,000 documents builds one huge request in memory;
 * batches of ~1,000 keep memory flat and are one round trip (one "operation") each.
 *
 * @param {{model: import('mongoose').Model, count: number, batchSize: number, makeDoc: () => object}} input
 * @returns {Promise<{collection: string, inserted: number, ms: number, docs_per_sec: number, budget: object}>}
 */
async function seedInBatches({ model, count, batchSize, makeDoc }) {
    const budget = await estimateBudget(model, count, makeDoc)
    if (!budget.allowed) throw new HttpError(507, budget.reason, budget)

    const startedAt = Date.now()
    let inserted = 0
    while (inserted < count) {
        const size = Math.min(batchSize, count - inserted)
        const batch = Array.from({ length: size }, makeDoc)
        // ordered: false = one bad document doesn't stop the rest of the batch
        const docs = await model.insertMany(batch, { ordered: false })
        inserted += docs.length
    }
    const ms = Date.now() - startedAt
    return {
        collection: model.collection.collectionName,
        inserted,
        ms,
        docs_per_sec: Math.round(inserted / Math.max(ms / 1000, 0.001)),
        budget,
    }
}

/**
 * Projected database size after the seed, against 80% of the Free tier's 0.5 GB.
 * Uses the collection's real average document size, or measures one generated document if it is empty.
 */
async function estimateBudget(model, count, makeDoc) {
    const db = mongoose.connection.db
    const dbStats = await db.stats()
    const usedBytes = (dbStats.dataSize ?? 0) + (dbStats.indexSize ?? 0)

    const [collStats] = await model.collection.aggregate([{ $collStats: { storageStats: {} } }]).toArray().catch(() => [])
    const measured = collStats?.storageStats?.avgObjSize
    const avgObjSize = measured || mongoose.mongo.BSON.calculateObjectSize(new model(makeDoc()).toObject())

    const result = checkStorageBudget({
        usedBytes,
        avgObjSize,
        count,
        freeTier: process.env.ATLAS_FREE_TIER === 'true',
    })
    return {
        allowed: result.allowed,
        reason: result.reason,
        used_bytes: usedBytes,
        avg_obj_size: avgObjSize,
        projected_bytes: result.projectedBytes,
        limit_bytes: result.limitBytes,
    }
}

module.exports = { seedInBatches }
