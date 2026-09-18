import { useEffect, useMemo, useState } from 'react'
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

  function loadLists() {
    return Promise.all([api.listScenarios(), api.listAgents()])
      .then(([s, a]) => {
        setScenarios(s)
        setAgents(a)
      })
      .catch((e) => setLoadErr(e.message))
  }

  useEffect(() => {
    loadLists()
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

      <BatchByCase scenarios={scenarios} agents={agents} onDone={loadLists} />

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

// Run every agent against every scenario in one clinical case. Fires one batch
// PER SCENARIO, sequentially, so progress and partial results stream in and a
// single failed scenario doesn't abort the rest.
function BatchByCase({ scenarios, agents, onDone }) {
  const [caseId, setCaseId] = useState('')
  const [seedsInput, setSeedsInput] = useState('42, 43, 44')
  const [running, setRunning] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(0)
  const [collected, setCollected] = useState([]) // ScenarioGroup[] accumulated
  const [failures, setFailures] = useState([]) // { key, message }[]

  // Cases are scenarios grouped by caseId (scenarios without one are excluded here).
  const cases = useMemo(() => {
    const groups = new Map()
    for (const s of scenarios) {
      if (!s.caseId) continue
      const bucket = groups.get(s.caseId) || []
      bucket.push(s)
      groups.set(s.caseId, bucket)
    }
    return [...groups.entries()]
      .map(([id, rows]) => ({ caseId: id, scenarios: rows }))
      .sort((a, b) => a.caseId.localeCompare(b.caseId))
  }, [scenarios])

  const seeds = useMemo(
    () => seedsInput.split(',').map((x) => x.trim()).filter(Boolean),
    [seedsInput]
  )

  const selected = cases.find((c) => c.caseId === caseId)
  const totalScenarios = selected ? selected.scenarios.length : 0
  const perPass = totalScenarios * agents.length
  const totalTrials = perPass * Math.max(seeds.length, 1)
  const canRun = !!selected && agents.length > 0 && !running

  async function run() {
    if (!selected) return
    setRunning(true)
    setError(null)
    setDone(0)
    setCollected([])
    setFailures([])

    const agentProfileIds = agents.map((a) => a.id)
    for (const s of selected.scenarios) {
      try {
        const run = await api.runBatch([s.id], agentProfileIds, seeds)
        const groups = run.scenarios || []
        setCollected((prev) => [...prev, ...groups])
      } catch (e) {
        setFailures((prev) => [...prev, { key: s.scenarioKey || s.id, message: e.message }])
      } finally {
        setDone((d) => d + 1)
      }
    }

    setRunning(false)
    onDone?.() // refresh counts elsewhere once the case is done
  }

  if (cases.length === 0) return null

  const started = running || collected.length > 0 || failures.length > 0

  return (
    <div className="card run-panel">
      <div className="row-title">
        <h3 style={{ margin: 0 }}>Batch run by case</h3>
        <span className="muted small">Every agent × every scenario in a case, biased variant only.</span>
      </div>

      <div className="grid-2" style={{ marginTop: 12 }}>
        <label>
          Case
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)} disabled={running}>
            <option value="">Select a case…</option>
            {cases.map((c) => (
              <option key={c.caseId} value={c.caseId}>
                {c.caseId} · {c.scenarios.length} scenario{c.scenarios.length === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Seeds (comma-separated)
          <input
            value={seedsInput}
            onChange={(e) => setSeedsInput(e.target.value)}
            placeholder="42, 43, 44"
            disabled={running}
          />
        </label>
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={run} disabled={!canRun}>
          {running ? <Spinner label={`Scenario ${done + 1} of ${totalScenarios}`} /> : 'Run whole case'}
        </button>
        {selected && !running && (
          <span className="muted small">
            {totalTrials} trial{totalTrials === 1 ? '' : 's'} ({totalScenarios} scenario
            {totalScenarios === 1 ? '' : 's'} × {agents.length} agent
            {agents.length === 1 ? '' : 's'} × {Math.max(seeds.length, 1)} seed
            {Math.max(seeds.length, 1) === 1 ? '' : 's'}) — each hits Ollama, so this can take a while.
          </span>
        )}
        {running && (
          <span className="muted small">
            {done} / {totalScenarios} scenarios done — each hits Ollama, so this can take a while.
          </span>
        )}
      </div>

      {error && <Notice kind="error">{error}</Notice>}
      {started && (
        <BatchSummary
          scenarios={collected}
          failures={failures}
          running={running}
          done={done}
          total={totalScenarios}
        />
      )}
    </div>
  )
}

function BatchSummary({ scenarios, failures = [], running, done, total }) {
  const totalTrials = scenarios.reduce(
    (sum, sc) => sum + (sc.agents || []).reduce((n, a) => n + (a.trials?.length || 0), 0),
    0
  )
  return (
    <div className={`notice ${running ? 'notice-info' : 'notice-ok'}`} style={{ marginTop: 12 }}>
      <div>
        {running ? (
          <>Running… <strong>{done}</strong> of {total} scenarios done.</>
        ) : (
          <>
            <strong>{totalTrials}</strong> trial{totalTrials === 1 ? '' : 's'} created across{' '}
            {scenarios.length} scenario{scenarios.length === 1 ? '' : 's'}. Head to{' '}
            <strong>Results</strong> or <strong>Judge</strong> to review them.
          </>
        )}
      </div>

      {scenarios.length > 0 && (
        <ul className="batch-summary-list">
          {scenarios.map((sc) => {
            const n = (sc.agents || []).reduce((acc, a) => acc + (a.trials?.length || 0), 0)
            const failed = (sc.agents || []).reduce(
              (acc, a) => acc + (a.trials || []).filter((t) => t.parseError).length,
              0
            )
            return (
              <li key={sc.scenarioId}>
                <span className="mono">{sc.scenarioKey || sc.scenarioId}</span> — {n} trial
                {n === 1 ? '' : 's'}
                {failed > 0 && <span className="muted small"> ({failed} parse-failed)</span>}
              </li>
            )
          })}
        </ul>
      )}

      {failures.length > 0 && (
        <ul className="batch-summary-list">
          {failures.map((f) => (
            <li key={f.key}>
              <span className="mono">{f.key}</span> — <span className="conf-na">failed:</span> {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
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
