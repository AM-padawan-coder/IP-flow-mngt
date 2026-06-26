import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { AuditSummary } from '../types'

export default function AuditPage() {
  const [data, setData]   = useState<AuditSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.getAuditSummary()
      .then(d => setData(d as AuditSummary))
      .catch(() => setError('Impossible de charger les données d\'audit'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <>
      <div className="page-header"><h2>Audit</h2><p>Analyse des flux</p></div>
      <div className="page-content"><div className="empty-state"><div className="spinner" /></div></div>
    </>
  )

  if (error || !data) return (
    <>
      <div className="page-header"><h2>Audit</h2></div>
      <div className="page-content"><div className="empty-state">{error}</div></div>
    </>
  )

  const pctOk = data.total > 0 ? Math.round(((data.validated + data.deployed) / data.total) * 100) : 0

  return (
    <>
      <div className="page-header">
        <h2>Audit des flux IP</h2>
        <p>Synthèse des demandes traitées et indicateurs de conformité</p>
      </div>
      <div className="page-content">

        {/* KPI row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          <KpiCard value={data.total}     label="Flux total"      color="var(--text-1)" />
          <KpiCard value={data.deployed}  label="Déployés"        color="var(--teal)"   />
          <KpiCard value={data.validated} label="Validés"         color="var(--green)"  />
          <KpiCard value={data.rejected}  label="Refusés"         color="var(--red)"    />
          <KpiCard value={`${pctOk}%`}   label="Taux conformité" color="var(--blue)"   />
        </div>

        <div className="grid-2 gap-4">
          {/* Top applications */}
          <div className="card">
            <div className="card-title">Top applications</div>
            {data.top_applications.length === 0 ? (
              <div className="empty-state text-sm">Aucune donnée</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {data.top_applications.map((app, i) => {
                  const pct = Math.round((app.count / data.total) * 100)
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span>{app.name}</span>
                        <span className="text-muted">{app.count} flux</span>
                      </div>
                      <div style={{ background: 'var(--bg-input)', borderRadius: 4, height: 6 }}>
                        <div style={{ width: `${pct}%`, background: 'var(--blue)', borderRadius: 4, height: 6, transition: 'width 0.4s' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top analysts */}
          <div className="card">
            <div className="card-title">Activité par analyste</div>
            {data.top_analysts.length === 0 ? (
              <div className="empty-state text-sm">Aucune donnée</div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Analyste</th><th>Demandes</th><th>%</th></tr>
                  </thead>
                  <tbody>
                    {data.top_analysts.map((a, i) => (
                      <tr key={i}>
                        <td>{a.name}</td>
                        <td><span className="badge badge-info">{a.count}</span></td>
                        <td className="text-muted">{Math.round((a.count / data.total) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="card mt-4">
          <div className="card-title">Répartition par statut</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Déployés',   value: data.deployed,  cls: 'badge-deployed', pct: data.total ? Math.round(data.deployed/data.total*100) : 0 },
              { label: 'Validés',    value: data.validated, cls: 'badge-ok',       pct: data.total ? Math.round(data.validated/data.total*100) : 0 },
              { label: 'En attente', value: data.pending,   cls: 'badge-pending',  pct: data.total ? Math.round(data.pending/data.total*100) : 0 },
              { label: 'Refusés',    value: data.rejected,  cls: 'badge-error',    pct: data.total ? Math.round(data.rejected/data.total*100) : 0 },
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, minWidth: 140, padding: '16px', background: 'var(--bg-input)', borderRadius: 8 }}>
                <div className={`badge ${s.cls} mb-2`}>{s.label}</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{s.value}</div>
                <div className="text-xs text-muted">{s.pct}% du total</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function KpiCard({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value" style={{ color }}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
