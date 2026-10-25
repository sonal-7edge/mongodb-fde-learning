/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * Insert Movies | Movie Store
 * @description -- Inserts MANY movies in one round trip (Model.insertMany)
 * @route       -- POST /api/movies/bulk
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} How many were inserted and their ids
 */
module.exports.insertMovies = async (req, res, next) => {
    try {
        const docs = req.valid.body.movies.map((movie) => ({
            ...movie,
            source: { provider: 'manual', external_id: crypto.randomUUID() },
            created_by: req.auth.sub,
        }))
        // One request to MongoDB for all documents, instead of one request per movie
        const inserted = await Movie.insertMany(docs)
        return res.status(201).json({
            operation: 'insertMany',
            inserted_count: inserted.length,
            inserted_ids: inserted.map((movie) => movie._id),
        })
    } catch (error) {
        return next(error)
    }
}
