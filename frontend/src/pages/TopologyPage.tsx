import { useEffect, useState, useMemo, useRef } from 'react'
import { api } from '../api/client'
import TopologyGraph, { CRITICALITY_COLOR, ROUTE_COLOR, TYPE_COLORS, CRIT_APP_COLOR } from '../components/TopologyGraph'
import type { FlowOverlay, RouteOverlay, VRFOverlay, AppOverlay } from '../components/TopologyGraph'
import AppGraphView from '../components/AppGraphView'
import type { Equipment, Network, Zone } from '../types'

type Tab = 'graph' | 'equipment' | 'networks' | 'zones' | 'physzones' | 'links' | 'apps'

interface Link {
  id: number
  equipment_a_id: number; equipment_a_name: string
  equipment_b_id: number; equipment_b_name: string
  link_type: string; description: string
}
interface GraphData { nodes: any[]; edges: any[] }
interface Props { highlightedPath?: string[] }

const ALL_ROUTE_TYPES = ['bgp', 'ospf', 'isis', 'connected', 'static'] as const
type RouteType = typeof ALL_ROUTE_TYPES[number]

// ── Toggle switch ──────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label, count, color }: {
  on: boolean; onChange: () => void; label: string; count?: number; color?: string
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={onChange}
        style={{ width: 36, height: 20, borderRadius: 10, border: 'none', cursor: 'pointer', background: on ? (color || '#3b82f6') : 'var(--bg-input)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
      >
        <div style={{ position: 'absolute', top: 3, left: on ? 18 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
      </button>
      <span style={{ fontSize: 12, fontWeight: 600, color: on ? 'var(--text-1)' : 'var(--text-3)', flex: 1 }}>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: on ? `${color || '#3b82f6'}22` : 'var(--bg-input)', color: on ? (color || '#3b82f6') : 'var(--text-3)', fontWeight: 700 }}>
          {count}
        </span>
      )}
    </div>
  )
}

