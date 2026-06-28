import { useEffect, useState, useCallback } from 'react'
import { api } from '../api/client'

// ── Constantes d'affichage ───────────────────────────────────────────────────
const ACTION_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  CREATE:   { bg: 'rgba(34,197,94,0.15)',  fg: '#22c55e', label: 'CREATE' },
  UPDATE:   { bg: 'rgba(59,130,246,0.15)', fg: '#60a5fa', label: 'UPDATE' },
  VALIDATE: { bg: 'rgba(20,184,166,0.15)', fg: '#2dd4bf', label: 'VALIDATE' },
  DELETE:   { bg: 'rgba(239,68,68,0.15)',  fg: '#f87171', label: 'DELETE' },
  IMPORT:   { bg: 'rgba(168,85,247,0.15)', fg: '#c084fc', label: 'IMPORT' },
  EXPORT:   { bg: 'rgba(249,115,22,0.15)', fg: '#fb923c', label: 'EXPORT' },
}

const CATEGORY_COLOR: Record<string, string> = {
  Security: '#ef4444', Administration: '#64748b', Flow: '#3b82f6', Route: '#c084fc',
  Application: '#eab308', Import: '#a855f7', Export: '#f97316', Simulation: '#14b8a6',
  Validation: '#22c55e', 'User Management': '#06b6d4',
}

const SOURCE_ICON: Record<string, string> = {
  WEB_UI: 'ti ti-world', API: 'ti ti-plug', CMDB_SYNC: 'ti ti-refresh',
}

const RETENTION_LABEL = (d: number) => (d <= 0 ? 'Illimité' : `${d} jours`)

