/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

/**
 * @import : Common Helpers
 */
const { HttpError } = require('../shared/errors')
const { runWithOptionalExplain } = require('../shared/explain')

/**
 * Get Employee | Employee Management
 * @description -- Reads ONE employee by id (Model.findOne)
 * @route       -- GET /api/employees/:id?explain=
 * @access      -- (Bearer token)
 * @apiSuccess  -- (200) {Object} data: the employee, plan: with ?explain=true
 */
module.exports.getEmployee = async (req, res, next) => {
    try {
        const query = Employee.findOne({ _id: req.valid.params.id, deleted: false }).lean()
        const { data, plan } = await runWithOptionalExplain(query, req.valid.query.explain)
        if (!data) throw new HttpError(404, 'Employee not found')
        return res.status(200).json({ data, plan })
    } catch (error) {
        return next(error)
    }
}
