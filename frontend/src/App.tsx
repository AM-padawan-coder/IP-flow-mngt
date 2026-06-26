import { useState } from 'react'
import NewFlowPage from './pages/NewFlowPage'
import HistoryPage from './pages/HistoryPage'
import TopologyPage from './pages/TopologyPage'
import AdminPage from './pages/AdminPage'
import ImportPage from './pages/ImportPage'
import TeamsPage from './pages/TeamsPage'
import AuditPage from './pages/AuditPage'
import HelpModal from './components/HelpModal'

type Page = 'new' | 'history' | 'topology' | 'admin' | 'import' | 'teams' | 'audit'

const NAV = [
  { id: 'new',      label: 'Nouveau flux',  icon: '＋', section: 'Flux IP' },
  { id: 'history',  label: 'Historique',    icon: '⏱', section: 'Flux IP' },
  { id: 'topology', label: 'Graphe réseau', icon: '⬡', section: 'Topologie' },
  { id: 'admin',    label: 'Administration',icon: '⚙', section: 'Topologie' },
  { id: 'import',   label: 'Import / Export', icon: '⬆', section: 'Topologie' },
  { id: 'teams',    label: 'Équipes & Sites', icon: '👥', section: 'Organisation' },
  { id: 'audit',    label: 'Audit',         icon: '◎', section: 'Référentiel' },
] as const

export default function App() {
  const [page, setPage] = useState<Page>('new')
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])
  const [helpOpen, setHelpOpen] = useState(false)

  const goToGraph = (path: string[]) => {
    setHighlightedPath(path)
    setPage('topology')
  }

  const sections = [...new Set(NAV.map(n => n.section))]

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>IP Flow Manager</h1>
          <p>Gestion des flux réseau</p>
        </div>
        <nav className="sidebar-nav">
          {sections.map(section => (
            <div className="nav-section" key={section}>
              <div className="nav-section-label">{section}</div>
              {NAV.filter(n => n.section === section).map(item => (
                <button
                  key={item.id}
                  className={`nav-item${page === item.id ? ' active' : ''}`}
                  onClick={() => { setPage(item.id); if (item.id !== 'topology') setHighlightedPath([]) }}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="text-xs text-dimmed">demo-user · v2.1.0</div>
          <button
            onClick={() => setHelpOpen(true)}
            title="Guide d'utilisation"
            style={{
              background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: '50%', width: 26, height: 26,
              color: 'var(--text-2)', cursor: 'pointer',
              fontSize: 13, fontWeight: 700, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, fontFamily: 'inherit',
              transition: 'border-color 0.15s, color 0.15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--blue)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--blue)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
          >?</button>
        </div>
      </aside>

      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} />}

      <main className="main">
        {page === 'new'      && <NewFlowPage onShowGraph={goToGraph} />}
        {page === 'history'  && <HistoryPage onSelect={() => {}} />}
        {page === 'topology' && <TopologyPage highlightedPath={highlightedPath} />}
        {page === 'admin'    && <AdminPage />}
        {page === 'import'   && <ImportPage />}
        {page === 'teams'    && <TeamsPage />}
        {page === 'audit'    && <AuditPage />}
      </main>
    </div>
  )
}
