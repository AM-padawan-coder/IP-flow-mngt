import type { ValidationResult } from '../types'

const ICONS = { ok: '✓', error: '✕', warning: '!', info: 'i' }

export default function ValidationPanel({ result }: { result: ValidationResult }) {
  const { valid, checks, src_zone, dst_zone, src_network, dst_network } = result

  return (
    <div className="card">
      <div className={`result-header ${valid ? 'valid' : 'invalid'}`}>
        <span className="result-icon">{valid ? '✅' : '❌'}</span>
        <div>
          <div className="result-title">{valid ? 'Flux valide' : 'Flux refusé'}</div>
          <div className="result-sub">
            {valid
              ? `${checks.filter(c => c.status === 'ok').length} contrôles passés`
              : `${checks.filter(c => c.status === 'error').length} erreur(s) bloquante(s)`}
          </div>
        </div>
      </div>

      {src_zone && dst_zone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Flux :</span>
          <span className="badge badge-info">{src_zone}</span>
          {src_network && <span className="mono text-xs text-dimmed">{src_network.cidr}</span>}
          <span style={{ color: 'var(--text-3)' }}>→</span>
          <span className="badge badge-info">{dst_zone}</span>
          {dst_network && <span className="mono text-xs text-dimmed">{dst_network.cidr}</span>}
        </div>
      )}

      <div className="card-title">Contrôles de validation</div>
      <div className="check-list">
        {checks.map((c, i) => (
          <div key={i} className={`check-item ${c.status}`}>
            <div className={`check-dot ${c.status}`}>{ICONS[c.status]}</div>
            <div>
              <div className="check-name">{c.name}</div>
              <div className="check-msg">{c.message}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
