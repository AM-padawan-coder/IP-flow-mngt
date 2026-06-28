import React, { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { Zone, Equipment, Network } from '../types'
import EquipmentDetailModal from '../components/EquipmentDetailModal'

type Tab = 'equipment' | 'zones' | 'physzones' | 'networks' | 'links' | 'vrf' | 'applications' | 'environments'

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('equipment')
  const [zones, setZones] = useState<Zone[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [links, setLinks] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [physZones, setPhysZones] = useState<any[]>([])
  const [vrfs, setVrfs] = useState<any[]>([])
  const [applications, setApplications] = useState<any[]>([])
  const [environments, setEnvironments] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    const [z, e, n, l, t, p, v, apps, envs] = await Promise.all([
      api.getZones(), api.getEquipment(), api.getNetworks(),
      api.getLinks(), api.getTeams(), api.getPhysicalZones(),
      api.getOverlayVRF(), api.getApplications(), api.getEnvironments(),
    ])
    setZones(z as Zone[]); setEquipment(e as Equipment[])
    setNetworks(n as Network[]); setLinks(l as any[])
    setTeams(t as any[]); setPhysZones(p as any[])
    setVrfs(v as any[]); setApplications(apps as any[])
    setEnvironments(envs as any[])
  }

  useEffect(() => { load() }, [])

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  const TABS = [
    { id: 'equipment',    label: 'Équipements' },
    { id: 'zones',        label: 'Zones logiques' },
    { id: 'physzones',    label: 'Zones physiques' },
    { id: 'networks',     label: 'Réseaux' },
    { id: 'links',        label: 'Liens topo' },
    { id: 'vrf',          label: 'VRF' },
    { id: 'applications', label: 'Applications' },
    { id: 'environments', label: 'Environnements' },
  ] as const

  return (
    <>
      <div className="page-header">
        <h2>Configuration topologie</h2>
        <p>Créer, modifier et supprimer les éléments de l'architecture réseau</p>
      </div>
      <div className="page-content">
        {msg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, color: 'var(--green)', fontSize: 13 }}>✓ {msg}</div>}

        <div className="script-tabs mb-4">
          {TABS.map(t => <button key={t.id} className={`script-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id as Tab)}>{t.label}</button>)}
        </div>

        {tab === 'equipment' && <EquipmentAdmin equipment={equipment} zones={zones} teams={teams} physZones={physZones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'zones'     && <LogicalZoneAdmin zones={zones} physZones={physZones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'physzones' && <PhysZoneAdmin physZones={physZones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'networks'  && <NetworkAdmin networks={networks} zones={zones} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'links'     && <LinkAdmin links={links} equipment={equipment} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'vrf'          && <VrfAdmin vrfs={vrfs} equipment={equipment} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'applications' && <ApplicationAdmin applications={applications} zones={zones} teams={teams} environments={environments} networks={networks} onDone={async (m) => { await load(); notify(m) }} />}
        {tab === 'environments' && <EnvironmentAdmin environments={environments} onDone={async (m) => { await load(); notify(m) }} />}
      </div>
    </>
  )
}

// ── Equipment admin ─────────────────────────────────────────────────────────
function EquipmentAdmin({ equipment, zones, teams, physZones, onDone }: any) {
  const blank = { name: '', type: 'firewall', vendor: 'stormshield', model: '', management_ip: '', description: '', team_id: '', physical_zone_id: '', logical_zone_id: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const [detailEq, setDetailEq] = useState<any | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, team_id: form.team_id ? Number(form.team_id) : null, physical_zone_id: form.physical_zone_id ? Number(form.physical_zone_id) : null, logical_zone_id: form.logical_zone_id ? Number(form.logical_zone_id) : null }
    if (editing) { await api.updateEquipment(editing, payload) } else { await api.createEquipment(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `${form.name} mis à jour` : `${form.name} créé`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer ${name} ?`)) return
    await api.deleteEquipment(id); onDone(`${name} supprimé`)
  }

  const edit = (e: any) => {
    setForm({ name: e.name, type: e.type, vendor: e.vendor, model: e.model, management_ip: e.management_ip, description: e.description, team_id: e.team_id ?? '', physical_zone_id: e.physical_zone_id ?? '', logical_zone_id: e.logical_zone_id ?? '' })
    setEditing(e.id)
  }

  return (
    <>
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
          <div className="form-group">
            <label className="form-label">Zone logique</label>
            <select className="form-select" value={form.logical_zone_id} onChange={e => set('logical_zone_id', e.target.value)}>
              <option value="">— Aucune —</option>
              {zones.filter((z: any) => z.zone_type === 'logical').map((z: any) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>
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
              <button className="btn btn-ghost btn-sm" title="Voir politiques (routing + ACL)" onClick={() => setDetailEq(e)}>📋</button>
              <button className="btn btn-ghost btn-sm" onClick={() => edit(e)}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(e.id, e.name)}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
    {detailEq && <EquipmentDetailModal equipment={detailEq} onClose={() => setDetailEq(null)} />}
    </>
  )
}

