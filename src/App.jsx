import { useState } from 'react'
import RunView from './components/RunView'
import ResultsView from './components/ResultsView'
import AgentsView from './components/AgentsView'
import ScenariosView from './components/ScenariosView'
import AnalysisView from './components/AnalysisView'
import FusionView from './components/FusionView'
import JudgeView from './components/JudgeView'

const TAB_LABELS = {
  scenarios: 'Scenarios',
  run: 'Run',
  agents: 'Agents',
  results: 'Results',
  analysis: 'Analysis',
  judge: 'Judge',
  fusion: 'Reliability',
}

// Sidebar grouped into the workflow stages.
const NAV_GROUPS = [
  { label: 'Stage 1', items: ['scenarios', 'run', 'agents', 'results'] },
  { label: 'Stage 2', items: ['analysis', 'judge'] },
  { label: 'Final stage', items: ['fusion'] },
]

export default function App() {
  const [tab, setTab] = useState('scenarios')
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
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-group-label">{group.label}</div>
              {group.items.map((id) => (
                <button
                  key={id}
                  className={`nav-item ${tab === id ? 'active' : ''}`}
                  onClick={() => setTab(id)}
                >
                  {TAB_LABELS[id]}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="sidebar-foot-label">Live stack</div>
          <div className="sidebar-foot-value mono">phi3.5 · Ollama · :8080 / analysis :8082</div>
        </div>
      </aside>

      <main className="content">
        <div className="app-titlebar">
          <h1 className="app-title">Cognitive Bias Detection and Individual Intelligence Profiling</h1>
        </div>
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