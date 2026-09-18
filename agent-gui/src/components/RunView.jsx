import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner, Notice, VariantBadge, ConfidenceBar } from './common'

export default function RunView() {
  const [scenarios, setScenarios] = useState([])
  const [agents, setAgents] = useState([])
  const [loadErr, setLoadErr] = useState(null)

  const [scenarioId, setScenarioId] = useState('')
  const [agentId, setAgentId] = useState('')

  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [results, setResults] = useState([]) // most recent first

  useEffect(() => {
    Promise.all([api.listScenarios(), api.listAgents()])
      .then(([s, a]) => {
        setScenarios(s)
        setAgents(a)
      })
      .catch((e) => setLoadErr(e.message))
  }, [])

  async function run() {
    if (!scenarioId || !agentId) return
    setRunning(true)
    setError(null)
    try {
      const trial = await api.runTrial(scenarioId, agentId, false)
      setResults((r) => [trial, ...r]) // show the result as it lands
    } catch (e) {
      setError(e.message)
    } finally {
      setRunning(false)
    }
  }

  const canRun = scenarioId && agentId && !running
  const ready = scenarios.length > 0 && agents.length > 0

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Run a trial</h2>
          <p className="sub">Pick a scenario and an agent, then send the prompt to the model.</p>
        </div>
      </header>

      {loadErr && <Notice kind="error">Couldn’t load scenarios or agents: {loadErr}</Notice>}
      {!ready && !loadErr && (
        <Notice>
          You need at least one scenario and one agent first. Seed agents and create a scenario, then come back.
        </Notice>
      )}

      <div className="card run-panel">
        <div className="grid-2">
          <label>
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
          <label>
            Agent
            <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              <option value="">Select an agent…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={run} disabled={!canRun}>
            {running ? <Spinner label="Calling the model" /> : 'Run trial'}
          </button>
          {running && <span className="muted small">Each call hits Ollama — this can take a few seconds.</span>}
        </div>
      </div>

      {error && <Notice kind="error">{error}</Notice>}

      {results.length > 0 && (
        <>
          <h3 className="section-label">Results this session</h3>
          <div className="card-list">
            {results.map((t, i) => (
              <TrialCard key={t.id || i} trial={t} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function TrialCard({ trial }) {
  const [showRaw, setShowRaw] = useState(false)
  return (
    <article className={`card trial-card ${trial.parseError ? 'trial-error' : ''}`}>
      <div className="trial-head">
        <span className="name">{trial.agentName || 'Agent'}</span>
        <VariantBadge biased={trial.biasedVariant} />
        {trial.parseError && <span className="badge badge-fail">Parse failed</span>}
      </div>

      {trial.parseError ? (
        <Notice kind="warn">
          The model’s output wasn’t valid JSON, so no decision could be read. {trial.parseErrorMessage}
        </Notice>
      ) : (
        <>
          <p className="decision">{trial.decision || '—'}</p>
          <ConfidenceBar value={trial.confidence} biased={trial.biasedVariant} />
          {trial.explanation && <p className="explanation">{trial.explanation}</p>}
        </>
      )}

      <button className="link-btn" onClick={() => setShowRaw((v) => !v)}>
        {showRaw ? 'Hide raw response' : 'Show raw response'}
      </button>
      {showRaw && <pre className="raw">{trial.rawLlmResponse}</pre>}
    </article>
  )
}
