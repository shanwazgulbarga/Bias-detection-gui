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
  const [mode, setMode] = useState('single') // 'single' | 'all'
  const [agents, setAgents] = useState([])
  const [agentKey, setAgentKey] = useState('')
  const [profile, setProfile] = useState([])
  const [loadingAgents, setLoadingAgents] = useState(true)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [error, setError] = useState(null)

  // All-agents comparison matrix ('all' mode).
  const [allProfiles, setAllProfiles] = useState(null)
  const [loadingAll, setLoadingAll] = useState(false)

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

  // Fetch every agent's profile once when the user switches to the comparison table.
  useEffect(() => {
    if (mode !== 'all' || allProfiles) return
    let alive = true
    setLoadingAll(true)
    setError(null)
    analysisApi
      .getAllBehaviouralProfiles()
      .then((data) => {
        if (alive) setAllProfiles(data && typeof data === 'object' ? data : {})
      })
      .catch((e) => {
        if (alive) setError(e.message)
      })
      .finally(() => {
        if (alive) setLoadingAll(false)
      })
    return () => {
      alive = false
    }
  }, [mode, allProfiles])

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
          <p className="sub">
            {mode === 'single'
              ? 'Inspect one agent’s behavioural profile, grouped by bias type and metric.'
              : 'Compare every agent side by side — one row per metric, one column per agent.'}
          </p>
        </div>
        <div className="head-actions">
          <div className="segmented" role="tablist">
            <button
              className={`seg-btn ${mode === 'single' ? 'active' : ''}`}
              onClick={() => setMode('single')}
            >
              One agent
            </button>
            <button
              className={`seg-btn ${mode === 'all' ? 'active' : ''}`}
              onClick={() => setMode('all')}
            >
              All agents
            </button>
          </div>
          {onBack && (
            <button className="btn" onClick={onBack}>
              Back to app
            </button>
          )}
        </div>
      </header>

      {error && <Notice kind="error">{error}</Notice>}

      {mode === 'all' ? (
        loadingAll || !allProfiles ? (
          <Spinner label="Loading all profiles" />
        ) : (
          <>
            <AgentsChart data={allProfiles} />
            <AllAgentsMatrix data={allProfiles} />
          </>
        )
      ) : (
      <>
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
            <span className="analysis-agent-name">
              {typeof selectedAgent === 'string'
                ? selectedAgent
                : selectedAgent.name || selectedAgent.agentName || 'Agent'}
            </span>
            {typeof selectedAgent !== 'string' && <MonoId id={selectedAgent.id} />}
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
                            <td className={isSignificant(row) ? 'sig-val' : ''}>{formatNumber(row.value)}</td>
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
      </>
      )}
    </section>
  )
}

// Validated categorical palette (dataviz skill, light surface #fffaf4).
// Fixed order — assigned to agents by index, never cycled.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']

const METRIC_LABELS = {
  bias_divergence: 'Bias divergence (agent − control)',
  bias_pull_rate_agent: 'Bias pull rate (agent)',
  bias_pull_rate_control: 'Bias pull rate (control)',
  expected_calibration_error: 'Expected calibration error',
  overconfidence_divergence: 'Overconfidence divergence',
  overall_calibration_error: 'Overall calibration error',
}

