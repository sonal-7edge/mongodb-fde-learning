/**
 * @import : External Dependencies
 */
const mongoose = require('mongoose')

/**
 * @import : Entities
 */
const Rental = require('../entities/Rental')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { runWithOptionalExplain } = require('../shared/explain')

/**
 * Get Rental | Rentals
 * @description -- Reads ONE rental by id (Model.findOne). Movie title and employee name come from the
 *                 snapshot inside the rental: no second query, no join.
 * @route       -- GET /api/rentals/:id?explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the rental, plan: with ?explain=true
 */
module.exports.getRental = async (req, res, next) => {
    try {
        const _id = new mongoose.Types.ObjectId(decodeURIComponent(req.valid.params.id))
        const query = Rental.findOne({ _id, deleted: false }).lean()
        const { data, plan } = await runWithOptionalExplain(query, req.valid.query.explain)
        if (!data) throw new HttpError(404, 'Rental not found')
        return res.status(200).json({ data, plan })
    } catch (error) {
        return next(error)
    }
}