// ── Logical zone admin ──────────────────────────────────────────────────────
function LogicalZoneAdmin({ zones, physZones, onDone }: any) {
  const blank = { name: '', color: '#3b82f6', description: '', trust_level: '50', datacenter_id: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, trust_level: Number(form.trust_level), zone_type: 'logical', datacenter_id: form.datacenter_id ? Number(form.datacenter_id) : null }
    if (editing) { await api.updateZone(editing, payload) } else { await api.createZone(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `Zone ${form.name} mise à jour` : `Zone ${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer la zone ${name} ?`)) return
    await api.deleteZone(id); onDone(`Zone ${name} supprimée`)
  }

  const logicalZones = zones.filter((z: any) => z.zone_type === 'logical' || !z.zone_type)

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier zone logique' : 'Nouvelle zone logique'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Couleur</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Data Center (zone physique)</label>
            <select className="form-select" value={form.datacenter_id} onChange={e => set('datacenter_id', e.target.value)}>
              <option value="">— Aucun —</option>
              {(physZones || []).map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}
            </select>
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
        <div className="card-title">Zones logiques ({logicalZones.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
          {logicalZones.map((z: any) => (
            <div key={z.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)', borderRadius: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: z.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{z.name}</span>
              <span className="badge badge-info text-xs" style={{ whiteSpace: 'nowrap' }}>{z.trust_level}%</span>
              <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ name: z.name, color: z.color, description: z.description || '', trust_level: String(z.trust_level), datacenter_id: z.datacenter_id ? String(z.datacenter_id) : '' }); setEditing(z.id) }}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(z.id, z.name)}>✕</button>
            </div>
          ))}
          {logicalZones.length === 0 && <div className="empty-state" style={{ padding: 20 }}>Aucune zone logique</div>}
        </div>
      </div>
    </div>
  )
}

// ── Physical zone admin ──────────────────────────────────────────────────────
function PhysZoneAdmin({ physZones, onDone }: any) {
  const blank = { name: '', type: 'datacenter', location: '', description: '', parent_id: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    const payload = { ...form, parent_id: form.parent_id ? Number(form.parent_id) : null }
    if (editing) { await api.updatePhysicalZone(editing, payload) } else { await api.createPhysicalZone(payload) }
    setForm(blank); setEditing(null)
    onDone(editing ? `Zone physique ${form.name} mise à jour` : `Zone physique ${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer la zone physique ${name} ?`)) return
    await api.deletePhysicalZone(id); onDone(`Zone physique ${name} supprimée`)
  }

  const PHYS_TYPES = [['datacenter', 'Datacenter'], ['salle', 'Salle'], ['baie', 'Baie'], ['local', 'Local']] as const
  const TYPE_LABEL: Record<string, string> = { datacenter: 'Datacenter', salle: 'Salle', baie: 'Baie', local: 'Local' }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier zone physique' : 'Nouvelle zone physique'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Type</label>
              <select className="form-select" value={form.type} onChange={e => set('type', e.target.value)}>
                {PHYS_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Zone parente</label>
              <select className="form-select" value={form.parent_id} onChange={e => set('parent_id', e.target.value)}>
                <option value="">— Aucune —</option>
                {(physZones || []).filter((x: any) => x.id !== editing).map((x: any) => (
                  <option key={x.id} value={x.id}>{x.name} ({x.type})</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-group"><label className="form-label">Localisation</label><input className="form-input" value={form.location} onChange={e => set('location', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Zones physiques ({(physZones || []).length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
          {(physZones || []).map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', minHeight: 40, background: 'var(--bg-input)', borderRadius: 6 }}>
              <div style={{ width: 12, height: 12, borderRadius: 2, background: '#f97316', flexShrink: 0 }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{p.name}</span>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, fontWeight: 600, background: 'rgba(249,115,22,0.15)', color: '#f97316', whiteSpace: 'nowrap' }}>
                ⬡ {TYPE_LABEL[p.type] || p.type}
              </span>
              {p.location && <span className="text-xs text-dimmed" style={{ whiteSpace: 'nowrap' }}>{p.location}</span>}
              <button className="btn btn-ghost btn-sm" onClick={() => { set('name', p.name); set('type', p.type || 'datacenter'); set('location', p.location || ''); set('description', p.description || ''); set('parent_id', p.parent_id ? String(p.parent_id) : ''); setEditing(p.id) }}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(p.id, p.name)}>✕</button>
            </div>
          ))}
          {(physZones || []).length === 0 && <div className="empty-state" style={{ padding: 20 }}>Aucune zone physique</div>}
        </div>
      </div>
    </div>
  )
}

