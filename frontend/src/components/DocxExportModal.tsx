import { useState } from 'react'
import { api } from '../api/client'

type ExportFormat = 'csv' | 'docx'

interface Props {
  onClose: () => void
  format: ExportFormat
  // CSV: use pre-filtered flows already in memory
  flows?: any[]
  // DOCX: delegate filtering to the backend
  search?: string
  statusFilters?: string[]
}

const STATUS_LABELS: Record<string, string> = {
  validated: 'Validé', deployed: 'Déployé', rejected: 'Refusé', pending: 'En attente',
}

const ALL_COLUMNS = [
  { key: 'id',            label: 'ID',             get: (f: any) => String(f.id) },
  { key: 'date',          label: 'Date',            get: (f: any) => new Date(f.created_at).toLocaleDateString('fr-FR') },
  { key: 'src_ip',        label: 'IP Source',       get: (f: any) => f.src_ip || '' },
  { key: 'dst_ip',        label: 'IP Destination',  get: (f: any) => f.dst_ip || '' },
  { key: 'port',          label: 'Port',            get: (f: any) => String(f.port || '') },
  { key: 'protocol',      label: 'Protocole',       get: (f: any) => (f.protocol || '').toUpperCase() },
  { key: 'application',   label: 'Application',     get: (f: any) => f.application || '' },
  { key: 'analyst',       label: 'Analyste',        get: (f: any) => f.analyst || '' },
  { key: 'status',        label: 'Statut',          get: (f: any) => STATUS_LABELS[f.status] ?? f.status },
  { key: 'justification', label: 'Justification',   get: (f: any) => f.justification || '' },
]

const DEFAULT_ENABLED = new Set([
  'id', 'date', 'src_ip', 'dst_ip', 'port', 'protocol', 'application', 'analyst', 'status',
])

function downloadCsv(flows: any[], orderedCols: string[]) {
  const cols = orderedCols.map(k => ALL_COLUMNS.find(c => c.key === k)!)
  const BOM = '﻿'
  const headers = cols.map(c => c.label)
  const rows = flows.map(f => cols.map(c => c.get(f)))
  const csv = BOM + [headers, ...rows]
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flux_${new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export default function DocxExportModal({
  onClose, format, flows = [], search = '', statusFilters = [],
}: Props) {
  const [enabled, setEnabled] = useState<Set<string>>(new Set(DEFAULT_ENABLED))
  const [order, setOrder]     = useState<string[]>(ALL_COLUMNS.map(c => c.key))
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

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
    setError('')

    if (format === 'csv') {
      downloadCsv(flows, orderedCols)
      onClose()
      return
    }

    setLoading(true)
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

  const isCsv   = format === 'csv'
  const icon    = isCsv ? 'ti-file-spreadsheet' : 'ti-file-word'
  const color   = isCsv ? '#16a34a' : '#2563eb'
  const title   = isCsv ? 'Export Excel (.csv)' : 'Export Word (.docx)'
  const btnLabel = isCsv ? 'Télécharger .csv' : (loading ? 'Génération…' : 'Télécharger .docx')

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
          <i className={`ti ${icon}`} style={{ fontSize: 20, color }} />
          <span style={{ fontWeight: 700, fontSize: 15, flex: 1 }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 18, padding: '0 4px', lineHeight: 1, fontFamily: 'inherit' }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 14 }}>
            Sélectionnez et ordonnez les colonnes à inclure dans le fichier.
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
                    background: checked ? `${color}12` : 'var(--bg-input)',
                    border: `1px solid ${checked ? `${color}44` : 'var(--border)'}`,
                    transition: 'background 0.12s, border-color 0.12s',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(key)}
                    onClick={e => e.stopPropagation()}
                    style={{ accentColor: color, cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, fontSize: 13, color: checked ? 'var(--text-1)' : 'var(--text-3)' }}>
                    {col.label}
                  </span>
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
                            fontFamily: 'inherit',
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

          {error && <div style={{ marginTop: 10, color: '#ef4444', fontSize: 12 }}>{error}</div>}

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
              style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: loading ? '#1d4ed8' : color, color: '#fff', cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <i className="ti ti-download" />
              {btnLabel}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
