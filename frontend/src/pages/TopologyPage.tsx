import { useEffect, useState } from 'react'
import { api } from '../api/client'
import TopologyGraph from '../components/TopologyGraph'
import type { Equipment, Network, Zone } from '../types'

type Tab = 'graph' | 'equipment' | 'networks' | 'zones' | 'links'

interface Link {
  id: number
  equipment_a_id: number
  equipment_a_name: string
  equipment_b_id: number
  equipment_b_name: string
  link_type: string
  description: string
}

interface GraphData {
  nodes: any[]
  edges: any[]
}

interface Props {
  highlightedPath?: string[]
}

export default function TopologyPage({ highlightedPath = [] }: Props) {
  const [tab, setTab] = useState<Tab>(highlightedPath.length ? 'graph' : 'graph')
  const [graph, setGraph] = useState<GraphData>({ nodes: [], edges: [] })
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [zones, setZones] = useState<Zone[]>([])
  const [links, setLinks] = useState<Link[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.getGraph().then(d => setGraph(d as GraphData)),
      api.getEquipment().then(d => setEquipment(d as Equipment[])),
      api.getNetworks().then(d => setNetworks(d as Network[])),
      api.getZones().then(d => setZones(d as Zone[])),
      api.getLinks().then(d => setLinks(d as Link[])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const TABS = [
    { id: 'graph',     label: `Graphe réseau` },
    { id: 'equipment', label: `Équipements (${equipment.length})` },
    { id: 'networks',  label: `Réseaux (${networks.length})` },
    { id: 'zones',     label: `Zones (${zones.length})` },
    { id: 'links',     label: `Liens (${links.length})` },
  ] as const

  return (
    <>
      <div className="page-header">
        <h2>Topologie réseau</h2>
        <p>Vue graphique de l'architecture et référentiel des équipements</p>
      </div>
      <div className="page-content">

        <div className="script-tabs mb-4">
          {TABS.map(t => (
            <button key={t.id} className={`script-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id as Tab)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="empty-state"><div className="spinner" /></div> : (
          <>
            {tab === 'graph' && (
              <div>
                {highlightedPath.length > 0 && (
                  <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#f97316', display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔶 Chemin mis en évidence :
                    {highlightedPath.map((name, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {i > 0 && <span style={{ color: 'rgba(249,115,22,0.5)' }}>→</span>}
                        <span style={{ background: 'rgba(249,115,22,0.15)', padding: '1px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>{name}</span>
                      </span>
                    ))}
                  </div>
                )}
                <TopologyGraph
                  nodes={graph.nodes}
                  edges={graph.edges}
                  highlightedPath={highlightedPath}
                  height={560}
                />
              </div>
            )}

            {tab === 'equipment' && <EquipmentTable equipment={equipment} onRefresh={load} />}
            {tab === 'networks'  && <NetworkTable networks={networks} onRefresh={load} />}
            {tab === 'zones'     && <ZoneTable zones={zones} onRefresh={load} />}
            {tab === 'links'     && <LinkTable links={links} onRefresh={load} />}
          </>
        )}
      </div>
    </>
  )
}

function EquipmentTable({ equipment, onRefresh }: { equipment: Equipment[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Équipements</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Type</th><th>Vendor</th><th>Modèle</th><th>IP MGMT</th><th>Équipe</th><th>Zone physique</th></tr></thead>
          <tbody>
            {equipment.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.name}</td>
                <td><span className="badge badge-info">{e.type}</span></td>
                <td><span className={`vendor-badge vendor-${e.vendor}`}>{e.vendor}</span></td>
                <td className="text-muted">{e.model || '—'}</td>
                <td className="mono">{e.management_ip || '—'}</td>
                <td className="text-muted">{(e as any).team_name || '—'}</td>
                <td className="text-muted">{(e as any).physical_zone_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetworkTable({ networks, onRefresh }: { networks: Network[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Réseaux</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>CIDR</th><th>Zone</th><th>VLAN</th><th>Passerelle</th><th>Description</th></tr></thead>
          <tbody>
            {networks.map(n => (
              <tr key={n.id}>
                <td style={{ fontWeight: 600 }}>{n.name}</td>
                <td className="mono">{n.cidr}</td>
                <td><span className="badge" style={{ background: n.zone_color + '20', color: n.zone_color }}>{n.zone}</span></td>
                <td className="mono">{n.vlan_id ?? '—'}</td>
                <td className="mono">{n.gateway || '—'}</td>
                <td className="text-muted text-sm">{n.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ZoneTable({ zones, onRefresh }: { zones: Zone[]; onRefresh: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {zones.map(z => (
        <div key={z.id} className="card" style={{ borderLeft: `3px solid ${z.color}` }}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color }} />
            <span style={{ fontWeight: 700 }}>{z.name}</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: 10 }}>Confiance {z.trust_level}%</span>
          </div>
          <div className="text-sm text-muted mb-2">{z.description}</div>
          {z.networks.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
              <span className="mono">{n.cidr}</span>
              <span className="text-dimmed">{n.name}</span>
              {n.vlan_id && <span className="text-dimmed" style={{ marginLeft: 'auto' }}>VLAN {n.vlan_id}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function LinkTable({ links, onRefresh }: { links: Link[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Liens de topologie</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Équipement A</th><th></th><th>Équipement B</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            {links.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.equipment_a_name}</td>
                <td style={{ color: 'var(--text-3)', textAlign: 'center' }}>↔</td>
                <td style={{ fontWeight: 600 }}>{l.equipment_b_name}</td>
                <td><span className="badge badge-info">{l.link_type}</span></td>
                <td className="text-muted text-sm">{l.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
