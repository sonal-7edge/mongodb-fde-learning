import { callApi, tokenExpiry } from "./api.js";
import { endpoints } from "./endpoints.js";

const TOKEN_KEY = "movie-store-token";
const HISTORY_LIMIT = 20;

const $ = (id) => document.getElementById(id);
const form = {
  method: $("method"),
  path: $("path"),
  body: $("body"),
  explain: $("explain"),
  repeat: $("repeat"),
  note: $("endpoint-note"),
  send: $("send"),
};

/** @type {string|null} */
let token = readStoredToken();
/** @type {object[]} */
const history = [];

// ---------- token ----------

function readStoredToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(value) {
  token = value;
  try {
    if (value) sessionStorage.setItem(TOKEN_KEY, value);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage blocked: the token still works for this page
  }
  renderTokenStatus();
}

function renderTokenStatus() {
  const status = $("token-status");
  const expiry = token ? tokenExpiry(token) : null;
  if (!token) {
    status.textContent = "No token";
    status.className = "pill warn";
  } else if (expiry && expiry < new Date()) {
    status.textContent = "Token expired";
    status.className = "pill bad";
  } else {
    status.textContent = expiry ? `Token valid until ${expiry.toLocaleTimeString()}` : "Token set";
    status.className = "pill good";
  }
}

async function generateToken() {
  const result = await callApi({ method: "POST", path: "/auth/token", body: JSON.stringify({ label: "ui" }) });
  if (result.status === 201) {
    storeToken(result.body.access_token);
  } else {
    showResponse(result);
    alert(`Could not generate a token (HTTP ${result.status}). Is DEV_TOKEN_ENDPOINT=true in .env?`);
  }
}

// ---------- endpoint list ----------

function renderEndpointList() {
  const list = $("endpoint-list");
  const groups = Map.groupBy(endpoints, (endpoint) => endpoint.group);
  list.replaceChildren(
    ...[...groups].map(([group, items]) => {
      const section = document.createElement("div");
      const heading = document.createElement("h2");
      heading.textContent = group;
      section.append(heading);
      for (const endpoint of items) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "endpoint";
        button.innerHTML = `<span class="verb verb-${endpoint.method.toLowerCase()}">${endpoint.method}</span>`;
        button.append(document.createTextNode(endpoint.name));
        button.addEventListener("click", () => selectEndpoint(endpoint, button));
        section.append(button);
      }
      return section;
    })
  );
  list.querySelector("button.endpoint")?.click();
}

function selectEndpoint(endpoint, button) {
  document.querySelectorAll("button.endpoint").forEach((b) => b.classList.toggle("active", b === button));
  form.method.value = endpoint.method;
  form.path.value = endpoint.path;
  form.body.value = endpoint.body ? JSON.stringify(endpoint.body, null, 2) : "";
  form.explain.checked = false;
  form.explain.disabled = !endpoint.explain;
  form.note.textContent = endpoint.note ?? "";
}

// ---------- sending ----------

/** Add or remove explain=true in the path's query string. */
function withExplain(path, explain) {
  const url = new URL(path, location.origin);
  if (explain) url.searchParams.set("explain", "true");
  else url.searchParams.delete("explain");
  return url.pathname + url.search;
}

async function send(event) {
  event.preventDefault();
  const method = form.method.value;
  const path = withExplain(form.path.value.trim(), form.explain.checked && !form.explain.disabled);
  const body = form.body.value.trim() || undefined;
  const repeat = Math.min(Math.max(1, Number(form.repeat.value) || 1), 20);

  if (body) {
    try {
      JSON.parse(body);
    } catch {
      alert("The JSON body is not valid JSON.");
      return;
    }
  }

  form.send.disabled = true;
  try {
    const results = [];
    // Sequential on purpose: parallel calls would measure contention, not latency.
    for (let i = 0; i < repeat; i++) {
      const result = await callApi({ method, path, body, token });
      results.push(result);
      addHistory(method, path, result);
    }
    const last = results[results.length - 1];
    showMetrics(results);
    showPlan(last.body?.plan);
    showResponse(last);
  } catch (error) {
    $("response").textContent = `Network error: ${error.message}\nIs the backend running on the port Vite forwards to?`;
  } finally {
    form.send.disabled = false;
  }
}

