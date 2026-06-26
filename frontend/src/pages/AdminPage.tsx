import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Zone, Equipment, Network } from '../types'

type Tab = 'equipment' | 'zones' | 'networks' | 'links'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('equipment')
  const [zones, setZones] = useState<Zone[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [physZones, setPhysZones] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [z, e, n, l, t, p] = await Promise.all([
      api.getZones(), api.getEquipment(), api.getNetworks(),
      api.getLinks(), api.getTeams(), api.getPhysicalZones(),
    ])
    setZones(z as Zone[]); setEquipment(e as Equipment[])
    setNetworks(n as Network[]); setLinks(l as any[])
    setTeams(t as any[]); setPhysZones(p as any[])
  }

  useEffect(() => { load() }, [])

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const TABS = [
    { id: 'equipment', label: 'Équipements' },
    { id: 'zones',     label: 'Zones logiques' },
    { id: 'networks',  label: 'Réseaux' },
    { id: 'links',     label: 'Liens topo' },
  ] as const

  return (
    <>
      <div className="page-header">
        <h2>Administration topologie</h2>
        <p>Créer, modifier et supprimer les éléments de l'architecture réseau</p>
      </div>
      <div className="page-content">
        {msg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, color: 'var(--green)', fontSize: 13 }}>✓ {msg}</div>}

        <div className="script-tabs mb-4">
          {TABS.map(t => <button key={t.id} className={`script-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id as Tab)}>{t.label}</button>)}
        </div>

        {tab === 'equipment' && <EquipmentAdmin equipment={equipment} zones={zones} teams={teams} physZones={physZones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'zones'     && <ZoneAdmin zones={zones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'networks'  && <NetworkAdmin networks={networks} zones={zones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'links'     && <LinkAdmin links={links} equipment={equipment} onDone={async (m) => { await load(); notify(m) }} />}
      </div>
    </>
  )
}

// ── Equipment admin ─────────────────────────────────────────────────────────
function EquipmentAdmin({ equipment, zones: _z, teams, physZones, onDone }: any) {
  const blank = { name: '', type: 'firewall', vendor: 'stormshield', model: '', management_ip: '', description: '', team_id: '', physical_zone_id: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, team_id: form.team_id ? Number(form.team_id) : null, physical_zone_id: form.physical_zone_id ? Number(form.physical_zone_id) : null }
    if (editing) { await api.updateEquipment(editing, payload) } else { await api.createEquipment(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `${form.name} mis à jour` : `${form.name} créé`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer ${name} ?`)) return
    await api.deleteEquipment(id); onDone(`${name} supprimé`)
  }

  const edit = (e: any) => {
    setForm({ name: e.name, type: e.type, vendor: e.vendor, model: e.model, management_ip: e.management_ip, description: e.description, team_id: e.team_id ?? '', physical_zone_id: e.physical_zone_id ?? '' })
    setEditing(e.id)
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier équipement' : 'Nouvel équipement'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[['name','Nom *',''],['model','Modèle',''],['management_ip','IP Management',''],['description','Description','']].map(([k, label]) => (
            <div key={k} className="form-group">
              <label className="form-label">{label}</label>
              <input className="form-input" value={(form as any)[k]} onChange={e => set(k, e.target.value)} />
            </div>
          ))}
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {['firewall','router','switch','nsx'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Vendor</label>
              <select className="form-select" value={form.vendor} onChange={e => set('vendor', e.target.value)}>
                {['stormshield','paloalto','juniper','nsx','fortinet','checkpoint'].map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Équipe</label>
              <select className="form-select" value={form.team_id} onChange={e => set('team_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Zone physique</label>
              <select className="form-select" value={form.physical_zone_id} onChange={e => set('physical_zone_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {physZones.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Équipements existants ({equipment.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {equipment.map((e: any) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
              <span className={`vendor-badge vendor-${e.vendor}`}>{e.vendor}</span>
              <span style={{ flex: 1, fontWeight: 500 }}>{e.name}</span>
              <span className="text-xs text-dimmed">{e.model}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(e)}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(e.id, e.name)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Zone admin ──────────────────────────────────────────────────────────────
function ZoneAdmin({ zones, onDone }: any) {
  const blank = { name: '', color: '#3b82f6', description: '', trust_level: '50', zone_type: 'logical' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, trust_level: Number(form.trust_level) }
    if (editing) { await api.updateZone(editing, payload) } else { await api.createZone(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `Zone ${form.name} mise à jour` : `Zone ${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer la zone ${name} ?`)) return
    await api.deleteZone(id); onDone(`Zone ${name} supprimée`)
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier zone' : 'Nouvelle zone'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Couleur</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
                <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.zone_type} onChange={e => set('zone_type', e.target.value)}>
                <option value="logical">Logique</option>
                <option value="physical">Physique</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Niveau de confiance : {form.trust_level}%</label>
            <input type="range" min="0" max="100" value={form.trust_level} onChange={e => set('trust_level', e.target.value)} style={{ width: '100%', accentColor: 'var(--blue)' }} />
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Zones existantes ({zones.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {zones.map((z: any) => (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{z.name}</span>
              <span className="badge badge-info text-xs">{z.trust_level}%</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ name: z.name, color: z.color, description: z.description, trust_level: String(z.trust_level), zone_type: z.zone_type }); setEditing(z.id) }}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(z.id, z.name)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Network admin ───────────────────────────────────────────────────────────
function NetworkAdmin({ networks, zones, onDone }: any) {
  const blank = { name: '', cidr: '', zone_id: '', vlan_id: '', gateway: '', description: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, zone_id: Number(form.zone_id), vlan_id: form.vlan_id ? Number(form.vlan_id) : null }
    if (editing) { await api.updateNetwork(editing, payload) } else { await api.createNetwork(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `Réseau mis à jour` : `Réseau ${form.name} créé`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer le réseau ${name} ?`)) return
    await api.deleteNetwork(id); onDone(`Réseau ${name} supprimé`)
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier réseau' : 'Nouveau réseau'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" placeholder="LAN-BUREAUTIQUE" value={form.name} onChange={e => set('name', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">CIDR *</label><input className="form-input mono" placeholder="10.10.0.0/16" value={form.cidr} onChange={e => set('cidr', e.target.value)} /></div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Zone *</label>
              <select className="form-select" value={form.zone_id} onChange={e => set('zone_id', e.target.value)}>
                <option value="">— Choisir —</option>
                {zones.map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">VLAN ID</label><input className="form-input mono" placeholder="10" value={form.vlan_id} onChange={e => set('vlan_id', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">Passerelle</label><input className="form-input mono" placeholder="10.10.0.1" value={form.gateway} onChange={e => set('gateway', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name || !form.cidr || !form.zone_id}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Réseaux existants ({networks.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {networks.map((n: any) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: n.zone_color }} />
              <span className="mono text-sm" style={{ flex: 1 }}>{n.cidr}</span>
              <span className="text-xs text-muted">{n.name}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ name: n.name, cidr: n.cidr, zone_id: String(n.zone_id), vlan_id: n.vlan_id ? String(n.vlan_id) : '', gateway: n.gateway, description: n.description }); setEditing(n.id) }}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(n.id, n.name)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Link admin ──────────────────────────────────────────────────────────────
function LinkAdmin({ links, equipment, onDone }: any) {
  const blank = { equipment_a_id: '', equipment_b_id: '', link_type: 'ethernet', description: '' }
  const [form, setForm] = useState(blank)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    await api.createLink({ ...form, equipment_a_id: Number(form.equipment_a_id), equipment_b_id: Number(form.equipment_b_id) })
    setForm(blank)
    onDone('Lien créé')
  }

  const del = async (id: number) => {
    if (!confirm('Supprimer ce lien ?')) return
    await api.deleteLink(id); onDone('Lien supprimé')
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">Nouveau lien</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Équipement A *</label>
            <select className="form-select" value={form.equipment_a_id} onChange={e => set('equipment_a_id', e.target.value)}>
              <option value="">— Choisir —</option>
              {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Équipement B *</label>
            <select className="form-select" value={form.equipment_b_id} onChange={e => set('equipment_b_id', e.target.value)}>
              <option value="">— Choisir —</option>
              {equipment.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Type de lien</label>
            <select className="form-select" value={form.link_type} onChange={e => set('link_type', e.target.value)}>
              <option value="ethernet">Ethernet</option>
              <option value="logical">Logique</option>
              <option value="vxlan">VXLAN</option>
              <option value="lag">LAG / LACP</option>
            </select>
          </div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <button className="btn btn-primary mt-2" onClick={save} disabled={!form.equipment_a_id || !form.equipment_b_id}>Créer le lien</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Liens existants ({links.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {links.map((l: any) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{l.equipment_a_name}</span>
              <span className="text-dimmed">↔</span>
              <span style={{ fontWeight: 500, fontSize: 12 }}>{l.equipment_b_name}</span>
              <span className="badge badge-info text-xs" style={{ marginLeft: 'auto' }}>{l.link_type}</span>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(l.id)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
