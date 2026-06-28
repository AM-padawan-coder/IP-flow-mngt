import React, { useRef, useEffect, useState, useCallback, forwardRef, useImperativeHandle } from 'react'

const EQ_COLOR: Record<string, string> = {
  firewall: '#ef4444', router: '#22c55e', switch: '#3b82f6', nsx: '#a855f7',
}
const CRIT_COLOR: Record<string, string> = {
  Critique: '#ef4444', Elevée: '#f97316', Moyenne: '#3b82f6', Faible: '#64748b',
}

export interface AppGraphViewHandle {
  getDataUrl(format: 'png' | 'jpeg'): string | null
}

export interface AppGraphViewProps {
  data: { applications: any[]; networks: any[]; equipment: any[] } | null
  selectedAppId: number | null
  onSelectApp: (id: number) => void
  loading?: boolean
  filteredAppIds?: Set<number>
  stackedMode?: boolean
  onToggleStack?: () => void
}

// Layout constants
const ROW_Y   = [90, 280, 450]   // apps, networks, equipment
const APP_W   = 180
const APP_H   = 110
const NET_W   = 160
const NET_H   = 70
const EQ_R    = 28
const MIN_H   = 540
const STACK_W = 190
const STACK_H = 120
const MARGIN  = 12               // minimum padding from edges

function distribute(count: number, containerW: number, itemW: number): number[] {
  if (count === 0) return []
  const usable = containerW - MARGIN * 2
  const gap = Math.max(itemW + 12, usable / count)
  const total = gap * count
  // Ensure first center is at least itemW/2 + MARGIN from the left edge
  const startX = Math.max(itemW / 2 + MARGIN, (containerW - total) / 2 + gap / 2)
  return Array.from({ length: count }, (_, i) => startX + i * gap)
}

