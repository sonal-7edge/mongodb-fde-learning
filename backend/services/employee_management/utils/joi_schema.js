/**
 * @import : External Dependencies
 */
const Joi = require('joi')

/**
 * @import : Common Helpers
 */
const { MAX_LIMIT, DEFAULT_LIMIT } = require('../shared/pagination')

const SEED_MAX = Number(process.env.SEED_MAX ?? 100000)

/** GET/PATCH/DELETE /api/employees/:id */
const idParams = Joi.object({
    id: Joi.string().hex().length(24).required()
        .messages({
        'string.hex': '"id" must be a 24-character MongoDB ObjectId',
        'string.length': '"id" must be a 24-character MongoDB ObjectId',
    }),
})

/** Fields a client may send. employee_code, source and audit fields are set by the server. */
const employeeFields = {
    first_name: Joi.string().trim().min(1).max(100),
    last_name: Joi.string().trim().min(1).max(100),
    email: Joi.string().trim().lowercase().email(),
    phone: Joi.string().trim().max(40).allow(null),
    location: Joi.object({
        city: Joi.string().trim().max(100).allow(null),
        country: Joi.string().trim().max(100).allow(null),
    }),
    department: Joi.string().trim().max(100).allow(null),
    job_title: Joi.string().trim().max(100).allow(null),
    joined_at: Joi.date().iso().allow(null),
    avatar_url: Joi.string().uri().allow(null),
    skills: Joi.array().items(Joi.string().trim().lowercase().max(40)).max(20),
}

/** POST /api/employees */
const createEmployeeBody = Joi.object({
    ...employeeFields,
    first_name: employeeFields.first_name.required(),
    last_name: employeeFields.last_name.required(),
    email: employeeFields.email.required(),
})

/** PATCH /api/employees/:id — whitelisted fields, at least one */
const updateEmployeeBody = Joi.object(employeeFields).min(1)

/** GET /api/employees */
const listEmployeesQuery = Joi.object({
    department: Joi.string().trim().max(100),
    country: Joi.string().trim().max(100),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT),
})

/** GET /api/employees/:id */
const getEmployeeQuery = Joi.object({ explain: Joi.boolean().default(false) })

/** POST /api/employees/admin/seed */
const seedEmployeesBody = Joi.object({
    count: Joi.number().integer().min(1).max(SEED_MAX).required(),
    batch_size: Joi.number().integer().min(1).max(10000).default(1000),
    seed: Joi.number().integer().default(42),
})

module.exports = {
    idParams,
    createEmployeeBody,
    updateEmployeeBody,
    listEmployeesQuery,
    getEmployeeQuery,
    seedEmployeesBody,
}