// ── VRF admin ────────────────────────────────────────────────────────────────
function VrfAdmin({ vrfs, equipment, onDone }: any) {
  const blank = { name: '', color: '#a855f7', rd: '', rt_import: '', rt_export: '', description: '' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const [pendingEq, setPendingEq] = useState<number[]>([])  // IDs lors d'une création
  const [addEqSel, setAddEqSel] = useState('')
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const currentVrf = editing ? vrfs.find((v: any) => v.id === editing) : null
  // En édition : noms depuis la VRF existante ; en création : lookup depuis pendingEq
  const editEqNames: string[] = currentVrf?.equipment_names || []
  const createEqNames: string[] = pendingEq.map(id => (equipment as any[]).find((e: any) => e.id === id)?.name).filter(Boolean)
  const memberNames = editing ? editEqNames : createEqNames
  const available = (equipment as any[]).filter((e: any) => !memberNames.includes(e.name))

  const reset = () => { setForm(blank); setEditing(null); setPendingEq([]); setAddEqSel('') }

  const save = async () => {
    const payload = { name: form.name, color: form.color, rd: form.rd || null, rt_import: form.rt_import || null, rt_export: form.rt_export || null, description: form.description || null }
    if (editing) {
      await api.updateVRF(editing, payload)
    } else {
      const created = await api.createVRF(payload) as any
      for (const eqId of pendingEq) await api.addVRFEquipment(created.id, eqId)
    }
    reset()
    onDone(editing ? `VRF ${form.name} mise à jour` : `VRF ${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer la VRF ${name} ?`)) return
    await api.deleteVRF(id); onDone(`VRF ${name} supprimée`)
  }

  const addEq = async () => {
    if (!addEqSel) return
    if (editing) {
      await api.addVRFEquipment(editing, Number(addEqSel))
      onDone('Équipement ajouté à la VRF')
    } else {
      setPendingEq(prev => [...prev, Number(addEqSel)])
    }
    setAddEqSel('')
  }

  const removeEq = async (eqName: string) => {
    if (editing) {
      const eq = (equipment as any[]).find((e: any) => e.name === eqName)
      if (!eq) return
      await api.removeVRFEquipment(editing, eq.id)
      onDone('Équipement retiré de la VRF')
    } else {
      const eq = (equipment as any[]).find((e: any) => e.name === eqName)
      if (eq) setPendingEq(prev => prev.filter(id => id !== eq.id))
    }
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier VRF' : 'Nouvelle VRF'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Couleur</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group"><label className="form-label">Route Distinguisher</label><input className="form-input mono" placeholder="65000:10" value={form.rd} onChange={e => set('rd', e.target.value)} /></div>
            <div className="form-group"><label className="form-label">RT Import</label><input className="form-input mono" placeholder="65000:100" value={form.rt_import} onChange={e => set('rt_import', e.target.value)} /></div>
          </div>
          <div className="form-group"><label className="form-label">RT Export</label><input className="form-input mono" placeholder="65000:100" value={form.rt_export} onChange={e => set('rt_export', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>

          {/* Équipements membres — disponible en création ET en édition */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.6px', textTransform: 'uppercase', marginBottom: 8 }}>
              Équipements membres
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
              {memberNames.length === 0 && <div className="text-xs text-dimmed">Aucun équipement sélectionné</div>}
              {memberNames.map((name: string) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--bg-input)', borderRadius: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: form.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, flex: 1 }}>{name}</span>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => removeEq(name)}>✕</button>
                </div>
              ))}
            </div>
            {available.length > 0 && (
              <div style={{ display: 'flex', gap: 6 }}>
                <select className="form-select" style={{ flex: 1 }} value={addEqSel} onChange={e => setAddEqSel(e.target.value)}>
                  <option value="">+ Ajouter un équipement…</option>
                  {available.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <button className="btn btn-primary btn-sm" onClick={addEq} disabled={!addEqSel}>Ajouter</button>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={reset}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">VRF configurées ({vrfs.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 500, overflowY: 'auto' }}>
          {vrfs.map((v: any) => {
            const eqCount = (v.equipment_names || []).length
            const isActive = editing === v.id
            return (
              <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: isActive ? `${v.color}15` : 'var(--bg-input)', borderRadius: 6, border: `1px solid ${isActive ? v.color : v.color + '30'}` }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                <span style={{ flex: 1, fontWeight: 500 }}>{v.name}</span>
                {v.rd && <span className="text-xs text-dimmed mono">{v.rd}</span>}
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: `${v.color}22`, color: v.color, fontWeight: 600, whiteSpace: 'nowrap' }}>{eqCount} éq.</span>
                <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ name: v.name, color: v.color, rd: v.rd || '', rt_import: v.rt_import || '', rt_export: v.rt_export || '', description: v.description || '' }); setEditing(v.id); setAddEqSel('') }}>✏</button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(v.id, v.name)}>✕</button>
              </div>
            )
          })}
          {vrfs.length === 0 && <div className="empty-state" style={{ padding: 20 }}>Aucune VRF configurée</div>}
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

