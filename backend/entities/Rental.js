// SOURCE OF TRUTH: /entities/Rental.js. Do not edit copies under services/*/entities — run "make sync".
const { randomUUID } = require('node:crypto')
const mongoose = require('mongoose')
const mongoosePaginate = require('mongoose-paginate-v2')

const { Schema } = mongoose

// The events array is capped so a rental document can never grow without limit.
const MAX_RENTAL_EVENTS = 5

/**
 * One rental: the bridge between a movie, an employee and a customer.
 * See docs/data-model.md for why each part is embedded or referenced.
 *
 * @typedef {Object} Rental
 * @property {string} rental_code
 * @property {'active'|'returned'|'overdue'} status
 * @property {{_id: ObjectId, title: string, kind: string, year: number|null}} movie
 *           extended reference: the id plus a snapshot of the fields shown in lists
 * @property {{_id: ObjectId, name: string, employee_code: string}} employee   extended reference
 * @property {{name: string, email: string, phone: string|null}} customer    embedded, owned 1:1
 * @property {{daily_rate: number, days: number, total: number, currency: string}} pricing
 *           embedded, computed once at rent time
 * @property {{type: 'rented'|'extended'|'returned', at: Date, by_employee_id: ObjectId}[]} events
 *           bounded array (max MAX_RENTAL_EVENTS = 5)
 * @property {Date} rented_at
 * @property {Date} due_at
 * @property {Date|null} returned_at
 */
const RentalSchema = new Schema({
    // Basic Details
    rental_code: { type: String, required: true },
    status: { type: String, enum: ['active', 'returned', 'overdue'], default: 'active' },

    // Movie Details (extended reference: id + snapshot taken at rent time)
    movie: {
        _id: { type: Schema.Types.ObjectId, required: true },
        title: { type: String, required: true },
        kind: { type: String, required: true },
        year: { type: Number, default: null },
    },

    // Employee Details (extended reference)
    employee: {
        _id: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        employee_code: { type: String, required: true },
    },

    // Customer Details (embedded: belongs to this rental only)
    customer: {
        name: { type: String, required: true },
        email: { type: String, required: true, lowercase: true, trim: true },
        phone: { type: String, default: null },
    },

    // Pricing Details (embedded: computed once at rent time)
    pricing: {
        daily_rate: { type: Number, required: true, min: 0 },
        days: { type: Number, required: true, min: 1 },
        total: { type: Number, required: true, min: 0 },
        currency: { type: String, required: true },
    },

    // Event Details (bounded array)
    events: {
        type: [{
            _id: false,
            type: { type: String, enum: ['rented', 'extended', 'returned'], required: true },
            at: { type: Date, default: Date.now },
            by_employee_id: { type: Schema.Types.ObjectId },
        }],
        default: [],
        validate: {
            validator: (events) => events.length <= MAX_RENTAL_EVENTS,
            message: `A rental can hold at most ${MAX_RENTAL_EVENTS} events`,
        },
    },

    // Dates
    rented_at: { type: Date, default: Date.now },
    due_at: { type: Date, required: true },
    returned_at: { type: Date, default: null },

    // Audit Details
    created_by: { type: String, default: '' },
    created_by_email: { type: String, default: '' },
    updated_by: { type: String, default: '' },
    updated_by_email: { type: String, default: '' },
    update_id: { type: String, default: () => randomUUID() },

    // Soft delete: the document stays, queries must filter { deleted: false }
    deleted: { type: Boolean, default: false },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})

RentalSchema.plugin(mongoosePaginate)

const Rental = mongoose.model(`${process.env.STAGE}-rentals`, RentalSchema)

module.exports = Rental
