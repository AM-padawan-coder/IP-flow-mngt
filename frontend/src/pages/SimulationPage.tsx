import { useState, useEffect } from 'react'
import { api } from '../api/client'

type Tab = 'whatif' | 'loops' | 'impact' | 'spof'

const RISK_STYLE: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  low:     { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',   label: 'Risque faible',   icon: '✓' },
  medium:  { color: '#eab308', bg: 'rgba(234,179,8,0.1)',   label: 'Risque modéré',   icon: '!' },
  high:    { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Risque élevé',    icon: '⚠' },
  blocked: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Flux bloqué',     icon: '✕' },
}

const STATUS_COLORS: Record<string, string> = {
  validated: '#22c55e', deployed: '#14b8a6', rejected: '#ef4444', pending: '#8b93a8',
}

export default function SimulationPage() {
  const [tab, setTab] = useState<Tab>('whatif')

  return (
    <>
      <div className="page-header">
        <h2>Simulation & Vérification avant production</h2>
        <p>Analysez l'impact d'un changement avant de l'appliquer — What-if, boucles, impact équipement</p>
      </div>
      <div className="page-content">
        <div className="script-tabs mb-4">
          <button className={`script-tab${tab === 'whatif'  ? ' active' : ''}`} onClick={() => setTab('whatif')}><i className="ti ti-microscope" style={{ marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true" />Simulation What-if</button>
          <button className={`script-tab${tab === 'loops'   ? ' active' : ''}`} onClick={() => setTab('loops')}><i className="ti ti-rotate-clockwise-2" style={{ marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true" />Détection de boucles</button>
          <button className={`script-tab${tab === 'impact'  ? ' active' : ''}`} onClick={() => setTab('impact')}><i className="ti ti-bomb" style={{ marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true" />Analyse d'impact</button>
          <button className={`script-tab${tab === 'spof'    ? ' active' : ''}`} onClick={() => setTab('spof')}><i className="ti ti-bolt" style={{ marginRight: 5, verticalAlign: 'middle' }} aria-hidden="true" />SPOF</button>
        </div>
        {tab === 'whatif' && <WhatIfPanel />}
        {tab === 'loops'  && <LoopsPanel />}
        {tab === 'impact' && <ImpactPanel />}
        {tab === 'spof'   && <SpofPanel />}
      </div>
    </>
  )
}

// ── What-if ──────────────────────────────────────────────────────────────────
function WhatIfPanel() {
  const [form, setForm] = useState({ src_ip: '', dst_ip: '', port: '', protocol: 'tcp', application: '', justification: '' })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [recentFlows, setRecentFlows] = useState<any[]>([])
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    api.getFlows().then((r: any) => setRecentFlows((r as any[]).slice(0, 4)))
  }, [])

  const DEMOS = [
    { label: 'LAN → App HTTPS', src_ip: '10.10.1.50', dst_ip: '172.16.10.100', port: '443', protocol: 'tcp', application: 'SAP', justification: '' },
    { label: 'WiFi → Base SQL', src_ip: '10.20.1.30', dst_ip: '172.16.20.50',  port: '5432', protocol: 'tcp', application: 'Mobile API', justification: '' },
    { label: 'Telnet (interdit)', src_ip: '10.10.2.5', dst_ip: '172.16.10.50', port: '23',   protocol: 'tcp', application: 'Test', justification: '' },
  ]

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null)
    try {
      const r = await api.whatif(form)
      setResult(r)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const isValid = form.src_ip && form.dst_ip && form.port
  const risk = result ? RISK_STYLE[result.risk_level] ?? RISK_STYLE.low : null

  return (
    <div>
      <div className="card mb-4">
        <div className="card-title"><i className="ti ti-bolt" style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />Scénarios rapides</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEMOS.map(d => (
            <button key={d.label} className="btn btn-ghost btn-sm"
              onClick={() => { const { label, ...f } = d; void label; setForm(f); setResult(null) }}>
              {d.label}
            </button>
          ))}
          {recentFlows.length > 0 && (
            <>
              <span style={{ borderLeft: '1px solid var(--border)', margin: '0 4px' }} />
              {recentFlows.map(f => (
                <button key={f.id} className="btn btn-ghost btn-sm"
                  onClick={() => { setForm({ src_ip: f.src_ip, dst_ip: f.dst_ip, port: f.port, protocol: f.protocol, application: f.application || '', justification: '' }); setResult(null) }}
                  title={`Flux #${f.id} — ${f.application || ''}`}
                >
                  #{f.id} {f.src_ip}→{f.dst_ip}:{f.port}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="grid-2 gap-4">
        {/* Form */}
        <div className="card">
          <div className="card-title"><i className="ti ti-microscope" style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />Paramètres du flux à simuler</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">IP Source *</label>
                <input className="form-input mono" placeholder="10.10.1.50" value={form.src_ip} onChange={e => set('src_ip', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">IP Destination *</label>
                <input className="form-input mono" placeholder="172.16.10.100" value={form.dst_ip} onChange={e => set('dst_ip', e.target.value)} /></div>
            </div>
            <div className="grid-2">
              <div className="form-group"><label className="form-label">Port *</label>
                <input className="form-input mono" placeholder="443" value={form.port} onChange={e => set('port', e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Protocole</label>
                <select className="form-select" value={form.protocol} onChange={e => set('protocol', e.target.value)}>
                  <option value="tcp">TCP</option><option value="udp">UDP</option>
                  <option value="icmp">ICMP</option><option value="any">ANY</option>
                </select></div>
            </div>
            <div className="form-group"><label className="form-label">Application</label>
              <input className="form-input" placeholder="Nom de l'application..." value={form.application} onChange={e => set('application', e.target.value)} /></div>
            <button className="btn btn-primary" onClick={analyze} disabled={!isValid || loading} style={{ alignSelf: 'flex-start' }}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Simulation…</> : '▶ Simuler'}
            </button>
            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13 }}>⚠ {error}</div>}
          </div>
        </div>

        {/* Result summary */}
        {result ? (
          <div className="card">
            <div className="card-title">Résultat de simulation</div>

            {/* Risk badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 8, background: risk!.bg, border: `1px solid ${risk!.color}33`, marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: risk!.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>{risk!.icon}</div>
              <div>
                <div style={{ fontWeight: 700, color: risk!.color, fontSize: 15 }}>{risk!.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {result.flows_on_path.length} flux existant(s) sur le même chemin
                </div>
              </div>
            </div>

            {/* Validation checks */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Validation</div>
            <div className="check-list mb-4">
              {result.validation.checks?.slice(0, 4).map((c: any, i: number) => (
                <div key={i} className={`check-item ${c.status}`}>
                  <div className={`check-dot ${c.status}`}>{c.status === 'ok' ? '✓' : c.status === 'error' ? '✕' : '!'}</div>
                  <div><div className="check-name">{c.check}</div><div className="check-msg">{c.message}</div></div>
                </div>
              ))}
            </div>

            {/* Path */}
            {result.path?.found && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Chemin ({result.path.hops.length} hop(s))</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 4 }}>
                  {result.path.hops.map((h: any, i: number) => (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontFamily: 'monospace' }}>{h.equipment}</span>
                      {i < result.path.hops.length - 1 && <span style={{ color: 'var(--text-3)' }}>→</span>}
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="empty-state">
              <div className="empty-state-icon"><i className="ti ti-microscope" style={{ fontSize: 28 }} aria-hidden="true" /></div>
              <div>Renseignez les paramètres et cliquez sur Simuler</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 6 }}>Aucune donnée n'est enregistrée en base</div>
            </div>
          </div>
        )}
      </div>

      {/* Flows on path */}
      {result?.flows_on_path?.length > 0 && (
        <div className="card mt-4">
          <div className="card-title">⚠ Flux existants traversant le même chemin ({result.flows_on_path.length})</div>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
            Ces flux utilisent déjà des équipements de votre chemin simulé. Une nouvelle règle sur ces équipements pourrait interférer avec leur trafic.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th><th>Source</th><th>Destination</th><th>Port/Proto</th>
                  <th>Application</th><th>Statut</th><th>Équipements partagés</th>
                </tr>
              </thead>
              <tbody>
                {result.flows_on_path.map((f: any) => (
                  <tr key={f.id}>
                    <td className="mono">{f.id}</td>
                    <td className="mono">{f.src_ip}</td>
                    <td className="mono">{f.dst_ip}</td>
                    <td className="mono">{f.port}/{f.protocol}</td>
                    <td>{f.application}</td>
                    <td><span style={{ background: (STATUS_COLORS[f.status] ?? '#8b93a8') + '20', color: STATUS_COLORS[f.status] ?? '#8b93a8', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{f.status}</span></td>
                    <td>{f.shared_equipment.map((e: string) => (
                      <span key={e} style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--red)', padding: '1px 7px', borderRadius: 4, fontSize: 11, marginRight: 4 }}>{e}</span>
                    ))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {result?.flows_on_path?.length === 0 && result?.path?.found && (
        <div className="card mt-4" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--green)' }}>
            <span style={{ fontSize: 22 }}>✓</span>
            <div>
              <div style={{ fontWeight: 700 }}>Aucun conflit détecté</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>Ce flux ne partage aucun équipement avec des flux validés existants.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SPOF detection ───────────────────────────────────────────────────────────
function SpofPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const analyze = async () => {
    setLoading(true)
    try { const r = await api.detectSpof(); setResult(r) }
    finally { setLoading(false) }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="card mb-4">
        <div className="card-title"><i className="ti ti-bolt" style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />Détection de SPOF (Single Points of Failure)</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Identifie les équipements dont la panne rendrait le réseau non-connexe (points d'articulation du graphe de topologie). Un SPOF avec des flux actifs est une vulnérabilité critique à adresser en priorité.
        </p>
        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyse en cours…</> : '▶ Analyser la topologie'}
        </button>
      </div>

      {result && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 8, marginBottom: 16,
            background: result.has_spof ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${result.has_spof ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'}` }}>
            <span style={{ fontSize: 28 }}>{result.has_spof ? '⚠' : '✓'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: result.has_spof ? 'var(--red)' : 'var(--green)' }}>
                {result.has_spof ? `${result.spof_count} SPOF détecté(s)` : 'Aucun SPOF — topologie résiliente'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                Topologie analysée : {result.node_count} équipements · {result.edge_count} liens
              </div>
            </div>
          </div>

          {result.spof_nodes?.map((node: any, i: number) => {
            const critical = node.impacted_flows > 0
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', background: critical ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)', border: `1px solid ${critical ? 'rgba(239,68,68,0.25)' : 'var(--border)'}`, borderRadius: 8, marginBottom: 8 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: critical ? 'rgba(239,68,68,0.2)' : 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                  {critical ? '🔴' : '🟡'}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', fontFamily: 'monospace' }}>{node.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{node.type} · {node.vendor}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: critical ? 'var(--red)' : 'var(--text-2)', lineHeight: 1 }}>{node.impacted_flows}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>flux actifs</div>
                </div>
                <div style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: critical ? 'rgba(239,68,68,0.15)' : 'rgba(234,179,8,0.15)', color: critical ? 'var(--red)' : '#eab308' }}>
                  {critical ? 'CRITIQUE' : 'Attention'}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Loop detection ────────────────────────────────────────────────────────────
function LoopsPanel() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const analyze = async () => {
    setLoading(true)
    try {
      const r = await api.detectLoops()
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="card mb-4">
        <div className="card-title"><i className="ti ti-rotate-clockwise-2" style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />Détection de boucles L2/L3</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Analyse le graphe de topologie pour détecter des boucles de routage (L3) ou de commutation (L2) qui pourraient causer des tempêtes de broadcast ou des routes infinies.
        </p>
        <button className="btn btn-primary" onClick={analyze} disabled={loading}>
          {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyse en cours…</> : '▶ Analyser la topologie'}
        </button>
      </div>

      {result && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 8,
            background: result.has_loops ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.08)',
            border: `1px solid ${result.has_loops ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.2)'}`,
            marginBottom: result.has_loops ? 20 : 0 }}>
            <span style={{ fontSize: 28 }}>{result.has_loops ? '⚠' : '✓'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: result.has_loops ? 'var(--red)' : 'var(--green)' }}>
                {result.has_loops ? `${result.cycle_count} boucle(s) détectée(s)` : 'Aucune boucle détectée'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                Topologie analysée : {result.node_count} équipements · {result.edge_count} liens
              </div>
            </div>
          </div>

          {result.cycles?.map((cycle: string[], i: number) => (
            <div key={i} style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, padding: '12px 14px', marginTop: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--red)', marginBottom: 8 }}>Boucle #{i + 1}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[...cycle, cycle[0]].map((node, j) => (
                  <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontFamily: 'monospace' }}>{node}</span>
                    {j < cycle.length && <span style={{ color: 'var(--red)', fontSize: 12 }}>→</span>}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Impact analysis ──────────────────────────────────────────────────────────
function ImpactPanel() {
  const [equipment, setEquipment] = useState<any[]>([])
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    api.listEquipment().then((r: any) => setEquipment(r as any[]))
  }, [])

  const analyze = async () => {
    if (!selected) return
    setLoading(true); setResult(null)
    try {
      const r = await api.equipmentImpact(selected)
      setResult(r)
    } finally {
      setLoading(false)
    }
  }

  const TYPE_ICON: Record<string, string> = { firewall: '🛡', router: '⬡', nsx: '☁', switch: '⬡' }

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="card mb-4">
        <div className="card-title"><i className="ti ti-bomb" style={{ marginRight: 6, verticalAlign: 'middle' }} aria-hidden="true" />Analyse d'impact — simulation de panne</div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
          Sélectionnez un équipement et découvrez quels flux validés seraient interrompus en cas de panne ou de maintenance.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className="form-select" style={{ maxWidth: 320 }} value={selected} onChange={e => { setSelected(e.target.value); setResult(null) }}>
            <option value="">— Sélectionner un équipement —</option>
            {equipment.map((eq: any) => (
              <option key={eq.id} value={eq.name}>{TYPE_ICON[eq.type] ?? '⬡'} {eq.name} ({eq.vendor})</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={analyze} disabled={!selected || loading}>
            {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyse…</> : '▶ Analyser'}
          </button>
        </div>
      </div>

      {result && (
        <div>
          {/* Equipment summary */}
          <div className="card mb-4" style={{
            borderLeft: `4px solid ${result.impacted_count > 0 ? 'var(--red)' : 'var(--green)'}`,
          }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{result.equipment}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  {result.type} · {result.vendor} · {result.model || '—'}
                  {result.management_ip && <> · <span className="mono">{result.management_ip}</span></>}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 700, color: result.impacted_count > 0 ? 'var(--red)' : 'var(--green)', lineHeight: 1 }}>{result.impacted_count}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>flux impacté(s)</div>
              </div>
            </div>
          </div>

          {result.impacted_count === 0 ? (
            <div className="card" style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', color: 'var(--green)' }}>
                <span style={{ fontSize: 22 }}>✓</span>
                <div>
                  <div style={{ fontWeight: 700 }}>Aucun flux impacté</div>
                  <div style={{ fontSize: 13, opacity: 0.8, marginTop: 2 }}>Cet équipement ne se trouve sur le chemin d'aucun flux validé ou déployé.</div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="card mb-4">
                <div className="card-title">Flux interrompus si {result.equipment} tombe ({result.impacted_count})</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>#</th><th>Source</th><th>Destination</th><th>Port/Proto</th><th>Application</th><th>Statut</th><th>Date</th></tr></thead>
                    <tbody>
                      {result.flows.map((f: any) => (
                        <tr key={f.id}>
                          <td className="mono">{f.id}</td>
                          <td className="mono">{f.src_ip}</td>
                          <td className="mono">{f.dst_ip}</td>
                          <td className="mono">{f.port}/{f.protocol}</td>
                          <td>{f.application}</td>
                          <td><span style={{ background: (STATUS_COLORS[f.status] ?? '#8b93a8') + '20', color: STATUS_COLORS[f.status] ?? '#8b93a8', padding: '2px 8px', borderRadius: 100, fontSize: 11, fontWeight: 600 }}>{f.status}</span></td>
                          <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{new Date(f.created_at).toLocaleDateString('fr-FR')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Proposed actions */}
              <div className="card" style={{ background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div className="card-title" style={{ color: '#c4b5fd' }}>🛠 Actions proposées</div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
                  Actions envisageables pour limiter l'impact ou préparer la maintenance de <strong>{result.equipment}</strong>.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { icon: 'ti ti-lock', action: 'Bloquer le trafic via une règle ACL DENY', desc: `Ajouter une règle ACL DENY any→any sur ${result.equipment} pour bloquer le trafic avant maintenance`, page: 'policies' },
                    { icon: 'ti ti-map-2', action: 'Vérifier les routes passant par cet équipement', desc: `Consulter la table de routage de ${result.equipment} pour identifier les routes alternatives possibles`, page: 'policies' },
                    { icon: 'ti ti-rotate-clockwise-2', action: 'Analyser les boucles induites par la suppression', desc: 'Lancer la détection de boucles pour vérifier si la suppression crée une boucle L2/L3', page: 'loops' },
                    { icon: 'ti ti-clipboard-list', action: `Notifier les propriétaires des ${result.impacted_count} flux`, desc: 'Exporter la liste des flux impactés pour notification des équipes responsables', page: null },
                  ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 8 }}>
                      <span style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: 'center', color: 'var(--blue)' }}><i className={item.icon} aria-hidden="true" /></span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{item.action}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
