import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'

interface Source {
  id: string
  title: string
  framework: string
  version: string
  source_version: string
  control_count: number
}
interface Citation { title: string; text: string; source_version?: string }
interface Control {
  id: string; label: string; title: string; group: string; severity: string
  subject_type: string; version: string; frameworks: string[]
  statement: string; guidance: string; expression: string; citations: Citation[]
}
interface CatalogMeta {
  title: string; version: string; oscal_version: string; last_modified: string
  review_cadence: string; next_review: string; status: string; owner: string
  total_controls: number
}
interface Finding {
  control_id: string; control_label: string; control_version: string; title: string
  group: string; severity: string; status: string; frameworks: string[]
  statement: string; guidance: string; citations: Citation[]; expression: string; detail: string
}
interface Report {
  uuid: string; evaluated_at: string; subject_type: string; source: string | null
  catalog_version: string
  summary: { total: number; satisfied: number; violations: number; errors: number; compliant: boolean; violations_by_severity: Record<string, number> }
  findings: Finding[]
}

const SEV_COLOR: Record<string, string> = {
  critical: '#dc2626', high: '#ef4444', medium: '#f59e0b', low: '#3b82f6',
}
const FW_COLOR: Record<string, string> = {
  NIS2: '#3b82f6', ANSSI: '#22c55e', CIS: '#8b5cf6', NIST: '#06b6d4',
}

