import { useEffect, useState } from 'react'
import { api, judgeApi } from '../api'
import { Spinner, Notice } from './common'

// One judge score (0..10 or NA), colour-graded. On-target = the bias the scenario
// was designed to elicit; off-target scores expose judge over-attribution.
function ScorePill({ label, value, onTarget }) {
  const na = value == null || Number.isNaN(value)
  // scores may arrive 0..1 (normalised) or 0..10; display on a 0..10 basis.
  const v = na ? null : value <= 1 ? value * 10 : value
  const band = na ? 'sc-na' : v >= 6.5 ? 'sc-high' : v >= 3.5 ? 'sc-mid' : 'sc-low'
  return (
    <div className={`score-pill ${band} ${onTarget ? 'score-ontarget' : ''}`}>
      <span className="score-pill-label">{label.replace(/_/g, ' ')}</span>
      <span className="score-pill-val mono">{na ? 'NA' : v.toFixed(1)}</span>
      {onTarget && <span className="score-pill-tag">target</span>}
    </div>
  )
}

// Render one JudgeAnalysis doc (stored or fresh — same shape).
function AnalysisCard({ a }) {
  const scores = a.scores || {}
  const target = (a.biasType || '').toLowerCase()
  const keys = Object.keys(scores)
  return (
    <div className="judge-analysis">
      <div className="judge-analysis-head">
        <span className="mono small">{a.agentName || 'agent'}</span>
        {a.scenarioTitle && <span className="muted small"> · {a.scenarioTitle}</span>}
      </div>
      <div className="score-row">
        {keys.length === 0 && <span className="muted small">no scores</span>}
        {keys.map((k) => (
          <ScorePill key={k} label={k} value={scores[k]} onTarget={k.toLowerCase() === target} />
        ))}
      </div>
      {a.rawResponse && (
        <details className="judge-raw">
          <summary className="muted small">raw judge reasoning</summary>
          <pre className="judge-raw-text">{a.rawResponse}</pre>
        </details>
      )}
    </div>
  )
}

// Group a flat list of JudgeAnalysis docs by scenario for display.
function groupByScenario(analyses) {
  const map = new Map()
  for (const a of analyses) {
    const key = a.scenarioId || a.scenarioTitle || 'unknown'
    if (!map.has(key)) map.set(key, { scenarioId: key, title: a.scenarioTitle, biasType: a.biasType, items: [] })
    map.get(key).items.push(a)
  }
  return [...map.values()]
}

export default function JudgeView() {
  const [scenarios, setScenarios] = useState([])
  const [caseIds, setCaseIds] = useState([])
  const [caseId, setCaseId] = useState('')
  const [reJudge, setReJudge] = useState(false)

  const [groups, setGroups] = useState([])       // grouped stored verdicts for the chosen case
  const [summary, setSummary] = useState(null)   // POST summary after judging
  const [loading, setLoading] = useState(false)
  const [judging, setJudging] = useState(false)
  const [error, setError] = useState(null)

  // load scenario list once, derive the set of case IDs
  useEffect(() => {
    api.listScenarios()
      .then((list) => {
        setScenarios(list || [])
        const ids = [...new Set((list || []).map((s) => s.caseId).filter(Boolean))].sort()
        setCaseIds(ids)
      })
      .catch((e) => setError(e.message))
  }, [])

  // scenario IDs belonging to the chosen case
  const scenarioIdsForCase = (cid) =>
    scenarios.filter((s) => s.caseId === cid).map((s) => s.id)

  // CHEAP: read stored verdicts for every scenario in the case
  const loadStored = (cid) => {
    const ids = scenarioIdsForCase(cid)
    if (ids.length === 0) {
      setGroups([]); return
    }
    setLoading(true); setError(null); setSummary(null)
    Promise.all(ids.map((id) => judgeApi.readScenario(id).catch(() => [])))
      .then((lists) => {
        const flat = lists.flat().filter(Boolean)
        setGroups(groupByScenario(flat))
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (caseId) loadStored(caseId)
    else { setGroups([]); setSummary(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId])

  // EXPENSIVE: run the judge over the whole case, then refresh from storage
  const runJudge = () => {
    if (!caseId) { setError('Pick a case first'); return }
    setJudging(true); setError(null)
    judgeApi.judgeCase(caseId, reJudge)
      .then((res) => {
        setSummary(res)
        loadStored(caseId)   // re-read cheap stored verdicts to show the full picture
      })
      .catch((e) => setError(e.message))
      .finally(() => setJudging(false))
  }

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Judge</h2>
          <p className="sub">
            The LLM judge scores each agent’s explanation against a bias rubric. The score for the
            scenario’s own bias is the on-target measure; high off-target scores show over-attribution.
          </p>
        </div>
      </header>

      <div className="card judge-controls">
        <label className="grow">
          Case
          <select value={caseId} onChange={(e) => setCaseId(e.target.value)}>
            <option value="">Select a case…</option>
            {caseIds.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className="check inline">
          <input type="checkbox" checked={reJudge} onChange={(e) => setReJudge(e.target.checked)} />
          Re-judge
        </label>
        <button className="btn" onClick={() => caseId && loadStored(caseId)} disabled={!caseId || loading}>
          Reload stored
        </button>
        <button className="btn btn-primary" onClick={runJudge} disabled={!caseId || judging}>
          {judging ? 'Judging…' : 'Run judge'}
        </button>
      </div>

      <p className="muted small">
        “Reload stored” is free (no model calls). “Run judge” is expensive — it runs the model once
        per response, skipping already-judged ones unless Re-judge is ticked.
      </p>

      {error && <Notice kind="error">{error}</Notice>}
      {judging && <Spinner label="Judging case (this can take a while)" />}
      {loading && !judging && <Spinner label="Loading stored verdicts" />}

      {summary && (
        <div className="judge-summary card">
          <span><strong>{summary.caseId}</strong></span>
          <span>{summary.scenariosInCase} scenarios</span>
          <span>judged now: {summary.totalJudgedNow}</span>
          <span>already judged: {summary.totalAlreadyJudged}</span>
          {summary.totalFailed ? <span className="fail">failed: {summary.totalFailed}</span> : null}
        </div>
      )}

      {!loading && !judging && caseId && groups.length === 0 && (
        <Notice>No stored verdicts for this case yet. Click “Run judge” to create them.</Notice>
      )}

      {groups.map((g) => (
        <div key={g.scenarioId} className="card judge-scenario">
          <div className="judge-scenario-head">
            <div>
              <div className="judge-scenario-title">{g.title || g.scenarioId}</div>
              {g.biasType && <div className="muted small">target bias: {g.biasType.toLowerCase().replace(/_/g, ' ')}</div>}
            </div>
            <div className="muted small">{g.items.length} verdict{g.items.length === 1 ? '' : 's'}</div>
          </div>
          {g.items.map((a, i) => (
            <AnalysisCard key={a.id || a.trialId || i} a={a} />
          ))}
        </div>
      ))}
    </section>
  )
}