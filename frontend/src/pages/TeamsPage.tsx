import { useEffect, useState } from 'react'
import { api } from '../api/client'

export default function TeamsPage() {
  const [teams, setTeams] = useState<any[]>([])
  const [msg, setMsg] = useState('')

  const load = async () => {
    setTeams(await api.getTeams() as any[])
  }
  useEffect(() => { load() }, [])
  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  return (
    <>
      <div className="page-header">
        <h2>Organisation</h2>
        <p>Gestion des équipes et de leurs responsabilités</p>
      </div>
      <div className="page-content">
        {msg && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, color: 'var(--green)', fontSize: 13 }}>✓ {msg}</div>}
        <TeamsAdmin teams={teams} onDone={async m => { await load(); notify(m) }} />
      </div>
    </>
  )
}

function TeamsAdmin({ teams, onDone }: any) {
  const blank = { name: '', description: '', contact: '', color: '#3b82f6' }
  const [form, setForm] = useState(blank)
  const [editing, setEditing] = useState<number | null>(null)
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (editing) { await api.updateTeam(editing, form) } else { await api.createTeam(form) }
    setForm(blank); setEditing(null)
    onDone(editing ? `Équipe ${form.name} mise à jour` : `Équipe ${form.name} créée`)
  }

  const del = async (id: number, name: string) => {
    if (!confirm(`Supprimer l'équipe ${name} ?`)) return
    await api.deleteTeam(id); onDone(`Équipe ${name} supprimée`)
  }

  return (
    <div className="grid-2 gap-4">
      <div className="card">
        <div className="card-title">{editing ? 'Modifier équipe' : 'Nouvelle équipe'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="form-group"><label className="form-label">Nom *</label><input className="form-input" placeholder="Équipe Infrastructure" value={form.name} onChange={e => set('name', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={form.description} onChange={e => set('description', e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Contact (email)</label><input className="form-input" placeholder="equipe@entreprise.fr" value={form.contact} onChange={e => set('contact', e.target.value)} /></div>
          <div className="form-group">
            <label className="form-label">Couleur</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)} style={{ width: 40, height: 36, border: 'none', background: 'none', cursor: 'pointer' }} />
              <input className="form-input" value={form.color} onChange={e => set('color', e.target.value)} style={{ flex: 1 }} />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={save} disabled={!form.name}>{editing ? 'Mettre à jour' : 'Créer'}</button>
            {editing && <button className="btn btn-ghost" onClick={() => { setForm(blank); setEditing(null) }}>Annuler</button>}
          </div>
        </div>
      </div>

      <div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {teams.map((t: any) => (
            <div key={t.id} className="card" style={{ borderTop: `3px solid ${t.color}` }}>
              <div className="flex justify-between items-center mb-2">
                <span style={{ fontWeight: 700 }}>{t.name}</span>
                <div className="flex gap-1">
                  <button className="btn btn-ghost btn-sm" onClick={() => { setForm({ name: t.name, description: t.description, contact: t.contact, color: t.color }); setEditing(t.id) }}>✏</button>
                  <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} onClick={() => del(t.id, t.name)}>✕</button>
                </div>
              </div>
              <div className="text-sm text-muted mb-2">{t.description || '—'}</div>
              {t.contact && <div className="text-xs text-dimmed">✉ {t.contact}</div>}
              <div className="text-xs text-dimmed mt-1">⬡ {t.equipment_count} équipement(s)</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
