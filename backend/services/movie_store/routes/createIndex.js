/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { MOVIE_INDEXES } = require('../utils/indexes')

/**
 * Create Index | Movie Store
 * @description -- Builds one of the demo indexes in MOVIE_INDEXES (collection.createIndex).
 *                 Building reads the whole collection once, so on 100k movies it takes a moment.
 *                 Creating an index that already exists is a no-op.
 * @route       -- POST /api/movies/admin/indexes/:name
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} index: { name, key, access_pattern }, ms: build time
 */
module.exports.createIndex = async (req, res, next) => {
    try {
        const index = MOVIE_INDEXES[req.valid.params.name]
        const startedAt = Date.now()
        await Movie.collection.createIndex(index.key, { name: index.name })
        return res.status(201).json({ operation: 'createIndex', index, ms: Date.now() - startedAt })
    } catch (error) {
        return next(error)
    }
}