// ── Application admin ────────────────────────────────────────────────────────
const APP_TYPES = ['Web','API','ERP','Base de données','Middleware','Télécom','Virtualisation','Infrastructure','Sécurité','Supervision','ITSM'] as const
const APP_DOMAINS = ['Production','Communication','Sécurité','Support'] as const
// ── Glassmorphism select ──────────────────────────────────────────────────────
function GlassSelect({ value, onChange, children, style }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ position: 'relative', ...style }}>
      <select
        value={value}
        onChange={onChange}
        style={{
          width: '100%',
          appearance: 'none' as const,
          WebkitAppearance: 'none' as const,
          background: 'color-mix(in srgb, var(--bg-input) 78%, transparent)',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          padding: '6px 28px 6px 10px',
          fontSize: 12,
          color: 'var(--text-1)',
          fontFamily: 'inherit',
          cursor: 'pointer',
          outline: 'none',
          boxSizing: 'border-box' as const,
        }}
      >
        {children}
      </select>
      <svg style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--text-3)' }}
        width="12" height="12" viewBox="0 0 12 12" fill="none">
        <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  )
}

// ── IP CIDR helper ────────────────────────────────────────────────────────────
function ipInCidr(ip: string, cidr: string): boolean {
  try {
    const [base, bits] = cidr.split('/')
    const mask = bits ? parseInt(bits) : 32
    const toNum = (s: string) => s.split('.').reduce((a, o) => (a << 8) + parseInt(o), 0) >>> 0
    const maskNum = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0
    return (toNum(ip) & maskNum) === (toNum(base) & maskNum)
  } catch { return false }
}

const APP_CRITS = ['Faible','Moyenne','Elevée','Critique'] as const
const APP_ENVS = ['DEV','PREPROD1','PREPROD2','PROD'] as const
const CRIT_COLORS: Record<string, string> = { Critique:'#ef4444', Elevée:'#f97316', Moyenne:'#3b82f6', Faible:'#64748b' }

interface AppIPRow { ip_address: string; zone_id: string }

