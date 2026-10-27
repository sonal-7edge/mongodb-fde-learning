/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { MOVIE_INDEXES } = require('../utils/indexes')

/**
 * Drop Index | Movie Store
 * @description -- Removes one of the demo indexes (collection.dropIndex), so the "before" can be shown again
 * @route       -- DELETE /api/movies/admin/indexes/:name
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} dropped: index name
 * @apiError    -- (404) The index does not exist
 */
module.exports.dropIndex = async (req, res, next) => {
    try {
        const index = MOVIE_INDEXES[req.valid.params.name]
        await Movie.collection.dropIndex(index.name).catch((error) => {
            // 27 = IndexNotFound
            if (error.code === 27) throw new HttpError(404, `Index ${index.name} does not exist`)
            throw error
        })
        return res.status(200).json({ operation: 'dropIndex', dropped: index.name })
    } catch (error) {
        return next(error)
    }
}
