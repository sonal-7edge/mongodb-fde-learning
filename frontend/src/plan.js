/**
 * Turns the backend's plan summary (shared/explain.js PlanSummary) into a plain-language explanation:
 * a verdict, examined-vs-returned bars, the stages in the order MongoDB ran them, a comparison with
 * the previous run of the same request, and what to try next.
 *
 * @typedef {Object} Plan
 * @property {string} stage
 * @property {string|null} indexName
 * @property {number} docsExamined
 * @property {number} keysExamined
 * @property {number} nReturned
 * @property {number} ms
 * @property {boolean} hasSortStage
 * @property {string[]} stages   top (last to run) to bottom (first to run)
 */

/** One line per stage name, in words someone new to MongoDB can follow. */
const STAGE_HELP = {
  COLLSCAN: "Read every document in the collection, one by one, and checked each against the filter.",
  IXSCAN: "Walked only the matching range of an index (a sorted list of keys), not the whole collection.",
  EXPRESS_IXSCAN: "Fast path: looked up one exact key in an index and stopped.",
  EXPRESS_CLUSTERED_IXSCAN: "Fast path: looked up one exact key in the clustered index and stopped.",
  IDHACK: "Fast path: looked up one document by _id.",
  FETCH: "Loaded the full documents that the index entries point to.",
  SORT: "Sorted the matches in memory, because no index was already in this order.",
  SORT_KEY_GENERATOR: "Worked out the sort key of each document for the in-memory sort.",
  LIMIT: "Stopped as soon as it had the requested number of documents.",
  SKIP: "Read and threw away documents to reach the requested page (skip).",
  PROJECTION_SIMPLE: "Kept only the requested fields.",
  PROJECTION_DEFAULT: "Kept only the requested fields.",
  PROJECTION_COVERED: "Built the result from the index alone, without reading documents.",
  GROUP: "Combined the matches into one result ($group), e.g. a count.",
  COUNT: "Counted the matching documents.",
  COUNT_SCAN: "Counted index entries without reading any documents.",
  DISTINCT_SCAN: "Jumped through the index one distinct value at a time.",
  EOF: "Nothing to read: MongoDB knew there could be no matches (e.g. the collection doesn't exist).",
  SHARDING_FILTER: "Dropped documents that belong to another shard.",
  OR: "Ran several index scans and merged the results ($or).",
};

const fmt = (n) => Number(n ?? 0).toLocaleString();

/** "1 document" / "2 documents" */
const count = (n, noun) => `${fmt(n)} ${noun}${n === 1 ? "" : "s"}`;

/** "100,000×" / "2.5×" */
const times = (n) => `${n >= 10 ? fmt(Math.round(n)) : n.toFixed(1).replace(/\.0$/, "")}×`;

/**
 * @param {Plan} plan
 * @param {{plan: Plan|null, path: string}} context  previous plan of the same request, if any
 * @returns {string} HTML
 */
export function renderPlan(plan, { plan: previous, path }) {
  return `
    <div class="plan-head">
      <h2>Query plan</h2>
      <span class="stage-badge ${stageClass(plan.stage)}">${escape(plan.stage)}</span>
    </div>
    ${verdict(plan)}
    ${bars(plan)}
    ${previous ? comparison(previous, plan) : ""}
    ${pipeline(plan)}
    ${hints(plan, path)}
    <details class="plan-raw">
      <summary>All numbers</summary>
      <div class="plan-grid">
        <div><span class="label">Stage</span><span class="value ${stageClass(plan.stage)}">${escape(plan.stage)}</span></div>
        <div><span class="label">Index</span><span class="value">${escape(plan.indexName ?? "none")}</span></div>
        <div><span class="label">Docs examined</span><span class="value">${fmt(plan.docsExamined)}</span></div>
        <div><span class="label">Keys examined</span><span class="value">${fmt(plan.keysExamined)}</span></div>
        <div><span class="label">Returned</span><span class="value">${fmt(plan.nReturned)}</span></div>
        <div><span class="label">MongoDB time</span><span class="value">${fmt(plan.ms)} ms</span></div>
        <div><span class="label">Sort in memory</span><span class="value ${plan.hasSortStage ? "warn" : "good"}">${plan.hasSortStage ? "yes" : "no"}</span></div>
      </div>
    </details>`;
}

/** COLLSCAN is the one to worry about; everything else used an index or had nothing to read. */
export function stageClass(stage) {
  return stage === "COLLSCAN" ? "bad" : "good";
}

/** Results that summarise many documents (a count, a group) return 1 row by design. */
function isAggregate(plan) {
  return (plan.stages ?? []).some((name) => ["GROUP", "COUNT", "COUNT_SCAN", "DISTINCT_SCAN"].includes(name));
}

function verdict(plan) {
  const { stage, indexName, docsExamined, keysExamined, nReturned } = plan;
  let headline;
  let detail;
  if (stage === "COLLSCAN") {
    headline = "Full collection scan";
    detail = `MongoDB read <b>all ${count(docsExamined, "document")}</b> to return <b>${fmt(nReturned)}</b>. No index helped, so the work grows with the size of the collection.`;
  } else if (stage === "EOF") {
    headline = "Nothing to read";
    detail = "MongoDB answered without reading anything.";
  } else if (indexName) {
    headline = `Used the index ${escape(indexName)}`;
    detail = `MongoDB read <b>${count(keysExamined, "index key")}</b> and <b>${count(docsExamined, "document")}</b> to return <b>${fmt(nReturned)}</b>. The rest of the collection was never touched.`;
  } else {
    headline = escape(stage);
    detail = `Read ${count(docsExamined, "document")} to return ${fmt(nReturned)}.`;
  }

  let efficiency = "";
  if (!isAggregate(plan) && docsExamined > 0) {
    const ratio = docsExamined / Math.max(nReturned, 1);
    efficiency =
      ratio <= 1.5
        ? `<p class="good">About one document read per result: as good as it gets.</p>`
        : `<p class="${ratio >= 10 ? "bad" : "warn"}">${times(ratio)} more documents read than returned. Every extra one is wasted work.</p>`;
  }
  return `
    <div class="verdict ${stageClass(stage)}">
      <p class="verdict-title">${headline}</p>
      <p>${detail}</p>
      ${efficiency}
    </div>`;
}

