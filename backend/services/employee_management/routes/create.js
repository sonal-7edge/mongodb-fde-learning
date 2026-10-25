/**
 * @import : Entities
 */
const Employee = require('../entities/Employee')

/**
 * @import : Common Helpers
 */
const { newEmployeeCode } = require('../utils/helpers')

/**
 * Create Employee | Employee Management
 * @description -- Inserts ONE employee (Model.create → insertOne). The server sets employee_code and source.
 * @route       -- POST /api/employees
 * @access      -- (Bearer token)
 * @apiSuccess  -- (201) {Object} The stored employee
 */
module.exports.createEmployee = async (req, res, next) => {
    try {
        const employee = await Employee.create({
            ...req.valid.body,
            employee_code: newEmployeeCode(),
            source: { provider: 'manual', external_id: crypto.randomUUID() },
            created_by: req.auth.sub,
        })
        return res.status(201).json({ data: employee })
    } catch (error) {
        return next(error)
    }
}
