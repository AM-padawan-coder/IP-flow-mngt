import { useEffect, useState } from 'react'
import { api } from '../api/client'

type Tab = 'routing' | 'acl'

const ROUTE_TYPES = ['static', 'connected', 'ospf', 'bgp']
const DIRECTIONS = ['in', 'out', 'both']
const ACTIONS = ['permit', 'deny']

const EMPTY_ROUTE = { equipment_id: 0, destination: '', gateway: '', interface: '', metric: 1, route_type: 'static', comment: '' }
const EMPTY_ACL = { equipment_id: 0, priority: 100, name: '', direction: 'in', action: 'permit', src_ip: 'any', dst_ip: 'any', port: 'any', protocol: 'any', comment: '', flow_id: undefined as number | undefined }

export default function PolicyPage() {
  const [tab, setTab] = useState<Tab>('routing')
  const [equipment, setEquipment] = useState<any[]>([])
  const [selectedEq, setSelectedEq] = useState<number | ''>('')
  const [routes, setRoutes] = useState<any[]>([])
  const [acls, setAcls] = useState<any[]>([])
  const [flows, setFlows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddRoute, setShowAddRoute] = useState(false)
  const [showAddAcl, setShowAddAcl] = useState(false)
  const [routeForm, setRouteForm] = useState({ ...EMPTY_ROUTE })
  const [aclForm, setAclForm] = useState({ ...EMPTY_ACL })
  const [generating, setGenerating] = useState(false)
  const [genFlowId, setGenFlowId] = useState<number | ''>('')
  const [genResult, setGenResult] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'route' | 'acl'; id: number } | null>(null)

  useEffect(() => {
    api.listPolicyEquipment().then((d: any) => setEquipment(d))
    api.getFlows().then((d: any) => setFlows((d as any[]).filter(f => f.status === 'validated' || f.status === 'deployed')))
  }, [])

  useEffect(() => {
    if (!selectedEq) { setRoutes([]); setAcls([]); return }
    setLoading(true)
    Promise.all([
      api.listRouting(selectedEq as number),
      api.listAcl(selectedEq as number),
    ]).then(([r, a]: any) => { setRoutes(r); setAcls(a); setLoading(false) })
  }, [selectedEq])

  const addRoute = async () => {
    if (!routeForm.destination || !selectedEq) return
    await api.createRoute({ ...routeForm, equipment_id: selectedEq })
    setShowAddRoute(false)
    setRouteForm({ ...EMPTY_ROUTE })
    const r: any = await api.listRouting(selectedEq as number)
    setRoutes(r)
  }

  const addAcl = async () => {
    if (!selectedEq) return
    await api.createAcl({ ...aclForm, equipment_id: selectedEq })
    setShowAddAcl(false)
    setAclForm({ ...EMPTY_ACL })
    const a: any = await api.listAcl(selectedEq as number)
    setAcls(a)
  }

  const deleteRoute = async (id: number) => {
    await api.deleteRoute(id)
    setDeleteConfirm(null)
    const r: any = await api.listRouting(selectedEq as number)
    setRoutes(r)
  }

  const deleteAcl = async (id: number) => {
    await api.deleteAcl(id)
    setDeleteConfirm(null)
    const a: any = await api.listAcl(selectedEq as number)
    setAcls(a)
  }

  const generateFromFlow = async () => {
    if (!genFlowId) return
    setGenerating(true)
    const result: any = await api.generateFromFlow(genFlowId as number)
    setGenResult(result)
    setGenerating(false)
    if (selectedEq) {
      const a: any = await api.listAcl(selectedEq as number)
      setAcls(a)
    }
  }

  const inputStyle = { padding: '6px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-1)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }
  const btnPrimary = { padding: '6px 14px', background: 'var(--blue)', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }
  const btnGhost = { padding: '6px 12px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }
  const btnDanger = { padding: '4px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', borderRadius: 5, color: '#ef4444', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }

  return (
    <>
      <div className="page-header">
        <h2>Politiques réseau</h2>
        <p>Tables de routage et règles ACL par équipement</p>
      </div>
      <div className="page-content">

        {/* Equipment selector + tab */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          <select
            value={selectedEq}
            onChange={e => setSelectedEq(e.target.value ? Number(e.target.value) : '')}
            style={{ ...inputStyle, minWidth: 220 }}
          >
            <option value="">— Choisir un équipement —</option>
            {equipment.map(eq => (
              <option key={eq.id} value={eq.id}>{eq.name} ({eq.type || eq.vendor || ''})</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 4 }}>
            {([['routing', '🗺 Tables de routage'], ['acl', '🔒 ACL']] as [Tab, string][]).map(([t, l]) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: tab === t ? 700 : 400, background: tab === t ? 'var(--blue)' : 'var(--bg-input)', color: tab === t ? '#fff' : 'var(--text-2)', border: tab === t ? '1px solid var(--blue)' : '1px solid var(--border)' }}>{l}</button>
            ))}
          </div>
        </div>

        {!selectedEq ? (
          <div className="card">
            <div className="empty-state">
              <div className="empty-state-icon">🔌</div>
              <div>Sélectionnez un équipement pour voir ses politiques</div>
            </div>
          </div>
        ) : loading ? (
          <div className="card"><div className="empty-state"><div className="spinner" /></div></div>
        ) : tab === 'routing' ? (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div className="card-title" style={{ marginBottom: 0 }}>{routes.length} entrée{routes.length !== 1 ? 's' : ''}</div>
              <button style={btnPrimary} onClick={() => setShowAddRoute(!showAddRoute)}>+ Ajouter une route</button>
            </div>

            {showAddRoute && (
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Destination (CIDR) *
                  <input style={inputStyle} placeholder="10.0.0.0/8" value={routeForm.destination} onChange={e => setRouteForm(f => ({ ...f, destination: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Passerelle (next-hop)
                  <input style={inputStyle} placeholder="192.168.1.254" value={routeForm.gateway} onChange={e => setRouteForm(f => ({ ...f, gateway: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Interface
                  <input style={inputStyle} placeholder="eth0" value={routeForm.interface} onChange={e => setRouteForm(f => ({ ...f, interface: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Métrique
                  <input style={inputStyle} type="number" min={1} value={routeForm.metric} onChange={e => setRouteForm(f => ({ ...f, metric: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Type
                  <select style={inputStyle} value={routeForm.route_type} onChange={e => setRouteForm(f => ({ ...f, route_type: e.target.value }))}>
                    {ROUTE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Commentaire
                  <input style={inputStyle} placeholder="Optionnel" value={routeForm.comment} onChange={e => setRouteForm(f => ({ ...f, comment: e.target.value }))} />
                </label>
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={btnGhost} onClick={() => setShowAddRoute(false)}>Annuler</button>
                  <button style={btnPrimary} onClick={addRoute}>Enregistrer</button>
                </div>
              </div>
            )}

            {routes.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-state-icon">🗺</div>
                <div>Aucune route configurée</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Destination</th><th>Passerelle</th><th>Interface</th><th>Métrique</th><th>Type</th><th>Commentaire</th><th></th></tr></thead>
                  <tbody>
                    {routes.map((r: any) => (
                      <tr key={r.id}>
                        <td className="mono">{r.destination}</td>
                        <td className="mono">{r.gateway || '—'}</td>
                        <td className="mono">{r.interface || '—'}</td>
                        <td>{r.metric}</td>
                        <td><span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--bg-input)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>{r.route_type}</span></td>
                        <td className="text-muted">{r.comment || '—'}</td>
                        <td>
                          {deleteConfirm?.type === 'route' && deleteConfirm.id === r.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button style={btnDanger} onClick={() => deleteRoute(r.id)}>Confirmer</button>
                              <button style={btnGhost} onClick={() => setDeleteConfirm(null)}>✕</button>
                            </div>
                          ) : (
                            <button style={btnDanger} onClick={() => setDeleteConfirm({ type: 'route', id: r.id })}>🗑</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* ACL tab */
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8, flexWrap: 'wrap' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>{acls.length} règle{acls.length !== 1 ? 's' : ''}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {/* Generate from flow */}
                <select
                  value={genFlowId}
                  onChange={e => { setGenFlowId(e.target.value ? Number(e.target.value) : ''); setGenResult(null) }}
                  style={{ ...inputStyle, minWidth: 180 }}
                >
                  <option value="">Générer depuis un flux…</option>
                  {flows.map((f: any) => (
                    <option key={f.id} value={f.id}>#{f.id} {f.src_ip}→{f.dst_ip}:{f.port}</option>
                  ))}
                </select>
                <button
                  style={{ ...btnPrimary, background: genFlowId ? '#8b5cf6' : 'var(--bg-input)', color: genFlowId ? '#fff' : 'var(--text-3)', border: genFlowId ? 'none' : '1px solid var(--border)', cursor: genFlowId ? 'pointer' : 'default' }}
                  onClick={generateFromFlow}
                  disabled={!genFlowId || generating}
                >{generating ? '⏳' : '⚡ Générer'}</button>
                <button style={btnPrimary} onClick={() => setShowAddAcl(!showAddAcl)}>+ Ajouter une règle</button>
              </div>
            </div>

            {genResult && (
              <div style={{ marginBottom: 12, padding: '10px 14px', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 8, fontSize: 12 }}>
                <strong style={{ color: '#c4b5fd' }}>⚡ {genResult.generated} règle{genResult.generated !== 1 ? 's' : ''} générée{genResult.generated !== 1 ? 's' : ''}</strong>
                {genResult.equipment?.length > 0 && <span style={{ color: 'var(--text-2)', marginLeft: 8 }}>sur : {genResult.equipment.join(', ')}</span>}
              </div>
            )}

            {showAddAcl && (
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Nom / Description
                  <input style={inputStyle} placeholder="ex: Autoriser HTTPS LAN" value={aclForm.name} onChange={e => setAclForm(f => ({ ...f, name: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Priorité
                  <input style={inputStyle} type="number" min={1} value={aclForm.priority} onChange={e => setAclForm(f => ({ ...f, priority: Number(e.target.value) }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Direction
                  <select style={inputStyle} value={aclForm.direction} onChange={e => setAclForm(f => ({ ...f, direction: e.target.value }))}>
                    {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Action
                  <select style={inputStyle} value={aclForm.action} onChange={e => setAclForm(f => ({ ...f, action: e.target.value }))}>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  IP Source
                  <input style={inputStyle} placeholder="any" value={aclForm.src_ip} onChange={e => setAclForm(f => ({ ...f, src_ip: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  IP Destination
                  <input style={inputStyle} placeholder="any" value={aclForm.dst_ip} onChange={e => setAclForm(f => ({ ...f, dst_ip: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Port
                  <input style={inputStyle} placeholder="any / 443 / 80,443" value={aclForm.port} onChange={e => setAclForm(f => ({ ...f, port: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)' }}>
                  Protocole
                  <input style={inputStyle} placeholder="any / tcp / udp" value={aclForm.protocol} onChange={e => setAclForm(f => ({ ...f, protocol: e.target.value }))} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--text-3)', gridColumn: '1/-1' }}>
                  Commentaire
                  <input style={inputStyle} placeholder="Optionnel" value={aclForm.comment} onChange={e => setAclForm(f => ({ ...f, comment: e.target.value }))} />
                </label>
                <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={btnGhost} onClick={() => setShowAddAcl(false)}>Annuler</button>
                  <button style={btnPrimary} onClick={addAcl}>Enregistrer</button>
                </div>
              </div>
            )}

            {acls.length === 0 ? (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-state-icon">🔒</div>
                <div>Aucune règle ACL configurée</div>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Prio</th><th>Nom</th><th>Dir.</th><th>Action</th><th>Source</th><th>Destination</th><th>Port</th><th>Proto</th><th>Flux</th><th></th></tr></thead>
                  <tbody>
                    {acls.map((r: any) => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.priority}</td>
                        <td className="text-muted">{r.name || '—'}</td>
                        <td><span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>{r.direction}</span></td>
                        <td>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700, background: r.action === 'permit' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: r.action === 'permit' ? '#22c55e' : '#ef4444' }}>
                            {r.action}
                          </span>
                        </td>
                        <td className="mono">{r.src_ip}</td>
                        <td className="mono">{r.dst_ip}</td>
                        <td className="mono">{r.port}</td>
                        <td className="mono">{r.protocol}</td>
                        <td className="text-dimmed">{r.flow_id ? `#${r.flow_id}` : '—'}</td>
                        <td>
                          {deleteConfirm?.type === 'acl' && deleteConfirm.id === r.id ? (
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button style={btnDanger} onClick={() => deleteAcl(r.id)}>Confirmer</button>
                              <button style={btnGhost} onClick={() => setDeleteConfirm(null)}>✕</button>
                            </div>
                          ) : (
                            <button style={btnDanger} onClick={() => setDeleteConfirm({ type: 'acl', id: r.id })}>🗑</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