/** Examined vs returned on one linear scale: a scan of 100,000 for 1 result should look that lopsided. */
function bars(plan) {
  const rows = [
    ["Index keys read", plan.keysExamined],
    ["Documents read", plan.docsExamined],
    ["Returned", plan.nReturned],
  ];
  const max = Math.max(1, ...rows.map(([, n]) => n));
  return `
    <div class="bars">
      ${rows
        .map(
          ([label, n]) => `
        <span class="label">${label}</span>
        <span class="bar-track"><span class="bar" style="width:${n === 0 ? 0 : Math.max(0.5, (n / max) * 100)}%"></span></span>
        <span class="bar-value">${fmt(n)}</span>`
        )
        .join("")}
    </div>`;
}

/** Before → after against the last plan of this same request (the index demo in one glance). */
function comparison(before, after) {
  const changed =
    before.stage !== after.stage || before.docsExamined !== after.docsExamined || before.keysExamined !== after.keysExamined;
  if (!changed) return `<p class="note">Same plan as the last time you sent this request.</p>`;

  const docsChange = (a, b) => {
    if (a === b) return "no change";
    if (b === 0) return `${fmt(a)} fewer`;
    return a > b ? `${times(a / b)} fewer` : `${times(b / Math.max(a, 1))} more`;
  };
  return `
    <div class="compare">
      <h3>Compared with the last run of this request</h3>
      <table>
        <thead><tr><th></th><th>Before</th><th>Now</th><th>Change</th></tr></thead>
        <tbody>
          <tr><td>Stage</td><td class="${stageClass(before.stage)}">${escape(before.stage)}</td><td class="${stageClass(after.stage)}">${escape(after.stage)}</td><td></td></tr>
          <tr><td>Index</td><td>${escape(before.indexName ?? "none")}</td><td>${escape(after.indexName ?? "none")}</td><td></td></tr>
          <tr><td>Documents read</td><td>${fmt(before.docsExamined)}</td><td>${fmt(after.docsExamined)}</td><td>${docsChange(before.docsExamined, after.docsExamined)}</td></tr>
          <tr><td>MongoDB time</td><td>${fmt(before.ms)} ms</td><td>${fmt(after.ms)} ms</td><td></td></tr>
          <tr><td>Sort in memory</td><td>${before.hasSortStage ? "yes" : "no"}</td><td>${after.hasSortStage ? "yes" : "no"}</td><td></td></tr>
        </tbody>
      </table>
    </div>`;
}

/** The plan tree lists the last stage first; show it in the order MongoDB ran it. */
function pipeline(plan) {
  const steps = [...(plan.stages ?? [])].reverse();
  if (steps.length === 0) return "";
  return `
    <div class="pipeline">
      <h3>How MongoDB ran it (first step first)</h3>
      <ol>
        ${steps
          .map((name) => {
            const kind = name === "COLLSCAN" || name === "SORT" || name === "SKIP" ? "bad" : "";
            const help = STAGE_HELP[name] ?? "A step in the plan.";
            const index = name.includes("IXSCAN") && plan.indexName ? ` <code>${escape(plan.indexName)}</code>` : "";
            return `<li><span class="stage-chip ${kind}">${escape(name)}</span>${index}<span class="stage-help">${help}</span></li>`;
          })
          .join("")}
      </ol>
    </div>`;
}

/** What to try next, based on what the plan shows and what the request filtered on. */
function hints(plan, path) {
  const params = new URL(path, location.origin).searchParams;
  const tips = [];
  if (plan.stage === "COLLSCAN") {
    if (path.startsWith("/api/movies") && params.has("title")) {
      tips.push("Create the title index (<b>Movies: indexes → createIndex { title: 1 }</b>), then send this request again to compare.");
    } else if (path.startsWith("/api/rentals") && params.has("movie_title")) {
      tips.push("Rentals have no index on <code>movie.title</code> yet, so every rental is read. An index on that field would turn this into an IXSCAN.");
    } else {
      tips.push("No index fits this filter. An index on the field you filter by lets MongoDB jump straight to the matches.");
    }
  }
  if (plan.hasSortStage) {
    tips.push("The results were sorted in memory. An index in the same order as the sort returns them already sorted, and lets MongoDB stop at the limit.");
  }
  if ((plan.stages ?? []).includes("SKIP")) {
    tips.push("skip still reads every document it skips, so later pages get slower. Movies → find uses a cursor instead.");
  }
  if (plan.indexName && plan.docsExamined > 0 && plan.docsExamined <= Math.max(plan.nReturned, 1) * 1.5) {
    tips.push("This is what a good plan looks like: documents read ≈ documents returned.");
  }
  if (tips.length === 0) return "";
  return `<div class="hints"><h3>What to try next</h3><ul>${tips.map((t) => `<li>${t}</li>`).join("")}</ul></div>`;
}

export function escape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}
