import React, { useRef, useEffect, useState } from 'react'

const EQ_COLOR: Record<string, string> = {
  firewall: '#ef4444', router: '#22c55e', switch: '#3b82f6', nsx: '#a855f7',
}
const CRIT_COLOR: Record<string, string> = {
  Critique: '#ef4444', Elevée: '#f97316', Moyenne: '#3b82f6', Faible: '#64748b',
}

export interface AppGraphViewProps {
  data: { applications: any[]; networks: any[]; equipment: any[] } | null
  selectedAppId: number | null
  onSelectApp: (id: number) => void
  loading?: boolean
}

// Layout constants
const ROW_Y = [80, 240, 400]  // apps, networks, equipment
const APP_W   = 180
const APP_H   = 110
const NET_W   = 160
const NET_H   = 70
const EQ_R    = 28
const MIN_H   = 500

function distribute(count: number, containerW: number, itemW: number): number[] {
  if (count === 0) return []
  const gap = Math.max(itemW + 12, containerW / count)
  const total = gap * count
  const startX = (containerW - total) / 2 + gap / 2
  return Array.from({ length: count }, (_, i) => startX + i * gap)
}

export default function AppGraphView({ data, selectedAppId, onSelectApp, loading }: AppGraphViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

  useEffect(() => {
    if (!containerRef.current) return
    const obs = new ResizeObserver(entries => {
      for (const e of entries) setWidth(e.contentRect.width)
    })
    obs.observe(containerRef.current)
    return () => obs.disconnect()
  }, [])

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

  const { applications, networks, equipment } = data

  // Positions
  const appXs = distribute(applications.length, width, APP_W)
  const netXs  = distribute(networks.length, width, NET_W)
  const eqXs   = distribute(equipment.length, width, EQ_R * 2)

  const appById  = new Map(applications.map(a => [a.id, { ...a, cx: 0 }]))
  const netById  = new Map(networks.map(n => [n.id, { ...n, cx: 0 }]))
  const eqById   = new Map(equipment.map(e => [e.id, { ...e, cx: 0 }]))

  applications.forEach((a, i) => { appById.get(a.id)!.cx = (appXs[i] ?? 0) })
  networks.forEach((n, i)     => { netById.get(n.id)!.cx = (netXs[i] ?? 0) })
  equipment.forEach((e, i)    => { eqById.get(e.id)!.cx  = (eqXs[i] ?? 0) })

  const svgH = ROW_Y[2] + EQ_R + 60

  // Build SVG lines
  const appNetLines: React.ReactElement[] = []
  applications.forEach(app => {
    const ax = appById.get(app.id)?.cx ?? 0
    const color = CRIT_COLOR[app.criticality] || '#64748b'
    for (const netId of app.network_ids) {
      const net = netById.get(netId)
      if (!net) continue
      appNetLines.push(
        <line
          key={`an-${app.id}-${netId}`}
          x1={ax} y1={ROW_Y[0] + APP_H}
          x2={net.cx} y2={ROW_Y[1]}
          stroke={color} strokeWidth={1.5} strokeOpacity={0.5}
        />
      )
    }
  })

  const netEqLines: React.ReactElement[] = []
  networks.forEach(net => {
    const nx = netById.get(net.id)?.cx ?? 0
    const color = net.vrf_color || 'var(--border)'
    for (const eqId of net.equipment_ids) {
      const eq = eqById.get(eqId)
      if (!eq) continue
      netEqLines.push(
        <line
          key={`ne-${net.id}-${eqId}`}
          x1={nx} y1={ROW_Y[1] + NET_H}
          x2={eq.cx} y2={ROW_Y[2] - EQ_R}
          stroke={color} strokeWidth={1.5} strokeOpacity={0.6}
          strokeDasharray="5 3"
        />
      )
    }
  })

  return (
    <div ref={containerRef} style={{ flex: 1, minHeight: MIN_H, position: 'relative', overflow: 'auto' }}>
      {/* SVG connector lines */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: svgH, pointerEvents: 'none' }}
        viewBox={`0 0 ${width} ${svgH}`}
        preserveAspectRatio="none"
      >
        {appNetLines}
        {netEqLines}
      </svg>

      {/* DOM cards */}
      <div style={{ position: 'relative', height: svgH }}>

        {/* Row 1 — Applications */}
        {applications.map((app, i) => {
          const cx = appXs[i] ?? 0
          const color = CRIT_COLOR[app.criticality] || '#64748b'
          const isSelected = selectedAppId === app.id
          return (
            <div
              key={app.id}
              onClick={() => onSelectApp(app.id)}
              style={{
                position: 'absolute',
                left: cx - APP_W / 2,
                top: ROW_Y[0],
                width: APP_W,
                height: APP_H,
                borderRadius: 12,
                padding: '12px 16px',
                background: `${color}18`,
                border: `${isSelected ? 3 : 1.5}px solid ${color}`,
                boxShadow: isSelected ? `0 0 0 3px ${color}44` : 'none',
                cursor: 'pointer',
                boxSizing: 'border-box',
                transition: 'box-shadow 0.15s, border-width 0.15s',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.name}</div>
              {app.code && (
                <div style={{ fontSize: 10, fontFamily: 'monospace', color: color, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{app.code}</div>
              )}
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 4 }}>{app.app_type}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {(app.ips as string[]).slice(0, 3).map((ip: string) => (
                  <span key={ip} style={{ fontSize: 9, fontFamily: 'monospace', background: 'var(--bg-input)', color: 'var(--text-3)', padding: '1px 4px', borderRadius: 3 }}>{ip}</span>
                ))}
                {app.ips.length > 3 && (
                  <span style={{ fontSize: 9, color: 'var(--text-3)' }}>+{app.ips.length - 3}</span>
                )}
              </div>
            </div>
          )
        })}

        {/* Row 2 — Networks */}
        {networks.map((net, i) => {
          const cx = netXs[i] ?? 0
          const vrfColor = net.vrf_color || undefined
          return (
            <div
              key={net.id}
              style={{
                position: 'absolute',
                left: cx - NET_W / 2,
                top: ROW_Y[1],
                width: NET_W,
                height: NET_H,
                borderRadius: 8,
                padding: '8px 12px',
                background: 'var(--bg-card)',
                border: `2px dashed ${vrfColor || 'var(--border)'}`,
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 11, color: 'var(--text-1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{net.cidr}</div>
              <div style={{ fontSize: 10, color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>{net.name}</div>
              {net.vrf_name && (
                <div style={{ fontSize: 9, color: vrfColor || 'var(--text-3)', marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>VRF : {net.vrf_name}</div>
              )}
            </div>
          )
        })}

        {/* Row 3 — Equipment */}
        {equipment.map((eq, i) => {
          const cx = eqXs[i] ?? 0
          const color = EQ_COLOR[eq.type] || '#64748b'
          const letter = eq.name.charAt(0).toUpperCase()
          return (
            <div key={eq.id} style={{ position: 'absolute', left: cx - EQ_R, top: ROW_Y[2] - EQ_R, width: EQ_R * 2, height: EQ_R * 2 }}>
              <div style={{
                width: EQ_R * 2,
                height: EQ_R * 2,
                borderRadius: '50%',
                background: `${color}22`,
                border: `2px solid ${color}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
                color: color,
              }}>{letter}</div>
              <div style={{
                position: 'absolute',
                top: EQ_R * 2 + 4,
                left: '50%',
                transform: 'translateX(-50%)',
                fontSize: 9,
                color: 'var(--text-3)',
                whiteSpace: 'nowrap',
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                textAlign: 'center',
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

        {/* Row labels */}
        {applications.length > 0 && (
          <>
            <div style={{ position: 'absolute', left: 8, top: ROW_Y[0], fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Applications</div>
            {networks.length > 0 && <div style={{ position: 'absolute', left: 8, top: ROW_Y[1], fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Réseaux</div>}
            {equipment.length > 0 && <div style={{ position: 'absolute', left: 8, top: ROW_Y[2] - EQ_R, fontSize: 9, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.8px', textTransform: 'uppercase' }}>Équipements</div>}
          </>
        )}
      </div>
    </div>
  )
}
