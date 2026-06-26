import { useState } from 'react'
import type { ScriptsResult } from '../types'

const VENDOR_LABELS: Record<string, string> = {
  stormshield: 'Stormshield CLI',
  paloalto:    'PAN-OS set',
  juniper:     'Junos set',
  nsx:         'NSX-T REST',
  fortinet:    'FortiOS CLI',
  checkpoint:  'CPAPI mgmt',
}

export default function ScriptPanel({ scripts }: { scripts: ScriptsResult }) {
  const entries = Object.entries(scripts?.scripts || {})
  const [active, setActive] = useState(entries[0]?.[0] || '')
  const [copied, setCopied] = useState(false)

  if (!entries.length) {
    return (
      <div className="card">
        <div className="card-title">Scripts générés</div>
        <div className="empty-state">
          <div className="empty-state-icon">📄</div>
          <div>Aucun script disponible</div>
        </div>
      </div>
    )
  }

  const current = scripts.scripts[active]

  const copy = () => {
    navigator.clipboard.writeText(current?.script || '')
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="card">
      <div className="card-title flex justify-between items-center">
        <span>Scripts générés</span>
        {scripts.rule_id && (
          <span className="mono text-xs text-dimmed">#{scripts.rule_id}</span>
        )}
      </div>

      <div className="script-tabs">
        {entries.map(([eqName, sc]) => (
          <button
            key={eqName}
            className={`script-tab${active === eqName ? ' active' : ''}`}
            onClick={() => setActive(eqName)}
          >
            {VENDOR_LABELS[sc.vendor] || sc.vendor} · {eqName}
          </button>
        ))}
      </div>

      {current && (
        <>
          <div className="text-xs text-muted mb-2">
            {current.action} — <span className={`vendor-badge vendor-${current.vendor}`}>{current.vendor}</span>
          </div>
          <div className="script-block">
            <button className="copy-btn" onClick={copy}>{copied ? '✓ Copié' : 'Copier'}</button>
            <pre>{current.script}</pre>
          </div>
        </>
      )}
    </div>
  )
}
