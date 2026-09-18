import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner, Notice, ConfidenceBar, MonoId } from './common'

export default function ResultsView() {
  const [scenarios, setScenarios] = useState([])
  const [scenarioId, setScenarioId] = useState('')
  const [latestOnly, setLatestOnly] = useState(true)
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.listScenarios().then(setScenarios).catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!scenarioId) {
      setGroup(null)
      return
    }
    setLoading(true)
    setError(null)
    api
      .grouped(scenarioId, latestOnly)
      .then(setGroup)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [scenarioId, latestOnly])

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Results</h2>
          <p className="sub">For one scenario, review the latest result from each agent.</p>
        </div>
        <a className="btn" href={api.exportUrl()} target="_blank" rel="noreferrer">
          Export JSON
        </a>
      </header>

      <div className="card results-controls">
        <label className="grow">
          Scenario
          <select value={scenarioId} onChange={(e) => setScenarioId(e.target.value)}>
            <option value="">Select a scenario…</option>
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.scenarioKey}
              </option>
            ))}
          </select>
        </label>
        <label className="check inline">
          <input type="checkbox" checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)} />
          Latest run per agent
        </label>
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {loading && <Spinner label="Loading results" />}

      {!loading && scenarioId && group && (group.agents?.length ?? 0) === 0 && (
        <Notice>No trials recorded for this scenario yet. Run one from the Run tab.</Notice>
      )}

      {!loading && group && group.agents?.length > 0 && (
        <div className="results">
          <p className="results-key mono muted">
            {group.scenarioKey} · {group.agents.length} agent{group.agents.length === 1 ? '' : 's'}
          </p>
          {group.agents.map((ag) => (
            <AgentResult key={ag.agentProfileId} agent={ag} />
          ))}
        </div>
      )}
    </section>
  )
}

function AgentResult({ agent }) {
  const trial = agent.trials[0]

  return (
    <article className="card agent-result">
      <div className="agent-result-head">
        <span className="name">{agent.agentName}</span>
        <MonoId id={agent.agentProfileId} />
      </div>

      <VariantColumn label="Latest result" trial={trial} />
    </article>
  )
}

function VariantColumn({ label, trial }) {
  if (!trial) {
    return (
      <div className="variant-col">
        <span className="variant-col-label">{label}</span>
        <p className="muted small">Not run.</p>
      </div>
    )
  }
  return (
    <div className="variant-col">
      <span className="variant-col-label">{label}</span>
      {trial.parseError ? (
        <p className="muted small">Parse failed — no decision.</p>
      ) : (
        <>
          <p className="decision sm">{trial.decision || '—'}</p>
          <ConfidenceBar value={trial.confidence} biased={trial.biasedVariant} />
          {trial.explanation && <p className="explanation sm">{trial.explanation}</p>}
        </>
      )}
    </div>
  )
}
