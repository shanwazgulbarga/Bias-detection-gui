import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner, Notice, MonoId } from './common'

const EMPTY = {
  scenarioKey: '',
  biasType: '',
  title: '',
  description: '',
  biasedPrompt: '',
  responseFormat: '{"decision":"...","confidence":0,"explanation":"..."}',
  groundTruth: '',
  biasElement: '',
}

export default function ScenariosView({ onChanged }) {
  const [scenarios, setScenarios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [showForm, setShowForm] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setScenarios(await api.listScenarios())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function validate(id) {
    setError(null)
    try {
      await api.validateScenario(id)
      await load()
    } catch (e) {
      setError(e.message)
    }
  }

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createScenario(form)
      setForm(EMPTY)
      setShowForm(false)
      await load()
      onChanged?.()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Scenarios</h2>
          <p className="sub">Each scenario holds a biased and a neutral prompt for the same underlying question.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)}>
          {showForm ? 'Close' : 'New scenario'}
        </button>
      </header>

      {error && <Notice kind="error">{error}</Notice>}

      {showForm && (
        <form className="card form" onSubmit={create}>
          <div className="grid-2">
            <label>
              Scenario key
              <input value={form.scenarioKey} onChange={set('scenarioKey')} required placeholder="medical-anchoring-01" />
            </label>
            <label>
              Bias type
              <input value={form.biasType} onChange={set('biasType')} placeholder="anchoring" />
            </label>
            <label>
              Title
              <input value={form.title} onChange={set('title')} placeholder="Patient diagnosis under anchor" />
            </label>
            <label>
              Bias element
              <input value={form.biasElement} onChange={set('biasElement')} placeholder="The 80% figure stated up front" />
            </label>
          </div>
          <label>
            Description
            <input value={form.description} onChange={set('description')} />
          </label>
          <label>
            Prompt
            <textarea rows={6} value={form.biasedPrompt} onChange={set('biasedPrompt')} required />
          </label>
          <div className="grid-2">
            <label>
              Response format
              <input value={form.responseFormat} onChange={set('responseFormat')} />
            </label>
            <label>
              Ground truth
              <input value={form.groundTruth} onChange={set('groundTruth')} placeholder="Optional correct answer" />
            </label>
          </div>
          <div className="form-actions">
            <button className="btn btn-primary" disabled={busy}>
              {busy ? <Spinner label="Saving" /> : 'Create scenario'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <Spinner label="Loading scenarios" />
      ) : scenarios.length === 0 ? (
        <Notice>No scenarios yet. Create one to start running trials against it.</Notice>
      ) : (
        <div className="card-list">
          {scenarios.map((s) => (
            <article key={s.id} className="card row-card">
              <div className="row-main">
                <div className="row-title">
                  <span className="name">{s.title || s.scenarioKey}</span>
                </div>
                <p className="meta">
                  <span className="mono">{s.scenarioKey}</span>
                  {s.biasType && (
                    <>
                      {' '}· bias <span className="mono">{s.biasType}</span>
                    </>
                  )}
                </p>
                {s.description && <p className="muted">{s.description}</p>}
              </div>
              <div className="row-side col">
                <MonoId id={s.id} />
                {!s.validated && (
                  <button className="btn btn-sm" onClick={() => validate(s.id)}>
                    Mark validated
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
