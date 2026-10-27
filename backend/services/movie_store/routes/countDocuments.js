/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { summarizeExplain } = require('../shared/explain')
const { buildMovieFilter } = require('../utils/helpers')

/**
 * Count Movies | Movie Store
 * @description -- Counts movies matching filters without returning them (Model.countDocuments)
 * @route       -- GET /api/movies/count?title=&genre=&kind=&year_from=&year_to=&min_rating=&in_stock=&explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} count, plan: with ?explain=true
 */
module.exports.countMovies = async (req, res, next) => {
    try {
        const { explain, ...filters } = req.valid.query
        const filter = buildMovieFilter(filters)
        const count = await Movie.countDocuments(filter)
        // countDocuments can't be explained directly; the driver runs it as this aggregation, so explain that
        const plan = explain
            ? summarizeExplain(await Movie.aggregate([{ $match: filter }, { $group: { _id: 1, n: { $sum: 1 } } }]).explain('executionStats'))
            : undefined
        return res.status(200).json({ operation: 'countDocuments', filter, count, plan })
    } catch (error) {
        return next(error)
    }
}
