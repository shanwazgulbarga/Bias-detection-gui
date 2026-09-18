import { useState } from 'react'
import RunView from './components/RunView'
import ResultsView from './components/ResultsView'
import AgentsView from './components/AgentsView'
import ScenariosView from './components/ScenariosView'
import AnalysisView from './components/AnalysisView'
import FusionView from './components/FusionView'
import JudgeView from './components/JudgeView'

const TABS = [
  { id: 'run', label: 'Run' },
  { id: 'results', label: 'Results' },
  { id: 'judge', label: 'Judge' },
  { id: 'fusion', label: 'Reliability' },
  { id: 'agents', label: 'Agents' },
  { id: 'scenarios', label: 'Scenarios' },
  { id: 'analysis', label: 'Analysis' },
]

export default function App() {
  const [tab, setTab] = useState('run')
  // Bump this to force child lists to refetch after cross-view changes.
  const [, setRev] = useState(0)
  const refresh = () => setRev((n) => n + 1)

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">bl</span>
          <div>
            <div className="brand-name">Bias Lab</div>
            <div className="brand-sub">prompt arena</div>
          </div>
        </div>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-foot-label">Live stack</div>
          <div className="sidebar-foot-value mono">phi3.5 · Ollama · :8080 / analysis :8082</div>
        </div>
      </aside>

      <main className="content">
        {tab === 'run' && <RunView />}
        {tab === 'results' && <ResultsView />}
        {tab === 'judge' && <JudgeView />}
        {tab === 'fusion' && <FusionView />}
        {tab === 'agents' && <AgentsView onChanged={refresh} />}
        {tab === 'scenarios' && <ScenariosView onChanged={refresh} />}
        {tab === 'analysis' && <AnalysisView onBack={() => setTab('run')} />}
      </main>
    </div>
  )
}
