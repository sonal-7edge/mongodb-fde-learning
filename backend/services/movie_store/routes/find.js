/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { runWithOptionalExplain } = require('../shared/explain')
const { afterCursorFilter, toPage } = require('../shared/pagination')
const { buildMovieFilter } = require('../utils/helpers')

/**
 * Find Movies | Movie Store
 * @description -- Lists movies matching filters, sorted, one page at a time (Model.find)
 * @route       -- GET /api/movies?genre=&kind=&year_from=&year_to=&min_rating=&in_stock=&sort=rating|year&limit=&cursor=&explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: movies, next_cursor: pass it back as ?cursor= for the next page, plan: with ?explain=true
 */
module.exports.findMovies = async (req, res, next) => {
    try {
        const { sort, limit, cursor, explain, ...filters } = req.valid.query

        // Range pagination: "after the last movie I saw" instead of skip(N)
        const filter = { ...buildMovieFilter(filters), ...afterCursorFilter(sort, -1, cursor) }

        // limit + 1: the extra row only tells us whether another page exists
        const query = Movie.find(filter).sort({ [sort]: -1, _id: -1 }).limit(limit + 1).lean()
        const { data, plan } = await runWithOptionalExplain(query, explain)

        const { items, next_cursor } = toPage(data, limit, sort)
        return res.status(200).json({ operation: 'find', filter, data: items, next_cursor, plan })
    } catch (error) {
        return next(error)
    }
}
