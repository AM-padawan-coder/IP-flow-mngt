import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Props {
  equipment: { id: number; name: string; type: string; vendor: string; model?: string; management_ip?: string }
  onClose: () => void
}

type Tab = 'routing' | 'acl'

export default function EquipmentDetailModal({ equipment, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('routing')
  const [routes, setRoutes] = useState<any[]>([])
  const [acls, setAcls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.listRouting(equipment.id),
      api.listAcl(equipment.id),
    ]).then(([r, a]: any) => { setRoutes(r); setAcls(a); setLoading(false) })
  }, [equipment.id])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '88vw', maxWidth: 860, maxHeight: '82vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>{equipment.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {equipment.type} · {equipment.vendor}{equipment.model ? ` · ${equipment.model}` : ''}{equipment.management_ip ? ` · ${equipment.management_ip}` : ''}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, padding: '10px 20px 0', background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          {([['routing', '🗺 Table de routage'], ['acl', '🔒 Règles ACL']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: '6px 6px 0 0', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, background: tab === t ? 'var(--bg-panel)' : 'transparent', color: tab === t ? 'var(--blue)' : 'var(--text-2)', border: tab === t ? '1px solid var(--border)' : 'none', borderBottom: tab === t ? '1px solid var(--bg-panel)' : 'none', marginBottom: '-1px' }}>{l}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {loading ? (
            <div className="empty-state"><div className="spinner" /></div>
          ) : tab === 'routing' ? (
            routes.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">🗺</div><div>Aucune route configurée</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Destination</th><th>Passerelle</th><th>Interface</th><th>Métrique</th><th>Type</th><th>Commentaire</th></tr></thead>
                  <tbody>
                    {routes.map((r: any) => (
                      <tr key={r.id}>
                        <td className="mono">{r.destination}</td>
                        <td className="mono">{r.gateway || '—'}</td>
                        <td className="mono">{r.interface || '—'}</td>
                        <td>{r.metric}</td>
                        <td><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>{r.route_type}</span></td>
                        <td className="text-muted">{r.comment || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            acls.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">🔒</div><div>Aucune règle ACL configurée</div></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Prio</th><th>Nom</th><th>Direction</th><th>Action</th><th>Source</th><th>Destination</th><th>Port</th><th>Flux</th></tr></thead>
                  <tbody>
                    {acls.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.priority}</td>
                        <td className="text-muted">{r.name || '—'}</td>
                        <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>{r.direction}</span></td>
                        <td><span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: r.action === 'permit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: r.action === 'permit' ? '#22c55e' : '#ef4444' }}>{r.action}</span></td>
                        <td className="mono">{r.src_ip}</td>
                        <td className="mono">{r.dst_ip}</td>
                        <td className="mono">{r.port}/{r.protocol}</td>
                        <td className="text-dimmed">{r.flow_id ? `#${r.flow_id}` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        <div style={{ padding: '10px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {tab === 'routing' ? `${routes.length} route(s)` : `${acls.length} règle(s) ACL`}
          </div>
        </div>
      </div>
    </div>
  )
}