const PAGE_SIZE = 50

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${p(d.getHours())}:${p(d.getMinutes())}`
}

type Stats = {
  total: number
  by_action: Record<string, number>
  by_category: Record<string, number>
  by_status: Record<string, number>
  users: string[]
  object_types: string[]
  actions: string[]
  categories: string[]
  retention_days: number
  retention_options: number[]
}

export default function LogsPage() {
  const [items, setItems] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [unavailable, setUnavailable] = useState(false)

  const [stats, setStats] = useState<Stats | null>(null)
  const [sinks, setSinks] = useState<any[]>([])

  // Filtres
  const [search, setSearch] = useState('')
  const [fAction, setFAction] = useState('')
  const [fType, setFType] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fCategory, setFCategory] = useState('')
  const [fUser, setFUser] = useState('')
  const [fEnv, setFEnv] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const [detail, setDetail] = useState<any | null>(null)
  const [exporting, setExporting] = useState(false)

  const buildParams = useCallback(() => ({
    page, page_size: PAGE_SIZE,
    search: search || undefined,
    action: fAction || undefined,
    object_type: fType || undefined,
    status: fStatus || undefined,
    category: fCategory || undefined,
    user: fUser || undefined,
    environment: fEnv || undefined,
    date_from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
    date_to: dateTo ? new Date(dateTo).toISOString() : undefined,
  }), [page, search, fAction, fType, fStatus, fCategory, fUser, fEnv, dateFrom, dateTo])

  // Recharge la liste (debounce léger sur la recherche)
  useEffect(() => {
    let cancelled = false
    const t = setTimeout(() => {
      setLoading(true)
      api.getAuditLogs(buildParams())
        .then((d: any) => {
          if (cancelled) return
          setItems(d.items || [])
          setTotal(d.total || 0)
          setPages(d.pages || 1)
          setUnavailable(false)
        })
        .catch(() => { if (!cancelled) setUnavailable(true) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }, 250)
    return () => { cancelled = true; clearTimeout(t) }
  }, [buildParams])

  // Stats + sinks (une fois)
  const loadStats = useCallback(() => {
    api.getAuditStats().then((d: any) => setStats(d)).catch(() => {})
    api.getAuditSinks().then((d: any) => setSinks(d.sinks || [])).catch(() => {})
  }, [])
  useEffect(() => { loadStats() }, [loadStats])

  // Réinitialise la page à 1 quand un filtre change
  useEffect(() => { setPage(1) }, [search, fAction, fType, fStatus, fCategory, fUser, fEnv, dateFrom, dateTo])

  const resetFilters = () => {
    setSearch(''); setFAction(''); setFType(''); setFStatus(''); setFCategory('')
    setFUser(''); setFEnv(''); setDateFrom(''); setDateTo('')
  }
  const hasFilters = !!(search || fAction || fType || fStatus || fCategory || fUser || fEnv || dateFrom || dateTo)

  const doExport = async (format: 'csv' | 'json') => {
    setExporting(true)
    try {
      const { search: s, ...rest } = buildParams()
      const res: any = await api.exportAuditLogs(format, { ...rest, search: s, page: undefined, page_size: undefined })
      const blob = new Blob([res.content], { type: res.mime })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = res.filename
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)
      loadStats()
    } catch {
      /* indisponible hors backend déployé */
    } finally {
      setExporting(false)
    }
  }

  const changeRetention = async (days: number) => {
    try {
      await api.setAuditRetention(days)
      loadStats()
      setPage(1)
    } catch { /* noop */ }
  }

  const selStyle: React.CSSProperties = { width: 'auto', minWidth: 0, padding: '7px 26px 7px 10px', fontSize: 12.5 }

  return (
    <>
      <div className="page-header">
        <h2>Logs &amp; Traçabilité</h2>
        <p>Journal d'audit immuable des actions — création, modification, validation, suppression, import, export</p>
      </div>
      <div className="page-content">

        {unavailable ? (
          <div className="card">
            <div className="empty-state" style={{ padding: '40px 0' }}>
              <div className="empty-state-icon"><i className="ti ti-server-off" style={{ fontSize: 30 }} /></div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Journal indisponible</div>
              <div className="text-sm text-muted" style={{ maxWidth: 460, textAlign: 'center' }}>
                Le service de journalisation sera actif après le déploiement du backend v2.10.
                Les actions sont tracées côté serveur dès sa mise en ligne.
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* ── KPIs + rétention + export ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
              <Kpi value={stats?.total ?? total} label="Entrées" color="var(--text-1)" />
              {(['CREATE', 'UPDATE', 'VALIDATE', 'DELETE', 'IMPORT', 'EXPORT'] as const).map(a => (
                <Kpi key={a} value={stats?.by_action?.[a] ?? 0} label={ACTION_STYLE[a].label} color={ACTION_STYLE[a].fg} />
              ))}
              <div style={{ flex: 1 }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-3)' }}>
                <i className="ti ti-clock-hour-4" /> Conservation
                <select className="form-select" style={selStyle}
                  value={stats?.retention_days ?? 90}
                  onChange={e => changeRetention(Number(e.target.value))}>
                  {(stats?.retention_options ?? [30, 90, 120, 180, 365, 0]).map(d => (
                    <option key={d} value={d}>{RETENTION_LABEL(d)}</option>
                  ))}
                </select>
              </label>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={exporting} onClick={() => doExport('csv')}>
                <i className="ti ti-file-type-csv" style={{ marginRight: 5 }} />CSV
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={exporting} onClick={() => doExport('json')}>
                <i className="ti ti-file-type-xml" style={{ marginRight: 5 }} />JSON
              </button>
            </div>

            {/* ── Filtres ── */}
            <div className="card" style={{ padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200 }}>
                  <i className="ti ti-search" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 14 }} />
                  <input className="form-input" style={{ paddingLeft: 30, fontSize: 12.5 }}
                    placeholder="Rechercher : FLOW-123, admin, WEB-NGINX, EXPORT…"
                    value={search} onChange={e => setSearch(e.target.value)} />
                </div>
                <select className="form-select" style={selStyle} value={fAction} onChange={e => setFAction(e.target.value)}>
                  <option value="">Toutes actions</option>
                  {(stats?.actions ?? Object.keys(ACTION_STYLE)).map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select className="form-select" style={selStyle} value={fCategory} onChange={e => setFCategory(e.target.value)}>
                  <option value="">Toutes catégories</option>
                  {(stats?.categories ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select className="form-select" style={selStyle} value={fType} onChange={e => setFType(e.target.value)}>
                  <option value="">Tous types</option>
                  {(stats?.object_types ?? []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select className="form-select" style={selStyle} value={fUser} onChange={e => setFUser(e.target.value)}>
                  <option value="">Tous utilisateurs</option>
                  {(stats?.users ?? []).map(u => <option key={u} value={u}>{u}</option>)}
                </select>
                <select className="form-select" style={selStyle} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                  <option value="">Tous résultats</option>
                  <option value="SUCCESS">SUCCESS</option>
                  <option value="FAILURE">FAILURE</option>
                </select>
                <input className="form-input" style={{ width: 'auto', fontSize: 12, color: 'var(--text-2)' }} type="date"
                  title="Depuis" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <input className="form-input" style={{ width: 'auto', fontSize: 12, color: 'var(--text-2)' }} type="date"
                  title="Jusqu'à" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                {hasFilters && (
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={resetFilters}>
                    <i className="ti ti-x" style={{ marginRight: 4 }} />Réinitialiser
                  </button>
                )}
              </div>
            </div>

            {/* ── Table ── */}
            <div className="card">
              {loading ? (
                <div className="empty-state" style={{ padding: '40px 0' }}><div className="spinner" /></div>
              ) : items.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0' }}>
                  <div className="empty-state-icon"><i className="ti ti-list-search" style={{ fontSize: 28 }} /></div>
                  <div>Aucune entrée ne correspond aux filtres</div>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th>Utilisateur</th><th>Action</th><th>Type</th>
                        <th>Objet</th><th>Catégorie</th><th>Source</th><th>Résultat</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(l => {
                        const a = ACTION_STYLE[l.action] || { bg: 'var(--bg-input)', fg: 'var(--text-2)', label: l.action }
                        return (
                          <tr key={l.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(l.id)}>
                            <td className="mono" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(l.timestamp)}</td>
                            <td>{l.username}</td>
                            <td><span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: a.bg, color: a.fg }}>{a.label}</span></td>
                            <td><span className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>{l.object_type}</span></td>
                            <td>
                              <span style={{ fontWeight: 600, fontSize: 12.5 }}>{l.object_id || '—'}</span>
                              {l.object_name && <span style={{ color: 'var(--text-3)', fontSize: 11, marginLeft: 6 }}>{l.object_name}</span>}
                            </td>
                            <td><span style={{ fontSize: 10.5, padding: '1px 7px', borderRadius: 8, border: `1px solid ${CATEGORY_COLOR[l.category] || 'var(--border)'}55`, color: CATEGORY_COLOR[l.category] || 'var(--text-3)' }}>{l.category}</span></td>
                            <td title={l.source} style={{ color: 'var(--text-3)' }}><i className={SOURCE_ICON[l.source] || 'ti ti-point'} /></td>
                            <td>
                              <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: l.status === 'FAILURE' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: l.status === 'FAILURE' ? '#f87171' : '#22c55e' }}>
                                {l.status === 'FAILURE' ? 'ÉCHEC' : 'OK'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination */}
              {!loading && total > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, fontSize: 12, color: 'var(--text-3)' }}>
                  <span>{total} entrée{total > 1 ? 's' : ''} · page {page}/{pages}</span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <i className="ti ti-chevron-left" /> Préc.
                    </button>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                      Suiv. <i className="ti ti-chevron-right" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Intégrations (roadmap) ── */}
            {sinks.length > 0 && (
              <div className="card" style={{ marginTop: 14 }}>
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-plug-connected" /> Intégrations d'export — à venir
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {sinks.map(s => (
                    <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', opacity: 0.85 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'rgba(139,92,246,0.15)', color: '#c084fc' }}>{s.roadmap}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{s.label}</span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{s.enabled ? 'actif' : 'désactivé'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {detail && <LogDetailModal log={detail} onClose={() => setDetail(null)} />}
    </>
  )

  function openDetail(id: number) {
    api.getAuditLog(id).then((d: any) => setDetail(d)).catch(() => {})
  }
}

function Kpi({ value, label, color }: { value: number | string; label: string; color: string }) {
  return (
    <div style={{ padding: '6px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, minWidth: 72 }}>
      <div style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--text-3)', letterSpacing: '0.4px', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  )
}

// ── Vue détail ───────────────────────────────────────────────────────────────
function LogDetailModal({ log, onClose }: { log: any; onClose: () => void }) {
  const a = ACTION_STYLE[log.action] || { bg: 'var(--bg-input)', fg: 'var(--text-2)', label: log.action }
  const row = (label: string, value: React.ReactNode) => (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 130, minWidth: 130, fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--text-1)', wordBreak: 'break-word' }}>{value}</div>
    </div>
  )
  const json = (obj: any) => obj == null
    ? <span style={{ color: 'var(--text-3)' }}>null</span>
    : <pre style={{ margin: 0, fontSize: 11.5, background: 'var(--bg-input)', borderRadius: 6, padding: '8px 10px', overflowX: 'auto', color: 'var(--text-2)' }}>{JSON.stringify(obj, null, 2)}</pre>

  return (
    <div onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}>
      <div style={{ width: '90vw', maxWidth: 640, maxHeight: '85vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: a.bg, color: a.fg }}>{a.label}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{log.object_type}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 13 }}>{log.log_ref}</span>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 12px', fontSize: 13, fontFamily: 'inherit' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '12px 20px 18px' }}>
          {row('Date', fmtDate(log.timestamp))}
          {row('Utilisateur', `${log.username}${log.user_id && log.user_id !== log.username ? ` (${log.user_id})` : ''}`)}
          {row('Objet', `${log.object_id || '—'}`)}
          {log.object_name && row('Nom', log.object_name)}
          {row('Catégorie', <span style={{ color: CATEGORY_COLOR[log.category] || 'var(--text-2)' }}>{log.category}</span>)}
          {row('Résultat', <span style={{ color: log.status === 'FAILURE' ? '#f87171' : '#22c55e', fontWeight: 600 }}>{log.status}</span>)}
          {row('Source', log.source)}
          {log.environment && row('Environnement', log.environment)}
          {log.application && row('Application', log.application)}
          {row('IP source', <span className="mono">{log.ip_address || '—'}</span>)}
          {row('Session', <span className="mono">{log.session_id || '—'}</span>)}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Avant</div>
            {json(log.before)}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Après</div>
            {json(log.after)}
          </div>
          {log.details && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: 5 }}>Détails</div>
              {json(log.details)}
            </div>
          )}
          {log.integrity_hash && (
            <div style={{ marginTop: 14, padding: '8px 10px', background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>
                <i className="ti ti-lock-check" style={{ color: '#22c55e' }} /> Empreinte d'intégrité (chaînée — tamper-evident)
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-2)', wordBreak: 'break-all' }}>{log.integrity_hash}</div>
              {log.signature && <div className="mono" style={{ fontSize: 10.5, color: 'var(--text-3)', wordBreak: 'break-all', marginTop: 4 }}>sig: {log.signature}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
