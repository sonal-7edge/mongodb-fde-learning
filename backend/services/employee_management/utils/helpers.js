/**
 * @import : External Dependencies
 */
const { randomUUID } = require('node:crypto')
const { faker } = require('@faker-js/faker')

const SKILLS = ['customer service', 'inventory', 'cash handling', 'film history', 'scheduling', 'visual merchandising', 'returns', 'team lead', 'social media', 'repairs']

/**
 * A new, readable employee code: 'EMP-' + 8 uppercase hex characters, e.g. 'EMP-3F9A1C02'.
 * @returns {string}
 */
function newEmployeeCode() {
    return `EMP-${randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

/**
 * One synthetic employee in our domain shape. Call faker.seed() first for repeatable output.
 * @param {string} createdBy
 * @returns {object}
 */
function fakeEmployee(createdBy) {
    const first_name = faker.person.firstName()
    const last_name = faker.person.lastName()
    return {
        // faker (not randomUUID) so the same seed gives the same codes
        employee_code: `EMP-${faker.string.hexadecimal({ length: 8, casing: 'upper', prefix: '' })}`,
        first_name,
        last_name,
        email: faker.internet.email({ firstName: first_name, lastName: last_name }).toLowerCase(),
        phone: faker.phone.number(),
        location: { city: faker.location.city(), country: faker.location.country() },
        department: faker.commerce.department(),
        job_title: faker.person.jobTitle(),
        joined_at: faker.date.past({ years: 10 }),
        avatar_url: null,
        skills: faker.helpers.arrayElements(SKILLS, { min: 1, max: 4 }),
        source: { provider: 'manual', external_id: faker.string.uuid() },
        created_by: createdBy,
    }
}

module.exports = { newEmployeeCode, fakeEmployee }
