/**
 * Every endpoint the console can call. Each stage branch adds its endpoints here.
 *
 * @typedef {Object} Endpoint
 * @property {string} group          heading in the side list
 * @property {string} name
 * @property {"GET"|"POST"|"PATCH"|"DELETE"} method
 * @property {string} path           may include a query string
 * @property {boolean} [public]      true = no token needed
 * @property {boolean} [explain]     true = supports ?explain=true
 * @property {object} [body]         default JSON body
 * @property {string} [note]         one line shown under the request
 */

/** @type {Endpoint[]} */
export const endpoints = [
  {
    group: "Platform",
    name: "Health",
    method: "GET",
    path: "/health",
    public: true,
    note: "No token needed. 200 only when MongoDB is connected.",
  },
  {
    group: "Platform",
    name: "Storage overview",
    method: "GET",
    path: "/api/admin/overview",
    note: "Size of every collection (data + indexes) against the Atlas Free tier's 0.5 GB.",
  },
];
