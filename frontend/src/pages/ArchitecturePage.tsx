import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Zone, Equipment, Network } from '../types'

type Tab = 'zones' | 'equipment' | 'networks'

export default function ArchitecturePage() {
  const [tab, setTab]       = useState<Tab>('equipment')
  const [zones, setZones]   = useState<Zone[]>([])
  const [eqps, setEqps]     = useState<Equipment[]>([])
  const [nets, setNets]     = useState<Network[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.getZones()     .then(d => setZones(d as Zone[])),
      api.getEquipment() .then(d => setEqps(d as Equipment[])),
      api.getNetworks()  .then(d => setNets(d as Network[])),
    ]).finally(() => setLoading(false))
  }, [])

  return (
    <>
      <div className="page-header">
        <h2>Architecture réseau</h2>
        <p>Référentiel des équipements, zones et réseaux modélisés</p>
      </div>
      <div className="page-content">
        <div className="script-tabs mb-4">
          {(['equipment', 'zones', 'networks'] as Tab[]).map(t => (
            <button key={t} className={`script-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
              {t === 'equipment' ? `⬡ Équipements (${eqps.length})`
               : t === 'zones'  ? `◎ Zones (${zones.length})`
               :                  `⊞ Réseaux (${nets.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="empty-state"><div className="spinner" /></div>
        ) : tab === 'equipment' ? (
          <EquipmentView eqps={eqps} />
        ) : tab === 'zones' ? (
          <ZoneView zones={zones} />
        ) : (
          <NetworkView nets={nets} />
        )}
      </div>
    </>
  )
}

function EquipmentView({ eqps }: { eqps: Equipment[] }) {
  const types = [...new Set(eqps.map(e => e.type))]
  return (
    <div>
      {types.map(type => (
        <div key={type} className="mb-4">
          <div className="text-xs text-dimmed mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
            {type === 'firewall' ? '🛡 Firewalls' : type === 'router' ? '🔀 Routeurs' : type === 'nsx' ? '☁ NSX' : type}
            &nbsp;({eqps.filter(e => e.type === type).length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {eqps.filter(e => e.type === type).map(e => (
              <div key={e.id} className="eqp-card">
                <div className="eqp-header">
                  <div>
                    <div className="eqp-name">{e.name}</div>
                    <div className="eqp-model">{e.model || '—'}</div>
                  </div>
                  <span className={`vendor-badge vendor-${e.vendor}`}>{e.vendor}</span>
                </div>
                {e.description && <div className="text-xs text-muted mb-2">{e.description}</div>}
                {e.management_ip && (
                  <div className="eqp-mgmt">🖥 {e.management_ip}</div>
                )}
                <div className="eqp-ifaces">
                  {e.interfaces.map((iface, i) => (
                    <div key={i} className="eqp-iface-row">
                      <div className="zone-dot" style={{ background: iface.zone_color }} />
                      <span className="mono text-xs">{iface.name}</span>
                      <span className="mono text-xs text-muted">{iface.ip}</span>
                      <span className="text-xs text-dimmed">{iface.network_name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ZoneView({ zones }: { zones: Zone[] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
      {zones.map(z => (
        <div key={z.id} className="card" style={{ borderLeft: `3px solid ${z.color}` }}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>{z.name}</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: 11 }}>
              Confiance {z.trust_level}%
            </span>
          </div>
          <div className="text-sm text-muted mb-3">{z.description}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {z.networks.map(n => (
              <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 5 }}>
                <span className="mono text-sm">{n.cidr}</span>
                <span className="text-xs text-dimmed">{n.name}</span>
                {n.vlan_id && <span className="text-xs text-dimmed" style={{ marginLeft: 'auto' }}>VLAN {n.vlan_id}</span>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function NetworkView({ nets }: { nets: Network[] }) {
  return (
    <div className="net-cards">
      {nets.map(n => (
        <div key={n.id} className="net-card">
          <div style={{ width: 12, height: 40, borderRadius: 3, background: n.zone_color, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="net-cidr">{n.cidr}</div>
            <div className="net-name">{n.name}</div>
            <div className="net-meta">
              {n.zone} · {n.gateway && `GW ${n.gateway}`} {n.vlan_id && `· VLAN ${n.vlan_id}`}
            </div>
            {n.description && <div className="net-meta">{n.description}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
