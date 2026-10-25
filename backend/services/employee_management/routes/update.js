/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { toSetPaths } = require('../shared/update')

/**
 * Update Employee | Employee Management
 * @description -- Changes whitelisted fields of ONE employee and returns it (Model.findOneAndUpdate)
 * @route       -- PATCH /api/employees/:id
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the employee AFTER the change
 */
module.exports.updateEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.findOneAndUpdate(
            { _id: req.valid.params.id, deleted: false },
            { $set: { ...toSetPaths(req.valid.body), updated_by: req.auth.sub } },
            // returnDocument 'after' = send back the updated version; runValidators = check schema rules
            { returnDocument: 'after', runValidators: true, lean: true },
        )
        if (!employee) throw new HttpError(404, 'Employee not found')
        return res.status(200).json({ data: employee })
    } catch (error) {
        return next(error)
    }
}
