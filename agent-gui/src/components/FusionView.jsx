import { useEffect, useState } from 'react'
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
