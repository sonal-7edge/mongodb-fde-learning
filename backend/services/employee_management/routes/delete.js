/**
 * @import : External Dependencies
 */
const mongoose = require('mongoose')

/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')

/**
 * Delete Employee | Employee Management
 * @description -- SOFT delete: marks ONE employee deleted: true (Model.updateOne)
 * @route       -- DELETE /api/employees/:id
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} result: { matchedCount, modifiedCount }
 */
module.exports.deleteEmployee = async (req, res, next) => {
    try {
        const _id = new mongoose.Types.ObjectId(decodeURIComponent(req.valid.params.id))
        const result = await Employee.updateOne(
            { _id, deleted: false },
            { $set: { deleted: true, updated_by: req.auth.sub } },
        )
        if (result.matchedCount === 0) throw new HttpError(404, 'Employee not found')
        return res.status(200).json({ result })
    } catch (error) {
        return next(error)
    }
}
