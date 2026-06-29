import { useEffect, useState } from 'react'
import { api } from '../api/client'
import FlowDetailModal from '../components/FlowDetailModal'
import DocxExportModal from '../components/DocxExportModal'

const STATUS_LABEL: Record<string, string> = { validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente' }
const STATUS_COLOR: Record<string, string> = { validated: '#22c55e', deployed: '#3b82f6', rejected: '#ef4444', pending: '#eab308' }


const STATUS_FILTERS = [
  { key: 'validated', label: 'Validé' },
  { key: 'deployed', label: 'Déployé' },
  { key: 'pending', label: 'En attente' },
  { key: 'rejected', label: 'Refusé' },
]

export default function FlowsTopologyPage() {
  const [flows, setFlows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilters, setStatusFilters] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [exportFormat, setExportFormat] = useState<'csv' | 'docx' | null>(null)

  const load = () => {
    setLoading(true)
    api.getFlows().then((f: any) => { setFlows(f); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const toggleStatus = (key: string) => {
    setStatusFilters(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    )
  }

  const filtered = flows.filter(f => {
    const matchSearch = !search ||
      f.src_ip.includes(search) || f.dst_ip.includes(search) ||
      (f.application || '').toLowerCase().includes(search.toLowerCase()) ||
      f.analyst.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilters.length === 0 || statusFilters.includes(f.status)
    return matchSearch && matchStatus
  })

  return (
    <>
      <div className="page-header">
        <h2>Flux IP</h2>
        <p>Liste des demandes de flux — vue topologie</p>
      </div>
      <div className="page-content">

        {/* Filters + export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {STATUS_FILTERS.map(f => {
              const active = statusFilters.includes(f.key)
              const color = STATUS_COLOR[f.key]
              return (
                <button
                  key={f.key}
                  onClick={() => toggleStatus(f.key)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                    fontWeight: active ? 700 : 400,
                    background: active ? `${color}22` : 'var(--bg-input)',
                    color: active ? color : 'var(--text-2)',
                    border: active ? `1px solid ${color}` : '1px solid var(--border)',
                    transition: 'all 0.15s',
                  }}
                >
                  {active && '✓ '}{f.label}
                </button>
              )
            })}
            {statusFilters.length > 0 && (
              <button
                onClick={() => setStatusFilters([])}
                style={{ padding: '4px 8px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border)' }}
              >✕</button>
            )}
          </div>
          <input
            className="form-input"
            style={{ flex: '1 1 260px', maxWidth: 400, minWidth: 260 }}
            placeholder="Rechercher IP, application, analyste…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} flux</span>
          <button
            onClick={() => setExportFormat('csv')}
            style={{ padding: '6px 14px', background: '#16a34a', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <i className="ti ti-file-spreadsheet" /> Export Excel (CSV)
          </button>
          <button
            onClick={() => setExportFormat('docx')}
            style={{ padding: '6px 14px', background: '#2563eb', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <i className="ti ti-file-word" /> Export Word
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><i className="ti ti-file-search" style={{ fontSize: 28 }} aria-hidden="true" /></div>
              <div>Aucun flux trouvé</div>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Date</th><th>Source</th><th>Destination</th>
                    <th>Port / Proto</th><th>Application</th><th>Analyste</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} style={{ cursor: 'pointer', borderLeft: `3px solid ${STATUS_COLOR[f.status] || 'transparent'}` }} onClick={() => setSelectedId(f.id)}>
                      <td className="text-dimmed">{f.id}</td>
                      <td className="text-sm text-muted">{new Date(f.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td className="mono">{f.src_ip}</td>
                      <td className="mono">{f.dst_ip}</td>
                      <td className="mono">{f.port}/{f.protocol?.toUpperCase()}</td>
                      <td className="text-muted">{f.application || '—'}</td>
                      <td className="text-muted">{f.analyst}</td>
                      <td>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: `${STATUS_COLOR[f.status] || '#64748b'}22`, color: STATUS_COLOR[f.status] || 'var(--text-3)' }}>
                          {STATUS_LABEL[f.status] || f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedId !== null && (
        <FlowDetailModal
          flowId={selectedId}
          onClose={() => setSelectedId(null)}
          onDeleted={() => { setSelectedId(null); load() }}
          onStatusChanged={load}
        />
      )}

      {exportFormat !== null && (
        <DocxExportModal
          format={exportFormat}
          onClose={() => setExportFormat(null)}
          flows={filtered}
          search={search}
          statusFilters={statusFilters}
        />
      )}
    </>
  )
}
