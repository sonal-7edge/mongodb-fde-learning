/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { collectionStats } = require('../shared/admin')

/**
 * List Indexes | Movie Store
 * @description -- Every index on the movies collection, with its size (collection.indexes + $collStats)
 * @route       -- GET /api/movies/admin/indexes
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: [{ name, key, size_bytes }]
 */
module.exports.listIndexes = async (_req, res, next) => {
    try {
        // 26 = NamespaceNotFound: nothing seeded yet, so there are no indexes
        const indexes = await Movie.collection.indexes().catch((error) => (error.code === 26 ? [] : Promise.reject(error)))
        const { indexSizes } = await collectionStats(Movie)
        const data = indexes.map((index) => ({ name: index.name, key: index.key, size_bytes: indexSizes[index.name] ?? 0 }))
        return res.status(200).json({ operation: 'listIndexes', data })
    } catch (error) {
        return next(error)
    }
}
