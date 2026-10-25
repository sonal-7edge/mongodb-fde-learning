/**
 * @import : Entities
 */
const Movie = require('../entities/Movie')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')

/**
 * Adjust Stock | Movie Store
 * @description -- Takes or returns one copy ATOMICALLY (Model.findOneAndUpdate + $inc).
 *                 The stock check is part of the filter, so two requests can never both take the last copy.
 * @route       -- POST /api/movies/:id/stock   body: { action: 'take' | 'return' }
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the movie AFTER the change
 */
module.exports.adjustStock = async (req, res, next) => {
    try {
        const { id } = req.valid.params
        const take = req.valid.body.action === 'take'

        const filter = take
            ? { _id: id, deleted: false, 'inventory.available': { $gt: 0 } }
            // $expr compares two fields of the same document: available must stay <= total
            : { _id: id, deleted: false, $expr: { $lt: ['$inventory.available', '$inventory.total'] } }
        const update = { $inc: { 'inventory.available': take ? -1 : 1 }, $set: { updated_by: req.auth.sub } }

        const movie = await Movie.findOneAndUpdate(filter, update, { returnDocument: 'after', lean: true })
        if (!movie) {
            // Nothing matched: either the movie doesn't exist, or the stock rule refused the change
            const exists = await Movie.exists({ _id: id, deleted: false })
            if (!exists) throw new HttpError(404, 'Movie not found')
            throw new HttpError(409, take ? 'Out of stock' : 'All copies are already in stock')
        }
        return res.status(200).json({ operation: 'findOneAndUpdate', filter, update, data: movie })
    } catch (error) {
        return next(error)
    }
}
