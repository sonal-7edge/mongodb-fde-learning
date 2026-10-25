/**
 * @import : External Dependencies
 */
const { randomUUID } = require('node:crypto')

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * A new, readable rental code: 'RNT-' + 8 uppercase hex characters, e.g. 'RNT-7C01A9E4'.
 * @returns {string}
 */
function newRentalCode() {
    return `RNT-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/**
 * Price is computed ONCE, at rent time, and stored in the rental.
 * Later price changes on the movie don't change what this customer agreed to pay.
 * @param {number} dailyRate
 * @param {number} days
 * @param {string} currency
 * @returns {{daily_rate: number, days: number, total: number, currency: string}}
 */
function computePricing(dailyRate, days, currency) {
    return { daily_rate: dailyRate, days, total: Math.round(dailyRate * days * 100) / 100, currency }
}

/**
 * @param {Date} from
 * @param {number} days
 * @returns {Date}
 */
function addDays(from, days) {
    return new Date(from.getTime() + days * DAY_MS)
}

module.exports = { newRentalCode, computePricing, addDays }
