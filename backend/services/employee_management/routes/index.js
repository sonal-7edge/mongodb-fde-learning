const { Router } = require('express')

// Mounted at /api/employees. Routes are added stage by stage (see README branch table).
const employeeRouter = Router()

module.exports = { employeeRouter }
