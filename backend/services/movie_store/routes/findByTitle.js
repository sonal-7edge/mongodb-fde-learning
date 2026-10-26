/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { runWithOptionalExplain } = require('../shared/explain')

/**
 * Find Movies by Title | Movie Store
 * @description -- Movies whose title STARTS WITH the given text (case-sensitive), sorted by title (Model.find).
 *                 Without the { title: 1 } index MongoDB reads every movie (COLLSCAN); with it, it jumps
 *                 straight to the matching range of the index (IXSCAN).
 *                 max_time_ms makes MongoDB give up on a slow query (504), which shows a COLLSCAN failing at scale.
 * @route       -- GET /api/movies/by-title?title=&limit=&max_time_ms=&explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: matching movies, plan: with ?explain=true
 * @apiError    -- (504) The query ran longer than max_time_ms
 */
module.exports.findMoviesByTitle = async (req, res, next) => {
    try {
        const { title, limit, max_time_ms, explain } = req.valid.query

        // An anchored (^), case-sensitive regex is a prefix search, so it can use the title index.
        // Special characters are escaped so the user's text is matched literally.
        const prefix = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const filter = { title: { $regex: `^${prefix}` }, deleted: false }

        let query = Movie.find(filter).sort({ title: 1 }).limit(limit).lean()
        if (max_time_ms) query = query.maxTimeMS(max_time_ms)
        const { data, plan } = await runWithOptionalExplain(query, explain)
        return res.status(200).json({ operation: 'find (title prefix)', filter, data, plan })
    } catch (error) {
        return next(error)
    }
}
