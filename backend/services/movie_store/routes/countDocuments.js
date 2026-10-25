/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { buildMovieFilter } = require('../utils/helpers')

/**
 * Count Movies | Movie Store
 * @description -- Counts movies matching filters without returning them (Model.countDocuments)
 * @route       -- GET /api/movies/count?genre=&kind=&year_from=&year_to=&min_rating=&in_stock=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} count
 */
module.exports.countMovies = async (req, res, next) => {
    try {
        const filter = buildMovieFilter(req.valid.query)
        const count = await Movie.countDocuments(filter)
        return res.status(200).json({ operation: 'countDocuments', filter, count })
    } catch (error) {
        return next(error)
    }
}
