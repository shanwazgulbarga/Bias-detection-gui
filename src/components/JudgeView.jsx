import { useEffect, useState } from 'react'
import { reasoningApi } from '../api'
import { Spinner, Notice, MonoId } from './common'

export default function JudgeView() {
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [busyCase, setBusyCase] = useState(null)

  const [selectedId, setSelectedId] = useState(null)
  const [caseData, setCaseData] = useState(null)
  const [loadingCase, setLoadingCase] = useState(false)

  async function loadCases() {
    setLoading(true)
    setError(null)
    try {
      const res = await reasoningApi.listCases()
      setCases(Array.isArray(res) ? res : [])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCases()
  }, [])

  async function readCase(id) {
    setSelectedId(id)
    setLoadingCase(true)
    setError(null)
    try {
      const res = await reasoningApi.readCase(id)
      setCaseData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingCase(false)
    }
  }

  async function runJudge(id) {
    setBusyId(id)
    setSelectedId(id)
    setError(null)
    try {
      const res = await reasoningApi.judgeCase(id, false)
      // judging returns the case resource (verdicts under `results`) — show it
      setCaseData(res)
      // refresh case list to reflect judged status
      await loadCases()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyId(null)
      setLoadingCase(false)
    }
  }

  // Judge every scenario in one clinical case with a single request.
  async function runWholeCase(caseId) {
    setBusyCase(caseId)
    setSelectedId(caseId)
    setError(null)
    try {
      const res = await reasoningApi.judgeWholeCase(caseId, false)
      setCaseData(res) // whole-case summary: { caseId, totals…, scenarios: [...] }
      await loadCases()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusyCase(null)
      setLoadingCase(false)
    }
  }

  async function openCaseWindow(id) {
    setError(null)
    try {
      const data = await reasoningApi.readCase(id)
      const w = window.open('', `_blank`)
      if (!w) throw new Error('Popup blocked')
      const title = Array.isArray(data) ? (getScenarioTitle(data[0]) || id) : (getScenarioTitle(data) || id)
      const html = `
        <!doctype html>
        <html>
        <head>
          <meta charset="utf-8" />
          <title>Judge — ${title}</title>
          <style>
            body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:20px}
            h1{font-size:20px;margin-bottom:8px}
            .meta{color:#666;margin-bottom:16px}
            .verdict{border:1px solid #ddd;padding:12px;margin-bottom:12px;border-radius:6px}
            .agent{font-weight:600}
            pre{white-space:pre-wrap;background:#f7f7f7;padding:10px;border-radius:6px}
          </style>
        </head>
        <body>
          <h1>Case: ${escapeHtml(title)}</h1>
          <div class="meta">Scenario ID: ${escapeHtml(id)}</div>
          <div>
            ${formatVerdictsHtml(data)}
          </div>
        </body>
        </html>
      `
      w.document.open()
      w.document.write(html)
      w.document.close()
    } catch (e) {
      setError(e.message)
    }
  }

  function escapeHtml(s) {
    if (s == null) return ''
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
  }

  function formatVerdictsHtml(data) {
    if (!data) return '<div>No data</div>'
    const verdicts = extractVerdicts(data)
    if (verdicts.length === 0) return '<div>No verdicts</div>'
    return verdicts
      .map((v) => {
        const agent = escapeHtml(v.agent || v.agentId || v.agentName || 'unknown')
        const decision = escapeHtml(v.decision || v.verdict || '')
        const explanation = escapeHtml(v.explanation || v.note || '')
        const judged = v.judged ? 'Yes' : 'No'
        const scoresHtml = v.scores
          ? Object.entries(v.scores)
              .map(([k, val]) => `<div class="mono">${escapeHtml(k)}: ${escapeHtml(val)}</div>`)
              .join('')
          : ''
        const target = v.targetBias ? `<div>Target bias: ${escapeHtml(v.targetBias)} (${escapeHtml(v.targetBiasScore)})</div>` : ''
        const others = v.otherBiases && v.otherBiases.length ? `<div>Other biases: ${escapeHtml(JSON.stringify(v.otherBiases))}</div>` : ''
        return `
          <div class="verdict">
            <div class="agent">${agent}</div>
            <div><strong>Decision:</strong> ${decision}</div>
            <div><strong>Judged:</strong> ${judged}</div>
            ${explanation ? `<div style="margin-top:8px">${explanation}</div>` : ''}
            ${scoresHtml ? `<div style="margin-top:8px"><strong>Scores</strong>${scoresHtml}</div>` : ''}
            ${target}
            ${others}
          </div>
        `
      })
      .join('')
  }

  const groups = groupByCase(cases)
  const isWholeCase = caseData && !Array.isArray(caseData) && Array.isArray(caseData.scenarios)

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Judge</h2>
          <p className="sub">Judge one scenario at a time, or a whole clinical case in one run.</p>
        </div>
      </header>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="card judge-grid">
        <aside className="judge-list">
          <h3>Cases</h3>
          {loading ? (
            <Spinner label="Loading cases" />
          ) : cases.length === 0 ? (
            <Notice>No cases available.</Notice>
          ) : (
            <div className="judge-groups">
              {groups.map((g) => (
                <div key={g.caseId} className="judge-case-group">
                  <div className="judge-case-group-head">
                    <div>
                      <span className="mono">{g.caseId}</span>{' '}
                      <span className="muted small">
                        {g.rows.length} scenario{g.rows.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    {g.grouped && (
                      <button
                        className="btn btn-sm"
                        onClick={() => runWholeCase(g.caseId)}
                        disabled={busyCase === g.caseId}
                        title="Judge every scenario in this case in one run"
                      >
                        {busyCase === g.caseId ? <Spinner /> : 'Judge whole case'}
                      </button>
                    )}
                  </div>

                  <div className="card-list">
                    {g.rows.map((c) => (
                      <article key={c.scenarioId} className={`card row-card ${selectedId === c.scenarioId ? 'active' : ''}`}>
                        <div className="row-main" onClick={() => readCase(c.scenarioId)} style={{ cursor: 'pointer' }}>
                          <div className="row-title">
                            <span className="name">{getScenarioTitle(c)}</span>
                            <div className="muted small mono" style={{ marginTop: 6 }}>{c.scenarioId}</div>
                          </div>
                          <p className="muted small">Responses: {c.responses ?? c.responseCount ?? '—'}</p>
                        </div>
                        <div className="row-side">
                          <div>
                            {c.status === 'complete' ? (
                              <span className="badge badge-neutral">Judged</span>
                            ) : (
                              <button className="btn" onClick={(e) => { e.stopPropagation(); runJudge(c.scenarioId) }} disabled={busyId === c.scenarioId}>
                                {busyId === c.scenarioId ? <Spinner /> : (c.status === 'partial' ? 'Finish judging' : 'Judge')}
                              </button>
                            )}
                            <div style={{ marginTop: 8 }}>
                              <button className="btn" onClick={(e) => { e.stopPropagation(); openCaseWindow(c.scenarioId) }} style={{ marginRight: 8 }}>
                                Open
                              </button>
                              <MonoId id={c.scenarioId} />
                            </div>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        <div className="judge-panel card">
          <h3>Case</h3>
          {!selectedId ? (
            <Notice>Select a case to view or judge it.</Notice>
          ) : loadingCase ? (
            <Spinner label="Loading case" />
          ) : !caseData ? (
            <Notice>No data for this case. Press Judge to run the judge.</Notice>
          ) : caseData.error ? (
            <Notice kind="error">{caseData.error}</Notice>
          ) : isWholeCase ? (
            <WholeCaseSummary summary={caseData} />
          ) : (
            <div>
              <h4>{Array.isArray(caseData) ? (getScenarioTitle(caseData[0]) || selectedId) : (getScenarioTitle(caseData) || selectedId)}</h4>
              <p className="muted small">Scenario ID: <MonoId id={selectedId} /></p>

              <section>
                <h5>Verdicts</h5>
                <VerdictList verdicts={extractVerdicts(caseData)} />
              </section>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

// One judged clinical case: a totals banner plus each scenario's verdicts.
function WholeCaseSummary({ summary }) {
  const scenarios = Array.isArray(summary.scenarios) ? summary.scenarios : []
  return (
    <div>
      <h4>Case {summary.caseId}</h4>
      <p className="muted small">
        {summary.scenariosInCase ?? scenarios.length} scenario
        {(summary.scenariosInCase ?? scenarios.length) === 1 ? '' : 's'}
        {' · '}judged now {summary.totalJudgedNow ?? 0}
        {' · '}already judged {summary.totalAlreadyJudged ?? 0}
        {' · '}failed {summary.totalFailed ?? 0}
      </p>

      {scenarios.length === 0 ? (
        <Notice>No scenarios were judged for this case.</Notice>
      ) : (
        scenarios.map((sc, i) => (
          <section key={sc.scenarioId || i} style={{ marginTop: 16 }}>
            <h5>
              {getScenarioTitle(sc)}{' '}
              {sc.biasType && <span className="muted small mono">{sc.biasType}</span>}
            </h5>
            <VerdictList verdicts={extractVerdicts(sc)} />
          </section>
        ))
      )}
    </div>
  )
}

function VerdictList({ verdicts }) {
  if (!verdicts || verdicts.length === 0) {
    return <Notice>No verdicts yet for this case.</Notice>
  }
  return (
    <div className="card-list">
      {verdicts.map((v, i) => (
        <article key={i} className="card row-card">
          <div className="row-main">
            <div className="row-title">
              <span className="name">{v.agent || v.agentId || v.agentName}</span>
            </div>
            <p className="muted small">Decision: {v.decision || v.verdict || '—'}</p>
            <p className="muted small">Judged: {v.judged ? 'yes' : 'no'}</p>
            {v.explanation && <div style={{ marginTop: 8 }}>{v.explanation}</div>}
            {v.scores && (
              <div className="muted small" style={{ marginTop: 8 }}>
                <strong>Scores:</strong>
                <div>
                  {Object.entries(v.scores).map(([k, val]) => (
                    <div key={k} className="mono">{k}: {val}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}

// readCase returns the verdict array directly; judgeCase wraps it under `results`.
function extractVerdicts(data) {
  if (!data) return []
  if (Array.isArray(data)) return data
  if (Array.isArray(data.results)) return data.results
  if (Array.isArray(data.verdicts)) return data.verdicts
  return []
}

// Group the per-scenario rows into clinical cases by caseId. Rows without a
// caseId fall into an "Ungrouped" bucket that has no whole-case action.
function groupByCase(cases) {
  const groups = new Map()
  for (const c of cases) {
    const key = c.caseId || 'Ungrouped'
    const bucket = groups.get(key) || []
    bucket.push(c)
    groups.set(key, bucket)
  }
  return [...groups.entries()].map(([caseId, rows]) => ({
    caseId,
    rows,
    grouped: caseId !== 'Ungrouped',
  }))
}

function getScenarioTitle(item) {
  if (!item) return ''
  return (
    item.title || item.scenarioTitle || item.scenarioName || item.name || item.scenarioId || ''
  )
}
