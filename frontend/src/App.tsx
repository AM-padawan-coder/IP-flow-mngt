import { useState, useEffect } from 'react'
import NewFlowPage from './pages/NewFlowPage'
import HistoryPage from './pages/HistoryPage'
import TopologyPage from './pages/TopologyPage'
import AdminPage from './pages/AdminPage'
import BackupPage from './pages/BackupPage'
import CompliancePage from './pages/CompliancePage'
import ImportPage from './pages/ImportPage'
import TeamsPage from './pages/TeamsPage'
import AuditPage from './pages/AuditPage'
import SimulationPage from './pages/SimulationPage'
import PolicyPage from './pages/PolicyPage'
import FlowsTopologyPage from './pages/FlowsTopologyPage'
import HelpModal from './components/HelpModal'
import RoadmapModal from './components/RoadmapModal'

type Page = 'new' | 'history' | 'simulation' | 'topology' | 'admin' | 'import' | 'teams' | 'audit' | 'policies' | 'flows-topology' | 'backups' | 'compliance'

const NAV = [
  { id: 'new',        label: 'Nouveau flux',       icon: '＋', section: 'Flux IP' },
  { id: 'history',    label: 'Historique',          icon: '⏱', section: 'Flux IP' },
  { id: 'simulation', label: 'Simulation',          icon: 'ti ti-adjustments-horizontal', section: 'Flux IP' },
  { id: 'topology',        label: 'Graphe réseau',       icon: '⬡', section: 'Topologie' },
  { id: 'admin',           label: 'Configuration',       icon: '⚙', section: 'Topologie' },
  { id: 'backups',         label: 'Sauvegardes',         icon: 'ti ti-database', section: 'Administration' },
  { id: 'flows-topology',  label: 'Flux',                icon: '↔', section: 'Topologie' },
  { id: 'policies',        label: 'Politiques réseau',   icon: 'ti ti-shield', section: 'Topologie' },
  { id: 'import',          label: 'Import / Export',     icon: '⬆', section: 'Topologie' },
  { id: 'teams',      label: 'Équipes',             icon: 'ti ti-users', section: 'Organisation' },
  { id: 'audit',      label: 'Audit',               icon: '◎', section: 'Référentiel' },
  { id: 'compliance', label: 'Conformité',          icon: 'ti ti-checkbox', section: 'Référentiel' },
] as const

function getInitialTheme(): 'dark' | 'light' {
  const stored = localStorage.getItem('theme') as 'dark' | 'light' | null
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

const ICON_BTN: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: '50%', width: 26, height: 26,
  color: 'var(--text-2)', cursor: 'pointer',
  fontSize: 13, fontWeight: 700, lineHeight: 1,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0, fontFamily: 'inherit',
  transition: 'border-color 0.15s, color 0.15s',
}

export default function App() {
  const [page, setPage] = useState<Page>('new')
  const [highlightedPath, setHighlightedPath] = useState<string[]>([])
  const [helpOpen, setHelpOpen] = useState(false)
  const [roadmapOpen, setRoadmapOpen] = useState(false)
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  const goToGraph = (path: string[]) => {
    setHighlightedPath(path)
    setPage('topology')
  }

  const sections = [...new Set(NAV.map(n => n.section))]

  const hoverBlue = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--blue)'
    e.currentTarget.style.color = 'var(--blue)'
  }
  const hoverOut = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.borderColor = 'var(--border)'
    e.currentTarget.style.color = 'var(--text-2)'
  }

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
                  <span className="nav-icon">
                    {item.icon.startsWith('ti ') ? <i className={item.icon} aria-hidden="true" /> : item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer — version + actions */}
        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="text-xs text-dimmed" style={{ flex: 1 }}>demo · v2.9.2</div>

          {/* Dark/Light toggle */}
          <button
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            style={ICON_BTN}
            onMouseEnter={hoverBlue}
            onMouseLeave={hoverOut}
          >
            {theme === 'dark' ? '☀' : '🌙'}
          </button>

          {/* Roadmap */}
          <button
            onClick={() => setRoadmapOpen(true)}
            title="Roadmap"
            style={ICON_BTN}
            onMouseEnter={hoverBlue}
            onMouseLeave={hoverOut}
          >
            ⬡
          </button>

          {/* Help */}
          <button
            onClick={() => setHelpOpen(true)}
            title="Guide d'utilisation"
            style={ICON_BTN}
            onMouseEnter={hoverBlue}
            onMouseLeave={hoverOut}
          >
            ?
          </button>
        </div>
      </aside>

      {helpOpen    && <HelpModal    onClose={() => setHelpOpen(false)} />}
      {roadmapOpen && <RoadmapModal onClose={() => setRoadmapOpen(false)} />}

      <main className="main">
        {page === 'new'        && <NewFlowPage onShowGraph={goToGraph} />}
        {page === 'history'    && <HistoryPage onSelect={() => {}} />}
        {page === 'simulation' && <SimulationPage />}
        {page === 'policies'        && <PolicyPage />}
        {page === 'flows-topology'  && <FlowsTopologyPage />}
        {page === 'topology'        && <TopologyPage highlightedPath={highlightedPath} />}
        {page === 'admin'      && <AdminPage />}
        {page === 'backups'    && <BackupPage />}
        {page === 'compliance' && <CompliancePage />}
        {page === 'import'     && <ImportPage onNavigate={(p) => setPage(p as Page)} />}
        {page === 'teams'      && <TeamsPage />}
        {page === 'audit'      && <AuditPage />}
      </main>
    </div>
  )
}