// ---------- rendering results ----------

const fmtMs = (ms) => (ms == null ? "–" : `${ms < 10 ? ms.toFixed(1) : Math.round(ms)} ms`);

function showMetrics(results) {
  const last = results[results.length - 1];
  const status = $("m-status");
  status.textContent = String(last.status);
  status.className = `value ${last.status < 300 ? "good" : last.status < 500 ? "warn" : "bad"}`;

  if (results.length === 1) {
    $("m-roundtrip").textContent = fmtMs(last.roundTripMs);
    $("m-server").textContent = fmtMs(last.serverMs);
  } else {
    $("m-roundtrip").textContent = summarize(results.map((r) => r.roundTripMs));
    $("m-server").textContent = summarize(results.map((r) => r.serverMs).filter((v) => v != null));
  }
  const plan = last.body?.plan;
  $("m-db").textContent = plan ? fmtMs(plan.ms) : "–";
}

/** "avg 12 ms (min 9, max 20)" */
function summarize(values) {
  if (values.length === 0) return "–";
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return `avg ${fmtMs(avg)} (min ${Math.round(Math.min(...values))}, max ${Math.round(Math.max(...values))})`;
}

function showPlan(plan) {
  const box = $("plan");
  if (!plan) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const stageClass = plan.stage === "COLLSCAN" ? "bad" : "good";
  box.innerHTML = `
    <h2>Query plan</h2>
    <div class="plan-grid">
      <div><span class="label">Stage</span><span class="value ${stageClass}">${escape(plan.stage)}</span></div>
      <div><span class="label">Index</span><span class="value">${escape(plan.indexName ?? "none")}</span></div>
      <div><span class="label">Docs examined</span><span class="value">${plan.docsExamined}</span></div>
      <div><span class="label">Keys examined</span><span class="value">${plan.keysExamined}</span></div>
      <div><span class="label">Returned</span><span class="value">${plan.nReturned}</span></div>
      <div><span class="label">Sort in memory</span><span class="value ${plan.hasSortStage ? "warn" : "good"}">${plan.hasSortStage ? "yes" : "no"}</span></div>
    </div>
    <p class="note">Stages: ${escape((plan.stages ?? []).join(" → "))}</p>`;
}

function showResponse(result) {
  const text = typeof result.body === "string" ? result.body : JSON.stringify(result.body, null, 2);
  $("response").textContent = text;
}

function addHistory(method, path, result) {
  const plan = result.body?.plan;
  history.unshift({ at: new Date(), method, path, ...result, plan });
  history.length = Math.min(history.length, HISTORY_LIMIT);
  renderHistory();
}

function renderHistory() {
  $("history").innerHTML = history
    .map((row) => {
      const p = row.plan;
      const cells = [
        row.at.toLocaleTimeString(),
        `<code>${escape(row.method)} ${escape(row.path)}</code>`,
        row.status,
        fmtMs(row.roundTripMs),
        fmtMs(row.serverMs),
        p ? `<span class="${p.stage === "COLLSCAN" ? "bad" : "good"}">${escape(p.stage)}</span>` : "",
        p ? escape(p.indexName ?? "none") : "",
        p?.docsExamined ?? "",
        p?.keysExamined ?? "",
        p?.nReturned ?? "",
        p ? (p.hasSortStage ? "yes" : "no") : "",
      ];
      return `<tr>${cells.map((c) => `<td>${c}</td>`).join("")}</tr>`;
    })
    .join("");
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
}

// ---------- wire up ----------

$("generate-token").addEventListener("click", generateToken);
$("clear-token").addEventListener("click", () => storeToken(null));
$("clear-history").addEventListener("click", () => {
  history.length = 0;
  renderHistory();
});
$("request-form").addEventListener("submit", send);
setInterval(renderTokenStatus, 30_000);

renderTokenStatus();
renderEndpointList();
