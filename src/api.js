// Central API layer for the main app. These calls go to /api/*, which the
// Vite dev server proxies to the Spring backend on http://localhost:8080.
// AnalysisView uses /analysis-api/*, proxied by Vite to http://localhost:8082/api.

const BASE = '/api'
const ANALYSIS_BASE = '/analysis-api'

function normalizeAnalysisAgentId(agent) {
  // Agent keys are case-sensitive on the analysis backend: trials are stored under
  // the exact agentKey (e.g. "AP-OLLAMA") and profileForAgent/reliability match by
  // that exact string. Lowercasing here returns an all-null profile, so only trim.
  return String(agent || '').trim()
}

async function req(path, options = {}, base = BASE) {
  const res = await fetch(base + path, options)
  if (!res.ok) {
    let detail = ''
    try {
      detail = await res.text()
    } catch {
      /* ignore */
    }
    throw new Error(`${res.status} ${res.statusText}${detail ? ' — ' + detail : ''}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  const text = await res.text()
  return text || null
}

const json = (body) => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

export const api = {
  // Agents
  listAgents: () => req('/agents'),
  getAgent: (id) => req(`/agents/${id}`),
  getAgentBehaviouralProfile: (agent) => req(`/agents/${encodeURIComponent(agent)}/behavioural-profile`),
  createAgent: (body) => req('/agents', json(body)),
  seedAgents: () => req('/agents/seed', { method: 'POST' }),

  // Scenarios
  listScenarios: () => req('/scenarios'),
  getScenario: (id) => req(`/scenarios/${id}`),
  createScenario: (body) => req('/scenarios', json(body)),
  validateScenario: (id) => req(`/scenarios/${id}/validate`, { method: 'POST' }),

  // Simulations
  runTrial: (scenarioId, agentId, biasedVariant) =>
    req(
      `/simulations/trial?scenarioId=${encodeURIComponent(scenarioId)}` +
        `&agentId=${encodeURIComponent(agentId)}&biasedVariant=${biasedVariant}`,
      { method: 'POST' }
    ),
  // Batch run: every agent × every scenario × every seed (biased variant only, by
  // design). seeds is an array of strings; empty means one pass per agent's own seed.
  runBatch: (scenarioIds, agentProfileIds, seeds = []) =>
    req('/simulations/batch', json({ scenarioIds, agentProfileIds, seeds })),
  grouped: (scenarioId, latestOnly = false) =>
    req(
      `/simulations/scenarios/${encodeURIComponent(scenarioId)}/grouped?latestOnly=${latestOnly}`
    ),

  // Export is a file download — return the URL the browser can hit directly.
  exportUrl: () => BASE + '/simulations/export',
}

export const analysisApi = {
  listAgents: () => req('/agents', {}, ANALYSIS_BASE),
  getAgentBehaviouralProfile: (agent) =>
    req(
      `/agents/${encodeURIComponent(normalizeAnalysisAgentId(agent))}/behavioural-profile`,
      {},
      ANALYSIS_BASE
    ),
  // Every agent's profile at once: { "AP-OLLAMA": [MetricResult...], ... }
  getAllBehaviouralProfiles: () => req('/behavioural-profiles', {}, ANALYSIS_BASE),
}

export const fusionApi = {
  // FusionController lives on the analysis service (:8082), reached via /analysis-api.
  reliability: () => req('/fusion/reliability', {}, ANALYSIS_BASE),
  reliabilityForAgent: (agent) =>
    req(`/fusion/reliability/${encodeURIComponent(normalizeAnalysisAgentId(agent))}`, {}, ANALYSIS_BASE),
}

export const reasoningApi = {
  // ReasoningController lives on the analysis service (:8082) at /api/reasoning,
  // reached via /analysis-api (the Vite proxy rewrites /analysis-api/* -> :8082/api/*).
  // Judging (POST) costs LLM calls; reading (GET) is a cheap Mongo read — kept separate.
  listCases: () => req('/reasoning/cases', {}, ANALYSIS_BASE),
  readCase: (scenarioId) =>
    req(`/reasoning/case/${encodeURIComponent(scenarioId)}`, {}, ANALYSIS_BASE),
  judgeCase: (scenarioId, reJudge = false) =>
    req(
      `/reasoning/judge/${encodeURIComponent(scenarioId)}?reJudge=${reJudge}`,
      { method: 'POST' },
      ANALYSIS_BASE
    ),
  // Judge every scenario in one clinical case (e.g. CASE-10) in a single request.
  judgeWholeCase: (caseId, reJudge = false) =>
    req(
      `/reasoning/judge-case/${encodeURIComponent(caseId)}?reJudge=${reJudge}`,
      { method: 'POST' },
      ANALYSIS_BASE
    ),
}
