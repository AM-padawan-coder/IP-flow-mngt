import { useState } from 'react'
import { api } from '../api/client'

interface Props {
  onClose: () => void
  search: string
  statusFilters: string[]
}

const ALL_COLUMNS = [
  { key: 'id',            label: 'ID' },
  { key: 'date',          label: 'Date' },
  { key: 'src_ip',        label: 'IP Source' },
  { key: 'dst_ip',        label: 'IP Destination' },
  { key: 'port',          label: 'Port' },
  { key: 'protocol',      label: 'Protocole' },
  { key: 'application',   label: 'Application' },
  { key: 'analyst',       label: 'Analyste' },
  { key: 'status',        label: 'Statut' },
  { key: 'justification', label: 'Justification' },
]

const DEFAULT_ENABLED = new Set([
  'id','date','src_ip','dst_ip','port','protocol','application','analyst','status',
])

const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente',
}

export default function DocxExportModal({ onClose, search, statusFilters }: Props) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED))
  const [order, setOrder]   = useState<string[]>(ALL_COLUMNS.map(c => c.key))
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  const toggle = (key: string) =>
    setEnabled(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const move = (key: string, dir: -1 | 1) =>
    setOrder(prev => {
      const idx  = prev.indexOf(key)
      const next = idx + dir
      if (next < 0 || next >= prev.length) return prev
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })

  const download = async () => {
    const orderedCols = order.filter(k => enabled.has(k))
    if (orderedCols.length === 0) { setError('Sélectionnez au moins une colonne.'); return }
    setLoading(true)
    setError('')
    try {
      const blob = await api.exportFlowsDocx({
        columns:  orderedCols.join(','),
        statuses: statusFilters.length > 0 ? statusFilters.join(',') : undefined,
        search:   search || undefined,
      })
      const ts  = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '')
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `flux_${ts}.docx`
      a.click()
      URL.revokeObjectURL(url)
      onClose()
    } catch (e: any) {
      setError(e.message || "Erreur lors de l'export.")
    }
    setLoading(false)
  }

  const filterSummary = [
    statusFilters.length > 0 && `Statut : ${statusFilters.map(s => STATUS_LABELS[s] ?? s).join(', ')}`,
    search && `Recherche : "${search}"`,
  ].filter(Boolean).join(' · ')

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '92vw', maxWidth: 460, background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <i className="ti ti-file-word" style={{ fontSize: 20, color: '#2563eb' }} />
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>Export Word (.docx)</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Sélectionnez et ordonnez les colonnes à inclure dans le document.
            {filterSummary && (
              <div style={{ marginTop: 4, color: 'var(--text-2)' }}>
                <i className="ti ti-filter" style={{ marginRight: 4, fontSize: 11 }} />{filterSummary}
              </div>
            )}
          </div>

          {/* Column list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {order.map((key, idx) => {
              const col     = ALL_COLUMNS.find(c => c.key === key)!
              const checked = enabled.has(key)
              return (
                <div
                  key={key}
                  onClick={() => toggle(key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', borderRadius: 6, cursor: 'pointer',
                    background: checked ? 'rgba(37,99,235,0.07)' : 'var(--bg-input)',
                    border: `1px solid ${checked ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: checked ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {col.label}
                  </span>
                  {/* Reorder arrows */}
                  <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                    {(['up', 'down'] as const).map(d => {
                      const disabled = d === 'up' ? idx === 0 : idx === order.length - 1
                      return (
                        <button
                          key={d}
                          onClick={e => { e.stopPropagation(); move(key, d === 'up' ? -1 : 1) }}
                          disabled={disabled}
                          style={{
                            width: 24, height: 24, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 4, border: '1px solid var(--border)',
                            background: disabled ? 'transparent' : 'var(--bg-card)',
                            color: disabled ? 'var(--border)' : 'var(--text-2)',
                            cursor: disabled ? 'default' : 'pointer',
                            fontFamily: 'inherit', fontSize: 12,
                          }}
                        >
                          <i className={`ti ti-chevron-${d}`} style={{ fontSize: 12 }} />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          {error && (
            <div style={{ marginTop: 10, color: '#ef4444', fontSize: 12 }}>{error}</div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 18 }}>
            <button
              onClick={onClose}
              style={{ padding: '7px 16px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
            >
              Annuler
            </button>
            <button
              onClick={download}
              disabled={loading}
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: loading ? '#1d4ed8' : '#2563eb', color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <i className="ti ti-download" />
              {loading ? 'Génération…' : 'Télécharger .docx'}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
