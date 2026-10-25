// SOURCE OF TRUTH: /shared/explain.js. Do not edit copies under services/*/shared — run "make sync".

/**
 * The short version of a MongoDB query plan that every '?explain=true' endpoint returns.
 *
 * @typedef {Object} PlanSummary
 * @property {string} stage            the stage that matters most: COLLSCAN, IXSCAN, EXPRESS_IXSCAN, ...
 * @property {string|null} indexName   index the winning plan used, if any
 * @property {number} docsExamined     documents MongoDB had to read (the number to watch)
 * @property {number} keysExamined     index entries MongoDB had to read
 * @property {number} nReturned        documents returned
 * @property {number} ms               executionTimeMillis reported by the server
 * @property {boolean} hasSortStage    true = sorted in memory (no index supports the sort)
 * @property {string[]} stages         every stage in the winning plan, top to bottom
 */

// Order of interest when we pick one stage to headline: a COLLSCAN anywhere is the big news.
const HEADLINE_STAGES = ['COLLSCAN', 'TEXT_MATCH', 'IXSCAN', 'EXPRESS_IXSCAN', 'EXPRESS_CLUSTERED_IXSCAN', 'IDHACK', 'COUNT_SCAN']

/**
 * @param {object} explainOutput  result of query.explain('executionStats') or aggregate().explain('executionStats')
 * @returns {PlanSummary}
 */
function summarizeExplain(explainOutput) {
    const section = findPlannerSection(explainOutput)
    const winningPlan = section.queryPlanner.winningPlan
    // MongoDB 7+ (slot-based engine) nests the classic-looking plan under 'queryPlan'.
    const planRoot = winningPlan.queryPlan ?? winningPlan
    const nodes = flattenPlan(planRoot)
    const stages = nodes.map((node) => node.stage)
    const stats = section.executionStats ?? {}

    return {
        stage: HEADLINE_STAGES.find((name) => stages.includes(name)) ?? stages[0] ?? 'UNKNOWN',
        indexName: nodes.find((node) => node.indexName)?.indexName ?? null,
        docsExamined: stats.totalDocsExamined ?? 0,
        keysExamined: stats.totalKeysExamined ?? 0,
        nReturned: stats.nReturned ?? 0,
        ms: stats.executionTimeMillis ?? 0,
        hasSortStage: stages.some((name) => name === 'SORT' || name === 'SORT_KEY_GENERATOR'),
        stages,
    }
}

/**
 * find() explains have queryPlanner at the top. aggregate() explains may put it inside
 * the first stage's $cursor, so we look there too.
 * @param {object} output
 * @returns {{queryPlanner: object, executionStats?: object}}
 */
function findPlannerSection(output) {
    if (output?.queryPlanner) return output
    const cursorStage = output?.stages?.find((stage) => stage.$cursor)?.$cursor
    if (cursorStage?.queryPlanner) return cursorStage
    throw new Error('Unrecognised explain output: no queryPlanner section')
}

/**
 * Depth-first walk of a plan tree (inputStage / inputStages).
 * @param {object} node
 * @returns {object[]}
 */
function flattenPlan(node) {
    if (!node) return []
    const children = [node.inputStage, ...(node.inputStages ?? [])].filter(Boolean)
    return [node, ...children.flatMap(flattenPlan)]
}

/**
 * Helper for routes: run a mongoose query either normally or with explain.
 * @param {import('mongoose').Query|import('mongoose').Aggregate} query
 * @param {boolean} explain
 * @returns {Promise<{data: any, plan?: PlanSummary}>}
 */
async function runWithOptionalExplain(query, explain) {
    if (!explain) return { data: await query.exec() }
    // Run the query once for the data, and once with explain for the plan.
    const data = await query.clone().exec()
    const plan = summarizeExplain(await query.explain('executionStats'))
    return { data, plan }
}

module.exports = { summarizeExplain, runWithOptionalExplain }
