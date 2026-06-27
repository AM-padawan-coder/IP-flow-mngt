import { useEffect, useState } from 'react'
import { api } from '../api/client'
import FlowDetailModal from '../components/FlowDetailModal'
import type { FlowSummary } from '../types'

type HistoryTab = 'flows' | 'events'

const STATUS_BADGE: Record<string, string> = {
  validated: 'badge-ok', deployed: 'badge-deployed', rejected: 'badge-error', pending: 'badge-pending',
}
const STATUS_LABEL: Record<string, string> = {
  validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente',
}
const STATUS_FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'validated', label: 'Validé' },
  { key: 'deployed', label: 'Déployé' },
  { key: 'pending', label: 'En attente' },
  { key: 'rejected', label: 'Refusé' },
]
const STATUS_BAR_COLOR: Record<string, string> = {
  validated: '#22c55e', deployed: '#3b82f6', rejected: '#ef4444', pending: '#eab308',
}

const EVENT_ICON: Record<string, string> = {
  route_created: '🗺', route_deleted: '🗑', acl_created: '🔒', acl_deleted: '🗑',
}
const EVENT_COLOR: Record<string, string> = {
  route_created: '#22c55e', route_deleted: '#ef4444', acl_created: '#3b82f6', acl_deleted: '#ef4444',
}

export default function HistoryPage({ onSelect }: { onSelect: (id: number) => void }) {
  const [histTab, setHistTab] = useState<HistoryTab>('flows')
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.getFlows(),
      api.listPolicyEvents(50),
    ]).then(([f, e]) => {
      setFlows(f as FlowSummary[])
      setEvents(e as any[])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const filtered = flows.filter(f => {
    const matchSearch = !search ||
      f.src_ip.includes(search) ||
      f.dst_ip.includes(search) ||
      (f.application || '').toLowerCase().includes(search.toLowerCase()) ||
      f.analyst.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || f.status === statusFilter
    return matchSearch && matchStatus
  })

  const counts: Record<string, number> = { validated: 0, deployed: 0, rejected: 0, pending: 0 }
  flows.forEach(f => { if (counts[f.status] !== undefined) counts[f.status]++ })

  return (
    <>
      <div className="page-header">
        <h2>Historique des flux</h2>
        <p>Toutes les demandes d'ouverture de flux enregistrées</p>
      </div>
      <div className="page-content">

        {/* Tabs */}
        <div className="script-tabs mb-4">
          <button className={`script-tab${histTab === 'flows' ? ' active' : ''}`} onClick={() => setHistTab('flows')}>📋 Flux IP</button>
          <button className={`script-tab${histTab === 'events' ? ' active' : ''}`} onClick={() => setHistTab('events')}>🔔 Événements politiques réseau</button>
        </div>

        {histTab === 'events' ? (
          <div className="card">
            <div className="card-title">Journal des modifications — Tables de routage & ACL</div>
            {loading ? <div className="empty-state"><div className="spinner" /></div> : events.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">📭</div><div>Aucun événement enregistré</div></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {events.map(e => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8, borderLeft: `3px solid ${EVENT_COLOR[e.event_type] || '#64748b'}` }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>{EVENT_ICON[e.event_type] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 500 }}>{e.description}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{e.equipment_name}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
        <>

        {/* KPI bar */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
          {Object.entries(counts).map(([status, count]) => (
            <div key={status} style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderLeft: `3px solid ${STATUS_BAR_COLOR[status]}`, borderRadius: 8, padding: '10px 14px' }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_BAR_COLOR[status] }}>{count}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{STATUS_LABEL[status]}</div>
            </div>
          ))}
        </div>

        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => setStatusFilter(f.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', fontWeight: statusFilter === f.key ? 700 : 400,
                    background: statusFilter === f.key ? 'var(--blue)' : 'var(--bg-input)',
                    color: statusFilter === f.key ? '#fff' : 'var(--text-2)',
                    border: statusFilter === f.key ? '1px solid var(--blue)' : '1px solid var(--border)',
                  }}
                >{f.label}</button>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <input
              className="form-input"
              style={{ width: 220 }}
              placeholder="Rechercher IP, appli, analyste…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <span style={{ fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
          </div>

          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📭</div>
              <div>Aucun flux trouvé</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Date</th>
                    <th>Source</th>
                    <th>Destination</th>
                    <th>Port / Proto</th>
                    <th>Application</th>
                    <th>Analyste</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr
                      key={f.id}
                      style={{ cursor: 'pointer', borderLeft: `3px solid ${STATUS_BAR_COLOR[f.status] || 'transparent'}` }}
                      onClick={() => setSelectedId(f.id)}
                    >
                      <td className="text-dimmed">{f.id}</td>
                      <td className="text-sm text-muted">{new Date(f.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="mono">{f.src_ip}</td>
                      <td className="mono">{f.dst_ip}</td>
                      <td className="mono">{f.port}/{f.protocol.toUpperCase()}</td>
                      <td className="text-muted">{f.application || '—'}</td>
                      <td className="text-muted">{f.analyst}</td>
                      <td><span className={`badge ${STATUS_BADGE[f.status] || 'badge-pending'}`}>{STATUS_LABEL[f.status] || f.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        </>
        )} {/* end histTab ternary */}

      {selectedId !== null && (
        <FlowDetailModal
          flowId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => { setSelectedId(null); load() }}
          onStatusChanged={load}
        />
      )}
      </div>{/* end page-content */}
    </>
  )
}
