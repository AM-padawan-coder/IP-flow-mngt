import { useState, useRef, useCallback, useEffect } from 'react'

interface Props {
  onClose: () => void
  onImported?: (count: number) => void
}

/* ── JSON format ─────────────────────────────────────────────────────── */
interface JsonFlowSource {
  zones?: string[]
  ip?: string[]
  ports?: (string | number)[]
}
interface JsonFlow {
  name?: string
  source?: JsonFlowSource
  destination?: JsonFlowSource
  protocol?: string
  action?: string
  tags?: string[]
}
interface JsonImport {
  version?: string
  flows?: JsonFlow[]
}

/* ── Validation ──────────────────────────────────────────────────────── */
type Severity = 'error' | 'warning'
interface Issue { field: string; message: string; severity: Severity }
interface ValidatedFlow {
  raw: JsonFlow
  issues: Issue[]
  valid: boolean   // no blocking errors
}

const PROTOCOLS = ['TCP', 'UDP', 'ICMP', 'ANY']
const ACTIONS   = ['permit', 'deny', 'drop']

function validateFlows(flows: JsonFlow[], existingFlows: any[]): ValidatedFlow[] {
  return flows.map(f => {
    const issues: Issue[] = []

    if (!f.name || typeof f.name !== 'string' || !f.name.trim())
      issues.push({ field: 'name', message: 'Nom requis', severity: 'error' })

    if (!f.source || typeof f.source !== 'object')
      issues.push({ field: 'source', message: 'Bloc source manquant', severity: 'error' })
    else {
      if (!f.source.ip?.length && !f.source.zones?.length)
        issues.push({ field: 'source', message: 'Source : au moins une IP ou une zone requise', severity: 'warning' })
    }

    if (!f.destination || typeof f.destination !== 'object')
      issues.push({ field: 'destination', message: 'Bloc destination manquant', severity: 'error' })
    else {
      if (!f.destination.ip?.length && !f.destination.zones?.length)
        issues.push({ field: 'destination', message: 'Destination : au moins une IP ou une zone requise', severity: 'warning' })
    }

    if (f.protocol && !PROTOCOLS.includes(f.protocol.toUpperCase()))
      issues.push({ field: 'protocol', message: `Protocole inconnu : "${f.protocol}"`, severity: 'warning' })

    if (f.action && !ACTIONS.includes(f.action.toLowerCase()))
      issues.push({ field: 'action', message: `Action inconnue : "${f.action}"`, severity: 'warning' })

    // src == dst conflict
    if (f.source?.ip && f.destination?.ip) {
      const srcIps = f.source.ip
      const dstIps = f.destination.ip
      const overlap = srcIps.some(ip => dstIps.includes(ip))
      if (overlap)
        issues.push({ field: 'source', message: 'Source et destination ont des IPs identiques', severity: 'warning' })
    }

    // duplicate check
    if (existingFlows.length && f.name) {
      const dup = existingFlows.find(e =>
        e.src_ip === (f.source?.ip?.[0] || '') &&
        e.dst_ip === (f.destination?.ip?.[0] || '') &&
        String(e.port) === String(f.destination?.ports?.[0] || '') &&
        e.protocol === (f.protocol || '')
      )
      if (dup)
        issues.push({ field: 'name', message: 'Flux similaire déjà existant (src/dst/port/proto)', severity: 'warning' })
    }

    const blocking = issues.some(i => i.severity === 'error')
    return { raw: f, issues, valid: !blocking }
  })
}

/* ── Builder palette fields ──────────────────────────────────────────── */
const PALETTE_FIELDS = [
  { id: 'name',       label: 'Nom du flux',     section: 'rule',   icon: '🏷' },
  { id: 'src.zones',  label: 'Zone source',      section: 'source', icon: '⬡' },
  { id: 'src.ip',     label: 'IP source',        section: 'source', icon: '◎' },
  { id: 'src.ports',  label: 'Port source',      section: 'source', icon: '#' },
  { id: 'dst.zones',  label: 'Zone destination', section: 'dest',   icon: '⬡' },
  { id: 'dst.ip',     label: 'IP destination',   section: 'dest',   icon: '◎' },
  { id: 'dst.ports',  label: 'Port dest.',       section: 'dest',   icon: '#' },
  { id: 'protocol',   label: 'Protocole',        section: 'rule',   icon: '⇄' },
  { id: 'action',     label: 'Action',           section: 'rule',   icon: '⚡' },
  { id: 'tags',       label: 'Tags',             section: 'rule',   icon: '◈' },
]