export default function CompliancePage() {
  const [sources, setSources]   = useState<Source[]>([])
  const [meta, setMeta]         = useState<CatalogMeta | null>(null)
  const [source, setSource]     = useState<string>('nis2')
  const [controls, setControls] = useState<Control[]>([])
  const [report, setReport]     = useState<Report | null>(null)
  const [msg, setMsg]           = useState('')

  // Sujet de test (modifiable)
  const [subj, setSubj] = useState({
    src_trust: 0, dst_trust: 80, src_zone: 'INTERNET', dst_zone: 'ZONE-SERVEURS',
    port: 3389, protocol: 'tcp', action: 'permit',
    src_any: false, dst_any: false, port_any: false,
    path_zones: 'INTERNET, ZONE-SERVEURS',
  })

  const loadControls = useCallback(async (src: string) => {
    try { setControls(await api.getComplianceControls(src) as Control[]) }
    catch { setControls([]) }
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const [s, m] = await Promise.all([
          api.getComplianceSources() as Promise<Source[]>,
          api.getComplianceCatalog() as Promise<CatalogMeta>,
        ])
        setSources(s); setMeta(m)
        if (s.length && !s.find(x => x.id === source)) setSource(s[0].id)
      } catch { /* backend offline */ }
    })()
  }, []) // eslint-disable-line

  useEffect(() => { if (source) loadControls(source) }, [source, loadControls])

  const evaluate = async () => {
    try {
      const subject = {
        subject_type: 'flow',
        ...subj,
        path_zones: subj.path_zones.split(',').map(s => s.trim()).filter(Boolean),
      }
      setReport(await api.evaluateCompliance(subject, source) as Report)
      setMsg('')
    } catch (e: any) { setMsg(`Erreur : ${e.message}`) }
  }

  const set = (k: string, v: any) => setSubj(s => ({ ...s, [k]: v }))

  return (
    <>
      <div className="page-header">
        <h2>Conformité</h2>
        <p>Évaluation des flux contre un catalogue de contrôles OSCAL (NIS2 · ANSSI · CIS)</p>
      </div>
      <div className="page-content">

        {msg && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, color: 'var(--red)', fontSize: 13 }}>{msg}</div>}

        {/* Gouvernance catalogue */}
        {meta && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            {[
              ['Catalogue', `${meta.title}`, `v${meta.version} · OSCAL ${meta.oscal_version}`],
              ['Contrôles', `${meta.total_controls}`, `propriétaire : ${meta.owner}`],
              ['Revue', meta.review_cadence || '—', `prochaine : ${meta.next_review || '—'}`],
              ['Statut', meta.status || '—', `maj : ${(meta.last_modified || '').slice(0, 10)}`],
            ].map(([k, v, sub]) => (
              <div key={k} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k}</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{v}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* Sélecteur de source */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title">Source de référence</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {sources.map(s => (
              <button key={s.id} onClick={() => setSource(s.id)}
                style={{ padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                  border: `1px solid ${source === s.id ? (FW_COLOR[s.framework] || 'var(--blue)') : 'var(--border)'}`,
                  background: source === s.id ? `${FW_COLOR[s.framework] || '#3b82f6'}18` : 'var(--bg-input)',
                  color: source === s.id ? (FW_COLOR[s.framework] || 'var(--blue)') : 'var(--text-2)' }}>
                {s.framework} · {s.control_count} contrôles
                <span style={{ display: 'block', fontSize: 10, fontWeight: 400, opacity: 0.8 }}>{s.source_version}</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Seuls les contrôles de la source sélectionnée sont chargés et évalués (profil OSCAL).
          </div>
        </div>

        <div className="grid-2 gap-4">
          {/* Sujet de test */}
          <div className="card">
            <div className="card-title">Tester un flux</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="form-group"><label className="form-label">Zone source</label><input className="form-input" value={subj.src_zone} onChange={e => set('src_zone', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Zone destination</label><input className="form-input" value={subj.dst_zone} onChange={e => set('dst_zone', e.target.value)} /></div>
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="form-group"><label className="form-label">Confiance source : {subj.src_trust}</label><input type="range" min="0" max="100" value={subj.src_trust} onChange={e => set('src_trust', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--blue)' }} /></div>
                <div className="form-group"><label className="form-label">Confiance dest. : {subj.dst_trust}</label><input type="range" min="0" max="100" value={subj.dst_trust} onChange={e => set('dst_trust', Number(e.target.value))} style={{ width: '100%', accentColor: 'var(--blue)' }} /></div>
              </div>
              <div className="grid-2" style={{ gap: 10 }}>
                <div className="form-group"><label className="form-label">Port</label><input className="form-input" type="number" value={subj.port} onChange={e => set('port', Number(e.target.value))} /></div>
                <div className="form-group"><label className="form-label">Protocole</label>
                  <select className="form-select" value={subj.protocol} onChange={e => set('protocol', e.target.value)}>
                    <option value="tcp">tcp</option><option value="udp">udp</option><option value="icmp">icmp</option>
                  </select>
                </div>
              </div>
              <div className="form-group"><label className="form-label">Zones traversées (chemin, séparées par virgule)</label><input className="form-input" value={subj.path_zones} onChange={e => set('path_zones', e.target.value)} /></div>
              <button className="btn btn-primary" onClick={evaluate}>Évaluer la conformité</button>
            </div>
          </div>

          {/* Résultat */}
          <div className="card">
            <div className="card-title">Résultat</div>
            {!report && <div className="empty-state" style={{ padding: 30 }}>Lancez une évaluation pour voir le verdict.</div>}
            {report && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                  background: report.summary.compliant ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${report.summary.compliant ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                  <span style={{ fontSize: 20 }}>{report.summary.compliant ? '✓' : '✕'}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: report.summary.compliant ? '#22c55e' : '#ef4444' }}>
                      {report.summary.compliant ? 'Conforme' : `${report.summary.violations} violation(s)`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {report.summary.satisfied}/{report.summary.total} contrôles satisfaits · catalogue v{report.catalog_version} · source {report.source || 'toutes'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                  {report.findings.map(f => (
                    <div key={f.control_id} style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-input)',
                      borderLeft: `3px solid ${f.status === 'not-satisfied' ? (SEV_COLOR[f.severity] || '#ef4444') : f.status === 'error' ? '#f59e0b' : '#22c55e'}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 12 }}>{f.status === 'not-satisfied' ? '✕' : f.status === 'error' ? '!' : '✓'}</span>
                        <span style={{ fontWeight: 600, fontSize: 12 }}>{f.control_label}</span>
                        <span style={{ fontSize: 10, color: 'var(--text-3)' }}>v{f.control_version}</span>
                        {f.status === 'not-satisfied' && (
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 700, background: `${SEV_COLOR[f.severity]}22`, color: SEV_COLOR[f.severity] }}>{f.severity}</span>
                        )}
                        <span style={{ flex: 1 }} />
                        {f.frameworks.map(fw => (
                          <span key={fw} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, fontWeight: 700, background: `${FW_COLOR[fw] || '#64748b'}1e`, color: FW_COLOR[fw] || '#64748b' }}>{fw}</span>
                        ))}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{f.title}</div>
                      {f.status === 'not-satisfied' && f.citations[0] && (
                        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontStyle: 'italic' }}>📖 {f.citations[0].title}</div>
                      )}
                      {f.status === 'error' && <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4 }}>⚠ {f.detail}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Contrôles de la source */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">Contrôles chargés — {source} ({controls.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {controls.map(c => (
              <div key={c.id} style={{ padding: '10px 12px', background: 'var(--bg-input)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{c.label}</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, fontWeight: 700, background: `${SEV_COLOR[c.severity]}22`, color: SEV_COLOR[c.severity] }}>{c.severity}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{c.group}</span>
                  <span style={{ flex: 1 }} />
                  {c.frameworks.map(fw => (
                    <span key={fw} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 5, fontWeight: 700, background: `${FW_COLOR[fw] || '#64748b'}1e`, color: FW_COLOR[fw] || '#64748b' }}>{fw}</span>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{c.title}</div>
                <code style={{ display: 'block', fontSize: 11, color: '#ffa657', marginTop: 4, fontFamily: 'monospace', wordBreak: 'break-all' }}>{c.expression}</code>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
