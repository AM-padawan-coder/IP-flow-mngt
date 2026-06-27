import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

interface BackupEntry {
  id: string
  type: 'full' | 'incremental'
  domain: string
  filename: string
  created_at: string
  size_bytes: number
  integrity: 'ok' | 'failed' | null
  integrity_detail?: string
  status: 'ok' | 'failed'
  last_verified?: string
  last_restored?: string
}

interface SchedulerStatus {
  running: boolean
  last_daily: string | null
  last_weekly: string | null
  last_alert: string | null
  next_daily: string | null
  next_weekly: string | null
  total_backups: number
  latest: BackupEntry | null
}

const DOMAIN_LABELS: Record<string, string> = {
  all: 'Tous domaines', metier: 'Métier', audits: 'Audits', simulation: 'Simulation',
}
const DOMAIN_COLORS: Record<string, string> = {
  all: '#3b82f6', metier: '#22c55e', audits: '#f59e0b', simulation: '#8b5cf6',
}

function fmt(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(2)} Mo`
}

function age(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  if (h < 1) return 'à l\'instant'
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

export default function BackupPage() {
  const [backups, setBackups]       = useState<BackupEntry[]>([])
  const [scheduler, setScheduler]   = useState<SchedulerStatus | null>(null)
  const [loading, setLoading]       = useState(false)
  const [creating, setCreating]     = useState(false)
  const [msg, setMsg]               = useState('')
  const [restoreId, setRestoreId]   = useState<string | null>(null)
  const [verifying, setVerifying]   = useState<string | null>(null)

  const notify = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 4000) }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, s] = await Promise.all([
        api.listBackups() as Promise<BackupEntry[]>,
        api.getSchedulerStatus() as Promise<SchedulerStatus>,
      ])
      setBackups(b)
      setScheduler(s)
    } catch { /* backend might be offline in local dev */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const createBackup = async (type: 'full' | 'incremental', domain = 'all') => {
    setCreating(true)
    try {
      await api.createBackup({ type, domain })
      notify(`Sauvegarde ${type} (${DOMAIN_LABELS[domain]}) lancée — actualisez dans quelques secondes`)
      setTimeout(load, 2500)
    } catch (e: any) { notify(`Erreur : ${e.message}`) }
    setCreating(false)
  }

  const verify = async (b: BackupEntry) => {
    setVerifying(b.id)
    try {
      const r = await api.verifyBackup(b.id) as any
      notify(`Intégrité ${b.filename} : ${r.integrity === 'ok' ? '✓ OK' : '✕ ÉCHEC — ' + r.detail}`)
      load()
    } catch (e: any) { notify(`Erreur vérification : ${e.message}`) }
    setVerifying(null)
  }

  const doRestore = async (b: BackupEntry) => {
    try {
      await api.restoreBackup(b.id)
      notify(`✓ Base restaurée depuis ${b.filename} — redémarrage du serveur requis`)
      setRestoreId(null)
      load()
    } catch (e: any) { notify(`Erreur restauration : ${e.message}`) }
  }

  const deleteBackup = async (b: BackupEntry) => {
    if (!confirm(`Supprimer ${b.filename} ?`)) return
    try {
      await api.deleteBackup(b.id)
      notify(`${b.filename} supprimé`)
      load()
    } catch (e: any) { notify(`Erreur : ${e.message}`) }
  }

  const alertColor = scheduler?.last_alert ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.08)'
  const alertBorder = scheduler?.last_alert ? 'rgba(239,68,68,0.35)' : 'rgba(34,197,94,0.3)'

  return (
    <>
      <div className="page-header">
        <h2>Sauvegardes & Restauration</h2>
        <p>Gestion des sauvegardes automatisées et manuelles de la base de données</p>
      </div>
      <div className="page-content">

        {msg && (
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, color: 'var(--blue)', fontSize: 13 }}>
            {msg}
          </div>
        )}

        {/* ── Scheduler status ── */}
        {scheduler && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {/* Scheduler health */}
            <div style={{ background: alertColor, border: `1px solid ${alertBorder}`, borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>État du planificateur</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: scheduler.running ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontWeight: 600, fontSize: 13 }}>{scheduler.running ? 'Actif' : 'Inactif'}</span>
              </div>
              {scheduler.last_alert && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>⚠ Alerte : {fmt(scheduler.last_alert)}</div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                {scheduler.total_backups} sauvegarde{scheduler.total_backups !== 1 ? 's' : ''} au total
              </div>
            </div>

            {/* Next daily */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Prochaine incrémentale</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{fmt(scheduler.next_daily)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Quotidienne · 02h00 UTC</div>
              {scheduler.last_daily && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Dernière : {fmt(scheduler.last_daily)}</div>}
            </div>

            {/* Next weekly */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Prochaine complète</div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>{fmt(scheduler.next_weekly)}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Hebdomadaire · Dimanche 03h00 UTC</div>
              {scheduler.last_weekly && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Dernière : {fmt(scheduler.last_weekly)}</div>}
            </div>
          </div>
        )}

        {/* ── Manual triggers ── */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Déclencher manuellement</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button onClick={() => createBackup('full')} disabled={creating}
              style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid rgba(59,130,246,0.5)', background: 'rgba(59,130,246,0.1)', color: 'var(--blue)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
              💾 Complète (toutes tables)
            </button>
            {(['metier', 'audits', 'simulation', 'all'] as const).map(dom => (
              <button key={dom} onClick={() => createBackup('incremental', dom)} disabled={creating}
                style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${DOMAIN_COLORS[dom]}44`, background: `${DOMAIN_COLORS[dom]}14`, color: DOMAIN_COLORS[dom], cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                ⬇ JSON {DOMAIN_LABELS[dom]}
              </button>
            ))}
            <button onClick={load} style={{ marginLeft: 'auto', padding: '7px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
              ↺ Actualiser
            </button>
          </div>
        </div>

        {/* ── Backup list ── */}
        <div className="card">
          <div className="card-title">Historique des sauvegardes ({backups.length})</div>
          {loading && <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>Chargement…</div>}
          {!loading && backups.length === 0 && (
            <div className="empty-state" style={{ padding: 30 }}>
              Aucune sauvegarde — déclenchez-en une manuellement ou attendez le prochain cycle automatique
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {backups.map(b => {
              const isRestoring = restoreId === b.id
              const domColor = DOMAIN_COLORS[b.domain] || '#64748b'
              return (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', minHeight: 44, background: 'var(--bg-input)', borderRadius: 6,
                  border: `1px solid ${b.status === 'failed' ? 'rgba(239,68,68,0.3)' : 'transparent'}` }}>

                  {/* Type badge */}
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap',
                    background: b.type === 'full' ? 'rgba(59,130,246,0.15)' : 'rgba(100,116,139,0.15)',
                    color: b.type === 'full' ? '#3b82f6' : 'var(--text-3)' }}>
                    {b.type === 'full' ? '💾 Complète' : '⬇ Incrémentale'}
                  </span>

                  {/* Domain badge */}
                  <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, fontWeight: 700, whiteSpace: 'nowrap',
                    background: `${domColor}18`, color: domColor }}>
                    {DOMAIN_LABELS[b.domain] || b.domain}
                  </span>

                  {/* Filename */}
                  <span style={{ flex: 1, fontSize: 12, fontFamily: 'monospace', color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {b.filename}
                  </span>

                  {/* Date + age */}
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmt(b.created_at)} · {age(b.created_at)}</span>

                  {/* Size */}
                  <span style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', minWidth: 52, textAlign: 'right' }}>{fmtSize(b.size_bytes)}</span>

                  {/* Integrity */}
                  <span style={{ fontSize: 11, whiteSpace: 'nowrap', minWidth: 48, textAlign: 'center',
                    color: b.integrity === 'ok' ? '#22c55e' : b.integrity === 'failed' ? '#ef4444' : 'var(--text-3)' }}>
                    {b.integrity === 'ok' ? '✓ OK' : b.integrity === 'failed' ? '✕ KO' : '— ?'}
                  </span>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => verify(b)} disabled={verifying === b.id}
                      title="Vérifier intégrité"
                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', fontFamily: 'inherit' }}>
                      {verifying === b.id ? '…' : '✓?'}
                    </button>
                    {b.type === 'full' && (
                      isRestoring ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <span style={{ fontSize: 11, color: 'var(--red)', alignSelf: 'center' }}>Confirmer ?</span>
                          <button onClick={() => doRestore(b)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', fontSize: 11, color: '#ef4444', fontFamily: 'inherit' }}>Oui</button>
                          <button onClick={() => setRestoreId(null)} style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 11, color: 'var(--text-2)', fontFamily: 'inherit' }}>Non</button>
                        </div>
                      ) : (
                        <button onClick={() => setRestoreId(b.id)} title="Restaurer cette base"
                          style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid rgba(245,158,11,0.4)', background: 'rgba(245,158,11,0.08)', cursor: 'pointer', fontSize: 11, color: '#f59e0b', fontFamily: 'inherit' }}>
                          ↺
                        </button>
                      )
                    )}
                    <button onClick={() => deleteBackup(b)} title="Supprimer"
                      style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid transparent', background: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text-3)', fontFamily: 'inherit' }}>
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Info note ── */}
        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(99,102,241,0.07)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--text-3)' }}>
          <b style={{ color: 'var(--text-2)' }}>Planification automatique</b> — Incrémentale quotidienne à 02h00 UTC (JSON par domaine) · Complète hebdomadaire dimanche à 03h00 UTC (copie binaire SQLite) · Vérification d'intégrité à 08h00 UTC · Alerte log CRITICAL si backup absent ou corrompu
        </div>

      </div>
    </>
  )
}
