import { useEffect, useMemo, useState } from 'react'
import { analysisApi } from '../api'
import { Spinner, Notice, MonoId } from './common'

const FALLBACK_ANALYSIS_AGENTS = [
  'AP-OLLAMA',
  'CB-OLLAMA',
  'CF-OLLAMA',
  'CR-OLLAMA',
  'OC-OLLAMA',
  'RA-OLLAMA',
].map((agentKey) => ({
  agentKey,
  name: agentKey,
  id: agentKey,
}))

export default function AnalysisView({ onBack }) {
  const [agents, setAgents] = useState([])
  const [agentKey, setAgentKey] = useState('')
  const [profile, setProfile] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setLoadingAgents(true)
    setError(null)
    analysisApi
      .listAgents()
      .then((items) => {
        if (!alive) return
        const resolved = Array.isArray(items) && items.length > 0 ? items : FALLBACK_ANALYSIS_AGENTS
        setAgents(resolved)
        const firstKey = getAgentKey(resolved[0])
        setAgentKey((current) => current || firstKey || '')
      })
      .catch((e) => {
        if (!alive) return
        setAgents(FALLBACK_ANALYSIS_AGENTS)
        const firstKey = getAgentKey(FALLBACK_ANALYSIS_AGENTS[0])
        setAgentKey((current) => current || firstKey || '')
        setError(e.message)
      })
      .finally(() => {
        if (alive) setLoadingAgents(false)
      })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (!agentKey) {
      setProfile([])
      return
    }

    let alive = true
    setLoadingProfile(true)
    setError(null)
    analysisApi
      .getAgentBehaviouralProfile(agentKey)
      .then((rows) => {
        if (alive) setProfile(Array.isArray(rows) ? rows : [])
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoadingProfile(false)
      })

    return () => {
      alive = false
    }
  }, [agentKey])

  const selectedAgent = useMemo(
    () => agents.find((agent) => getAgentKey(agent) === agentKey),
    [agents, agentKey]
  )

  const grouped = useMemo(() => groupMetrics(profile), [profile])
  const summary = useMemo(() => buildSummary(profile), [profile])

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Analysis</h2>
          <p className="sub">Inspect one agent’s behavioural profile, grouped by bias type and metric.</p>
        </div>
        {onBack && (
          <div className="head-actions">
            <button className="btn" onClick={onBack}>
              Back to app
            </button>
          </div>
        )}
      </header>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="card analysis-controls">
        <label className="grow">
          Agent
          <select value={agentKey} onChange={(e) => setAgentKey(e.target.value)} disabled={loadingAgents}>
            <option value="">Select an agent…</option>
            {agents.map((agent) => {
              const key = getAgentKey(agent)
              return (
                <option key={key || agent.id} value={key}>
                  {getAgentLabel(agent)}
                </option>
              )
            })}
          </select>
        </label>
        {selectedAgent && (
          <div className="analysis-agent-meta">
            <span className="analysis-agent-name">{selectedAgent.name || selectedAgent.agentName || 'Agent'}</span>
            <MonoId id={selectedAgent.id} />
          </div>
        )}
      </div>

      {loadingAgents && <Spinner label="Loading agents" />}

      {!loadingAgents && !agentKey && <Notice>No agents found. Seed the defaults or create an agent first.</Notice>}

      {agentKey && (
        <div className="analysis-content">
          <div className="analysis-summary-grid">
            <StatCard label="Metrics" value={summary.total} />
            <StatCard label="With values" value={summary.withValues} />
            <StatCard label="With notes" value={summary.withNotes} />
            <StatCard label="Bias types" value={summary.biasTypes} />
          </div>

          {loadingProfile ? (
            <Spinner label="Loading behavioural profile" />
          ) : profile.length === 0 ? (
            <Notice kind="warn">No behavioural profile rows were returned for this agent.</Notice>
          ) : (
            <div className="analysis-grid">
              {grouped.map((block) => (
                <article key={block.biasType} className="card analysis-block">
                  <div className="analysis-block-head">
                    <div>
                      <h3>{formatBiasType(block.biasType)}</h3>
                      <p className="muted small">{block.rows.length} metric{block.rows.length === 1 ? '' : 's'}</p>
                    </div>
                    <span className="badge badge-pending mono">{block.biasType}</span>
                  </div>

                  <div className="analysis-table-wrap">
                    <table className="analysis-table">
                      <thead>
                        <tr>
                          <th>Metric</th>
                          <th>Value</th>
                          <th>CI low</th>
                          <th>CI high</th>
                          <th>Trials</th>
                          <th>Note</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.rows.map((row) => (
                          <tr key={`${row.biasType}-${row.metricName}`}>
                            <td>
                              <div className="metric-name">{formatMetricName(row.metricName)}</div>
                              <div className="muted small mono">{row.metricName}</div>
                            </td>
                            <td>{formatNumber(row.value)}</td>
                            <td>{formatNumber(row.ciLow)}</td>
                            <td>{formatNumber(row.ciHigh)}</td>
                            <td className="mono">{row.ntrials ?? '—'}</td>
                            <td className="analysis-note">{row.note || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function StatCard({ label, value }) {
  return (
    <article className="card analysis-stat">
      <span className="analysis-stat-label">{label}</span>
      <span className="analysis-stat-value">{value}</span>
    </article>
  )
}

function getAgentKey(agent) {
  if (!agent) return ''
  return String(agent.agentKey ?? agent.key ?? agent.name ?? agent.id ?? '')
}

function getAgentLabel(agent) {
  const key = getAgentKey(agent)
  const name = agent?.name || agent?.agentName || key
  return key && name !== key ? `${name} · ${key}` : name
}

function groupMetrics(rows) {
  const groups = new Map()
  for (const row of rows) {
    const bucket = groups.get(row.biasType) || []
    bucket.push(row)
    groups.set(row.biasType, bucket)
  }
  return [...groups.entries()].map(([biasType, blockRows]) => ({
    biasType,
    rows: blockRows,
  }))
}

function buildSummary(rows) {
  const total = rows.length
  const withValues = rows.filter((row) => row.value != null).length
  const withNotes = rows.filter((row) => row.note).length
  const biasTypes = new Set(rows.map((row) => row.biasType)).size
  return { total, withValues, withNotes, biasTypes }
}

function formatBiasType(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatMetricName(value) {
  return String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function formatNumber(value) {
  if (value == null || Number.isNaN(value)) return '—'
  if (typeof value === 'number') {
    return Number.isInteger(value) ? String(value) : value.toFixed(3)
  }
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return String(value)
  return Number.isInteger(parsed) ? String(parsed) : parsed.toFixed(3)
}
