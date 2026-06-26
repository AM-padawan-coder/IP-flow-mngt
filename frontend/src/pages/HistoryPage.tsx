import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { FlowSummary } from '../types'

const STATUS_BADGE: Record<string, string> = {
  validated: 'badge-ok',
  deployed:  'badge-deployed',
  rejected:  'badge-error',
  pending:   'badge-pending',
}
const STATUS_LABEL: Record<string, string> = {
  validated: 'Validé',
  deployed:  'Déployé',
  rejected:  'Refusé',
  pending:   'En attente',
}

export default function HistoryPage({ onSelect }: { onSelect: (id: number) => void }) {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    api.getFlows().then((data) => {
      setFlows(data as FlowSummary[])
      setLoading(false)
    })
  }, [])

  const filtered = flows.filter(f =>
    !filter ||
    f.src_ip.includes(filter) ||
    f.dst_ip.includes(filter) ||
    (f.application || '').toLowerCase().includes(filter.toLowerCase()) ||
    f.analyst.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <>
      <div className="page-header">
        <h2>Historique des flux</h2>
        <p>Toutes les demandes d'ouverture de flux enregistrées</p>
      </div>
      <div className="page-content">
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <div className="card-title" style={{ marginBottom: 0 }}>
              {filtered.length} demande{filtered.length !== 1 ? 's' : ''}
            </div>
            <input
              className="form-input"
              style={{ width: 240 }}
              placeholder="Filtrer par IP, application, analyste…"
              value={filter}
              onChange={e => setFilter(e.target.value)}
            />
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
                    <th>Port/Proto</th>
                    <th>Application</th>
                    <th>Analyste</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(f => (
                    <tr key={f.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(f.id)}>
                      <td className="text-dimmed">{f.id}</td>
                      <td className="text-sm text-muted">{new Date(f.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
                      <td className="mono">{f.src_ip}</td>
                      <td className="mono">{f.dst_ip}</td>
                      <td className="mono">{f.port}/{f.protocol.toUpperCase()}</td>
                      <td className="text-muted">{f.application || '—'}</td>
                      <td className="text-muted">{f.analyst}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[f.status] || 'badge-pending'}`}>
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
    </>
  )
}
