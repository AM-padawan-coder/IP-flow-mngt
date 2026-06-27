import { useState } from 'react'
import { api } from '../api/client'
import type { AnalyzeResponse } from '../types'
import ValidationPanel from '../components/ValidationPanel'
import PathPanel from '../components/PathPanel'
import ScriptPanel from '../components/ScriptPanel'
import TopologyModal from '../components/TopologyModal'

const DEMO_FLOWS = [
  { label: 'LAN → Serveur App (HTTPS)',    src_ip: '10.10.1.50',   dst_ip: '172.16.10.100', port: '443',  protocol: 'tcp', application: 'Application RH (SAP)',    justification: 'Accès utilisateurs RH aux modules SAP' },
  { label: 'LAN → DMZ Web (HTTP)',          src_ip: '10.10.5.20',   dst_ip: '192.168.100.50', port: '80',  protocol: 'tcp', application: 'Portail intranet',        justification: 'Accès intranet bureautique' },
  { label: 'Serveur → Backup (SSH)',        src_ip: '172.16.20.10', dst_ip: '192.168.250.100', port: '22', protocol: 'tcp', application: 'Sauvegarde Oracle',       justification: 'Sauvegarde nightly base Oracle' },
  { label: 'LAN → Telnet (BLOQUÉ)',         src_ip: '10.10.2.5',    dst_ip: '172.16.10.50',  port: '23',  protocol: 'tcp', application: 'Test telnet',             justification: 'Test de connectivité' },
  { label: 'WiFi → Base de données',        src_ip: '10.20.1.30',   dst_ip: '172.16.20.50',  port: '5432', protocol: 'tcp', application: 'App mobile PostgreSQL', justification: 'API mobile vers BDD interne' },
]

export default function NewFlowPage({ onShowGraph }: { onShowGraph?: (path: string[]) => void }) {
  const [form, setForm] = useState({
    src_ip: '', dst_ip: '', port: '', protocol: 'tcp', application: '', justification: '',
  })
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResponse | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [error, setError] = useState('')
  const [topoPath, setTopoPath] = useState<string[] | null>(null)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const analyze = async () => {
    setLoading(true); setError(''); setResult(null); setSubmitted(false)
    try {
      const r = await api.analyzeFlow(form) as AnalyzeResponse
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur de connexion au serveur')
    } finally {
      setLoading(false)
    }
  }

  const submit = async () => {
    setLoading(true)
    try {
      const r = await api.submitFlow(form) as { id: number; status: string }
      setSubmitted(true)
      setSubmitMsg(`Demande #${r.id} enregistrée — statut : ${r.status}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur lors de la soumission')
    } finally {
      setLoading(false)
    }
  }

  const loadDemo = (demo: typeof DEMO_FLOWS[0]) => {
    const { label, ...fields } = demo; void label
    setForm(fields)
    setResult(null); setSubmitted(false); setError('')
  }

  const isValid = form.src_ip && form.dst_ip && form.port

  return (
    <>
      <div className="page-header">
        <h2>Nouveau flux IP</h2>
        <p>Saisissez les paramètres du flux pour validation et génération des scripts de configuration</p>
      </div>
      <div className="page-content">

        {/* Demo presets */}
        <div className="card mb-4">
          <div className="card-title">⚡ Scénarios de démonstration</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DEMO_FLOWS.map((d, i) => (
              <button key={i} className="btn btn-ghost btn-sm" onClick={() => loadDemo(d)}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid-2 gap-4">
          {/* Form */}
          <div className="card">
            <div className="card-title">Paramètres du flux</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">IP Source *</label>
                  <input className="form-input mono" placeholder="10.10.1.50"
                    value={form.src_ip} onChange={e => set('src_ip', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">IP Destination *</label>
                  <input className="form-input mono" placeholder="172.16.10.100"
                    value={form.dst_ip} onChange={e => set('dst_ip', e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Port *</label>
                  <input className="form-input mono" placeholder="443"
                    value={form.port} onChange={e => set('port', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Protocole</label>
                  <select className="form-select" value={form.protocol} onChange={e => set('protocol', e.target.value)}>
                    <option value="tcp">TCP</option>
                    <option value="udp">UDP</option>
                    <option value="icmp">ICMP</option>
                    <option value="any">ANY</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Application / Service</label>
                <input className="form-input" placeholder="ex: Application RH, Supervision SNMP…"
                  value={form.application} onChange={e => set('application', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Justification métier</label>
                <textarea className="form-input" placeholder="Justification de la demande d'ouverture de flux…"
                  value={form.justification} onChange={e => set('justification', e.target.value)} />
              </div>
              <div className="flex gap-2 mt-2">
                <button className="btn btn-primary" onClick={analyze} disabled={!isValid || loading}>
                  {loading ? <><span className="spinner" style={{width:14,height:14}}/> Analyse…</> : '▶ Analyser'}
                </button>
                {result?.validation?.valid && !submitted && (
                  <button className="btn btn-ghost" onClick={submit} disabled={loading}>
                    ✓ Soumettre la demande
                  </button>
                )}
                {result?.path?.found && (
                  <button className="btn btn-ghost" onClick={() => setTopoPath(result.path.hops.map((h: any) => h.equipment))}>
                    ⬡ Voir sur le graphe
                  </button>
                )}
              </div>
              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '10px 14px', color: 'var(--red)', fontSize: 13 }}>
                  ⚠ {error}
                </div>
              )}
              {submitted && (
                <div style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 6, padding: '10px 14px', color: '#eab308', fontSize: 13 }}>
                  ⏳ {submitMsg} — En attente de validation dans l'Historique.
                </div>
              )}
            </div>
          </div>

          {/* Validation panel */}
          {result ? (
            <ValidationPanel result={result.validation} />
          ) : (
            <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <div>Renseignez les paramètres et cliquez sur Analyser</div>
              </div>
            </div>
          )}
        </div>

        {/* Path + Scripts */}
        {result?.path?.found && (
          <div className="grid-2 gap-4 mt-4">
            <PathPanel path={result.path} />
            <ScriptPanel scripts={result.scripts} />
          </div>
        )}
      </div>

      {topoPath !== null && (
        <TopologyModal highlightedPath={topoPath} onClose={() => setTopoPath(null)} />
      )}
    </>
  )
}
