import { useState, useEffect } from 'react'
import { api } from '../api/client'

// ── Types ────────────────────────────────────────────────────────────────────

type SnapCount = { applications: number; flows: number; equipment: number; policies: number; routes: number }
type Snap = {
  id: number
  label: string
  description: string
  created_by: string
  created_at: string
  environment: string
  version_tag: string
  branch_from: number | null
  branch_name: string | null
  branch_status: string
  snapshot_type: string
  counts: SnapCount
  deltas: SnapCount | null
  featured_flow_ids: number[]
}
type DiffCounts = { added: number; deleted: number; modified: number }
type DiffEntry  = { added: any[]; deleted: any[]; modified: any[]; counts: DiffCounts }
type Diff       = Record<string, DiffEntry>

// ── Helpers ──────────────────────────────────────────────────────────────────

const COUNT_KEYS: Array<{ key: keyof SnapCount; label: string }> = [
  { key: 'applications', label: 'Apps' },
  { key: 'flows',        label: 'Flux' },
  { key: 'equipment',    label: 'Équip.' },
  { key: 'policies',     label: 'Politiques' },
  { key: 'routes',       label: 'Routes' },
]

const ENTITY_LABELS: Record<string, string> = {
  zones: 'Zones', equipment: 'Équipements', networks: 'Réseaux', links: 'Liens',
  flows: 'Flux', vrfs: 'VRFs', applications: 'Applications',
  acl_rules: 'Règles ACL', routes: 'Routes',
}

const BRANCH_STATUS_LABELS: Record<string, string> = { active: 'Actif', paused: 'En pause', merged: 'Fusionné' }
const BRANCH_STATUS_COLORS: Record<string, string> = { active: '#22c55e', paused: '#f59e0b', merged: '#6366f1' }

function versionColor(snap: Snap): string {
  if (snap.branch_from) return '#d97706'
  const major = parseInt(snap.version_tag?.replace('v', '').split('.')[0] || '1', 10)
  return (['#4f46e5', '#7c3aed', '#2563eb', '#0891b2'] as const)[Math.max(0, major - 1)] ?? '#64748b'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtNum(n: number) { return (n ?? 0).toLocaleString('fr-FR') }

// ── Sub-components ────────────────────────────────────────────────────────────

function DeltaBadge({ v }: { v: number }) {
  if (!v) return null
  const color = v > 0 ? '#22c55e' : '#ef4444'
  return <span style={{ fontSize: 10, color, fontWeight: 700, marginLeft: 3 }}>{v > 0 ? '+' : ''}{v}</span>
}

function SnapCard({ snap, selected, onSelect }: { snap: Snap; selected: boolean; onSelect: () => void }) {
  const color   = versionColor(snap)
  const isBranch = !!snap.branch_from

  return (
    <div
      onClick={onSelect}
      style={{
        width: 206,
        background: selected ? `${color}1a` : 'var(--bg-card)',
        border: `1.5px solid ${selected ? color : isBranch ? '#d9780644' : 'var(--border)'}`,
        borderRadius: 10,
        padding: '10px 12px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s',
        boxShadow: selected ? `0 0 0 3px ${color}22` : undefined,
        flexShrink: 0,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
        {snap.version_tag && (
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 5,
            background: `${color}22`, color, border: `1px solid ${color}55`, flexShrink: 0,
          }}>
            {snap.version_tag}
          </span>
        )}
        {isBranch && (
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 5, flexShrink: 0,
            background: `${BRANCH_STATUS_COLORS[snap.branch_status] ?? '#64748b'}22`,
            color: BRANCH_STATUS_COLORS[snap.branch_status] ?? '#64748b',
          }}>
            {BRANCH_STATUS_LABELS[snap.branch_status] ?? snap.branch_status}
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: `${color}88`, fontSize: 15 }}>
          <i className={isBranch ? 'ti ti-git-branch' : 'ti ti-camera'} />
        </span>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', lineHeight: 1.3, marginBottom: 3 }}>
        {snap.label}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 7 }}>
        {fmtDate(snap.created_at)} · {snap.created_by}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', fontSize: 10 }}>
        {COUNT_KEYS.slice(0, 3).map(({ key, label }) => (
          <span key={key} style={{ color: 'var(--text-3)' }}>
            {label}: <strong style={{ color: 'var(--text-2)' }}>{fmtNum(snap.counts?.[key] ?? 0)}</strong>
            {snap.deltas?.[key] != null && snap.deltas[key] !== 0 && <DeltaBadge v={snap.deltas[key]} />}
          </span>
        ))}
      </div>
    </div>
  )
}

