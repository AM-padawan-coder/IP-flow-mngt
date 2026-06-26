import type { PathResult } from '../types'

const VENDOR_ICONS: Record<string, string> = {
  stormshield: '🔵',
  paloalto:    '🔴',
  juniper:     '🟢',
  nsx:         '🟣',
  fortinet:    '🟡',
  checkpoint:  '🟠',
}

const TYPE_ICONS: Record<string, string> = {
  firewall: '🛡',
  router:   '🔀',
  switch:   '⇄',
  nsx:      '☁',
}

export default function PathPanel({ path }: { path: PathResult }) {
  if (!path.found) {
    return (
      <div className="card">
        <div className="card-title">Chemin réseau</div>
        <div className="empty-state">
          <div className="empty-state-icon">⚠</div>
          <div>{path.error || 'Chemin non trouvé'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-title flex justify-between items-center">
        <span>Chemin réseau</span>
        <span className="badge badge-info">{path.summary}</span>
      </div>

      <div className="path-list">
        {path.hops.map((hop, i) => (
          <div key={i} className="path-hop">
            {/* Connector line */}
            {i < path.hops.length - 1 && (
              <div style={{
                position: 'absolute', left: 17, top: 52, width: 2, height: 'calc(100% - 14px)',
                background: 'var(--border)', zIndex: 0,
              }} />
            )}
            <div className="hop-icon" style={{ zIndex: 1 }}>
              {VENDOR_ICONS[hop.vendor] || TYPE_ICONS[hop.type] || '◻'}
            </div>
            <div className="hop-body">
              <div className="hop-name">{hop.equipment}</div>
              <div className="hop-meta">
                <span className={`vendor-badge vendor-${hop.vendor}`}>{hop.vendor}</span>
                {hop.model && <span className="text-xs text-dimmed" style={{ marginLeft: 6 }}>{hop.model}</span>}
                {hop.management_ip && (
                  <span className="mono text-xs text-dimmed" style={{ marginLeft: 8 }}>🖥 {hop.management_ip}</span>
                )}
              </div>
              <div className="hop-action">{hop.action}</div>
              {hop.interfaces.length > 0 && (
                <div className="hop-ifaces">
                  {hop.interfaces.slice(0, 3).map((iface, j) => (
                    <span key={j} className="hop-iface" title={`${iface.network} (${iface.role})`}>
                      {iface.interface} · {iface.ip}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
