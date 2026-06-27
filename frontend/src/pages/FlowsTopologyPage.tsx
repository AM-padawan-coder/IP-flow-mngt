import { useEffect, useState } from 'react'
import { api } from '../api/client'
import FlowDetailModal from '../components/FlowDetailModal'

const STATUS_LABEL: Record<string, string> = { validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente' }
const STATUS_COLOR: Record<string, string> = { validated: '#22c55e', deployed: '#3b82f6', rejected: '#ef4444', pending: '#eab308' }

function exportToCsv(flows: any[]) {
  const BOM = '﻿'
  const headers = ['ID', 'Date', 'IP Source', 'IP Destination', 'Port', 'Protocole', 'Application', 'Analyste', 'Statut', 'Justification']
  const rows = flows.map(f => [
    f.id,
    new Date(f.created_at).toLocaleDateString('fr-FR'),
    f.src_ip,
    f.dst_ip,
    f.port,
    f.protocol?.toUpperCase(),
    f.application || '',
    f.analyst,
    STATUS_LABEL[f.status] || f.status,
    '', // justification not in summary — would need full flow fetch
  ])
  const csv = BOM + [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = 'matrice-flux.csv'; a.click()
  URL.revokeObjectURL(url)
}

const STATUS_FILTERS = [
  { key: '', label: 'Tous' },
  { key: 'validated', label: 'Validé' },
  { key: 'deployed', label: 'Déployé' },
  { key: 'pending', label: 'En attente' },
  { key: 'rejected', label: 'Refusé' },
]

export default function FlowsTopologyPage() {
  const [flows, setFlows] = useState<any[]>([])
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [eqFilter, setEqFilter] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([api.getFlows(), api.listPolicyEquipment()]).then(([f, e]: any) => {
      setFlows(f)
      setEquipment(e)
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [])

  const filtered = flows.filter(f => {
    const matchSearch = !search ||
      f.src_ip.includes(search) || f.dst_ip.includes(search) ||
      (f.application || '').toLowerCase().includes(search.toLowerCase()) ||
      f.analyst.toLowerCase().includes(search.toLowerCase())
    const matchStatus = !statusFilter || f.status === statusFilter
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
          <div style={{ display: 'flex', gap: 4 }}>
            {STATUS_FILTERS.map(f => (
              <button key={f.key} onClick={() => setStatusFilter(f.key)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer', fontWeight: statusFilter === f.key ? 700 : 400, background: statusFilter === f.key ? 'var(--blue)' : 'var(--bg-input)', color: statusFilter === f.key ? '#fff' : 'var(--text-2)', border: statusFilter === f.key ? '1px solid var(--blue)' : '1px solid var(--border)' }}>
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={eqFilter}
            onChange={e => setEqFilter(e.target.value)}
            style={{ padding: '4px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', fontSize: 12, fontFamily: 'inherit' }}
          >
            <option value="">Tous les équipements</option>
            {equipment.map((e: any) => <option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
          <input
            className="form-input"
            style={{ width: 200 }}
            placeholder="Rechercher IP, appli…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{filtered.length} flux</span>
          <button
            onClick={() => exportToCsv(filtered)}
            style={{ padding: '6px 14px', background: '#22c55e', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}
          >
            ⬇ Exporter Excel (CSV)
          </button>
        </div>

        <div className="card">
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
    </>
  )
}