function ApplicationAdmin({ applications, zones, teams, environments, networks, onDone }: any) {
  const blankForm = { name:'', code:'', description:'', app_type:'Web', domain:'Production', criticality:'Moyenne', environment:'PROD', team_id:'' }
  const [form, setForm] = useState(blankForm)
  const [editing, setEditing] = useState<number | null>(null)
  const [ips, setIps] = useState<AppIPRow[]>([])
  const [newIp, setNewIp] = useState({ ip_address:'', zone_id:'' })
  const [ipWarning, setIpWarning] = useState<string | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const reset = () => { setForm(blankForm); setEditing(null); setIps([]) }

  const save = async () => {
    const payload = {
      ...form,
      team_id: form.team_id ? Number(form.team_id) : null,
      ips: ips.map(ip => ({ ip_address: ip.ip_address, zone_id: ip.zone_id ? Number(ip.zone_id) : null })),
    }
    if (editing) {
      await api.updateApplication(editing, payload)
    } else {
      await api.createApplication(payload)
    }
    reset()
    onDone(editing ? `${form.name} mis à jour` : `${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer l'application ${name} ?`)) return
    await api.deleteApplication(id); onDone(`${name} supprimée`)
  }

  const startEdit = (app: any) => {
    setForm({ name:app.name, code:app.code||'', description:app.description||'', app_type:app.app_type, domain:app.domain, criticality:app.criticality, environment:app.environment, team_id: app.team_id ? String(app.team_id) : '' })
    setIps((app.ips||[]).map((ip: any) => ({ ip_address: ip.ip_address, zone_id: ip.zone_id ? String(ip.zone_id) : '' })))
    setEditing(app.id)
  }

  const addIp = () => {
    const ip = newIp.ip_address.trim()
    if (!ip) return
    const nets: any[] = networks || []
    const matched = nets.some((n: any) => n.cidr && ipInCidr(ip, n.cidr))
    if (!matched && nets.length > 0) {
      setIpWarning(`${ip} n'appartient à aucun réseau configuré — l'application ne s'affichera pas sur le graphe.`)
    } else {
      setIpWarning(null)
    }
    setIps(prev => [...prev, { ...newIp }])
    setNewIp({ ip_address:'', zone_id:'' })
  }
  const removeIp = (idx: number) => setIps(prev => prev.filter((_, i) => i !== idx))

  const INPUT: React.CSSProperties = { width:'100%', background:'var(--bg-input)', border:'1px solid var(--border)', borderRadius:4, padding:'5px 8px', fontSize:11, color:'var(--text-1)', fontFamily:'inherit', outline:'none', boxSizing:'border-box' as const }
  const SELECT: React.CSSProperties = { ...INPUT, cursor:'pointer' }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier application' : 'Nouvelle application'}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Code</label><input className="form-input" value={form.code} onChange={e => set('code', e.target.value)} placeholder="ex: SAP-ERP" /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Type</label>
              <GlassSelect value={form.app_type} onChange={e => set('app_type', e.target.value)}>
                {APP_TYPES.map(t => <option key={t}>{t}</option>)}
              </GlassSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Domaine</label>
              <GlassSelect value={form.domain} onChange={e => set('domain', e.target.value)}>
                {APP_DOMAINS.map(d => <option key={d}>{d}</option>)}
              </GlassSelect>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Criticité</label>
              <GlassSelect value={form.criticality} onChange={e => set('criticality', e.target.value)}>
                {APP_CRITS.map(c => <option key={c}>{c}</option>)}
              </GlassSelect>
            </div>
            <div className="form-group">
              <label className="form-label">Environnement</label>
              <GlassSelect value={form.environment} onChange={e => set('environment', e.target.value)}>
                {(environments && environments.length > 0
                  ? environments.map((env: any) => env.name)
                  : APP_ENVS
                ).map((env: string) => <option key={env}>{env}</option>)}
              </GlassSelect>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Équipe</label>
            <GlassSelect value={form.team_id} onChange={e => set('team_id', e.target.value)}>
              <option value="">— Aucune —</option>
              {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </GlassSelect>
          </div>

          {/* IPs section */}
          <div style={{ borderTop:'1px solid var(--border)', paddingTop:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', letterSpacing:'0.6px', textTransform:'uppercase', marginBottom:8 }}>Adresses IP</div>
            {ips.map((ip, idx) => (
              <div key={idx} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5, padding:'5px 8px', background:'var(--bg-input)', borderRadius:4 }}>
                <span style={{ fontFamily:'monospace', fontSize:12, flex:1 }}>{ip.ip_address}</span>
                {ip.zone_id && <span style={{ fontSize:10, color:'var(--text-3)' }}>{(zones as any[]).find((z: any) => String(z.id) === ip.zone_id)?.name || ''}</span>}
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={() => removeIp(idx)}>✕</button>
              </div>
            ))}
            {ips.length === 0 && <div className="text-xs text-dimmed" style={{ marginBottom:8 }}>Aucune IP ajoutée</div>}
            <div style={{ display:'flex', gap:6 }}>
              <input style={{ ...INPUT, flex:1 }} placeholder="10.0.0.1" value={newIp.ip_address}
                onChange={e => { setNewIp(p => ({ ...p, ip_address: e.target.value })); setIpWarning(null) }}
                onKeyDown={e => e.key === 'Enter' && addIp()} />
              <GlassSelect style={{ flex:1 }} value={newIp.zone_id} onChange={e => setNewIp(p => ({ ...p, zone_id: e.target.value }))}>
                <option value="">Zone opt.</option>
                {(zones as any[]).filter((z: any) => z.zone_type === 'logical').map((z: any) => <option key={z.id} value={z.id}>{z.name}</option>)}
              </GlassSelect>
              <button className="btn btn-primary btn-sm" onClick={addIp} disabled={!newIp.ip_address.trim()}>+</button>
            </div>
            {ipWarning && (
              <div style={{ marginTop: 8, padding: '8px 10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 6, fontSize: 11, color: '#fbbf24', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ flexShrink: 0 }}>⚠</span>
                <span>{ipWarning} Elle restera visible dans l'onglet Applications de la Topologie.</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={reset}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Applications existantes ({applications.length})</div>
        <div style={{ display:'flex', flexDirection:'column', gap:6, maxHeight:560, overflowY:'auto' }}>
          {applications.map((app: any) => {
            const critColor = CRIT_COLORS[app.criticality] || '#64748b'
            const ipCount = (app.ips || []).length
            return (
              <div key={app.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg-input)', borderRadius:6, borderLeft:`3px solid ${critColor}` }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{app.name}</div>
                  {app.code && <div style={{ fontSize:10, fontFamily:'monospace', color:'var(--text-3)' }}>{app.code}</div>}
                </div>
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:`${critColor}22`, color:critColor, fontWeight:700, whiteSpace:'nowrap' }}>{app.criticality}</span>
                <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:'rgba(59,130,246,0.12)', color:'#3b82f6', fontWeight:600, whiteSpace:'nowrap' }}>{app.app_type}</span>
                <span style={{ fontSize:10, color:'var(--text-3)', whiteSpace:'nowrap' }}>{ipCount} IP</span>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(app)}>✏</button>
                <button className="btn btn-ghost btn-sm" style={{ color:'var(--red)' }} onClick={() => del(app.id, app.name)}>✕</button>
              </div>
            )
          })}
          {applications.length === 0 && <div className="empty-state" style={{ padding:20 }}>Aucune application configurée</div>}
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