// ── Autocomplete input ─────────────────────────────────────────────────────────
function ComboInput({ value, onChange, options, placeholder, style }: {
  value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string; style?: React.CSSProperties
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const filtered = options.filter(o => !value || o.toLowerCase().includes(value.toLowerCase()))

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const BASE: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '5px 8px', fontSize: 11, color: 'var(--text-1)',
    fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
  }

  return (
    <div ref={ref} style={{ position: 'relative', ...style }}>
      <input
        style={BASE}
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && filtered.length > 0 && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#1c2233', border: '1px solid var(--border)', borderRadius: 4, boxShadow: '0 4px 16px rgba(0,0,0,0.5)', maxHeight: 140, overflowY: 'auto', marginTop: 2 }}>
          {filtered.slice(0, 20).map(o => (
            <div
              key={o}
              onMouseDown={e => { e.preventDefault(); onChange(o); setOpen(false) }}
              style={{ padding: '5px 8px', fontSize: 11, color: 'var(--text-2)', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = '')}
            >
              {o}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function TopologyPage({ highlightedPath = [] }: Props) {
  const [tab, setTab] = useState<Tab>('graph')
  const [graph,     setGraph]     = useState<GraphData>({ nodes: [], edges: [] })
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [networks,  setNetworks]  = useState<Network[]>([])
  const [zones,     setZones]     = useState<Zone[]>([])
  const [links,     setLinks]     = useState<Link[]>([])
  const [physZones, setPhysZones] = useState<any[]>([])
  const [apps,      setApps]      = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)

  // Zone mode (physical / logical / none) — persisted
  const [zoneMode, setZoneMode] = useState<'none' | 'physical' | 'logical'>(
    () => (localStorage.getItem('ipfm_zone_mode') as 'none' | 'physical' | 'logical') || 'none'
  )
  useEffect(() => { localStorage.setItem('ipfm_zone_mode', zoneMode) }, [zoneMode])

  // Overlay toggles
  const [showFlows,  setShowFlows]  = useState(false)
  const [showRoutes, setShowRoutes] = useState(false)
  const [showVRF,    setShowVRF]    = useState(false)
  const [showApps,   setShowApps]   = useState(false)

  // Overlay data
  const [overlayFlows,  setOverlayFlows]  = useState<FlowOverlay[]>([])
  const [overlayRoutes, setOverlayRoutes] = useState<RouteOverlay[]>([])
  const [overlayVRF,    setOverlayVRF]    = useState<VRFOverlay[]>([])
  const [overlayApps,   setOverlayApps]   = useState<AppOverlay[]>([])
  const [selectedAppIds, setSelectedAppIds] = useState<Set<number>>(new Set())
  const [loadingOverlay, setLoadingOverlay] = useState<string | null>(null)

  // App view mode (v2.9.4)
  const [appViewMode,      setAppViewMode]      = useState(false)
  const [appGraphData,     setAppGraphData]     = useState<any>(null)
  const [selectedAppId,    setSelectedAppId]    = useState<number | null>(null)
  const [appContext,       setAppContext]       = useState<any>(null)
  const [loadingAppGraph,  setLoadingAppGraph]  = useState(false)
  const [loadingAppContext, setLoadingAppContext] = useState(false)

  // Environments (for dynamic badge colors)
  const [environments, setEnvironments] = useState<any[]>([])

  // VRF multi-select filter (all selected by default once data loads)
  const [selectedVRFIds, setSelectedVRFIds] = useState<Set<number>>(new Set())
  // Route type multi-select filter
  const [selectedRouteTypes, setSelectedRouteTypes] = useState<Set<RouteType>>(new Set(ALL_ROUTE_TYPES))

  // Flux filter state
  const [fApp,      setFApp]      = useState('')
  const [fProto,    setFProto]    = useState('')
  const [fCrit,     setFCrit]     = useState('')
  const [fStatus,   setFStatus]   = useState('')
  const [fSrc,      setFSrc]      = useState('')
  const [fDst,      setFDst]      = useState('')
  const [fPort,     setFPort]     = useState('')
  const [fPending,  setFPending]  = useState<{app:string;proto:string;crit:string;status:string;src:string;dst:string;port:string} | null>(null)
  const [fActive,   setFActive]   = useState<typeof fPending>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      api.getGraph().then(d => setGraph(d as GraphData)),
      api.getEquipment().then(d => setEquipment(d as Equipment[])),
      api.getNetworks().then(d => setNetworks(d as Network[])),
      api.getZones().then(d => setZones(d as Zone[])),
      api.getLinks().then(d => setLinks(d as Link[])),
      api.getPhysicalZones().then(d => setPhysZones(d as any[])),
      api.getApplications().then(d => setApps(d as any[])).catch(() => {}),
      api.getEnvironments().then(d => setEnvironments(d as any[])).catch(() => {}),
    ]).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Load overlay data on toggle
  useEffect(() => {
    if (showFlows && overlayFlows.length === 0) {
      setLoadingOverlay('flows')
      api.getOverlayFlows().then((d: any) => setOverlayFlows(d as FlowOverlay[])).catch(() => {}).finally(() => setLoadingOverlay(null))
    }
  }, [showFlows])
  useEffect(() => {
    if (showRoutes && overlayRoutes.length === 0) {
      setLoadingOverlay('routes')
      api.getOverlayRoutes().then((d: any) => setOverlayRoutes(d as RouteOverlay[])).catch(() => {}).finally(() => setLoadingOverlay(null))
    }
  }, [showRoutes])
  useEffect(() => {
    if (showVRF && overlayVRF.length === 0) {
      setLoadingOverlay('vrf')
      api.getOverlayVRF().then((d: any) => {
        const vlist = d as VRFOverlay[]
        setOverlayVRF(vlist)
        setSelectedVRFIds(new Set(vlist.map(v => v.id)))
      }).catch(() => {}).finally(() => setLoadingOverlay(null))
    }
  }, [showVRF])
  useEffect(() => {
    if (showApps && overlayApps.length === 0) {
      setLoadingOverlay('apps')
      api.getAppsOverlay().then((d: any) => {
        const alist = d as AppOverlay[]
        setOverlayApps(alist)
        setSelectedAppIds(new Set(alist.map(a => a.id)))
      }).catch(() => {}).finally(() => setLoadingOverlay(null))
    }
  }, [showApps])

  // App graph view (v2.9.4)
  useEffect(() => {
    if (appViewMode && !appGraphData) {
      setLoadingAppGraph(true)
      api.getAppGraph().then((d: any) => setAppGraphData(d)).catch(() => {}).finally(() => setLoadingAppGraph(false))
    }
  }, [appViewMode])

  useEffect(() => {
    if (selectedAppId) {
      setLoadingAppContext(true)
      api.getAppContext(selectedAppId).then((d: any) => setAppContext(d)).catch(() => {}).finally(() => setLoadingAppContext(false))
    } else {
      setAppContext(null)
    }
  }, [selectedAppId])

  const applyFilters = () => {
    setFActive({ app: fApp, proto: fProto, crit: fCrit, status: fStatus, src: fSrc, dst: fDst, port: fPort })
  }
  const resetFilters = () => {
    setFApp(''); setFProto(''); setFCrit(''); setFStatus(''); setFSrc(''); setFDst(''); setFPort('')
    setFActive(null)
  }

  const filteredFlows = useMemo(() => {
    if (!fActive) return overlayFlows
    return overlayFlows.filter(f =>
      (!fActive.app    || f.application?.toLowerCase().includes(fActive.app.toLowerCase())) &&
      (!fActive.proto  || f.protocol?.toLowerCase().includes(fActive.proto.toLowerCase())) &&
      (!fActive.crit   || f.criticality === fActive.crit) &&
      (!fActive.status || f.status === fActive.status) &&
      (!fActive.src    || f.src_ip?.includes(fActive.src)) &&
      (!fActive.dst    || f.dst_ip?.includes(fActive.dst)) &&
      (!fActive.port   || f.port?.includes(fActive.port))
    )
  }, [overlayFlows, fActive])

  // VRF filtered by selected IDs
  const filteredVRF = useMemo(() => {
    if (selectedVRFIds.size === 0) return overlayVRF
    return overlayVRF.filter(v => selectedVRFIds.has(v.id))
  }, [overlayVRF, selectedVRFIds])

  // Routes filtered by selected types
  const filteredRoutes = useMemo(() => {
    if (selectedRouteTypes.size === ALL_ROUTE_TYPES.length) return overlayRoutes
    return overlayRoutes.filter(r => selectedRouteTypes.has(r.route_type as RouteType))
  }, [overlayRoutes, selectedRouteTypes])

  // Autocomplete option lists derived from loaded flows
  const optApps   = useMemo(() => [...new Set(overlayFlows.map(f => f.application).filter(Boolean) as string[])].sort(), [overlayFlows])
  const optProtos = useMemo(() => [...new Set(overlayFlows.map(f => f.protocol).filter(Boolean) as string[])].sort(), [overlayFlows])
  const optSrcs   = useMemo(() => [...new Set(overlayFlows.map(f => f.src_ip).filter(Boolean) as string[])].sort(), [overlayFlows])
  const optDsts   = useMemo(() => [...new Set(overlayFlows.map(f => f.dst_ip).filter(Boolean) as string[])].sort(), [overlayFlows])
  const optPorts  = useMemo(() => [...new Set(overlayFlows.map(f => f.port).filter(Boolean) as string[])].sort(), [overlayFlows])

  // Apps filtered by selected IDs — no early return: empty set = show nothing
  const filteredApps = useMemo(() => {
    return overlayApps.filter(a => selectedAppIds.has(a.id))
  }, [overlayApps, selectedAppIds])

  // Counts for right panel
  const visibleNodes   = graph.nodes.length
  const visibleEdges   = graph.edges.length
  const vrfNodes       = showVRF ? new Set(filteredVRF.flatMap(v => v.equipment_names)).size : 0
  const visibleApps    = showApps ? new Set(filteredApps.flatMap(a => a.equipment_names)).size : 0

  const TABS = [
    { id: 'graph',      label: 'Graphe réseau' },
    { id: 'equipment',  label: `Équipements (${equipment.length})` },
    { id: 'networks',   label: `Réseaux (${networks.length})` },
    { id: 'zones',      label: `Zones logiques (${zones.length})` },
    { id: 'physzones',  label: `Zones physiques (${physZones.length})` },
    { id: 'links',      label: `Liens (${links.length})` },
    { id: 'apps',       label: `Applications (${apps.length})` },
  ] as const

  const INPUT: React.CSSProperties = {
    width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
    borderRadius: 4, padding: '5px 8px', fontSize: 11, color: 'var(--text-1)',
    fontFamily: 'inherit', outline: 'none',
  }
  const SELECT: React.CSSProperties = { ...INPUT, cursor: 'pointer' }
  const LABEL: React.CSSProperties  = { fontSize: 10, color: 'var(--text-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 3 }

  return (
    <>
      <div className="page-header">
        <h2>Topologie réseau</h2>
        <p>Vue graphique de l'architecture et référentiel des équipements</p>
      </div>
      <div className="page-content">
        <div className="script-tabs mb-4">
          {TABS.map(t => (
            <button key={t.id} className={`script-tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id as Tab)}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? <div className="empty-state"><div className="spinner" /></div> : (
          <>
            {tab === 'graph' && (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>

                {/* ── Left panel ─────────────────────────────────────────── */}
                <div style={{ width: 220, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Zone representation toggle */}
                  <div className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Représentation</div>
                    <div style={{ display: 'flex', gap: 4, opacity: appViewMode ? 0.4 : 1, pointerEvents: appViewMode ? 'none' : undefined }}>
                      {([['none','Aucune'],['physical','Physique'],['logical','Logique']] as const).map(([mode, label]) => (
                        <button
                          key={mode}
                          onClick={() => setZoneMode(mode)}
                          style={{
                            flex: 1, padding: '5px 0', fontSize: 10, fontFamily: 'inherit', cursor: appViewMode ? 'default' : 'pointer',
                            borderRadius: 5, border: zoneMode === mode ? '1px solid var(--blue)' : '1px solid var(--border)',
                            background: zoneMode === mode ? 'rgba(59,130,246,0.15)' : 'var(--bg-input)',
                            color: zoneMode === mode ? 'var(--blue)' : 'var(--text-3)',
                            fontWeight: zoneMode === mode ? 700 : 400, transition: 'all 0.15s',
                          }}
                        >{label}</button>
                      ))}
                    </div>
                    {zoneMode !== 'none' && !appViewMode && (
                      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)' }}>
                        {zoneMode === 'physical' ? '— Zones par site / datacenter' : '— Zones logiques (segmentation)'}
                      </div>
                    )}
                    {/* Vue Applications toggle */}
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                      <Toggle
                        on={appViewMode}
                        onChange={() => { setAppViewMode(v => !v); setSelectedAppId(null) }}
                        label="Vue Applications"
                        color="#22c55e"
                      />
                    </div>
                  </div>

                  {/* Overlay toggles */}
                  <div className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Overlays</div>
                    <Toggle
                      on={showFlows}  onChange={() => setShowFlows(v => !v)}
                      label="Flux"    count={overlayFlows.length || undefined}
                      color="#f97316"
                    />
                    <Toggle
                      on={showRoutes} onChange={() => setShowRoutes(v => !v)}
                      label="Routes"  count={overlayRoutes.length || undefined}
                      color="#3b82f6"
                    />
                    <Toggle
                      on={showVRF}    onChange={() => setShowVRF(v => !v)}
                      label="VRF"     count={overlayVRF.length || undefined}
                      color="#a855f7"
                    />
                    <Toggle
                      on={showApps}   onChange={() => setShowApps(v => !v)}
                      label="Applications" count={overlayApps.length || undefined}
                      color="#f59e0b"
                    />
                    {loadingOverlay && (
                      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div className="spinner" style={{ width: 10, height: 10, border: '2px solid var(--border)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                        Chargement {loadingOverlay}…
                      </div>
                    )}
                  </div>

                  {/* Flux filters (visible when Flux overlay is on) */}
                  {showFlows && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 10 }}>Filtres flux</div>

                      {[
                        ['Application', fApp,   setFApp,   optApps,   'ex: SAP, RH…'],
                        ['Protocole',   fProto, setFProto, optProtos, 'ex: TCP, UDP…'],
                        ['Source',      fSrc,   setFSrc,   optSrcs,   'ex: 10.0.0.1'],
                        ['Destination', fDst,   setFDst,   optDsts,   'ex: 10.0.1.0'],
                        ['Port',        fPort,  setFPort,  optPorts,  'ex: 443, 5432'],
                      ].map(([lbl, val, setter, opts, ph]) => (
                        <div key={lbl as string} style={{ marginBottom: 7 }}>
                          <div style={LABEL}>{lbl as string}</div>
                          <ComboInput
                            value={val as string}
                            onChange={setter as (v:string)=>void}
                            options={opts as string[]}
                            placeholder={ph as string}
                          />
                        </div>
                      ))}

                      <div style={{ marginBottom: 7 }}>
                        <div style={LABEL}>Criticité</div>
                        <select style={SELECT} value={fCrit} onChange={e => setFCrit(e.target.value)}>
                          <option value="">Toutes</option>
                          <option value="critique">Critique</option>
                          <option value="haute">Haute</option>
                          <option value="moyenne">Moyenne</option>
                          <option value="basse">Basse</option>
                        </select>
                      </div>

                      <div style={{ marginBottom: 10 }}>
                        <div style={LABEL}>Statut</div>
                        <select style={SELECT} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                          <option value="">Tous</option>
                          <option value="deployed">Déployé</option>
                          <option value="validated">Validé</option>
                          <option value="pending">En attente</option>
                          <option value="rejected">Refusé</option>
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-primary" style={{ flex: 1, fontSize: 11, padding: '5px 0', textAlign: 'center', justifyContent: 'center', display: 'flex', alignItems: 'center' }} onClick={applyFilters}>Appliquer</button>
                        <button className="btn btn-ghost"   style={{ fontSize: 11, padding: '5px 8px' }} onClick={resetFilters}>✕</button>
                      </div>

                      {fActive && (
                        <div style={{ marginTop: 8, fontSize: 10, color: '#f97316', textAlign: 'center' }}>
                          {filteredFlows.length} / {overlayFlows.length} flux affichés
                        </div>
                      )}
                    </div>
                  )}

                  {/* VRF multi-select filter (visible when VRF overlay is on) */}
                  {showVRF && overlayVRF.length > 0 && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.8px', textTransform: 'uppercase' }}>VRF actives</div>
                        <button
                          style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onClick={() => setSelectedVRFIds(selectedVRFIds.size === overlayVRF.length ? new Set() : new Set(overlayVRF.map(v => v.id)))}
                        >
                          {selectedVRFIds.size === overlayVRF.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      </div>
                      {overlayVRF.map((v, idx) => {
                        const checked = selectedVRFIds.has(v.id)
                        return (
                          <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < overlayVRF.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                            onClick={() => {
                              const next = new Set(selectedVRFIds)
                              if (checked) next.delete(v.id); else next.add(v.id)
                              setSelectedVRFIds(next)
                            }}
                          >
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${v.color}`, background: checked ? v.color : 'transparent', flexShrink: 0, transition: 'background 0.15s' }} />
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: v.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: checked ? 'var(--text-1)' : 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{v.equipment_names.length} éq.</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Apps multi-select filter (visible when Apps overlay is on) */}
                  {showApps && overlayApps.length > 0 && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Applications actives</div>
                        <button
                          style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onClick={() => setSelectedAppIds(selectedAppIds.size === overlayApps.length ? new Set() : new Set(overlayApps.map(a => a.id)))}
                        >
                          {selectedAppIds.size === overlayApps.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      </div>
                      {overlayApps.map((a, idx) => {
                        const checked = selectedAppIds.has(a.id)
                        const color = CRIT_APP_COLOR[a.criticality] || '#64748b'
                        return (
                          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx < overlayApps.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                            onClick={() => {
                              const next = new Set(selectedAppIds)
                              if (checked) next.delete(a.id); else next.add(a.id)
                              setSelectedAppIds(next)
                            }}
                          >
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${color}`, background: checked ? color : 'transparent', flexShrink: 0, transition: 'background 0.15s' }} />
                            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: checked ? 'var(--text-1)' : 'var(--text-3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.code || a.name}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{a.equipment_names.length} éq.</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Route type multi-select filter (visible when Routes overlay is on) */}
                  {showRoutes && overlayRoutes.length > 0 && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Protocoles</div>
                        <button
                          style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit' }}
                          onClick={() => setSelectedRouteTypes(selectedRouteTypes.size === ALL_ROUTE_TYPES.length ? new Set<RouteType>() : new Set(ALL_ROUTE_TYPES))}
                        >
                          {selectedRouteTypes.size === ALL_ROUTE_TYPES.length ? 'Tout décocher' : 'Tout cocher'}
                        </button>
                      </div>
                      {([['bgp','BGP'],['ospf','OSPF'],['isis','IS-IS'],['connected','Connecté'],['static','Statique']] as const).map(([k, lbl]) => {
                        const cnt = overlayRoutes.filter(r => r.route_type === k).length
                        if (!cnt) return null
                        const checked = selectedRouteTypes.has(k)
                        const color = ROUTE_COLOR[k]
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                            onClick={() => {
                              const next = new Set(selectedRouteTypes)
                              if (checked) next.delete(k as RouteType); else next.add(k as RouteType)
                              setSelectedRouteTypes(next)
                            }}
                          >
                            <div style={{ width: 14, height: 14, borderRadius: 3, border: `2px solid ${color}`, background: checked ? color : 'transparent', flexShrink: 0, transition: 'background 0.15s' }} />
                            <div style={{ width: 24, height: 0, borderTop: `2px dashed ${color}`, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: checked ? 'var(--text-1)' : 'var(--text-3)', flex: 1 }}>{lbl}</span>
                            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* ── Main canvas ─────────────────────────────────────────── */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {appViewMode ? (
                    <>
                      <AppGraphView
                        data={appGraphData}
                        selectedAppId={selectedAppId}
                        onSelectApp={setSelectedAppId}
                        loading={loadingAppGraph}
                      />
                      {selectedAppId && appContext && (
                        <AppContextPanel
                          app={apps.find((a: any) => a.id === selectedAppId)}
                          context={appContext}
                          loading={loadingAppContext}
                          onClose={() => setSelectedAppId(null)}
                        />
                      )}
                    </>
                  ) : (
                    <>
                      {highlightedPath.length > 0 && (
                        <div style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 6, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#f97316', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          🔶 Chemin :
                          {highlightedPath.map((name, i) => (
                            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              {i > 0 && <span style={{ color: 'rgba(249,115,22,0.5)' }}>→</span>}
                              <span style={{ background: 'rgba(249,115,22,0.15)', padding: '1px 8px', borderRadius: 4, fontFamily: 'monospace', fontSize: 12 }}>{name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <TopologyGraph
                        nodes={graph.nodes}
                        edges={graph.edges}
                        highlightedPath={highlightedPath}
                        height={560}
                        showFlows={showFlows}
                        showRoutes={showRoutes}
                        showVRF={showVRF}
                        flowsOverlay={filteredFlows}
                        routesOverlay={filteredRoutes}
                        vrfOverlay={filteredVRF}
                        zoneMode={zoneMode}
                        overlayApps={showApps ? filteredApps : []}
                        onSelectApp={showApps ? (id => { setSelectedAppId(id); setAppViewMode(false) }) : undefined}
                      />
                      {selectedAppId && appContext && (
                        <AppContextPanel
                          app={apps.find((a: any) => a.id === selectedAppId)}
                          context={appContext}
                          loading={loadingAppContext}
                          onClose={() => setSelectedAppId(null)}
                        />
                      )}
                    </>
                  )}
                </div>

                {/* ── Right panel ─────────────────────────────────────────── */}
                <div style={{ width: 182, minWidth: 182, display: 'flex', flexDirection: 'column', gap: 10 }}>

                  {/* Éléments visibles */}
                  <div className="card" style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Éléments visibles</div>
                    {[
                      ['Équipements', visibleNodes, '#64748b'],
                      ['Liens',       visibleEdges, '#64748b'],
                      showFlows  ? ['Flux',   filteredFlows.length,   '#f97316'] : null,
                      showRoutes ? ['Routes', filteredRoutes.length,  '#3b82f6'] : null,
                      showVRF    ? ['VRF',    filteredVRF.length,     '#a855f7'] : null,
                      showVRF    ? ['Nœuds VRF', vrfNodes,            '#a855f7'] : null,
                      showApps   ? ['Apps',   filteredApps.length,    '#f59e0b'] : null,
                      showApps   ? ['Éq. avec apps', visibleApps,     '#f59e0b'] : null,
                    ].filter(Boolean).map((row) => { const [lbl, cnt, color] = row as [string, number, string]; return (
                      <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{lbl}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color }}>{cnt}</span>
                      </div>
                    )})}
                  </div>

                  {/* Légende flux */}
                  {showFlows && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Criticité flux</div>
                      {[['critique','Critique'],['haute','Haute'],['moyenne','Moyenne'],['basse','Basse']].map(([k, lbl]) => (
                        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 28, height: 3, background: CRITICALITY_COLOR[k], borderRadius: 2 }} />
                          <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{lbl}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>
                            {filteredFlows.filter(f => f.criticality === k).length}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Légende routes */}
                  {showRoutes && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Protocoles routes</div>
                      {[['bgp','BGP'],['ospf','OSPF'],['isis','IS-IS'],['connected','Connecté'],['static','Statique']].map(([k, lbl]) => {
                        const cnt = filteredRoutes.filter(r => r.route_type === k).length
                        if (!cnt) return null
                        return (
                          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                            <div style={{ width: 28, height: 0, borderTop: `2px dashed ${ROUTE_COLOR[k]}`, borderRadius: 2 }} />
                            <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{lbl}</span>
                            <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-3)' }}>{cnt}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Légende VRF */}
                  {showVRF && filteredVRF.length > 0 && (
                    <div className="card" style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#a855f7', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 8 }}>Légende VRF</div>
                      {filteredVRF.map(v => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px dashed ${v.color}`, background: `${v.color}18`, flexShrink: 0 }} />
                          <span style={{ fontSize: 10, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.name}</span>
                        </div>
                      ))}
                      <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: 6 }}>
                        Équipements hors-VRF estompés
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'equipment'  && <EquipmentTable equipment={equipment}   onRefresh={load} />}
            {tab === 'networks'   && <NetworkTable networks={networks}       onRefresh={load} />}
            {tab === 'zones'      && <ZoneTable zones={zones}               onRefresh={load} />}
            {tab === 'physzones'  && <PhysZoneTable physZones={physZones}   onRefresh={load} />}
            {tab === 'links'      && <LinkTable links={links}               onRefresh={load} />}
            {tab === 'apps'       && <ApplicationTable apps={apps} environments={environments} onRefresh={load} />}
          </>
        )}
      </div>
    </>
  )
}

// ── AppContextPanel ───────────────────────────────────────────────────────────
function AppContextPanel({ app, context, loading, onClose }: {
  app: any; context: any; loading: boolean; onClose: () => void
}) {
  const STATUS_COLOR: Record<string, string> = {
    deployed: '#22c55e', validated: '#3b82f6', pending: '#eab308', rejected: '#ef4444',
  }
  const STATUS_LABEL: Record<string, string> = {
    deployed: 'Déployé', validated: 'Validé', pending: 'En attente', rejected: 'Refusé',
  }

  return (
    <div style={{
      background: 'var(--bg-panel, var(--bg-card))',
      borderTop: '2px solid var(--border-focus, var(--blue))',
      maxHeight: 220,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
        <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          ROUTES ET FLUX — {app?.name || ''}
        </div>
        {context?.stats && (
          <div style={{ display: 'flex', gap: 12, marginRight: 10 }}>
            {[
              ['Flux', context.stats.flow_count, '#f97316'],
              ['Routes', context.stats.route_count, '#3b82f6'],
              ['Équipements', context.stats.equipment_count, '#a855f7'],
            ].map(([lbl, cnt, color]) => (
              <span key={lbl as string} style={{ fontSize: 10, color: color as string }}>
                <b>{cnt as number}</b> {lbl}
              </span>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1 }}
        >✕</button>
      </div>

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Routes */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 0 0', borderRight: '1px solid var(--border)' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#3b82f6', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '6px 12px 4px', position: 'sticky', top: 0, background: 'var(--bg-panel, var(--bg-card))' }}>Routes</div>
            {context?.routes?.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)' }}>Aucune route</div>
            )}
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <tbody>
                {(context?.routes || []).map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 12px', color: 'var(--text-2)', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.equipment_name}</td>
                    <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: 'var(--text-1)', whiteSpace: 'nowrap' }}>{r.destination}</td>
                    <td style={{ padding: '4px 6px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>via {r.gateway_equipment || r.gateway || '—'}</td>
                    <td style={{ padding: '4px 12px 4px 6px' }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'rgba(59,130,246,0.15)', color: '#3b82f6', fontWeight: 600, textTransform: 'uppercase' }}>{r.route_type}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Flux */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#f97316', letterSpacing: '0.8px', textTransform: 'uppercase', padding: '6px 12px 4px', position: 'sticky', top: 0, background: 'var(--bg-panel, var(--bg-card))' }}>Flux</div>
            {context?.flows?.length === 0 && (
              <div style={{ padding: '8px 12px', fontSize: 11, color: 'var(--text-3)' }}>Aucun flux</div>
            )}
            <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
              <tbody>
                {(context?.flows || []).map((f: any) => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '4px 12px', fontFamily: 'monospace', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                      {f.src_ip} → {f.dst_ip}
                    </td>
                    <td style={{ padding: '4px 6px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{f.port}/{f.protocol}</td>
                    <td style={{ padding: '4px 6px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: `${STATUS_COLOR[f.status] || '#64748b'}22`, color: STATUS_COLOR[f.status] || '#64748b', fontWeight: 600 }}>
                        {STATUS_LABEL[f.status] || f.status}
                      </span>
                    </td>
                    <td style={{ padding: '4px 12px 4px 6px', color: 'var(--text-3)', fontSize: 10, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.path.length > 0 ? f.path.join(' → ') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-tables (unchanged) ────────────────────────────────────────────────────
function EquipmentTable({ equipment, onRefresh }: { equipment: Equipment[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Équipements</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>Type</th><th>Vendor</th><th>Modèle</th><th>IP MGMT</th><th>Équipe</th><th>Zone physique</th></tr></thead>
          <tbody>
            {equipment.map(e => (
              <tr key={e.id}>
                <td style={{ fontWeight: 600 }}>{e.name}</td>
                <td><span className="badge badge-info">{e.type}</span></td>
                <td><span className={`vendor-badge vendor-${e.vendor}`}>{e.vendor}</span></td>
                <td className="text-muted">{e.model || '—'}</td>
                <td className="mono">{e.management_ip || '—'}</td>
                <td className="text-muted">{(e as any).team_name || '—'}</td>
                <td className="text-muted">{(e as any).physical_zone_name || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function NetworkTable({ networks, onRefresh }: { networks: Network[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Réseaux</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nom</th><th>CIDR</th><th>Zone</th><th>VLAN</th><th>Passerelle</th><th>Description</th></tr></thead>
          <tbody>
            {networks.map(n => (
              <tr key={n.id}>
                <td style={{ fontWeight: 600 }}>{n.name}</td>
                <td className="mono">{n.cidr}</td>
                <td><span className="badge" style={{ background: n.zone_color + '20', color: n.zone_color }}>{n.zone}</span></td>
                <td className="mono">{n.vlan_id ?? '—'}</td>
                <td className="mono">{n.gateway || '—'}</td>
                <td className="text-muted text-sm">{n.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ZoneTable({ zones, onRefresh }: { zones: Zone[]; onRefresh: () => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {zones.map(z => (
        <div key={z.id} className="card" style={{ borderLeft: `3px solid ${z.color}` }}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: z.color }} />
            <span style={{ fontWeight: 700 }}>{z.name}</span>
            <span className="badge badge-info" style={{ marginLeft: 'auto', fontSize: 10, whiteSpace: 'nowrap' }}>Confiance {z.trust_level}%</span>
          </div>
          <div className="text-sm text-muted mb-2">{z.description}</div>
          {z.networks.map(n => (
            <div key={n.id} style={{ display: 'flex', gap: 8, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 4, marginBottom: 4, fontSize: 12 }}>
              <span className="mono">{n.cidr}</span>
              <span className="text-dimmed">{n.name}</span>
              {n.vlan_id && <span className="text-dimmed" style={{ marginLeft: 'auto' }}>VLAN {n.vlan_id}</span>}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function PhysZoneTable({ physZones, onRefresh }: { physZones: any[]; onRefresh: () => void }) {
  const TYPE_LABEL: Record<string, string> = { datacenter: 'Datacenter', salle: 'Salle', baie: 'Baie', local: 'Local' }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
      {physZones.map(p => (
        <div key={p.id} className="card" style={{ borderLeft: '3px solid #f97316' }}>
          <div className="flex items-center gap-2 mb-2">
            <div style={{ width: 10, height: 10, borderRadius: 2, background: '#f97316' }} />
            <span style={{ fontWeight: 700 }}>{p.name}</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, padding: '2px 6px', borderRadius: 8, background: 'rgba(249,115,22,0.15)', color: '#f97316', fontWeight: 600, whiteSpace: 'nowrap' }}>
              ⬡ {TYPE_LABEL[p.type] || p.type}
            </span>
          </div>
          {p.description && <div className="text-sm text-muted mb-1">{p.description}</div>}
          {p.location && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: 6, alignItems: 'center' }}>
              <span>📍</span><span>{p.location}</span>
            </div>
          )}
        </div>
      ))}
      {physZones.length === 0 && (
        <div className="empty-state" style={{ gridColumn: '1/-1', padding: 32 }}>Aucune zone physique configurée</div>
      )}
    </div>
  )
}

function LinkTable({ links, onRefresh }: { links: Link[]; onRefresh: () => void }) {
  return (
    <div className="card">
      <div className="flex justify-between items-center mb-3">
        <div className="card-title" style={{ marginBottom: 0 }}>Liens de topologie</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Équipement A</th><th></th><th>Équipement B</th><th>Type</th><th>Description</th></tr></thead>
          <tbody>
            {links.map(l => (
              <tr key={l.id}>
                <td style={{ fontWeight: 600 }}>{l.equipment_a_name}</td>
                <td style={{ color: 'var(--text-3)', textAlign: 'center' }}>↔</td>
                <td style={{ fontWeight: 600 }}>{l.equipment_b_name}</td>
                <td><span className="badge badge-info">{l.link_type}</span></td>
                <td className="text-muted text-sm">{l.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Applications table ────────────────────────────────────────────────────────

// CRIT_APP_COLOR is exported from TopologyGraph, re-use the import
// ENV colors come from the environments prop (dynamic)

function PillGroup({ label, options, value, onChange, colorMap }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void
  colorMap?: Record<string, string>
}) {
  const PILL_BASE: React.CSSProperties = {
    fontSize: 11, padding: '3px 10px', borderRadius: 12, border: '1px solid var(--border)',
    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s', whiteSpace: 'nowrap',
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {[{ val: '', lbl: 'Tous' }, ...options.map(o => ({ val: o, lbl: o }))].map(({ val, lbl }) => {
          const active = value === val
          const color = val && colorMap ? colorMap[val] : undefined
          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              style={{
                ...PILL_BASE,
                background: active ? (color ? `${color}22` : 'rgba(59,130,246,0.15)') : 'transparent',
                borderColor: active ? (color || '#3b82f6') : 'var(--border)',
                color: active ? (color || '#3b82f6') : 'var(--text-3)',
                fontWeight: active ? 700 : 400,
              }}
            >{lbl}</button>
          )
        })}
      </div>
    </div>
  )
}

function ApplicationTable({ apps, environments, onRefresh }: { apps: any[]; environments: any[]; onRefresh: () => void }) {
  const [filterType, setFilterType] = useState('')
  const [filterCrit, setFilterCrit] = useState('')
  const [filterEnv,  setFilterEnv]  = useState('')

  // Build dynamic env color map from environments
  const envColorMap: Record<string, string> = useMemo(() => {
    const m: Record<string, string> = {}
    environments.forEach((e: any) => { m[e.name] = e.color || '#64748b' })
    // Fallback legacy values
    if (!m['PROD'])    m['PROD']    = '#22c55e'
    if (!m['PREPROD1']) m['PREPROD1'] = '#eab308'
    if (!m['PREPROD2']) m['PREPROD2'] = '#f97316'
    if (!m['DEV'])     m['DEV']     = '#64748b'
    return m
  }, [environments])

  const allTypes = useMemo(() => [...new Set(apps.map(a => a.app_type).filter(Boolean))].sort(), [apps])
  const allEnvs  = useMemo(() => [...new Set(apps.map(a => a.environment).filter(Boolean))].sort(), [apps])

  const filtered = apps.filter(a =>
    (!filterType || a.app_type === filterType) &&
    (!filterCrit || a.criticality === filterCrit) &&
    (!filterEnv  || a.environment === filterEnv)
  )

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Applications ({filtered.length})</div>
        <button className="btn btn-ghost btn-sm" onClick={onRefresh}>↺ Rafraîchir</button>
      </div>

      {/* Pill filters */}
      <PillGroup label="Type" options={allTypes} value={filterType} onChange={setFilterType} />
      <PillGroup label="Criticité" options={['Critique','Elevée','Moyenne','Faible']} value={filterCrit} onChange={setFilterCrit}
        colorMap={{ Critique: '#ef4444', Elevée: '#f97316', Moyenne: '#3b82f6', Faible: '#64748b' }} />
      <PillGroup label="Environnement" options={allEnvs} value={filterEnv} onChange={setFilterEnv} colorMap={envColorMap} />

      {filtered.length === 0 && (
        <div className="empty-state" style={{ padding: 40 }}>Aucune application trouvée</div>
      )}

      <div className="table-wrap" style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>Nom / Code</th>
              <th>Type</th>
              <th>Criticité</th>
              <th>Environnement</th>
              <th>Domaine</th>
              <th>Équipe</th>
              <th>IPs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app: any) => {
              const critColor = CRIT_APP_COLOR[app.criticality] || '#64748b'
              const envColor  = envColorMap[app.environment] || '#64748b'
              const ips: any[] = app.ips || []
              return (
                <tr key={app.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{app.name}</div>
                    {app.code && <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--text-3)' }}>{app.code}</div>}
                  </td>
                  <td>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 8, background: 'rgba(59,130,246,0.12)', color: '#3b82f6', fontWeight: 600 }}>{app.app_type}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: `${critColor}22`, color: critColor, fontWeight: 700 }}>{app.criticality}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 8, background: `${envColor}22`, color: envColor, fontWeight: 600 }}>{app.environment}</span>
                  </td>
                  <td className="text-muted">{app.domain || '—'}</td>
                  <td className="text-muted">{app.team_name || '—'}</td>
                  <td>
                    {ips.length > 0 ? (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--bg-input)', color: 'var(--text-2)', fontWeight: 600 }}>{ips.length}</span>
                    ) : <span className="text-muted">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
