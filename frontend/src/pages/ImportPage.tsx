import { useState } from 'react'
import { api } from '../api/client'

type Mode = 'json' | 'csv-equipment' | 'csv-networks' | 'csv-links' | 'json-applications'

const APPS_TEMPLATE = JSON.stringify([
  {
    name: "Mon Application",
    code: "MON-APP",
    description: "Application métier exemple",
    app_type: "Web",
    domain: "Production",
    criticality: "Moyenne",
    environment: "PROD",
    team_id: null,
    ips: [
      { ip_address: "172.16.10.50", zone_id: null },
      { ip_address: "172.16.10.51", zone_id: null }
    ]
  }
], null, 2)

const CSV_TEMPLATES = {
  'csv-equipment': `name,type,vendor,model,management_ip,description
FW-PERIM-01,firewall,stormshield,SNS-3100,192.168.200.10,Firewall périmétrique
RTR-CORE-02,router,juniper,MX204,192.168.200.41,Routeur cœur DR`,

  'csv-networks': `name,cidr,zone_name,vlan_id,gateway,description
LAN-PROD,10.30.0.0/16,LAN-UTILISATEURS,30,10.30.0.1,LAN production
SERV-BACKUP-DR,172.17.10.0/24,ZONE-SERVEURS,210,172.17.10.1,Serveurs DR`,

  'csv-links': `equipment_a,equipment_b,link_type,description
FW-INTERNE-01,RTR-CORE-01,ethernet,Lien FW-LAN vers Core
RTR-CORE-01,NSX-DFW,logical,Uplink NSX T0`,
}

const JSON_TEMPLATE = JSON.stringify({
  zones: [
    { name: "NOUVELLE-ZONE", color: "#14b8a6", description: "Zone supplémentaire", trust_level: 60, zone_type: "logical" }
  ],
  equipment: [
    { name: "FW-DR-01", type: "firewall", vendor: "fortinet", model: "FG-200F", management_ip: "192.168.201.10", description: "Firewall site DR Lyon" }
  ],
  networks: [
    { name: "LAN-DR", cidr: "10.40.0.0/16", zone_name: "LAN-UTILISATEURS", vlan_id: 40, gateway: "10.40.0.1", description: "LAN site DR" }
  ],
  links: [
    { equipment_a: "RTR-CORE-01", equipment_b: "FW-DR-01", link_type: "ethernet", description: "Lien inter-sites" }
  ]
}, null, 2)

interface Props { onNavigate?: (page: string) => void }

export default function ImportPage({ onNavigate }: Props) {
  const [mode, setMode] = useState<Mode>('json')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')

  const run = async () => {
    setLoading(true); setResult(null); setError('')
    try {
      let r: any
      if (mode === 'json') {
        const parsed = JSON.parse(content)
        r = await api.importJson(parsed)
      } else if (mode === 'csv-equipment') {
        r = await api.importCsvEquipment(content)
      } else if (mode === 'csv-networks') {
        r = await api.importCsvNetworks(content)
      } else if (mode === 'json-applications') {
        const parsed = JSON.parse(content)
        r = await api.importApplications(parsed)
      } else {
        r = await api.importCsvLinks(content)
      }
      setResult(r)
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'import')
    } finally {
      setLoading(false)
    }
  }

  const exportJson = () => {
    window.open('https://backend-web-service-python.onrender.com/topology/export/json', '_blank')
  }

  const loadTemplate = () => {
    if (mode === 'json') setContent(JSON_TEMPLATE)
    else if (mode === 'json-applications') setContent(APPS_TEMPLATE)
    else setContent(CSV_TEMPLATES[mode as keyof typeof CSV_TEMPLATES] || '')
  }

  const MODES = [
    { id: 'json',              label: 'JSON complet',       desc: 'Importe zones, équipements, réseaux et liens en une fois' },
    { id: 'csv-equipment',     label: 'CSV Équipements',    desc: 'name, type, vendor, model, management_ip, description' },
    { id: 'csv-networks',      label: 'CSV Réseaux',        desc: 'name, cidr, zone_name, vlan_id, gateway, description' },
    { id: 'csv-links',         label: 'CSV Liens topo',     desc: 'equipment_a, equipment_b, link_type, description' },
    { id: 'json-applications', label: 'JSON Applications',  desc: 'Import en masse des applications — tableau JSON (v2.9)' },
  ] as const

  return (
    <>
      <div className="page-header">
        <h2>Import / Export topologie</h2>
        <p>Importer une topologie depuis JSON ou CSV, exporter l'architecture courante</p>
      </div>
      <div className="page-content">

        <div className="grid-2 gap-4" style={{ alignItems: 'start' }}>
          {/* Modes */}
          <div>
            <div className="card mb-4">
              <div className="card-title">Format d'import</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {MODES.map(m => (
                  <div key={m.id}
                    onClick={() => { setMode(m.id as Mode); setContent(''); setResult(null) }}
                    style={{
                      padding: '10px 14px', borderRadius: 6, cursor: 'pointer',
                      border: `1px solid ${mode === m.id ? 'var(--border-focus)' : 'var(--border)'}`,
                      background: mode === m.id ? 'rgba(59,130,246,0.08)' : 'var(--bg-input)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: mode === m.id ? 'var(--blue)' : 'var(--text-1)' }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>{m.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-title">Export topologie</div>
              <p className="text-sm text-muted mb-3">Exporter toute l'architecture en JSON pour sauvegarde ou migration</p>
              <button className="btn btn-ghost" onClick={exportJson}>⬇ Télécharger topology.json</button>
            </div>

            <div className="card" style={{ marginTop: 16 }}>
              <div className="card-title">Export flux</div>
              <p className="text-sm text-muted mb-3">Consulter et exporter la matrice de flux au format Excel (CSV)</p>
              <button className="btn btn-primary" onClick={() => onNavigate?.('flows-topology')}>↔ Ouvrir la vue Flux</button>
            </div>
          </div>

          {/* Editor */}
          <div className="card">
            <div className="flex justify-between items-center mb-3">
              <div className="card-title" style={{ marginBottom: 0 }}>
                {mode === 'json' ? 'Contenu JSON' : 'Contenu CSV'}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={loadTemplate}>Charger un exemple</button>
            </div>

            <textarea
              className="form-input"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, minHeight: 320, resize: 'vertical' }}
              placeholder={mode === 'json' ? '{ "equipment": [...], "networks": [...] }' : 'name,type,vendor,...'}
              value={content}
              onChange={e => setContent(e.target.value)}
            />

            <div className="flex gap-2 mt-3">
              <button className="btn btn-primary" onClick={run} disabled={!content.trim() || loading}>
                {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Import…</> : '⬆ Importer'}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13 }}>
                ✕ {error}
              </div>
            )}

            {result && (
              <div style={{ marginTop: 12, background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 6, padding: '12px 16px' }}>
                <div style={{ fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>✓ Import terminé</div>
                {result.created && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {Object.entries(result.created).map(([k, v]) => (
                      <div key={k} style={{ background: 'var(--bg-input)', borderRadius: 4, padding: '6px 10px', fontSize: 12 }}>
                        <span className="text-muted">{k}</span>
                        <span style={{ float: 'right' }}>
                          <span style={{ color: 'var(--green)' }}>+{v as number} créés</span>
                          {' / '}
                          <span className="text-dimmed">{(result.skipped as any)[k]} ignorés</span>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {(result.created !== undefined ? false : true) && (
                  <div className="text-sm text-muted">
                    Créés : {result.created ?? '?'} · Ignorés : {result.skipped ?? '?'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
