/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { runWithOptionalExplain } = require('../shared/explain')

/**
 * List Genres | Movie Store
 * @description -- Every different genre in use (Model.distinct). genres is an array: each element counts.
 * @route       -- GET /api/movies/genres?explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: sorted list of genres, plan: with ?explain=true
 */
module.exports.distinctGenres = async (req, res, next) => {
    try {
        const { data: genres, plan } = await runWithOptionalExplain(Movie.distinct('genres', { deleted: false }), req.valid.query.explain)
        return res.status(200).json({ operation: 'distinct', data: genres.sort(), plan })
    } catch (error) {
        return next(error)
    }
}