// ── Environment admin ────────────────────────────────────────────────────────
function EnvironmentAdmin({ environments, onDone }: any) {
  const blank = { name: '', description: '', color: '#64748b' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (editing) {
      await api.updateEnvironment(editing, form)
    } else {
      await api.createEnvironment(form)
    }
    setForm(blank); setEditing(null)
    onDone(editing ? `Environnement ${form.name} mis à jour` : `Environnement ${form.name} créé`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer l'environnement ${name} ?`)) return
    await api.deleteEnvironment(id); onDone(`Environnement ${name} supprimé`)
  }

  const startEdit = (e: any) => {
    setForm({ name: e.name, description: e.description || '', color: e.color || '#64748b' })
    setEditing(e.id)
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier environnement' : 'Nouvel environnement'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group">
            <label className="form-label">Nom *</label>
            <input className="form-input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="ex: Production" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="ex: Environnement de production" />
          </div>
          <div className="form-group">
            <label className="form-label">Couleur</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1, fontFamily: 'monospace' }} />
              <span style={{ padding: '3px 10px', borderRadius: 10, background: `${form.color}22`, color: form.color, fontSize: 12, fontWeight: 700, border: `1px solid ${form.color}44`, whiteSpace: 'nowrap' }}>
                {form.name || 'Aperçu'}
              </span>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Environnements ({environments.length})</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 460, overflowY: 'auto' }}>
          {environments.map((e: any) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: 4, background: e.color || '#64748b', flexShrink: 0 }} />
              <span style={{ fontWeight: 600, flex: 1 }}>{e.name}</span>
              <span className="text-xs text-muted" style={{ flex: 2 }}>{e.description || ''}</span>
              <button className="btn btn-ghost btn-sm" onClick={() => startEdit(e)}>✏</button>
              <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(e.id, e.name)}>✕</button>
            </div>
          ))}
          {environments.length === 0 && <div className="empty-state" style={{ padding: 20 }}>Aucun environnement configuré</div>}
        </div>
      </div>
    </div>
  )
}
