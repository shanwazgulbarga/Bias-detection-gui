import { useEffect, useState } from 'react'
import { api } from '../api'
import { Spinner, Notice, PersonaBadge, MonoId } from './common'

export default function AgentsView({ onChanged }) {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setAgents(await api.listAgents())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function seed() {
    setBusy(true)
    setError(null)
    try {
      const count = await api.seedAgents()
      await load()
      onChanged?.()
      if (Number(count) === 0) {
        setError('Agents already exist — nothing was seeded.')
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <header className="view-head">
        <div>
          <h2>Agents</h2>
          <p className="sub">Personas the model adopts. Each carries a system prompt and a temperature.</p>
        </div>
        <div className="head-actions">
          <button className="btn" onClick={seed} disabled={busy}>
            {busy ? <Spinner /> : 'Seed defaults'}
          </button>
        </div>
      </header>

      {error && <Notice kind="error">{error}</Notice>}

      {loading ? (
        <Spinner label="Loading agents" />
      ) : agents.length === 0 ? (
        <Notice>No agents yet. Seed the defaults to get six ready-made personas.</Notice>
      ) : (
        <div className="card-list">
          {agents.map((a) => (
            <article key={a.id} className="card row-card">
              <div className="row-main">
                <div className="row-title">
                  <span className="name">{a.name}</span>
                  <PersonaBadge biased={a.biasedPersona} />
                </div>
                <p className="muted">{a.description || 'No description'}</p>
                <p className="meta">
                  <span className="mono">{a.provider}</span> · <span className="mono">{a.modelName}</span> · temp{' '}
                  <span className="mono">{a.temperature}</span> · seed <span className="mono">{a.seed}</span>
                </p>
              </div>
              <div className="row-side">
                <MonoId id={a.id} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