const AppGraphView = forwardRef<AppGraphViewHandle, AppGraphViewProps>(function AppGraphViewInner({
  data, selectedAppId, onSelectApp, loading,
  filteredAppIds, stackedMode, onToggleStack: _onToggleStack,
}, ref) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  // Expose canvas export
  useImperativeHandle(ref, () => ({
    getDataUrl(format: 'png' | 'jpeg'): string | null {
      if (!data || !containerRef.current) return null
      const containerW = containerRef.current.offsetWidth || width
      const { applications: allApps, networks, equipment } = data
      const applications = filteredAppIds !== undefined
        ? allApps.filter((a: any) => filteredAppIds.has(a.id))
        : allApps
      const appXs = distribute(applications.length, containerW, APP_W)
      const netXs  = distribute(networks.length, containerW, NET_W)
      const eqXs   = distribute(equipment.length, containerW, EQ_R * 2)
      const svgH = ROW_Y[2] + EQ_R + 70

      const canvas = document.createElement('canvas')
      const dpr = window.devicePixelRatio || 1
      canvas.width  = containerW * dpr
      canvas.height = svgH * dpr
      const ctx = canvas.getContext('2d')!
      ctx.scale(dpr, dpr)

      const isLight = document.documentElement.getAttribute('data-theme') === 'light'
      ctx.fillStyle = isLight ? '#f8fafc' : '#0f1118'
      ctx.fillRect(0, 0, containerW, svgH)

      applications.forEach((app: any, i: number) => {
        const ax = appXs[i] ?? 0
        const color = CRIT_COLOR[app.criticality] || '#64748b'
        for (const netId of app.network_ids) {
          const ni = networks.findIndex((n: any) => n.id === netId)
          if (ni < 0) continue
          const nx = netXs[ni] ?? 0
          ctx.beginPath(); ctx.moveTo(ax, ROW_Y[0] + APP_H); ctx.lineTo(nx, ROW_Y[1])
          ctx.strokeStyle = color; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.stroke(); ctx.globalAlpha = 1
        }
      })
      networks.forEach((net: any, i: number) => {
        const nx = netXs[i] ?? 0; const color = net.vrf_color || '#64748b'
        for (const eqId of net.equipment_ids) {
          const ei = equipment.findIndex((e: any) => e.id === eqId); if (ei < 0) continue
          const ex = eqXs[ei] ?? 0
          ctx.beginPath(); ctx.moveTo(nx, ROW_Y[1] + NET_H); ctx.lineTo(ex, ROW_Y[2] - EQ_R)
          ctx.strokeStyle = color; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1
        }
      })

      applications.forEach((app: any, i: number) => {
        const cx = appXs[i] ?? 0; const color = CRIT_COLOR[app.criticality] || '#64748b'
        const x = cx - APP_W / 2, y = ROW_Y[0]
        ctx.save(); ctx.globalAlpha = 0.12; ctx.fillStyle = color
        ctx.beginPath(); ctx.roundRect(x, y, APP_W, APP_H, 12); ctx.fill(); ctx.restore()
        ctx.strokeStyle = color; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.roundRect(x, y, APP_W, APP_H, 12); ctx.stroke()
        ctx.font = 'bold 12px Inter,sans-serif'; ctx.fillStyle = isLight ? '#1e293b' : '#e2e8f0'
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(app.name, cx, y + 12)
        ctx.font = '10px Inter,sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText(app.app_type || '', cx, y + 30)
      })
      networks.forEach((net: any, i: number) => {
        const cx = netXs[i] ?? 0; const color = net.vrf_color || '#64748b'
        const x = cx - NET_W / 2, y = ROW_Y[1]
        ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([6, 3]); ctx.strokeRect(x, y, NET_W, NET_H); ctx.setLineDash([])
        ctx.font = 'bold 11px monospace'; ctx.fillStyle = isLight ? '#1e293b' : '#e2e8f0'
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(net.cidr, cx, y + 8)
        ctx.font = '10px Inter,sans-serif'; ctx.fillStyle = '#64748b'; ctx.fillText(net.name || '', cx, y + 24)
      })
      equipment.forEach((eq: any, i: number) => {
        const cx = eqXs[i] ?? 0; const cy = ROW_Y[2]; const color = EQ_COLOR[eq.type] || '#64748b'
        ctx.save(); ctx.globalAlpha = 0.13; ctx.fillStyle = color
        ctx.beginPath(); ctx.arc(cx, cy, EQ_R, 0, Math.PI * 2); ctx.fill(); ctx.restore()
        ctx.strokeStyle = color; ctx.lineWidth = 2
        ctx.beginPath(); ctx.arc(cx, cy, EQ_R, 0, Math.PI * 2); ctx.stroke()
        ctx.font = 'bold 14px Inter,sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(eq.name.charAt(0).toUpperCase(), cx, cy)
        ctx.font = '9px Inter,sans-serif'; ctx.fillStyle = '#64748b'; ctx.textBaseline = 'top'; ctx.fillText(eq.name, cx, cy + EQ_R + 4)
      })

      return canvas.toDataURL(format === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92)
    },
  }), [data, filteredAppIds, width])

  // Drag-to-reorder state (dragMouseX = card LEFT position)
  const [appOrder, setAppOrder]           = useState<number[]>([])
  const [draggingId, setDraggingId]       = useState<number | null>(null)
  const [dragTargetIdx, setDragTargetIdx] = useState<number | null>(null)
  const [dragMouseX, setDragMouseX]       = useState(0)   // = current card LEFT
  const dragStartClientX = useRef(0)
  const dragStartLeft    = useRef(0)

  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

  useEffect(() => {
    if (data?.applications) setAppOrder(data.applications.map((a: any) => a.id))
  }, [data])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (draggingId === null) return
    const delta = e.clientX - dragStartClientX.current
    const newLeft = dragStartLeft.current + delta
    setDragMouseX(newLeft)                              // left position of card

    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const relX = e.clientX - rect.left
    const n = appOrder.length
    const gap = width / n
    setDragTargetIdx(Math.max(0, Math.min(n - 1, Math.floor(relX / gap))))
  }, [draggingId, appOrder, width])

  const handleMouseUp = useCallback(() => {
    if (draggingId !== null && dragTargetIdx !== null) {
      const fromIdx = appOrder.indexOf(draggingId)
      if (fromIdx !== dragTargetIdx) {
        const next = [...appOrder]
        next.splice(fromIdx, 1)
        next.splice(dragTargetIdx, 0, draggingId)
        setAppOrder(next)
      }
    }
    setDraggingId(null)
    setDragTargetIdx(null)
  }, [draggingId, dragTargetIdx, appOrder])

  useEffect(() => {
    if (draggingId !== null) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggingId, handleMouseMove, handleMouseUp])

  if (loading) {
    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: MIN_H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!data) {
    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: MIN_H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 14 }}>
        Aucune donnée à afficher
      </div>
    )
  }

  const { applications: allApplications, networks, equipment } = data

  const applications = filteredAppIds !== undefined
    ? allApplications.filter((a: any) => filteredAppIds.has(a.id))
    : allApplications

  const sortedApps = [...applications].sort((a, b) => {
    const ia = appOrder.indexOf(a.id), ib = appOrder.indexOf(b.id)
    if (ia === -1 && ib === -1) return 0
    if (ia === -1) return 1; if (ib === -1) return -1
    return ia - ib
  })

  const selectedApp = selectedAppId ? applications.find((a: any) => a.id === selectedAppId) : null
  const linkedNetIds = new Set<number>(selectedApp ? selectedApp.network_ids : [])
  const linkedEqIds  = new Set<number>()
  if (selectedApp) {
    networks.forEach((net: any) => { if (linkedNetIds.has(net.id)) net.equipment_ids.forEach((eid: number) => linkedEqIds.add(eid)) })
  }

  // SVG height
  const svgH = ROW_Y[2] + EQ_R + 70

  // Positions for networks and equipment (shared between both modes)
  const netXs = distribute(networks.length, width, NET_W)
  const eqXs  = distribute(equipment.length, width, EQ_R * 2)
  const netById = new Map(networks.map((n: any, i: number) => [n.id, { ...n, cx: netXs[i] ?? 0 }]))
  const eqById  = new Map(equipment.map((e: any, i: number) => [e.id, { ...e, cx: eqXs[i] ?? 0 }]))

  // ── STACKED MODE ─────────────────────────────────────────────────────────────
  if (stackedMode) {
    const groups: Record<string, any[]> = {}
    sortedApps.forEach((app: any) => {
      const key = app.app_type || 'Autre'
      if (!groups[key]) groups[key] = []
      groups[key].push(app)
    })
    const groupKeys = Object.keys(groups)
    const stackXs = distribute(groupKeys.length, width, STACK_W)

    // Build SVG lines: stack → networks
    const stackNetLines: React.ReactElement[] = []
    const stackNetEqLines: React.ReactElement[] = []

    groupKeys.forEach((key, gi) => {
      const sx = stackXs[gi] ?? 0
      const groupNetIds = new Set<number>()
      groups[key].forEach((app: any) => app.network_ids.forEach((id: number) => groupNetIds.add(id)))
      const color = CRIT_COLOR[groups[key][0]?.criticality] || '#64748b'
      groupNetIds.forEach(netId => {
        const net = netById.get(netId); if (!net) return
        stackNetLines.push(
          <line key={`sn-${key}-${netId}`}
            x1={sx} y1={ROW_Y[0] + STACK_H}
            x2={net.cx} y2={ROW_Y[1]}
            stroke={color} strokeWidth="1.5" strokeOpacity="0.5"
          />
        )
      })
    })

    // net → eq lines (same as normal)
    networks.forEach((net: any) => {
      const nd = netById.get(net.id); if (!nd) return
      const color = net.vrf_color || 'var(--border)'
      net.equipment_ids.forEach((eqId: number) => {
        const eq = eqById.get(eqId); if (!eq) return
        stackNetEqLines.push(
          <line key={`ne-${net.id}-${eqId}`}
            x1={nd.cx} y1={ROW_Y[1] + NET_H}
            x2={eq.cx} y2={ROW_Y[2] - EQ_R}
            stroke={color} strokeWidth="1.5" strokeOpacity="0.6" strokeDasharray="5 3"
          />
        )
      })
    })

    return (
      <div ref={containerRef} style={{ flex: 1, minHeight: MIN_H, position: 'relative', overflow: 'auto', userSelect: 'none' }}>
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: svgH, pointerEvents: 'none' }}
          viewBox={`0 0 ${width} ${svgH}`} preserveAspectRatio="none">
          {stackNetLines}
          {stackNetEqLines}
        </svg>

        <div style={{ position: 'relative', height: svgH }}>
          {/* Row labels */}
          <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[0] - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Applications (empilées)</div>
          {networks.length > 0 && <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[1] - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Réseaux</div>}
          {equipment.length > 0 && <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[2] - EQ_R - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Équipements</div>}

          {/* Stack cards */}
          {groupKeys.map((key, gi) => {
            const cx = stackXs[gi] ?? 0
            const isExpanded = expandedTypes.has(key)
            const groupApps = groups[key]
            return (
              <div
                key={key}
                onClick={() => {
                  const next = new Set(expandedTypes)
                  if (isExpanded) next.delete(key); else next.add(key)
                  setExpandedTypes(next)
                }}
                style={{
                  position: 'absolute',
                  left: cx - STACK_W / 2,
                  top: ROW_Y[0],
                  width: STACK_W,
                  height: STACK_H,
                  borderRadius: 12,
                  padding: '14px 16px',
                  background: isExpanded ? 'rgba(34,197,94,0.12)' : 'var(--bg-card)',
                  border: `2px solid ${isExpanded ? '#22c55e' : 'var(--border)'}`,
                  boxShadow: isExpanded
                    ? '0 0 0 3px rgba(34,197,94,0.2)'
                    : '2px 4px 0 -2px var(--border), 4px 8px 0 -4px var(--border)',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transition: 'all 0.35s cubic-bezier(0.4,0,0.2,1)',
                  zIndex: 2,
                }}
              >
                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{key}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{groupApps.length} application{groupApps.length > 1 ? 's' : ''}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 8 }}>
                  {groupApps.slice(0, 5).map((app: any) => (
                    <span key={app.id} style={{ fontSize: 9, padding: '1px 5px', borderRadius: 3, background: `${CRIT_COLOR[app.criticality] || '#64748b'}22`, color: CRIT_COLOR[app.criticality] || '#64748b', border: `1px solid ${CRIT_COLOR[app.criticality] || '#64748b'}44` }}>{app.name}</span>
                  ))}
                  {groupApps.length > 5 && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>+{groupApps.length - 5}</span>}
                </div>
                <div style={{ position: 'absolute', top: 10, right: 12, fontSize: 11, color: isExpanded ? '#22c55e' : 'var(--text-3)' }}>{isExpanded ? '▲' : '▼'}</div>
              </div>
            )
          })}

          {/* Row 2 — Networks */}
          {networks.map((net: any) => {
            const nd = netById.get(net.id)!
            const vrfColor = net.vrf_color || undefined
            return (
              <div key={net.id} style={{
                position: 'absolute', left: nd.cx - NET_W / 2, top: ROW_Y[1],
                width: NET_W, height: NET_H, borderRadius: 8, padding: '8px 12px',
                background: 'var(--bg-card)', border: `2px dashed ${vrfColor || 'var(--border)'}`,
                boxSizing: 'border-box', overflow: 'hidden',
              }}>
                <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net.cidr}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{net.name}</div>
                {net.vrf_name && <div style={{ fontSize: 9, color: vrfColor || 'var(--text-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>VRF : {net.vrf_name}</div>}
              </div>
            )
          })}

          {/* Row 3 — Equipment */}
          {equipment.map((eq: any) => {
            const ed = eqById.get(eq.id)!
            const color = EQ_COLOR[eq.type] || '#64748b'
            return (
              <div key={eq.id} style={{ position: 'absolute', left: ed.cx - EQ_R, top: ROW_Y[2] - EQ_R, width: EQ_R * 2, height: EQ_R * 2 }}>
                <div style={{ width: EQ_R * 2, height: EQ_R * 2, borderRadius: '50%', background: `${color}22`, border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color }}>{eq.name.charAt(0).toUpperCase()}</div>
                <div style={{ position: 'absolute', top: EQ_R * 2 + 4, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{eq.name}</div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── NORMAL MODE ──────────────────────────────────────────────────────────────

  const appXs = distribute(sortedApps.length, width, APP_W)

  const appById = new Map(sortedApps.map((a: any, i: number) => [a.id, { ...a, cx: appXs[i] ?? 0 }]))

  // Effective center X for SVG lines (accounts for drag)
  const effectiveAppCx = (id: number): number => {
    const base = appById.get(id)?.cx ?? 0
    if (draggingId === id) return dragMouseX + APP_W / 2   // dragMouseX = left position
    return base
  }

  // Build SVG lines
  const appNetLines: React.ReactElement[] = []
  applications.forEach((app: any) => {
    const ax = effectiveAppCx(app.id)
    const color = CRIT_COLOR[app.criticality] || '#64748b'
    const isAppSelected = selectedAppId === app.id
    for (const netId of app.network_ids) {
      const net = netById.get(netId); if (!net) continue
      const lineGlow = selectedAppId !== null && isAppSelected
      const lineOpacity = selectedAppId === null ? 0.5 : (isAppSelected ? 1.0 : 0.12)
      appNetLines.push(
        <line key={`an-${app.id}-${netId}`}
          x1={ax} y1={ROW_Y[0] + APP_H}
          x2={net.cx} y2={ROW_Y[1]}
          stroke={color}
          strokeWidth={lineGlow ? 2.5 : 1.5}
          strokeOpacity={lineOpacity}
          filter={lineGlow ? 'url(#glow)' : undefined}
          style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
        />
      )
    }
  })

  const netEqLines: React.ReactElement[] = []
  networks.forEach((net: any) => {
    const nd = netById.get(net.id)!
    const color = net.vrf_color || 'var(--border)'
    const isLinked = selectedAppId === null || linkedNetIds.has(net.id)
    for (const eqId of net.equipment_ids) {
      const eq = eqById.get(eqId); if (!eq) continue
      netEqLines.push(
        <line key={`ne-${net.id}-${eqId}`}
          x1={nd.cx} y1={ROW_Y[1] + NET_H}
          x2={eq.cx} y2={ROW_Y[2] - EQ_R}
          stroke={color}
          strokeWidth={isLinked && selectedAppId !== null ? 2.5 : 1.5}
          strokeOpacity={isLinked ? (selectedAppId !== null ? 1.0 : 0.6) : 0.12}
          strokeDasharray="5 3"
          filter={isLinked && selectedAppId !== null ? 'url(#glow)' : undefined}
          style={{ transition: 'stroke-opacity 0.2s, stroke-width 0.2s' }}
        />
      )
    }
  })

  return (
    <div
      ref={containerRef}
      style={{ flex: 1, minHeight: MIN_H, position: 'relative', overflow: 'auto', userSelect: draggingId !== null ? 'none' : undefined }}
    >
      {/* SVG connector lines */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: svgH, pointerEvents: 'none' }}
        viewBox={`0 0 ${width} ${svgH}`} preserveAspectRatio="none"
      >
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        {appNetLines}
        {netEqLines}
      </svg>

      {/* Drag target indicator */}
      {draggingId !== null && dragTargetIdx !== null && sortedApps.length > 0 && (() => {
        const targetApp = sortedApps[dragTargetIdx]
        if (!targetApp) return null
        const tx = appById.get(targetApp.id)?.cx ?? 0
        return (
          <div style={{
            position: 'absolute', left: tx - APP_W / 2 - 3, top: ROW_Y[0],
            width: 3, height: APP_H, background: '#3b82f6', borderRadius: 2,
            zIndex: 10, pointerEvents: 'none', boxShadow: '0 0 6px #3b82f6',
          }} />
        )
      })()}

      {/* DOM cards */}
      <div style={{ position: 'relative', height: svgH }}>

        {/* Row labels — 16px above each row */}
        {applications.length > 0 && (
          <>
            <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[0] - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Applications</div>
            {networks.length > 0 && <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[1] - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Réseaux</div>}
            {equipment.length > 0 && <div style={{ position: 'absolute', left: MARGIN, top: ROW_Y[2] - EQ_R - 16, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Équipements</div>}
          </>
        )}

        {/* Row 1 — Applications */}
        {sortedApps.map((app: any, i: number) => {
          const cx = appXs[i] ?? 0
          const color = CRIT_COLOR[app.criticality] || '#64748b'
          const isSelected = selectedAppId === app.id
          const isLinked = selectedAppId === null || isSelected
          const isDragging = draggingId === app.id
          // dragMouseX = card LEFT position; cardLeft = dragMouseX when dragging
          const cardLeft = isDragging ? dragMouseX : cx - APP_W / 2

          return (
            <div
              key={app.id}
              onMouseDown={e => {
                e.preventDefault()
                dragStartClientX.current = e.clientX
                dragStartLeft.current = cx - APP_W / 2           // initial left
                setDragMouseX(cx - APP_W / 2)                    // start at current left
                setDraggingId(app.id)
              }}
              onClick={() => { if (draggingId === null) onSelectApp(app.id) }}
              style={{
                position: 'absolute',
                left: cardLeft,
                top: ROW_Y[0],
                width: APP_W,
                height: APP_H,
                borderRadius: 12,
                padding: '12px 16px',
                background: `${color}18`,
                border: `${isSelected ? 3 : 1.5}px solid ${color}`,
                boxShadow: isSelected
                  ? `0 0 0 3px ${color}44, 0 0 16px 2px ${color}33`
                  : 'none',
                cursor: isDragging ? 'grabbing' : 'grab',
                boxSizing: 'border-box',
                transition: isDragging ? 'none' : 'left 0.25s cubic-bezier(0.4,0,0.2,1), box-shadow 0.15s',
                overflow: 'hidden',
                opacity: isLinked ? 1 : 0.35,
                zIndex: isDragging ? 20 : (isSelected ? 5 : 1),
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
              {app.code && (
                <div style={{ fontSize: 10, fontFamily: 'monospace', color, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.code}</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{app.app_type}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {(app.ips as string[]).slice(0, 3).map((ip: string) => (
                  <span key={ip} style={{ fontSize: 9, fontFamily: 'monospace', background: 'var(--bg-input)', color: 'var(--text-3)', padding: '1px 4px', borderRadius: 3 }}>{ip}</span>
                ))}
                {app.ips.length > 3 && <span style={{ fontSize: 9, color: 'var(--text-3)' }}>+{app.ips.length - 3}</span>}
              </div>
            </div>
          )
        })}

        {/* Row 2 — Networks */}
        {networks.map((net: any) => {
          const nd = netById.get(net.id)!
          const vrfColor = net.vrf_color || undefined
          const isLinked = selectedAppId === null || linkedNetIds.has(net.id)
          const glowColor = vrfColor || '#64748b'
          return (
            <div key={net.id} style={{
              position: 'absolute', left: nd.cx - NET_W / 2, top: ROW_Y[1],
              width: NET_W, height: NET_H, borderRadius: 8, padding: '8px 12px',
              background: 'var(--bg-card)', border: `2px dashed ${vrfColor || 'var(--border)'}`,
              boxSizing: 'border-box', overflow: 'hidden',
              opacity: isLinked ? 1 : 0.35,
              boxShadow: isLinked && selectedAppId !== null ? `0 0 12px 2px ${glowColor}44` : 'none',
              transition: 'opacity 0.2s, box-shadow 0.2s',
            }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net.cidr}</div>
              <div style={{ fontSize: 10, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{net.name}</div>
              {net.vrf_name && <div style={{ fontSize: 9, color: vrfColor || 'var(--text-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>VRF : {net.vrf_name}</div>}
            </div>
          )
        })}

        {/* Row 3 — Equipment */}
        {equipment.map((eq: any) => {
          const ed = eqById.get(eq.id)!
          const color = EQ_COLOR[eq.type] || '#64748b'
          const isLinked = selectedAppId === null || linkedEqIds.has(eq.id)
          return (
            <div key={eq.id} style={{ position: 'absolute', left: ed.cx - EQ_R, top: ROW_Y[2] - EQ_R, width: EQ_R * 2, height: EQ_R * 2, opacity: isLinked ? 1 : 0.35, transition: 'opacity 0.2s' }}>
              <div style={{
                width: EQ_R * 2, height: EQ_R * 2, borderRadius: '50%',
                background: `${color}22`, border: `2px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700, color,
                boxShadow: isLinked && selectedAppId !== null ? `0 0 10px 2px ${color}44` : 'none',
                transition: 'box-shadow 0.2s',
              }}>{eq.name.charAt(0).toUpperCase()}</div>
              <div style={{
                position: 'absolute', top: EQ_R * 2 + 4, left: '50%', transform: 'translateX(-50%)',
                fontSize: 9, color: 'var(--text-3)', whiteSpace: 'nowrap', maxWidth: 80,
                overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center',
              }}>{eq.name}</div>
            </div>
          )
        })}

        {/* Empty state */}
        {applications.length === 0 && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--text-3)', fontSize: 14 }}>
            Aucune application avec des IPs associées
          </div>
        )}
      </div>
    </div>
  )
})

export default AppGraphView
