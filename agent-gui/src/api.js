// Central API layer for the main app. These calls go to /api/*, which the
// Vite dev server proxies to the Spring backend on http://localhost:8080.
// AnalysisView uses /analysis-api/*, proxied by Vite to http://localhost:8082/api.

const BASE = '/api'
const ANALYSIS_BASE = '/analysis-api'

function normalizeAnalysisAgentId(agent) {
  return String(agent || '')
    .trim()
    .toLowerCase()
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
}

export const fusionApi = {
  // FusionController lives on the analysis service (:8082), reached via /analysis-api.
  reliability: () => req('/fusion/reliability', {}, ANALYSIS_BASE),
  reliabilityForAgent: (agent) =>
    req(`/fusion/reliability/${encodeURIComponent(normalizeAnalysisAgentId(agent))}`, {}, ANALYSIS_BASE),
}

export const judgeApi = {
  // ReasoningController is on the analysis service (:8082), reached via /analysis-api.
  // POST judges the whole case and returns the per-scenario results in one payload.
  judgeCase: (caseId, reJudge = false) =>
    req(`/reasoning/judge-case/${encodeURIComponent(caseId)}?reJudge=${reJudge}`, { method: 'POST' }, ANALYSIS_BASE),
  // CHEAP: re-read one scenario's stored verdicts (list of JudgeAnalysis). No LLM calls.
  readScenario: (scenarioId) =>
    req(`/reasoning/case/${encodeURIComponent(scenarioId)}`, {}, ANALYSIS_BASE),
}
