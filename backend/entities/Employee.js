// SOURCE OF TRUTH: /entities/Employee.js. Do not edit copies under services/*/entities — run "make sync".
const { randomUUID } = require('node:crypto')
const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')

const { Schema } = mongoose

/**
 * A member of store staff.
 *
 * @typedef {Object} Employee
 * @property {string} employee_code           e.g. 'EMP-3F9A1C02' (built by the import translator)
 * @property {string} first_name
 * @property {string} last_name
 * @property {string} email                   lowercase; NOT unique (fake data collides)
 * @property {string|null} phone
 * @property {{city: string|null, country: string|null}} location
 * @property {string|null} department        null when the source has no department
 * @property {string|null} job_title
 * @property {Date|null} joined_at
 * @property {string|null} avatar_url
 * @property {string[]} skills                synthetic only; feeds text search
 * @property {{provider: 'randomuser'|'dummyjson'|'manual', external_id: string, fetched_at: Date}} source
 */
const EmployeeSchema = new Schema({
    // Basic Details
    employee_code: { type: String, required: true },
    first_name: { type: String, required: true, trim: true },
    last_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: null },
    location: {
        city: { type: String, default: null },
        country: { type: String, default: null },
    },

    // Job Details
    department: { type: String, default: null },
    job_title: { type: String, default: null },
    joined_at: { type: Date, default: null },
    avatar_url: { type: String, default: null },
    skills: { type: [String], default: [] },

    // Source Details (where the record was imported from)
    source: {
        provider: { type: String, enum: ['randomuser', 'dummyjson', 'manual'], required: true },
        external_id: { type: String, required: true },
        fetched_at: { type: Date, default: Date.now },
    },

    // Audit Details
    created_by: { type: String, default: '' },
    created_by_email: { type: String, default: '' },
    updated_by: { type: String, default: '' },
    updated_by_email: { type: String, default: '' },

    // Soft delete: the document stays, queries must filter { deleted: false }
    deleted: { type: Boolean, default: false },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

EmployeeSchema.plugin(mongoosePaginate)

const Employee = mongoose.model(`${process.env.STAGE}-employees`, EmployeeSchema)

module.exports = Employee