function DiffSummary({ diff }: { diff: Diff }) {
  const relevant = Object.entries(diff).filter(([, e]) => e.counts.added + e.counts.deleted + e.counts.modified > 0)
  if (relevant.length === 0) {
    return (
      <div style={{ marginTop: 8, padding: '8px 10px', background: '#22c55e18', border: '1px solid #22c55e44', borderRadius: 6, fontSize: 12, color: '#22c55e' }}>
        <i className="ti ti-circle-check" style={{ marginRight: 5 }} />
        Aucune différence — état identique
      </div>
    )
  }
  return (
    <div style={{ marginTop: 8 }}>
      {relevant.map(([etype, entry]) => (
        <div key={etype} style={{ marginBottom: 6, padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 5, fontSize: 11 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 3 }}>
            {ENTITY_LABELS[etype] ?? etype}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {entry.counts.added   > 0 && <span style={{ color: '#22c55e' }}>+{entry.counts.added} ajouté{entry.counts.added > 1 ? 's' : ''}</span>}
            {entry.counts.deleted > 0 && <span style={{ color: '#ef4444' }}>−{entry.counts.deleted} supprimé{entry.counts.deleted > 1 ? 's' : ''}</span>}
            {entry.counts.modified> 0 && <span style={{ color: '#f59e0b' }}>~{entry.counts.modified} modifié{entry.counts.modified > 1 ? 's' : ''}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

interface DetailPanelProps {
  snap: Snap
  diff: Diff | null
  diffLoading: boolean
  onClose: () => void
  onDiffCurrent: () => void
  onDelete: () => void
  onBranch: () => void
  onBranchStatusChange: (s: string) => void
}

function DetailPanel({ snap, diff, diffLoading, onClose, onDiffCurrent, onDelete, onBranch, onBranchStatusChange }: DetailPanelProps) {
  const color    = versionColor(snap)
  const isBranch = !!snap.branch_from

  return (
    <div style={{
      width: 300, borderLeft: '1px solid var(--border)', background: 'var(--bg-card)',
      overflowY: 'auto', flexShrink: 0, display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', gap: 8, flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
            {snap.version_tag && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 5, background: `${color}22`, color, border: `1px solid ${color}55` }}>
                {snap.version_tag}
              </span>
            )}
            {isBranch && (
              <span style={{ fontSize: 11, color: '#d97806', fontWeight: 600 }}>
                <i className="ti ti-git-branch" style={{ marginRight: 3 }} />{snap.branch_name}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)', lineHeight: 1.3 }}>{snap.label}</div>
          {snap.description && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 3, lineHeight: 1.4 }}>{snap.description}</div>
          )}
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 15, padding: 0, lineHeight: 1, fontFamily: 'inherit', flexShrink: 0 }}>✕</button>
      </div>

      {/* Meta */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11 }}>
        {[
          ['Date',    fmtDate(snap.created_at)],
          ['Auteur',  snap.created_by],
          ['Env.',    snap.environment],
          ['Type',    snap.snapshot_type],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', marginBottom: 3 }}>
            <span style={{ color: 'var(--text-3)', width: 56, flexShrink: 0 }}>{k}</span>
            <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Counts */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Compteurs</div>
        {COUNT_KEYS.map(({ key, label }) => {
          const delta = snap.deltas?.[key]
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 5, fontSize: 12 }}>
              <span style={{ flex: 1, color: 'var(--text-2)' }}>{label}</span>
              <span style={{ fontWeight: 700, color: 'var(--text-1)' }}>{fmtNum(snap.counts?.[key] ?? 0)}</span>
              {delta != null && delta !== 0 && <DeltaBadge v={delta} />}
            </div>
          )
        })}
      </div>

      {/* Branch status */}
      {isBranch && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Statut branche</div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['active', 'paused', 'merged'] as const).map(s => (
              <button key={s} onClick={() => onBranchStatusChange(s)} style={{
                padding: '3px 9px', borderRadius: 5, fontSize: 11, fontFamily: 'inherit', cursor: 'pointer',
                fontWeight: snap.branch_status === s ? 700 : 400,
                background: snap.branch_status === s ? `${BRANCH_STATUS_COLORS[s]}22` : 'var(--bg-input)',
                color: snap.branch_status === s ? BRANCH_STATUS_COLORS[s] : 'var(--text-2)',
                border: snap.branch_status === s ? `1px solid ${BRANCH_STATUS_COLORS[s]}` : '1px solid var(--border)',
              }}>
                {BRANCH_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Featured flows */}
      {snap.featured_flow_ids?.length > 0 && (
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
            Flux associés ({snap.featured_flow_ids.length})
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {snap.featured_flow_ids.map(id => (
              <span key={id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: '#2563eb18', color: '#2563eb', border: '1px solid #2563eb44' }}>
                Flux #{id}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Diff */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Comparaison</div>
        <button
          onClick={onDiffCurrent}
          disabled={diffLoading}
          style={{
            width: '100%', padding: '7px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 6, color: 'var(--text-1)', cursor: diffLoading ? 'wait' : 'pointer',
            fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
          }}
        >
          <i className="ti ti-git-diff" style={{ color: '#2563eb' }} />
          {diffLoading ? 'Calcul en cours…' : 'Comparer avec l\'état actuel'}
        </button>
        {diff && !diffLoading && <DiffSummary diff={diff} />}
      </div>

      {/* Actions */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Actions</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!isBranch && (
            <button onClick={onBranch} style={{
              padding: '7px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
            }}>
              <i className="ti ti-git-branch" style={{ color: '#d97806' }} />
              Créer une branche depuis ce snapshot
            </button>
          )}
          <button onClick={onDelete} style={{
            padding: '7px 10px', background: 'var(--bg-input)', border: '1px solid #ef444444',
            borderRadius: 6, color: '#ef4444', cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, textAlign: 'left',
          }}>
            <i className="ti ti-trash" />
            Supprimer ce snapshot
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Snapshot Modal ─────────────────────────────────────────────────────

interface CreateSnapProps {
  flows: any[]
  onClose: () => void
  onCreate: (data: object) => Promise<void>
}

function CreateSnapshotModal({ flows, onClose, onCreate }: CreateSnapProps) {
  const [label,       setLabel]       = useState('')
  const [description, setDescription] = useState('')
  const [versionTag,  setVersionTag]  = useState('')
  const [environment, setEnvironment] = useState('Production')
  const [selected,    setSelected]    = useState<number[]>([])
  const [flowSearch,  setFlowSearch]  = useState('')
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState('')

  const visibleFlows = flows.filter(f =>
    !flowSearch ||
    f.src_ip?.includes(flowSearch) || f.dst_ip?.includes(flowSearch) ||
    (f.application || '').toLowerCase().includes(flowSearch.toLowerCase())
  ).slice(0, 60)

  const toggle = (id: number) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

  const submit = async () => {
    if (!label.trim()) { setError('Le nom du snapshot est requis.'); return }
    setCreating(true); setError('')
    try {
      await onCreate({ label: label.trim(), description, version_tag: versionTag, environment, featured_flow_ids: selected })
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la création.')
      setCreating(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '92vw', maxWidth: 520, maxHeight: '90vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-camera" style={{ fontSize: 18, color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Créer un snapshot</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
          <div className="form-group">
            <label className="form-label">Nom du snapshot *</label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder="ex : Ajout flux SAP, Migration DMZ…" />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Contexte ou objectif de ce snapshot…" rows={2} style={{ resize: 'none', fontFamily: 'inherit' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Tag de version</label>
              <input className="form-input" value={versionTag} onChange={e => setVersionTag(e.target.value)} placeholder="v1.0, v2.3…" />
            </div>
            <div className="form-group">
              <label className="form-label">Environnement</label>
              <select className="form-input" value={environment} onChange={e => setEnvironment(e.target.value)} style={{ fontFamily: 'inherit' }}>
                <option>Production</option>
                <option>Staging</option>
                <option>DR</option>
              </select>
            </div>
          </div>

          {flows.length > 0 && (
            <div className="form-group">
              <label className="form-label">
                Flux à associer à cette version
                {selected.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#2563eb' }}>{selected.length} sélectionné{selected.length > 1 ? 's' : ''}</span>
                )}
              </label>
              <input
                className="form-input"
                value={flowSearch}
                onChange={e => setFlowSearch(e.target.value)}
                placeholder="Filtrer par IP ou application…"
                style={{ marginBottom: 6 }}
              />
              <div style={{ maxHeight: 170, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-input)' }}>
                {visibleFlows.length === 0 ? (
                  <div style={{ padding: 10, color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>Aucun flux trouvé</div>
                ) : visibleFlows.map((f: any) => {
                  const chk = selected.includes(f.id)
                  return (
                    <div
                      key={f.id}
                      onClick={() => toggle(f.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                        cursor: 'pointer', fontSize: 12,
                        background: chk ? '#2563eb10' : 'transparent',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      <input type="checkbox" checked={chk} onChange={() => toggle(f.id)} onClick={e => e.stopPropagation()} style={{ accentColor: '#2563eb', cursor: 'pointer' }} />
                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-2)' }}>{f.src_ip} → {f.dst_ip}:{f.port}</span>
                      {f.application && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 'auto' }}>{f.application}</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6 }}>{error}</div>}
        </div>

        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            Annuler
          </button>
          <button onClick={submit} disabled={creating} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: creating ? '#1d4ed8' : '#2563eb', color: '#fff', cursor: creating ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-camera" />
            {creating ? 'Capture en cours…' : 'Capturer le snapshot'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Branch Modal ────────────────────────────────────────────────────────

interface CreateBranchProps {
  fromSnap: Snap
  onClose: () => void
  onCreate: (data: object) => Promise<void>
}

function CreateBranchModal({ fromSnap, onClose, onCreate }: CreateBranchProps) {
  const [branchName,  setBranchName]  = useState('')
  const [description, setDescription] = useState('')
  const [creating,    setCreating]    = useState(false)
  const [error,       setError]       = useState('')

  const submit = async () => {
    if (!branchName.trim()) { setError('Le nom de la branche est requis.'); return }
    setCreating(true); setError('')
    try {
      await onCreate({ branch_name: branchName.trim(), description })
    } catch (e: any) {
      setError(e.message || 'Erreur.')
      setCreating(false)
    }
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '92vw', maxWidth: 420, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ti ti-git-branch" style={{ fontSize: 18, color: '#d97806' }} />
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Créer une branche</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px' }}>
          <div style={{ marginBottom: 14, padding: '8px 12px', background: '#d9780618', border: '1px solid #d9780644', borderRadius: 6, fontSize: 12, color: '#d97806' }}>
            <i className="ti ti-git-fork" style={{ marginRight: 6 }} />
            Branche depuis <strong>{fromSnap.version_tag || fromSnap.label}</strong>
          </div>

          <div className="form-group">
            <label className="form-label">Nom de la branche *</label>
            <input className="form-input" value={branchName} onChange={e => setBranchName(e.target.value)} placeholder="Migration-ERP, ZeroTrust-Pilot…" />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} rows={2} style={{ resize: 'none', fontFamily: 'inherit' }} placeholder="Objectif de cette branche…" />
          </div>

          {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 8 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button onClick={onClose} style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              Annuler
            </button>
            <button onClick={submit} disabled={creating} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: creating ? '#b45309' : '#d97806', color: '#fff', cursor: creating ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="ti ti-git-branch" />
              {creating ? 'Création…' : 'Créer la branche'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function VersioningPage() {
  const [snapshots,    setSnapshots]    = useState<Snap[]>([])
  const [liveCounts,   setLiveCounts]   = useState<SnapCount | null>(null)
  const [selected,     setSelected]     = useState<Snap | null>(null)
  const [createOpen,   setCreateOpen]   = useState(false)
  const [branchOpen,   setBranchOpen]   = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [maxCount,     setMaxCount]     = useState(20)
  const [maxInput,     setMaxInput]     = useState('20')
  const [diff,         setDiff]         = useState<Diff | null>(null)
  const [diffLoading,  setDiffLoading]  = useState(false)
  const [flows,        setFlows]        = useState<any[]>([])
  const [loading,      setLoading]      = useState(true)

  const load = async (keepSelected = false) => {
    setLoading(true)
    try {
      const [snaps, lc, settings] = await Promise.all([
        api.getSnapshots(),
        api.getSnapshotLiveCounts(),
        api.getSnapshotSettings(),
      ])
      setSnapshots(snaps as Snap[])
      setLiveCounts(lc as SnapCount)
      setMaxCount(settings.max_count)
      setMaxInput(String(settings.max_count))
      if (keepSelected && selected) {
        const upd = (snaps as Snap[]).find(s => s.id === selected.id)
        if (upd) setSelected(upd)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = async () => {
    if (flows.length === 0) setFlows(await api.getFlows() as any[])
    setCreateOpen(true)
  }

  const loadDiff = async (snapId: number) => {
    setDiffLoading(true); setDiff(null)
    try {
      setDiff(await api.diffSnapshotWithCurrent(snapId) as Diff)
    } catch { /* ignore */ }
    setDiffLoading(false)
  }

  const deleteSnap = async (id: number) => {
    if (!confirm('Supprimer définitivement ce snapshot ?')) return
    try { await api.deleteSnapshot(id) } catch { /* ignore 204 */ }
    if (selected?.id === id) { setSelected(null); setDiff(null) }
    load()
  }

  const saveMaxCount = async () => {
    const n = parseInt(maxInput, 10)
    if (isNaN(n) || n < 1 || n > 200) return
    await api.setSnapshotSettings({ max_count: n })
    setMaxCount(n)
    setSettingsOpen(false)
  }

  // Build branch map
  const branchMap = new Map<number, Snap[]>()
  snapshots.filter(s => s.branch_from).forEach(s => {
    const list = branchMap.get(s.branch_from!) ?? []
    list.push(s)
    branchMap.set(s.branch_from!, list)
  })
  const mainSnaps = snapshots.filter(s => !s.branch_from)

  const selectSnap = (snap: Snap) => {
    if (selected?.id === snap.id) { setSelected(null); setDiff(null) }
    else { setSelected(snap); setDiff(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Page header */}
      <div className="page-header">
        <h2>Versioning</h2>
        <p>Timeline des états de la topologie réseau — snapshots &amp; branches</p>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 24px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' }}>
          {liveCounts && (
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              {COUNT_KEYS.map(({ key, label }) => (
                <span key={key} style={{ color: 'var(--text-3)' }}>
                  {label}: <strong style={{ color: 'var(--text-1)' }}>{fmtNum(liveCounts[key])}</strong>
                </span>
              ))}
            </div>
          )}
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            <i className="ti ti-history" style={{ marginRight: 4 }} />
            {mainSnaps.length} / {maxCount} snapshots
          </span>
          <button
            onClick={() => setSettingsOpen(s => !s)}
            style={{ padding: '5px 12px', background: settingsOpen ? '#2563eb18' : 'var(--bg-input)', border: settingsOpen ? '1px solid #2563eb' : '1px solid var(--border)', borderRadius: 6, color: settingsOpen ? '#2563eb' : 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <i className="ti ti-settings" /> Paramètres
          </button>
          <button
            onClick={openCreate}
            style={{ padding: '5px 14px', background: '#2563eb', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <i className="ti ti-camera" /> Créer un snapshot
          </button>
        </div>

        {/* Settings bar */}
        {settingsOpen && (
          <div style={{ padding: '10px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0, flexWrap: 'wrap' }}>
            <i className="ti ti-adjustments-horizontal" style={{ color: 'var(--text-3)' }} />
            <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Nombre max de snapshots dans l'historique :</span>
            <input
              type="number" value={maxInput} onChange={e => setMaxInput(e.target.value)} min={1} max={200}
              style={{ width: 64, padding: '4px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-1)', fontFamily: 'inherit', fontSize: 12 }}
            />
            <button onClick={saveMaxCount} style={{ padding: '4px 14px', background: '#2563eb', border: 'none', borderRadius: 5, color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600 }}>
              Enregistrer
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              Les snapshots les plus anciens (hors branches) sont supprimés automatiquement au-delà de cette limite.
            </span>
          </div>
        )}

        {/* Main area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* Timeline */}
          <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', padding: '40px 32px 32px' }}>
            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : mainSnaps.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><i className="ti ti-camera-off" style={{ fontSize: 28 }} /></div>
                <div>Aucun snapshot — créez votre premier point de sauvegarde</div>
              </div>
            ) : (
              <>
                {/* Horizontal timeline */}
                <div style={{ position: 'relative', minWidth: 'max-content' }}>
                  {/* Background connector line */}
                  <div style={{
                    position: 'absolute',
                    top: 76,
                    left: 12,
                    right: 12,
                    height: 2,
                    background: 'var(--border)',
                    zIndex: 0,
                    borderRadius: 1,
                  }} />

                  {/* Cards row */}
                  <div style={{ display: 'flex', gap: 0, alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                    {mainSnaps.map((snap, idx) => {
                      const branches = branchMap.get(snap.id) ?? []
                      const isLast   = idx === mainSnaps.length - 1

                      return (
                        <div key={snap.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
                          {/* Column: main card + branches below */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <SnapCard snap={snap} selected={selected?.id === snap.id} onSelect={() => selectSnap(snap)} />

                            {branches.length > 0 && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                {/* Vertical line to branches */}
                                <div style={{ width: 2, height: 28, background: '#d9780666', marginTop: 0 }} />
                                {/* Horizontal bar if multiple branches */}
                                {branches.length > 1 && (
                                  <div style={{ height: 2, background: '#d9780666', width: (branches.length - 1) * 218 + 2 }} />
                                )}
                                {/* Branch cards */}
                                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                                  {branches.map((branch, bi) => (
                                    <div key={branch.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                      {branches.length > 1 && (
                                        <div style={{ width: 2, height: bi === 0 ? 0 : 0, background: 'transparent' }} />
                                      )}
                                      {/* Short vertical drop to each branch card */}
                                      {branches.length > 1 && (
                                        <div style={{ width: 2, height: 12, background: '#d9780666' }} />
                                      )}
                                      <SnapCard snap={branch} selected={selected?.id === branch.id} onSelect={() => selectSnap(branch)} />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Horizontal connector to next main snap */}
                          {!isLast && (
                            <div style={{ width: 48, height: 2, background: 'var(--border)', marginTop: 75, flexShrink: 0 }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Legend */}
                <div style={{ marginTop: 40, display: 'flex', gap: 20, fontSize: 11, color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: 'var(--text-2)' }}>Légende :</span>
                  {[
                    { color: '#4f46e5', label: 'Série v1.x' },
                    { color: '#7c3aed', label: 'Série v2.x' },
                    { color: '#2563eb', label: 'Série v3.x' },
                    { color: '#d97806', label: 'Branche' },
                  ].map(({ color, label }) => (
                    <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: `${color}33`, border: `1.5px solid ${color}` }} />
                      {label}
                    </span>
                  ))}
                  <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>
                    Cliquez sur un snapshot pour voir ses détails
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <DetailPanel
              snap={selected}
              diff={diff}
              diffLoading={diffLoading}
              onClose={() => { setSelected(null); setDiff(null) }}
              onDiffCurrent={() => loadDiff(selected.id)}
              onDelete={() => deleteSnap(selected.id)}
              onBranch={() => setBranchOpen(true)}
              onBranchStatusChange={async (status) => {
                await api.updateSnapshotBranchStatus(selected.id, status)
                load(true)
              }}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {createOpen && (
        <CreateSnapshotModal
          flows={flows}
          onClose={() => setCreateOpen(false)}
          onCreate={async (data) => {
            await api.createSnapshot(data)
            setCreateOpen(false)
            load()
          }}
        />
      )}

      {branchOpen && selected && (
        <CreateBranchModal
          fromSnap={selected}
          onClose={() => setBranchOpen(false)}
          onCreate={async (data) => {
            await api.createSnapshotBranch(selected.id, data)
            setBranchOpen(false)
            load(true)
          }}
        />
      )}
    </div>
  )
}
