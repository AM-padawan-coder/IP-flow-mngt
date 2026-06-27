import { useEffect, useState } from 'react'
import { api } from '../api/client'

interface Props {
  flowId: number
  onClose: () => void
  onDeleted: () => void
  onStatusChanged?: () => void
}

const STATUS_COLOR: Record<string, string> = {
  validated: '#22c55e', deployed: '#3b82f6', rejected: '#ef4444', pending: '#eab308',
}
const STATUS_LABEL: Record<string, string> = {
  validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente',
}

export default function FlowDetailModal({ flowId, onClose, onDeleted, onStatusChanged }: Props) {
  const [flow, setFlow] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [openSection, setOpenSection] = useState<string[]>(['validation', 'path'])

  useEffect(() => {
    api.getFlow(flowId).then(d => { setFlow(d); setLoading(false) })
  }, [flowId])

  const toggleSection = (s: string) =>
    setOpenSection(o => o.includes(s) ? o.filter(x => x !== s) : [...o, s])

  const handleDelete = async () => {
    setDeleting(true)
    await api.deleteFlow(flowId)
    onDeleted()
  }

  const handleStatus = async (status: string) => {
    setUpdatingStatus(true)
    await api.updateFlowStatus(flowId, status)
    setFlow((f: any) => ({ ...f, status }))
    setUpdatingStatus(false)
    onStatusChanged?.()
  }

  const statusColor = flow ? (STATUS_COLOR[flow.status] || '#64748b') : '#64748b'

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '90vw', maxWidth: 820, maxHeight: '88vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          {flow && <div style={{ width: 4, height: 36, borderRadius: 2, background: statusColor, flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            {flow ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>Flux #{flow.id}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: `${statusColor}22`, color: statusColor }}>
                    {STATUS_LABEL[flow.status] || flow.status}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>
                  {flow.src_ip} → {flow.dst_ip} : {flow.port}/{flow.protocol?.toUpperCase()}
                  {flow.application && <span style={{ marginLeft: 10, fontFamily: 'inherit', color: 'var(--text-2)' }}>— {flow.application}</span>}
                </div>
              </>
            ) : (
              <div style={{ color: 'var(--text-3)', fontSize: 14 }}>Chargement…</div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>✕</button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Meta */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {[
                ['Analyste', flow.analyst],
                ['Date', new Date(flow.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })],
                ['Justification', flow.justification || '—'],
              ].map(([k, v]) => (
                <div key={k} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-1)', wordBreak: 'break-word' }}>{v}</div>
                </div>
              ))}
            </div>

            {/* Validation */}
            <Section title="Vérification réseau" id="validation" open={openSection} toggle={toggleSection}>
              {flow.validation?.checks?.length ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {flow.validation.checks.map((c: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                      <span style={{ color: c.ok ? '#22c55e' : '#ef4444', fontWeight: 700, flexShrink: 0 }}>{c.ok ? '✓' : '✗'}</span>
                      <span style={{ color: c.ok ? 'var(--text-2)' : '#fca5a5' }}>{c.message}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Aucun détail de validation disponible</span>
              )}
            </Section>

            {/* Path */}
            <Section title="Chemin réseau" id="path" open={openSection} toggle={toggleSection}>
              {flow.path?.found && flow.path.hops?.length ? (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0 }}>
                  {flow.path.hops.map((hop: any, i: number) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: '5px 10px', fontSize: 11, fontFamily: 'monospace', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>
                          {hop.equipment || hop.name || hop}
                        </div>
                        {hop.role && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{hop.role}</div>}
                      </div>
                      {i < flow.path.hops.length - 1 && (
                        <div style={{ padding: '0 4px', color: 'var(--text-3)', fontSize: 14 }}>→</div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 12, color: flow.path?.found === false ? '#fca5a5' : 'var(--text-3)' }}>
                  {flow.path?.found === false ? `Chemin introuvable — ${flow.path?.reason || ''}` : 'Aucun chemin calculé'}
                </span>
              )}
            </Section>

            {/* Scripts */}
            {flow.scripts?.scripts && Object.keys(flow.scripts.scripts).length > 0 && (
              <Section title="Scripts de configuration générés" id="scripts" open={openSection} toggle={toggleSection}>
                {flow.scripts.rule_id && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>Rule ID</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>{flow.scripts.rule_id}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 4 }}>— identifiant unique de la règle, tracé dans les scripts déployés</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {Object.entries(flow.scripts.scripts).map(([eq, sc]: any) => (
                    <div key={eq}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                        {eq} <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-3)', marginLeft: 6 }}>· {sc?.action}</span>
                      </div>
                      <div className="script-block" style={{ borderRadius: 6, overflow: 'auto', maxHeight: 160 }}>
                        <pre style={{ margin: 0, fontSize: 11, lineHeight: 1.6, padding: '10px 12px' }}>{sc?.script || ''}</pre>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          {/* Status actions */}
          {flow && !confirmDelete && (
            <div style={{ display: 'flex', gap: 6, flex: 1 }}>
              {flow.status !== 'validated' && (
                <button onClick={() => handleStatus('validated')} disabled={updatingStatus} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.35)' }}>
                  ✓ Valider
                </button>
              )}
              {flow.status !== 'deployed' && (
                <button onClick={() => handleStatus('deployed')} disabled={updatingStatus} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.35)' }}>
                  🚀 Déployer
                </button>
              )}
              {flow.status !== 'rejected' && (
                <button onClick={() => handleStatus('rejected')} disabled={updatingStatus} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', fontWeight: 600, background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>
                  ✕ Refuser
                </button>
              )}
              {flow.status !== 'pending' && (
                <button onClick={() => handleStatus('pending')} disabled={updatingStatus} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', background: 'var(--bg-input)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                  ↺ En attente
                </button>
              )}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            {confirmDelete ? (
              <>
                <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>Confirmer la suppression ?</span>
                <button onClick={() => setConfirmDelete(false)} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontFamily: 'inherit' }}>Annuler</button>
                <button onClick={handleDelete} disabled={deleting} style={{ background: '#ef4444', border: 'none', borderRadius: 6, color: '#fff', cursor: deleting ? 'wait' : 'pointer', padding: '6px 14px', fontSize: 12, fontFamily: 'inherit', fontWeight: 600 }}>
                  {deleting ? 'Suppression…' : 'Supprimer définitivement'}
                </button>
              </>
            ) : (
              <>
                <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontFamily: 'inherit' }}>Fermer</button>
                <button onClick={() => setConfirmDelete(true)} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 6, color: '#ef4444', cursor: 'pointer', padding: '6px 14px', fontSize: 12, fontFamily: 'inherit' }}>
                  🗑 Supprimer
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, id, open, toggle, children }: { title: string; id: string; open: string[]; toggle: (s: string) => void; children: React.ReactNode }) {
  const isOpen = open.includes(id)
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => toggle(id)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', background: 'var(--bg-card)', border: 'none', cursor: 'pointer', fontFamily: 'inherit', color: 'var(--text-1)' }}
      >
        <span style={{ fontSize: 11, color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block' }}>▶</span>
        <span style={{ fontWeight: 600, fontSize: 12 }}>{title}</span>
      </button>
      {isOpen && (
        <div style={{ padding: '10px 14px', background: 'var(--bg-panel)' }}>{children}</div>
      )}
    </div>
  )
}
