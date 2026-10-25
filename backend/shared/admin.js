// SOURCE OF TRUTH: /shared/admin.js. Do not edit copies under services/*/shared — run "make sync".

/** Atlas Free tier (M0) storage limit: 0.5 GB of data + indexes. */
const FREE_TIER_BYTES = 512 * 1024 * 1024
/** Seeding refuses to go past this share of the Free tier budget. */
const BUDGET_SHARE = 0.8

/**
 * @typedef {Object} CollectionStats
 * @property {string} collection
 * @property {number} count
 * @property {number} avgObjSize
 * @property {number} dataSize          uncompressed size of the documents
 * @property {number} storageSize       size on disk (compressed)
 * @property {number} totalIndexSize
 * @property {Object<string, number>} indexSizes
 */

/**
 * Size numbers for one collection, from the $collStats aggregation stage.
 * @param {import('mongoose').Model} model
 * @returns {Promise<CollectionStats>}
 */
async function collectionStats(model) {
    const empty = {
        collection: model.collection.collectionName,
        count: 0,
        avgObjSize: 0,
        dataSize: 0,
        storageSize: 0,
        totalIndexSize: 0,
        indexSizes: {},
    }
    let rows
    try {
        rows = await model.collection.aggregate([{ $collStats: { storageStats: {} } }]).toArray()
    } catch (error) {
        // 26 = NamespaceNotFound: the collection doesn't exist yet.
        if (error.code === 26) return empty
        throw error
    }
    const storage = rows[0]?.storageStats
    if (!storage) return empty
    return {
        ...empty,
        count: storage.count ?? 0,
        avgObjSize: storage.avgObjSize ?? 0,
        dataSize: storage.size ?? 0,
        storageSize: storage.storageSize ?? 0,
        totalIndexSize: storage.totalIndexSize ?? 0,
        indexSizes: storage.indexSizes ?? {},
    }
}

/**
 * @param {number} bytes  dataSize + totalIndexSize
 * @returns {number} percentage of the Free tier budget, 2 decimals
 */
function percentOfFreeTier(bytes) {
    return Math.round((bytes / FREE_TIER_BYTES) * 10000) / 100
}

/**
 * Should a seed of `count` more documents be allowed?
 * @param {{usedBytes: number, avgObjSize: number, count: number, freeTier: boolean}} input
 * @returns {{allowed: boolean, projectedBytes: number, limitBytes: number, reason?: string}}
 */
function checkStorageBudget({ usedBytes, avgObjSize, count, freeTier }) {
    const projectedBytes = usedBytes + avgObjSize * count
    const limitBytes = Math.floor(FREE_TIER_BYTES * BUDGET_SHARE)
    if (!freeTier || projectedBytes <= limitBytes) return { allowed: true, projectedBytes, limitBytes }
    return {
        allowed: false,
        projectedBytes,
        limitBytes,
        reason:
            `Projected size ${(projectedBytes / 1e6).toFixed(1)} MB is over ${BUDGET_SHARE * 100}% of the ` +
            "Free tier's 512 MB. Seed fewer documents, drop data, or set ATLAS_FREE_TIER=false on a bigger cluster.",
    }
}

/**
 * Read-only: the indexes that exist on a collection right now.
 * (This app never creates indexes by itself; see docs on why each index is needed.)
 * @param {import('mongoose').Model} model
 * @returns {Promise<{name: string, key: object, unique?: boolean}[]>}
 */
async function listIndexes(model) {
    try {
        return await model.collection.listIndexes().toArray()
    } catch (error) {
        if (error.code === 26) return []
        throw error
    }
}

module.exports = { FREE_TIER_BYTES, BUDGET_SHARE, collectionStats, percentOfFreeTier, checkStorageBudget, listIndexes }