// Grouped bar chart: for one metric, a bar per agent within each bias-type group.
function AgentsChart({ data }) {
  const agents = useMemo(() => Object.keys(data || {}).sort(), [data])

  const metrics = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const ag of agents) {
      for (const r of data[ag] || []) {
        if (!seen.has(r.metricName)) {
          seen.add(r.metricName)
          out.push(r.metricName)
        }
      }
    }
    return out
  }, [data, agents])

  const [metric, setMetric] = useState('bias_divergence')
  const activeMetric = metrics.includes(metric) ? metric : metrics[0] || ''

  // Groups = bias types that carry this metric; each holds agent -> row.
  const groups = useMemo(() => {
    const order = []
    const byBias = new Map()
    for (const ag of agents) {
      for (const r of data[ag] || []) {
        if (r.metricName !== activeMetric) continue
        if (!byBias.has(r.biasType)) {
          byBias.set(r.biasType, new Map())
          order.push(r.biasType)
        }
        byBias.get(r.biasType).set(ag, r)
      }
    }
    return order.map((bt) => ({ biasType: bt, rows: byBias.get(bt) }))
  }, [data, agents, activeMetric])

  const colorOf = (ag) => SERIES[agents.indexOf(ag) % SERIES.length]

  // ---- geometry ----
  const W = 760
  const H = 360
  const M = { l: 46, r: 16, t: 20, b: 46 }
  const plotW = W - M.l - M.r
  const plotH = H - M.t - M.b

  const vals = []
  for (const g of groups) {
    for (const ag of agents) {
      const c = g.rows.get(ag)
      if (c && c.value != null) {
        vals.push(c.value)
        if (c.ciLow != null) vals.push(c.ciLow)
        if (c.ciHigh != null) vals.push(c.ciHigh)
      }
    }
  }
  const rawMax = vals.length ? Math.max(...vals, 0) : 1
  const rawMin = vals.length ? Math.min(...vals, 0) : 0
  const span = rawMax - rawMin || 1
  const yMax = rawMax + span * 0.15
  const yMin = rawMin < 0 ? rawMin - span * 0.05 : 0
  const yToPx = (v) => M.t + plotH * (1 - (v - yMin) / (yMax - yMin))
  const zeroY = yToPx(0)

  const nG = Math.max(groups.length, 1)
  const groupW = plotW / nG
  const barGap = 3
  const barAreaW = groupW * 0.82
  const barW = Math.max(6, (barAreaW - barGap * (agents.length - 1)) / agents.length)

  const ticks = 4
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / ticks)

  const hasData = vals.length > 0

  return (
    <div className="card analysis-block">
      <div className="analysis-block-head">
        <div>
          <h3>Comparison chart</h3>
          <p className="muted small">{METRIC_LABELS[activeMetric] || formatMetricName(activeMetric)} by agent, grouped by bias type.</p>
        </div>
        <label className="chart-metric-select">
          Metric
          <select value={activeMetric} onChange={(e) => setMetric(e.target.value)}>
            {metrics.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m] || formatMetricName(m)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Legend — always present for multiple series; identity never color-alone. */}
      <div className="chart-legend">
        {agents.map((ag) => (
          <span key={ag} className="chart-legend-item">
            <span className="chart-swatch" style={{ background: colorOf(ag) }} />
            <span className="mono small">{ag}</span>
          </span>
        ))}
      </div>

      {!hasData ? (
        <Notice kind="warn">No values for this metric yet.</Notice>
      ) : (
        <div className="chart-wrap">
          <svg viewBox={`0 0 ${W} ${H}`} className="agents-chart" role="img"
               aria-label={`${METRIC_LABELS[activeMetric] || activeMetric} by agent`}>
            {/* gridlines + y ticks */}
            {tickVals.map((tv, i) => (
              <g key={i}>
                <line x1={M.l} x2={W - M.r} y1={yToPx(tv)} y2={yToPx(tv)}
                      className={Math.abs(tv) < 1e-9 ? 'chart-zero' : 'chart-grid'} />
                <text x={M.l - 8} y={yToPx(tv) + 3} className="chart-tick" textAnchor="end">
                  {formatNumber(tv)}
                </text>
              </g>
            ))}

            {groups.map((g, gi) => {
              const gx = M.l + gi * groupW
              const startX = gx + (groupW - barAreaW) / 2
              return (
                <g key={g.biasType}>
                  {agents.map((ag, ai) => {
                    const c = g.rows.get(ag)
                    const bx = startX + ai * (barW + barGap)
                    if (!c || c.value == null) return null
                    const top = yToPx(Math.max(c.value, 0))
                    const bottom = yToPx(Math.min(c.value, 0))
                    const h = Math.max(1, bottom - top)
                    const hasCi = c.ciLow != null && c.ciHigh != null
                    const cx = bx + barW / 2
                    const tip = `${ag} · ${formatBiasType(g.biasType)}\n${METRIC_LABELS[activeMetric] || activeMetric}: ${formatNumber(c.value)}` +
                      (hasCi ? `\n95% CI [${formatNumber(c.ciLow)}, ${formatNumber(c.ciHigh)}]` : '') +
                      `\nn=${c.ntrials ?? 0}`
                    return (
                      <g key={ag} className="chart-bar-g">
                        <rect x={bx} y={top} width={barW} height={h} rx={3}
                              fill={colorOf(ag)} className="chart-bar">
                          <title>{tip}</title>
                        </rect>
                        {hasCi && c.ciHigh - c.ciLow > 1e-9 && (
                          <g className="chart-ci">
                            <line x1={cx} x2={cx} y1={yToPx(c.ciLow)} y2={yToPx(c.ciHigh)} />
                            <line x1={cx - 3} x2={cx + 3} y1={yToPx(c.ciHigh)} y2={yToPx(c.ciHigh)} />
                            <line x1={cx - 3} x2={cx + 3} y1={yToPx(c.ciLow)} y2={yToPx(c.ciLow)} />
                          </g>
                        )}
                        {/* direct label (relief for sub-3:1 hues) */}
                        <text x={cx} y={(c.value >= 0 ? top : bottom + 12) - 4}
                              className="chart-val" textAnchor="middle">
                          {formatNumber(c.value)}
                        </text>
                      </g>
                    )
                  })}
                  <text x={gx + groupW / 2} y={H - M.b + 20} className="chart-xlabel" textAnchor="middle">
                    {formatBiasType(g.biasType)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
      )}
    </div>
  )
}

// Comparison matrix: rows are (bias type × metric), columns are agents.
function AllAgentsMatrix({ data }) {
  const agents = useMemo(() => Object.keys(data || {}).sort(), [data])

  // Canonical metric rows: union across agents, preserving first-seen order.
  const rows = useMemo(() => {
    const out = []
    const seen = new Set()
    for (const ag of agents) {
      for (const r of data[ag] || []) {
        const key = `${r.biasType}||${r.metricName}`
        if (!seen.has(key)) {
          seen.add(key)
          out.push({ biasType: r.biasType, metricName: r.metricName, key })
        }
      }
    }
    return out
  }, [data, agents])

  // Fast lookup of a cell: lookup[agent].get("biasType||metricName")
  const lookup = useMemo(() => {
    const map = {}
    for (const ag of agents) {
      map[ag] = new Map((data[ag] || []).map((r) => [`${r.biasType}||${r.metricName}`, r]))
    }
    return map
  }, [data, agents])

  if (agents.length === 0) {
    return <Notice kind="warn">No profiles were returned.</Notice>
  }

  // rowSpan sizing so each bias type labels its group once.
  const groupSize = new Map()
  for (const r of rows) groupSize.set(r.biasType, (groupSize.get(r.biasType) || 0) + 1)
  const groupSeen = new Set()

  return (
    <div className="card analysis-block">
      <div className="analysis-block-head">
        <div>
          <h3>All agents</h3>
          <p className="muted small">
            {agents.length} agent{agents.length === 1 ? '' : 's'} · {rows.length} metric
            {rows.length === 1 ? '' : 's'}
          </p>
        </div>
        <div className="head-actions">
          <button className="btn btn-sm" onClick={() => exportMatrixCsv(agents, rows, lookup)}>
            Export CSV
          </button>
          <button className="btn btn-sm" onClick={() => exportProfilesJson(data)}>
            Export JSON
          </button>
        </div>
      </div>
      <div className="analysis-table-wrap">
        <table className="analysis-table matrix-table">
          <thead>
            <tr>
              <th>Bias type</th>
              <th>Metric</th>
              {agents.map((ag) => (
                <th key={ag} className="mono matrix-agent-col">{ag}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const firstOfGroup = !groupSeen.has(row.biasType)
              if (firstOfGroup) groupSeen.add(row.biasType)
              return (
                <tr key={row.key} className={firstOfGroup ? 'matrix-group-start' : ''}>
                  {firstOfGroup && (
                    <td rowSpan={groupSize.get(row.biasType)} className="matrix-bias">
                      {formatBiasType(row.biasType)}
                    </td>
                  )}
                  <td>
                    <div className="metric-name">{formatMetricName(row.metricName)}</div>
                    <div className="muted small mono">{row.metricName}</div>
                  </td>
                  {agents.map((ag) => {
                    const cell = lookup[ag].get(row.key)
                    return <MatrixCell key={ag} cell={cell} />
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small" style={{ marginTop: 10 }}>
        Each cell shows the value with its 95% CI and trial count. Hover a value for the full note.
        A CI that excludes 0 is highlighted.
      </p>
    </div>
  )
}

function MatrixCell({ cell }) {
  if (!cell || cell.value == null) {
    return <td className="matrix-cell matrix-na" title={cell?.note || 'no value'}>—</td>
  }
  const hasCi = cell.ciLow != null && cell.ciHigh != null
  return (
    <td className={`matrix-cell ${isSignificant(cell) ? 'matrix-sig' : ''}`} title={cell.note || ''}>
      <span className="matrix-val">{formatNumber(cell.value)}</span>
      {hasCi && (
        <span className="matrix-ci muted">
          [{formatNumber(cell.ciLow)}, {formatNumber(cell.ciHigh)}]
        </span>
      )}
      <span className="matrix-n muted mono">n={cell.ntrials ?? 0}</span>
    </td>
  )
}

// A CI strictly above or below 0 signals a detectable effect at this sample size.
function isSignificant(r) {
  return (
    r &&
    r.value != null &&
    r.ciLow != null &&
    r.ciHigh != null &&
    (r.ciLow > 0 || r.ciHigh < 0)
  )
}

// ---- Exports ---------------------------------------------------------------

function download(filename, text, type) {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function csvCell(v) {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

// Wide CSV: one row per metric, four columns per agent (value, ci_low, ci_high, n).
function exportMatrixCsv(agents, rows, lookup) {
  const header = ['bias_type', 'metric']
  for (const ag of agents) header.push(`${ag}_value`, `${ag}_ci_low`, `${ag}_ci_high`, `${ag}_n`)
  const lines = [header.map(csvCell).join(',')]
  for (const row of rows) {
    const cells = [csvCell(row.biasType), csvCell(row.metricName)]
    for (const ag of agents) {
      const c = lookup[ag].get(row.key)
      cells.push(csvCell(c?.value), csvCell(c?.ciLow), csvCell(c?.ciHigh), csvCell(c?.ntrials))
    }
    lines.push(cells.join(','))
  }
  download('behavioural-profiles.csv', lines.join('\n'), 'text/csv;charset=utf-8')
}

function exportProfilesJson(data) {
  download('behavioural-profiles.json', JSON.stringify(data, null, 2), 'application/json')
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
  // The analysis backend's /api/agents returns plain strings (e.g. "AP-OLLAMA");
  // the FALLBACK list uses objects. Handle both.
  if (typeof agent === 'string') return agent
  return String(agent.agentKey ?? agent.key ?? agent.name ?? agent.id ?? '')
}

function getAgentLabel(agent) {
  if (typeof agent === 'string') return agent
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