type BuilderField = { id: string; label: string; section: string; icon: string; value: string }

function buildFlowFromFields(fields: BuilderField[]): JsonFlow {
  const get = (id: string) => fields.find(f => f.id === id)?.value || ''
  const arr = (v: string) => v ? v.split(',').map(s => s.trim()).filter(Boolean) : []

  return {
    name:        get('name') || undefined,
    source:      { zones: arr(get('src.zones')), ip: arr(get('src.ip')), ports: arr(get('src.ports')) },
    destination: { zones: arr(get('dst.zones')), ip: arr(get('dst.ip')), ports: arr(get('dst.ports')) },
    protocol:    get('protocol') || undefined,
    action:      get('action') || undefined,
    tags:        arr(get('tags')),
  }
}

/* ── Step types ──────────────────────────────────────────────────────── */
type Step = 'input' | 'preview' | 'validation' | 'import'

const STEPS: { id: Step; label: string }[] = [
  { id: 'input',      label: '1 · Saisie' },
  { id: 'preview',    label: '2 · Aperçu' },
  { id: 'validation', label: '3 · Validation' },
  { id: 'import',     label: '4 · Import' },
]

/* ── Main component ──────────────────────────────────────────────────── */
export default function FlowImportModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>('input')
  const [mode, setMode] = useState<'json' | 'builder'>('json')

  // JSON input
  const [jsonText, setJsonText] = useState('')
  const [jsonError, setJsonError] = useState('')

  // Builder
  const [activeSection, setActiveSection] = useState<'source' | 'dest' | 'rule'>('source')
  const [builderFields, setBuilderFields] = useState<BuilderField[]>([])
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [focusedField, setFocusedField] = useState<string | null>(null)

  // Parsed & validated
  const [parsedFlows, setParsedFlows] = useState<JsonFlow[]>([])
  const [validated, setValidated] = useState<ValidatedFlow[]>([])
  const [existingFlows, setExistingFlows] = useState<any[]>([])

  // Import result
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ ok: number; fail: number } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)

  /* fetch existing flows for duplicate check */
  useEffect(() => {
    fetch('/api/flows').then(r => r.ok ? r.json() : []).then(data => {
      setExistingFlows(Array.isArray(data) ? data : (data.flows || []))
    }).catch(() => {})
  }, [])

  /* ── JSON parse ── */
  const parseJson = useCallback((text: string) => {
    try {
      const parsed = JSON.parse(text) as JsonImport
      if (!parsed.flows || !Array.isArray(parsed.flows))
        return { error: 'Le JSON doit contenir un tableau "flows"', flows: [] }
      return { error: '', flows: parsed.flows }
    } catch (e: any) {
      return { error: `JSON invalide : ${e.message}`, flows: [] }
    }
  }, [])

  /* ── Nav to preview ── */
  const goPreview = () => {
    let flows: JsonFlow[]
    if (mode === 'json') {
      const { error, flows: f } = parseJson(jsonText)
      if (error) { setJsonError(error); return }
      setJsonError('')
      flows = f
    } else {
      flows = [buildFlowFromFields(builderFields)]
    }
    setParsedFlows(flows)
    setStep('preview')
  }

  /* ── Nav to validation ── */
  const goValidation = () => {
    const v = validateFlows(parsedFlows, existingFlows)
    setValidated(v)
    setStep('validation')
  }

  /* ── Import ── */
  const doImport = async () => {
    const toImport = validated.filter(v => v.valid)
    if (!toImport.length) return
    setImporting(true)
    let ok = 0; let fail = 0
    for (const { raw } of toImport) {
      const body = {
        name:        raw.name || '',
        src_ip:      raw.source?.ip?.[0] || '',
        dst_ip:      raw.destination?.ip?.[0] || '',
        port:        String(raw.destination?.ports?.[0] || ''),
        protocol:    raw.protocol || 'ANY',
        application: raw.tags?.[0] || '',
        action:      raw.action || 'permit',
      }
      try {
        const r = await fetch('/api/flows', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
        if (r.ok) ok++; else fail++
      } catch { fail++ }
    }
    setImportResult({ ok, fail })
    setImporting(false)
    setStep('import')
    if (onImported) onImported(ok)
  }

  /* ── Builder: drag from palette ── */
  const onPaletteDragStart = (e: React.DragEvent, field: typeof PALETTE_FIELDS[0]) => {
    e.dataTransfer.setData('fieldId', field.id)
  }

  const onDropSection = (e: React.DragEvent, section: string) => {
    e.preventDefault()
    setDragOver(null)
    const fieldId = e.dataTransfer.getData('fieldId')
    const meta = PALETTE_FIELDS.find(p => p.id === fieldId)
    if (!meta) return
    if (builderFields.find(f => f.id === fieldId)) return
    setBuilderFields(prev => [...prev, { ...meta, value: '' }])
  }

  const removeBuilderField = (id: string) => setBuilderFields(prev => prev.filter(f => f.id !== id))
  const updateBuilderField = (id: string, value: string) =>
    setBuilderFields(prev => prev.map(f => f.id === id ? { ...f, value } : f))

  /* ── Builder live JSON preview ── */
  const builderJson = JSON.stringify({ version: '1.0', flows: [buildFlowFromFields(builderFields)] }, null, 2)

  /* ── Stats ── */
  const blocking  = validated.filter(v => !v.valid).length
  const warnings  = validated.filter(v => v.valid && v.issues.length).length
  const clean     = validated.filter(v => v.valid && !v.issues.length).length

  /* ── File upload ── */
  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setJsonText(ev.target?.result as string || '')
    reader.readAsText(file)
  }

  /* ─────────────────────────────── Render ─────────────────────────────── */
  const S = { color: 'var(--text-1)', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '94vw', maxWidth: 1080, height: '90vh', display: 'flex', flexDirection: 'column', ...S, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 22px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Importer des flux JSON</div>
          {/* Steps */}
          <div style={{ display: 'flex', gap: 4 }}>
            {STEPS.map(s => (
              <div key={s.id} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                background: step === s.id ? 'var(--blue)' : 'var(--bg-input)',
                color: step === s.id ? '#fff' : 'var(--text-3)' }}>
                {s.label}
              </div>
            ))}
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 12px', fontSize: 13, fontFamily: 'inherit' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* ── STEP 1: INPUT ── */}
          {step === 'input' && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: 20, gap: 12 }}>
              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                {(['json', 'builder'] as const).map(m => (
                  <button key={m} onClick={() => setMode(m)}
                    style={{ padding: '6px 16px', borderRadius: 6, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                      background: mode === m ? 'var(--blue)' : 'var(--bg-input)',
                      color: mode === m ? '#fff' : 'var(--text-2)' }}>
                    {m === 'json' ? '{ } Coller JSON' : '⊞ Constructeur visuel'}
                  </button>
                ))}
              </div>

              {mode === 'json' ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'hidden' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>
                    Format&nbsp;:&nbsp;<code style={{ background: 'var(--bg-input)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>{'{ "version": "1.0", "flows": [{ "name", "source": { "zones", "ip", "ports" }, "destination": { "zones", "ip", "ports" }, "protocol", "action", "tags" }] }'}</code>
                  </div>
                  <textarea
                    value={jsonText}
                    onChange={e => { setJsonText(e.target.value); setJsonError('') }}
                    placeholder={'{\n  "version": "1.0",\n  "flows": [\n    {\n      "name": "Flux RH vers BDD",\n      "source": { "zones": ["LAN-RH"], "ip": ["10.1.0.0/24"], "ports": [] },\n      "destination": { "zones": ["DMZ-BDD"], "ip": ["10.2.0.5"], "ports": [5432] },\n      "protocol": "TCP",\n      "action": "permit",\n      "tags": ["postgresql"]\n    }\n  ]\n}'}
                    style={{ flex: 1, resize: 'none', fontFamily: 'monospace', fontSize: 12, background: 'var(--bg-input)', border: `1px solid ${jsonError ? 'var(--red)' : 'var(--border)'}`, borderRadius: 6, padding: 12, color: 'var(--text-1)', outline: 'none' }}
                  />
                  {jsonError && <div style={{ color: 'var(--red)', fontSize: 12 }}>⚠ {jsonError}</div>}
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => fileRef.current?.click()} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                      📁 Charger un fichier
                    </button>
                    <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={onFile} />
                    <button onClick={() => setJsonText('')} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                      Effacer
                    </button>
                  </div>
                </div>
              ) : (
                /* ── BUILDER ── */
                <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 280px', gap: 12, overflow: 'hidden', minHeight: 0 }}>

                  {/* A — Palette */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: '1px solid var(--border)', overflow: 'auto' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Palette de champs</div>
                    {PALETTE_FIELDS.map(f => (
                      <div key={f.id}
                        draggable
                        onDragStart={e => onPaletteDragStart(e, f)}
                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', background: 'var(--bg-input)', borderRadius: 6, cursor: 'grab', fontSize: 12, border: '1px solid var(--border)', opacity: builderFields.find(bf => bf.id === f.id) ? 0.4 : 1 }}>
                        <span style={{ fontSize: 14 }}>{f.icon}</span>
                        <span>{f.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* B — Constructor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto' }}>
                    {(['source', 'dest', 'rule'] as const).map(sec => {
                      const secLabel = sec === 'source' ? 'SOURCE' : sec === 'dest' ? 'DESTINATION' : 'RÈGLE'
                      const secFields = builderFields.filter(f => f.section === sec)
                      return (
                        <div key={sec}
                          onDragOver={e => { e.preventDefault(); setDragOver(sec) }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={e => onDropSection(e, sec)}
                          style={{ flex: 1, background: 'var(--bg-card)', borderRadius: 8, padding: 12, border: `2px dashed ${dragOver === sec ? 'var(--blue)' : 'var(--border)'}`, transition: 'border-color 0.15s', minHeight: 80 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{secLabel}</div>
                          {secFields.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text-3)', fontStyle: 'italic' }}>Glisser un champ ici…</div>
                          )}
                          {secFields.map(f => (
                            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <span style={{ fontSize: 12, color: 'var(--text-3)', width: 90, flexShrink: 0 }}>{f.label}</span>
                              <input
                                className="form-input"
                                placeholder={f.id === 'protocol' ? 'TCP / UDP / ICMP / ANY' : f.id === 'action' ? 'permit / deny' : 'valeur…'}
                                value={f.value}
                                ref={el => { if (el && focusedField === f.id) { el.focus(); setFocusedField(null) } }}
                                onChange={e => updateBuilderField(f.id, e.target.value)}
                                style={{ flex: 1, fontSize: 12 }}
                              />
                              <button onClick={() => removeBuilderField(f.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 14, padding: 2 }}>✕</button>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>

                  {/* C — Live JSON preview */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflow: 'hidden' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aperçu JSON</div>
                    <pre style={{ flex: 1, margin: 0, background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, padding: 10, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-2)', overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {builderJson}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 2: PREVIEW ── */}
          {step === 'preview' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-2)' }}>
                {parsedFlows.length} flux détecté{parsedFlows.length > 1 ? 's' : ''} — vérifiez avant validation.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {parsedFlows.map((f, i) => (
                  <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>{f.name || <span style={{ color: 'var(--text-3)' }}>(sans nom)</span>}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, fontSize: 12 }}>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>SOURCE</div>
                        {f.source?.zones?.map(z => <div key={z}>⬡ {z}</div>)}
                        {f.source?.ip?.map(ip => <div key={ip}>◎ {ip}</div>)}
                        {f.source?.ports?.map(p => <div key={String(p)}>: {p}</div>)}
                        {!f.source?.zones?.length && !f.source?.ip?.length && <div style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</div>}
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>DESTINATION</div>
                        {f.destination?.zones?.map(z => <div key={z}>⬡ {z}</div>)}
                        {f.destination?.ip?.map(ip => <div key={ip}>◎ {ip}</div>)}
                        {f.destination?.ports?.map(p => <div key={String(p)}>: {p}</div>)}
                        {!f.destination?.zones?.length && !f.destination?.ip?.length && <div style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</div>}
                      </div>
                      <div>
                        <div style={{ color: 'var(--text-3)', fontSize: 11, marginBottom: 2 }}>RÈGLE</div>
                        {f.protocol && <div>⇄ {f.protocol}</div>}
                        {f.action && <div>⚡ {f.action}</div>}
                        {f.tags?.map(t => <div key={t}>◈ {t}</div>)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: VALIDATION ── */}
          {step === 'validation' && (
            <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
              {/* Summary bar */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {[
                  { label: `${blocking} erreur${blocking !== 1 ? 's' : ''} bloquante${blocking !== 1 ? 's' : ''}`, color: 'var(--red)', bg: 'rgba(239,68,68,0.1)' },
                  { label: `${warnings} avertissement${warnings !== 1 ? 's' : ''}`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
                  { label: `${clean} flux valide${clean !== 1 ? 's' : ''}`, color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
                ].map(({ label, color, bg }) => (
                  <div key={label} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, color, background: bg }}>
                    {label}
                  </div>
                ))}
              </div>
              {validated.map((v, i) => (
                <div key={i} style={{ marginBottom: 10, background: 'var(--bg-card)', border: `1px solid ${!v.valid ? 'rgba(239,68,68,0.4)' : v.issues.length ? 'rgba(245,158,11,0.35)' : 'rgba(34,197,94,0.3)'}`, borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: !v.valid ? 'rgba(239,68,68,0.07)' : v.issues.length ? 'rgba(245,158,11,0.07)' : 'rgba(34,197,94,0.07)' }}>
                    <span style={{ fontSize: 14 }}>{!v.valid ? '✕' : v.issues.length ? '⚠' : '✓'}</span>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{v.raw.name || `Flux ${i + 1}`}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{v.raw.source?.ip?.[0] || v.raw.source?.zones?.[0] || '?'} → {v.raw.destination?.ip?.[0] || v.raw.destination?.zones?.[0] || '?'}</span>
                  </div>
                  {v.issues.length > 0 && (
                    <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {v.issues.map((issue, j) => (
                        <div key={j}
                          onClick={() => setFocusedField(issue.field)}
                          style={{ display: 'flex', gap: 8, fontSize: 12, cursor: 'pointer',
                            color: issue.severity === 'error' ? 'var(--red)' : '#f59e0b' }}>
                          <span>{issue.severity === 'error' ? '✕' : '⚠'}</span>
                          <span><b>{issue.field}</b> : {issue.message}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 4: IMPORT RESULT ── */}
          {step === 'import' && importResult && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
              <div style={{ fontSize: 48 }}>{importResult.fail === 0 ? '✓' : importResult.ok === 0 ? '✕' : '⚠'}</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {importResult.ok} flux importé{importResult.ok !== 1 ? 's' : ''}{importResult.fail > 0 ? `, ${importResult.fail} échec${importResult.fail !== 1 ? 's' : ''}` : ''}
              </div>
              <button onClick={onClose} style={{ padding: '8px 24px', background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 600 }}>
                Fermer
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step !== 'import' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 22px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
            <button
              onClick={() => setStep(s => s === 'preview' ? 'input' : s === 'validation' ? 'preview' : 'input')}
              disabled={step === 'input'}
              style={{ padding: '7px 18px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-2)', cursor: step === 'input' ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: step === 'input' ? 0.4 : 1 }}>
              ← Retour
            </button>
            {step === 'input' && (
              <button onClick={goPreview} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                Aperçu →
              </button>
            )}
            {step === 'preview' && (
              <button onClick={goValidation} style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: 'var(--blue)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                Valider →
              </button>
            )}
            {step === 'validation' && (
              <button onClick={doImport} disabled={importing || !validated.filter(v => v.valid).length}
                style={{ padding: '7px 18px', borderRadius: 6, border: 'none', background: validated.filter(v => v.valid).length ? 'var(--green)' : 'var(--bg-input)', color: validated.filter(v => v.valid).length ? '#fff' : 'var(--text-3)', cursor: importing || !validated.filter(v => v.valid).length ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 600 }}>
                {importing ? 'Import en cours…' : `Importer ${validated.filter(v => v.valid).length} flux →`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
