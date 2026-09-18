import { useEffect, useMemo, useState } from 'react'
import { fusionApi } from '../api'
import { Spinner, Notice } from './common'

// Reliability is 0..10. Colour-code by band so the ranking reads at a glance.
function scoreClass(score) {
  if (score == null || Number.isNaN(score)) return 'rel-na'
  if (score >= 6.5) return 'rel-high'
  if (score >= 5) return 'rel-mid'
  return 'rel-low'
}

// Stream agreement 0..1. Low agreement means the two streams disagree and the
// blended score should be treated with caution — surface that prominently.
function agreementLabel(a) {
  if (a == null || Number.isNaN(a)) return { text: 'single stream', cls: 'agree-na' }
  if (a >= 0.6) return { text: `agree ${a.toFixed(2)}`, cls: 'agree-ok' }
  return { text: `disagree ${a.toFixed(2)}`, cls: 'agree-warn' }
}

function ReliabilityBar({ score }) {
  if (score == null || Number.isNaN(score)) return <span className="conf-na">no score</span>
  const pct = Math.max(0, Math.min(100, (score / 10) * 100))
  return (
    <div className="conf">
      <div className="conf-track">
        <div className={`conf-fill ${scoreClass(score)}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="conf-num">{score.toFixed(1)}</span>
    </div>
  )
}

function PerBiasRow({ label, value }) {
  return (
    <div className="perbias-row">
      <span className="perbias-label">{label.replace(/_/g, ' ')}</span>
      <div className="perbias-bar-track">
        <div
          className={`perbias-bar-fill ${scoreClass(value)}`}
          style={{ width: `${Math.max(0, Math.min(100, (value / 10) * 100))}%` }}
        />
      </div>
      <span className="perbias-num mono">{value == null ? '—' : value.toFixed(1)}</span>
    </div>
  )
}

function AgentCard({ agent, rank }) {
  const [open, setOpen] = useState(false)
  const agree = agreementLabel(agent.streamAgreement)
  const perBias = agent.perBiasReliability || {}
  const biasKeys = Object.keys(perBias)

  return (
    <div className={`card fusion-card ${rank === 1 ? 'fusion-top' : ''}`}>
      <div className="fusion-card-head" onClick={() => setOpen((o) => !o)}>
        <div className="fusion-rank">#{rank}</div>
        <div className="fusion-name">
          <span className="mono">{agent.agentName}</span>
          {rank === 1 && <span className="badge badge-persona-neutral">most reliable</span>}
        </div>
        <div className="fusion-score-wrap">
          <ReliabilityBar score={agent.reliabilityScore} />
        </div>
        <span className={`badge ${agree.cls}`}>{agree.text}</span>
        <button className="link-btn" aria-label="toggle detail">{open ? '▾' : '▸'}</button>
      </div>

      {open && (
        <div className="fusion-card-body">
          <div className="fusion-streams">
            <div className="stream-stat">
              <span className="stream-label">behavioural bias</span>
              <span className="mono">{agent.behaviouralBias == null || Number.isNaN(agent.behaviouralBias) ? 'n/a' : agent.behaviouralBias.toFixed(2)}</span>
              <span className="muted small">n={agent.nBehavioural}</span>
            </div>
            <div className="stream-stat">
              <span className="stream-label">reasoning bias</span>
              <span className="mono">{agent.reasoningBias == null || Number.isNaN(agent.reasoningBias) ? 'n/a' : agent.reasoningBias.toFixed(2)}</span>
              <span className="muted small">n={agent.nReasoning}</span>
            </div>
          </div>

          {biasKeys.length > 0 && (
            <div className="perbias">
              <div className="perbias-title muted small">Per-bias reliability</div>
              {biasKeys.map((k) => (
                <PerBiasRow key={k} label={k} value={perBias[k]} />
              ))}
            </div>
          )}

          {agent.note && <p className="fusion-note muted small">{agent.note}</p>}
        </div>
      )}
    </div>
  )
}

export default function FusionView() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    fusionApi
      .reliability()
      .then((rows) => {
        // Backend returns most-reliable-first, but sort defensively.
        const sorted = [...(rows || [])].sort(
          (a, b) => (b.reliabilityScore ?? -1) - (a.reliabilityScore ?? -1)
        )
        setAgents(sorted)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Reliability</h2>
          <p className="sub">
            Per-agent reliability (0–10), fused from the behavioural and reasoning streams.
            Less bias means more reliable — the control persona should rank highest.
          </p>
        </div>
        <button className="btn" onClick={load}>Refresh</button>
      </header>

      {error && <Notice kind="error">{error}</Notice>}
      {loading && <Spinner label="Computing reliability" />}

      {!loading && !error && agents.length === 0 && (
        <Notice>No reliability data yet. Generate trials and run the judge, then refresh.</Notice>
      )}

      {!loading && agents.length > 0 && <ReliabilityChart agents={agents} />}

      {!loading && agents.length > 0 && (
        <div className="fusion-list">
          {agents.map((ag, i) => (
            <AgentCard key={ag.agentName} agent={ag} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  )
}

// Validated categorical palette (dataviz skill, light surface). Colour follows the
// agent identity (sorted by name), never the reliability rank.
const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4']

const fmtScore = (v) => (v == null || Number.isNaN(v) ? '—' : Number.isInteger(v) ? String(v) : v.toFixed(1))
const prettyBias = (s) =>
  String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase())

// Reliability bar chart: overall score, or per-bias reliability, both on a 0–10 scale.
function ReliabilityChart({ agents }) {
  const names = useMemo(() => [...agents].map((a) => a.agentName).sort(), [agents])
  const colorOf = (n) => SERIES[names.indexOf(n) % SERIES.length]

  const biasKeys = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const a of agents) {
      for (const k of Object.keys(a.perBiasReliability || {})) {
        if (!seen.has(k)) {
          seen.add(k)
          out.push(k)
        }
      }
    }
    return out
  }, [agents])

  const [view, setView] = useState('overall')

  const groups = useMemo(() => {
    if (view === 'overall') {
      const bars = [...agents]
        .map((a) => ({ name: a.agentName, value: a.reliabilityScore }))
        .sort((x, y) => (y.value ?? -1) - (x.value ?? -1))
      return [{ label: 'Overall', bars }]
    }
    return biasKeys.map((bk) => ({
      label: prettyBias(bk),
      bars: names.map((n) => {
        const a = agents.find((x) => x.agentName === n)
        const v = a && a.perBiasReliability ? a.perBiasReliability[bk] : null
        return { name: n, value: v == null ? null : v }
      }),
    }))
  }, [view, agents, biasKeys, names])

  // ---- geometry (fixed 0–10 reliability scale) ----
  const W = 760
  const H = 340
  const M = { l: 40, r: 16, t: 20, b: 46 }
  const plotW = W - M.l - M.r
  const plotH = H - M.t - M.b
  const yMin = 0
  const yMax = 10
  const yToPx = (v) => M.t + plotH * (1 - (v - yMin) / (yMax - yMin))

  const nG = Math.max(groups.length, 1)
  const groupW = plotW / nG
  const nBars = view === 'overall' ? agents.length : names.length
  const barGap = 3
  const barAreaW = groupW * 0.82
  const barW = Math.max(6, (barAreaW - barGap * (nBars - 1)) / nBars)
  const tickVals = [0, 2.5, 5, 7.5, 10]

  return (
    <div className="card analysis-block" style={{ marginBottom: 18 }}>
      <div className="analysis-block-head">
        <div>
          <h3>Reliability chart</h3>
          <p className="muted small">
            {view === 'overall'
              ? 'Blended reliability per agent (0–10, higher is better).'
              : 'Per-bias reliability per agent (0–10, higher is better).'}
          </p>
        </div>
        <div className="segmented" role="tablist">
          <button className={`seg-btn ${view === 'overall' ? 'active' : ''}`} onClick={() => setView('overall')}>
            Overall
          </button>
          <button className={`seg-btn ${view === 'perbias' ? 'active' : ''}`} onClick={() => setView('perbias')}>
            Per-bias
          </button>
        </div>
      </div>

      <div className="chart-legend">
        {names.map((n) => (
          <span key={n} className="chart-legend-item">
            <span className="chart-swatch" style={{ background: colorOf(n) }} />
            <span className="mono small">{n}</span>
          </span>
        ))}
      </div>

      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="agents-chart" role="img" aria-label="Reliability by agent">
          {tickVals.map((tv, i) => (
            <g key={i}>
              <line x1={M.l} x2={W - M.r} y1={yToPx(tv)} y2={yToPx(tv)}
                    className={tv === 0 ? 'chart-zero' : 'chart-grid'} />
              <text x={M.l - 8} y={yToPx(tv) + 3} className="chart-tick" textAnchor="end">{tv}</text>
            </g>
          ))}

          {groups.map((g, gi) => {
            const gx = M.l + gi * groupW
            const startX = gx + (groupW - barAreaW) / 2
            return (
              <g key={g.label}>
                {g.bars.map((b, bi) => {
                  const bx = startX + bi * (barW + barGap)
                  if (b.value == null) return null
                  const top = yToPx(b.value)
                  const h = Math.max(1, yToPx(0) - top)
                  const cx = bx + barW / 2
                  return (
                    <g key={b.name} className="chart-bar-g">
                      <rect x={bx} y={top} width={barW} height={h} rx={3} fill={colorOf(b.name)} className="chart-bar">
                        <title>{`${b.name} · ${g.label}\nreliability: ${fmtScore(b.value)} / 10`}</title>
                      </rect>
                      <text x={cx} y={top - 4} className="chart-val" textAnchor="middle">{fmtScore(b.value)}</text>
                    </g>
                  )
                })}
                <text x={gx + groupW / 2} y={H - M.b + 20} className="chart-xlabel" textAnchor="middle">{g.label}</text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
