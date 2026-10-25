/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * List Genres | Movie Store
 * @description -- Every different genre in use (Model.distinct). genres is an array: each element counts.
 * @route       -- GET /api/movies/genres
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: sorted list of genres
 */
module.exports.distinctGenres = async (req, res, next) => {
    try {
        const genres = await Movie.distinct('genres', { deleted: false })
        return res.status(200).json({ operation: 'distinct', data: genres.sort() })
    } catch (error) {
        return next(error)
    }
}
