import { useRef, useEffect, useCallback, useState, forwardRef, useImperativeHandle } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface GraphNode {
  id: number; name: string; type: string; vendor: string
  model: string; management_ip: string; team?: string
  physical_zone?: string; logical_zone?: string; logical_zone_color?: string
  x: number; y: number; vx: number; vy: number
}
interface GraphEdge {
  id: number; source: number; target: number; type: string; description: string
}
export interface FlowOverlay {
  id: number; name: string; application?: string; protocol?: string
  src_ip?: string; dst_ip?: string; port?: string
  criticality?: string; sla?: string; bandwidth_max?: number
  vrf_name?: string; status?: string; path: string[]; hop_count?: number
}
export interface RouteOverlay {
  id: number; destination: string; gateway?: string; route_type: string
  equipment_name: string; gateway_equipment?: string; metric?: number
}
export interface VRFOverlay {
  id: number; name: string; rd?: string; rt_import?: string; rt_export?: string
  color: string; equipment_names: string[]; equipment_count?: number; description?: string
}
export type AppOverlay = { id: number; name: string; code: string; criticality: string; environment: string; equipment_names: string[] }

type OverlayTip =
  | { kind: 'flow';  item: FlowOverlay;  x: number; y: number }
  | { kind: 'route'; item: RouteOverlay; x: number; y: number }
  | { kind: 'vrf';   vrf: VRFOverlay; nodeName: string; x: number; y: number }
  | { kind: 'app';   app: AppOverlay; x: number; y: number }

export interface TopologyGraphHandle {
  getDataUrl: (format: 'png' | 'jpeg') => string | null
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  highlightedPath?: string[]
  height?: number
  showFlows?: boolean
  showRoutes?: boolean
  showVRF?: boolean
  flowsOverlay?: FlowOverlay[]
  routesOverlay?: RouteOverlay[]
  vrfOverlay?: VRFOverlay[]
  zoneMode?: 'none' | 'physical' | 'logical'
  overlayApps?: AppOverlay[]
  onSelectApp?: (id: number) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const TYPE_COLORS: Record<string, string> = {
  firewall: '#ef4444', router: '#22c55e', switch: '#3b82f6', nsx: '#a855f7',
}
const TYPE_LABELS: Record<string, string> = {
  firewall: 'Firewall', router: 'Routeur / Switch', switch: 'Switch', nsx: 'Security / NF',
}
const PHYS_ZONE_PALETTE = ['#22c55e', '#3b82f6', '#f97316', '#a855f7', '#06b6d4', '#eab308', '#ef4444']
function hashZoneColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xFFFF
  return PHYS_ZONE_PALETTE[h % PHYS_ZONE_PALETTE.length]
}
function rndRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath()
}
const VENDOR_LETTER: Record<string, string> = {
  stormshield: 'S', paloalto: 'P', juniper: 'J', nsx: 'N', fortinet: 'F', checkpoint: 'C',
}
export const CRITICALITY_COLOR: Record<string, string> = {
  critique: '#ef4444', haute: '#f97316', moyenne: '#eab308', basse: '#22c55e',
}
export const CRIT_APP_COLOR: Record<string, string> = {
  Critique: '#ef4444', Elevée: '#f97316', Moyenne: '#3b82f6', Faible: '#64748b',
}
export const ROUTE_COLOR: Record<string, string> = {
  bgp: '#8b5cf6', ospf: '#3b82f6', isis: '#06b6d4', connected: '#22c55e', static: '#f97316',
}
const NODE_R = 28

// ── Force layout ──────────────────────────────────────────────────────────────
function runForce(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number): GraphNode[] {
  const ns = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    return { ...n, x: W / 2 + Math.cos(angle) * 220, y: H / 2 + Math.sin(angle) * 180, vx: 0, vy: 0 }
  })
  const idxById = new Map(ns.map((n, i) => [n.id, i]))
  for (let iter = 0; iter < 400; iter++) {
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x || 0.1, dy = ns[j].y - ns[i].y || 0.1
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const f = 6000 / (dist * dist), fx = (f * dx) / dist, fy = (f * dy) / dist
        ns[i].vx -= fx; ns[i].vy -= fy; ns[j].vx += fx; ns[j].vy += fy
      }
    }
    for (const e of edges) {
      const si = idxById.get(e.source), ti = idxById.get(e.target)
      if (si == null || ti == null) continue
      const dx = ns[ti].x - ns[si].x, dy = ns[ti].y - ns[si].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const f = 0.04 * (dist - 180), fx = (f * dx) / dist, fy = (f * dy) / dist
      ns[si].vx += fx; ns[si].vy += fy; ns[ti].vx -= fx; ns[ti].vy -= fy
    }
    for (const n of ns) {
      n.vx += (W / 2 - n.x) * 0.008; n.vy += (H / 2 - n.y) * 0.008
      n.vx *= 0.82; n.vy *= 0.82
      n.x = Math.max(NODE_R + 10, Math.min(W - NODE_R - 10, n.x + n.vx))
      n.y = Math.max(NODE_R + 20, Math.min(H - NODE_R - 20, n.y + n.vy))
    }
  }
  return ns
}

// ── Distance point → segment ──────────────────────────────────────────────────
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

// ── Component ─────────────────────────────────────────────────────────────────
const TopologyGraph = forwardRef<TopologyGraphHandle, Props>(function TopologyGraph({
  nodes: rawNodes, edges, highlightedPath = [], height = 520,
  showFlows = false, showRoutes = false, showVRF = false,
  flowsOverlay = [], routesOverlay = [], vrfOverlay = [],
  zoneMode = 'none',
  overlayApps = [],
  onSelectApp,
}: Props, ref) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const nodesRef     = useRef<GraphNode[]>([])
  const dragRef      = useRef<{ id: number; ox: number; oy: number } | null>(null)
  const dragZoneRef  = useRef<{ name: string; nodeStarts: Array<{node:GraphNode;sx:number;sy:number}>; mx0:number; my0:number } | null>(null)
  const rafIdRef     = useRef(0)
  const dashOffRef   = useRef(0)
  const zoneAlphaRef = useRef(zoneMode !== 'none' ? 1 : 0)
  const zoneBoxesRef    = useRef<Map<string, {minX:number;minY:number;maxX:number;maxY:number;color:string}>>(new Map())
  const appBadgeRectsRef = useRef<{app: AppOverlay; x: number; y: number; size: number}[]>([])

  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [nodeTip,      setNodeTip]      = useState<{ node: GraphNode; x: number; y: number } | null>(null)
  const [overlayTip,   setOverlayTip]   = useState<OverlayTip | null>(null)

  useImperativeHandle(ref, () => ({
    getDataUrl: (format) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      if (format === 'jpeg') return canvas.toDataURL('image/jpeg', 0.92)
      return canvas.toDataURL('image/png')
    }
  }))

  // ── Draw ──────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    const ns = nodesRef.current
    if (!ns.length) return
    const byId   = new Map(ns.map(n => [n.id, n]))
    const byName = new Map(ns.map(n => [n.name, n]))
    const highlighted = new Set(highlightedPath)

    // ── Zone containers ────────────────────────────────────────────────────
    const alpha = zoneAlphaRef.current
    zoneBoxesRef.current.clear()
    if (zoneMode !== 'none' && alpha > 0.01) {
      const groups = new Map<string, { nodes: GraphNode[]; color: string }>()
      for (const n of ns) {
        const key = zoneMode === 'physical' ? (n.physical_zone || '') : (n.logical_zone || '')
        if (!key) continue
        if (!groups.has(key)) {
          const color = zoneMode === 'logical' ? (n.logical_zone_color || hashZoneColor(key)) : hashZoneColor(key)
          groups.set(key, { nodes: [], color })
        }
        groups.get(key)!.nodes.push(n)
      }
      const PAD = 48
      for (const [name, { nodes: zns, color }] of groups) {
        const minX = Math.min(...zns.map(n => n.x)) - PAD
        const minY = Math.min(...zns.map(n => n.y)) - PAD - 16
        const maxX = Math.max(...zns.map(n => n.x)) + PAD
        const maxY = Math.max(...zns.map(n => n.y)) + PAD
        const w = maxX - minX, h = maxY - minY
        zoneBoxesRef.current.set(name, { minX, minY, maxX, maxY, color })
        ctx.save()
        ctx.globalAlpha = alpha
        rndRect(ctx, minX, minY, w, h, 12)
        ctx.fillStyle = color
        ctx.globalAlpha = alpha * (zoneMode === 'physical' ? 0.07 : 0.12)
        ctx.fill()
        ctx.globalAlpha = alpha * (zoneMode === 'physical' ? 0.5 : 0.65)
        rndRect(ctx, minX, minY, w, h, 12)
        ctx.strokeStyle = color
        ctx.lineWidth = 1.5
        ctx.setLineDash(zoneMode === 'physical' ? [7, 5] : [3, 3])
        ctx.stroke()
        ctx.setLineDash([])
        ctx.globalAlpha = alpha * 0.85
        ctx.font = 'bold 10px Inter, sans-serif'
        ctx.fillStyle = color
        ctx.textAlign = 'left'; ctx.textBaseline = 'top'
        ctx.fillText(name.toUpperCase(), minX + 9, minY + 7)
        ctx.restore()
      }
    }

    // VRF member set
    const vrfMemberNames = new Set<string>()
    if (showVRF && vrfOverlay.length > 0)
      vrfOverlay.forEach(v => v.equipment_names.forEach(n => vrfMemberNames.add(n)))

    // ── Base edges ──────────────────────────────────────────────────────────
    for (const e of edges) {
      const src = byId.get(e.source), dst = byId.get(e.target)
      if (!src || !dst) continue
      const inPath  = highlighted.size > 0 && highlighted.has(src.name) && highlighted.has(dst.name)
      const dimmed  = showVRF && vrfMemberNames.size > 0
                      && !vrfMemberNames.has(src.name) && !vrfMemberNames.has(dst.name)
      ctx.save()
      ctx.globalAlpha = dimmed ? 0.1 : 1
      ctx.beginPath(); ctx.moveTo(src.x, src.y); ctx.lineTo(dst.x, dst.y)
      if (inPath) {
        ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.setLineDash([])
        ctx.shadowColor = '#f97316'; ctx.shadowBlur = 10
      } else if (e.type === 'logical') {
        ctx.strokeStyle = 'rgba(139,147,168,0.35)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4])
      } else {
        ctx.strokeStyle = 'rgba(139,147,168,0.5)'; ctx.lineWidth = 1.5; ctx.setLineDash([])
      }
      ctx.stroke(); ctx.restore()
    }

    // ── Route overlay ───────────────────────────────────────────────────────
    if (showRoutes && routesOverlay.length > 0) {
      const validRoutes = routesOverlay.filter(
        r => r.gateway_equipment && byName.has(r.equipment_name) && byName.has(r.gateway_equipment!)
      )
      // Count routes per edge pair for offset
      const edgeCnt = new Map<string, number>()
      const edgeIdx = new Map<string, number>()
      validRoutes.forEach(r => {
        const k = [r.equipment_name, r.gateway_equipment].sort().join('||')
        edgeCnt.set(k, (edgeCnt.get(k) || 0) + 1)
      })
      for (const r of validRoutes) {
        const sn = byName.get(r.equipment_name)!, dn = byName.get(r.gateway_equipment!)!
        const k  = [r.equipment_name, r.gateway_equipment].sort().join('||')
        const cnt = edgeCnt.get(k) || 1
        const idx = edgeIdx.get(k) || 0; edgeIdx.set(k, idx + 1)
        const color = ROUTE_COLOR[r.route_type] || '#64748b'
        const dx = dn.x - sn.x, dy = dn.y - sn.y, len = Math.hypot(dx, dy) || 1
        const px = -dy / len, py = dx / len
        const om = (idx - (cnt - 1) / 2) * 10
        const ox = px * om, oy = py * om
        // Line
        ctx.save()
        ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.8
        ctx.setLineDash([4, 4]); ctx.lineDashOffset = -dashOffRef.current * 0.5
        ctx.beginPath(); ctx.moveTo(sn.x + ox, sn.y + oy); ctx.lineTo(dn.x + ox, dn.y + oy)
        ctx.stroke()
        // Arrowhead
        const ang = Math.atan2(dn.y - sn.y, dn.x - sn.x)
        const ex = dn.x + ox - (NODE_R + 4) * Math.cos(ang)
        const ey = dn.y + oy - (NODE_R + 4) * Math.sin(ang)
        ctx.setLineDash([]); ctx.lineWidth = 1.5; ctx.beginPath()
        ctx.moveTo(ex, ey); ctx.lineTo(ex - 8 * Math.cos(ang - 0.4), ey - 8 * Math.sin(ang - 0.4))
        ctx.moveTo(ex, ey); ctx.lineTo(ex - 8 * Math.cos(ang + 0.4), ey - 8 * Math.sin(ang + 0.4))
        ctx.stroke(); ctx.restore()
      }
    }

    // ── Flow overlay ────────────────────────────────────────────────────────
    if (showFlows && flowsOverlay.length > 0) {
      const validFlows = flowsOverlay.filter(
        f => f.path.length >= 2 && f.path.every(n => byName.has(n))
      )
      // Count flows per edge segment for perpendicular offset
      const edgeCnt = new Map<string, number>()
      const edgeIdx = new Map<string, number>()
      validFlows.forEach(f => {
        for (let i = 0; i < f.path.length - 1; i++) {
          const k = [f.path[i], f.path[i + 1]].sort().join('||')
          edgeCnt.set(k, (edgeCnt.get(k) || 0) + 1)
        }
      })
      // Reset per-edge index for actual drawing
      const edgeDrawIdx = new Map<string, number>()

      validFlows.forEach((flow, fi) => {
        const color = CRITICALITY_COLOR[flow.criticality || ''] || '#3b82f6'
        const pathNodes = flow.path.map(n => byName.get(n)!)
        const localEdgeIdx = new Map<string, number>()

        // Track last bezier segment for arrowhead (tangent = cp→end)
        let lastCpX = 0, lastCpY = 0, lastEndX = 0, lastEndY = 0

        ctx.save()
        ctx.strokeStyle = color; ctx.lineWidth = 2.5
        ctx.setLineDash([10, 6]); ctx.lineDashOffset = -dashOffRef.current + fi * 5
        ctx.globalAlpha = 0.85; ctx.shadowColor = color; ctx.shadowBlur = 5
        ctx.beginPath()

        for (let i = 0; i < pathNodes.length - 1; i++) {
          const src = pathNodes[i], dst = pathNodes[i + 1]
          const k  = [src.name, dst.name].sort().join('||')
          const cnt = edgeCnt.get(k) || 1
          const globalIdx = edgeDrawIdx.get(k) || 0
          const localIdx  = localEdgeIdx.get(k) ?? globalIdx
          localEdgeIdx.set(k, localIdx)
          edgeDrawIdx.set(k, globalIdx + 1)

          const dx = dst.x - src.x, dy = dst.y - src.y, len = Math.hypot(dx, dy) || 1
          const px = -dy / len, py = dx / len
          const om = (localIdx - (cnt - 1) / 2) * 14
          const ox = px * om, oy = py * om

          const cpOff = 18 + (fi % 3) * 9
          const mx = (src.x + dst.x) / 2 + px * cpOff + ox
          const my = (src.y + dst.y) / 2 + py * cpOff + oy

          if (i === 0) ctx.moveTo(src.x + ox, src.y + oy)
          ctx.quadraticCurveTo(mx, my, dst.x + ox, dst.y + oy)

          // Remember last segment's control point and endpoint (with offset)
          if (i === pathNodes.length - 2) {
            lastCpX = mx; lastCpY = my
            lastEndX = dst.x + ox; lastEndY = dst.y + oy
          }
        }
        ctx.stroke()

        // Arrowhead: direction = tangent at end of last bezier (cp → endpoint)
        if (pathNodes.length >= 2) {
          const ang = Math.atan2(lastEndY - lastCpY, lastEndX - lastCpX)
          const ex  = lastEndX - (NODE_R + 3) * Math.cos(ang)
          const ey  = lastEndY - (NODE_R + 3) * Math.sin(ang)
          ctx.setLineDash([]); ctx.lineWidth = 2.5; ctx.beginPath()
          ctx.moveTo(ex, ey)
          ctx.lineTo(ex - 12 * Math.cos(ang - 0.4), ey - 12 * Math.sin(ang - 0.4))
          ctx.moveTo(ex, ey)
          ctx.lineTo(ex - 12 * Math.cos(ang + 0.4), ey - 12 * Math.sin(ang + 0.4))
          ctx.stroke()
        }
        ctx.restore()
      })
    }

    // ── Nodes ───────────────────────────────────────────────────────────────
    // Map node name → list of VRF colors (for multi-VRF concentric rings)
    const nodeVRFColors = new Map<string, string[]>()
    if (showVRF) {
      vrfOverlay.forEach(v => {
        v.equipment_names.forEach(n => {
          const existing = nodeVRFColors.get(n) || []
          existing.push(v.color)
          nodeVRFColors.set(n, existing)
        })
      })
    }
    // Legacy single-color map (kept for dimming logic)
    const nodeVRFColor = new Map<string, string>()
    if (showVRF) vrfOverlay.forEach(v => v.equipment_names.forEach(n => nodeVRFColor.set(n, v.color)))

    for (const n of ns) {
      const inPath    = highlighted.size > 0 && highlighted.has(n.name)
      const isSelected= selectedNode?.id === n.id
      const color     = TYPE_COLORS[n.type] || '#64748b'
      const letter    = VENDOR_LETTER[n.vendor] || n.vendor[0]?.toUpperCase() || '?'
      const dimmed    = showVRF && vrfMemberNames.size > 0 && !vrfMemberNames.has(n.name)
      const vrfColors = nodeVRFColors.get(n.name) || []

      ctx.save()
      ctx.globalAlpha = dimmed ? 0.18 : 1

      // VRF concentric rings (one per VRF, innermost first)
      if (vrfColors.length > 0) {
        vrfColors.forEach((vrfColor, ringIdx) => {
          const ringR = NODE_R + 7 + ringIdx * 6
          ctx.beginPath(); ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2)
          ctx.strokeStyle = vrfColor; ctx.lineWidth = 1.8
          ctx.setLineDash([3, 3]); ctx.globalAlpha = dimmed ? 0.18 : 0.7
          ctx.stroke(); ctx.setLineDash([])
          ctx.globalAlpha = dimmed ? 0.18 : 1
        })
      }

      if (inPath)      { ctx.shadowColor = '#f97316'; ctx.shadowBlur = 20 }
      else if (isSelected) { ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 15 }

      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R + 4, 0, Math.PI * 2)
      ctx.fillStyle = inPath ? 'rgba(249,115,22,0.2)' : isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)'
      ctx.fill()

      ctx.beginPath(); ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = '#161b27'; ctx.fill()
      ctx.strokeStyle = inPath ? '#f97316' : isSelected ? '#3b82f6' : color
      ctx.lineWidth = inPath || isSelected ? 2.5 : 1.5; ctx.stroke()

      ctx.font = 'bold 15px Inter, monospace'
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(letter, n.x, n.y)
      ctx.restore()

      // Node label
      ctx.save()
      ctx.globalAlpha = dimmed ? 0.18 : 1
      ctx.font = `${inPath ? '600' : '500'} 11px Inter, sans-serif`
      ctx.fillStyle = inPath ? '#f97316' : '#e8eaf0'
      ctx.textAlign = 'center'; ctx.textBaseline = 'top'
      ctx.fillText(n.name, n.x, n.y + NODE_R + 5)
      ctx.restore()
    }

    // ── App overlay badges ────────────────────────────────────────────────────
    appBadgeRectsRef.current = []
    if (overlayApps.length > 0) {
      const nodeApps = new Map<string, AppOverlay[]>()
      for (const app of overlayApps) {
        for (const eqName of app.equipment_names) {
          const existing = nodeApps.get(eqName) || []
          existing.push(app)
          nodeApps.set(eqName, existing)
        }
      }
      for (const n of ns) {
        const apps = nodeApps.get(n.name)
        if (!apps || apps.length === 0) continue
        const BADGE = 20
        const SPACING = 24
        const totalW = apps.length * BADGE + (apps.length - 1) * (SPACING - BADGE)
        const startX = n.x - totalW / 2
        const badgeY = n.y - NODE_R - 30
        apps.forEach((app, idx) => {
          const bx = startX + idx * SPACING
          const color = CRIT_APP_COLOR[app.criticality] || '#64748b'
          ctx.save()
          rndRect(ctx, bx, badgeY, BADGE, BADGE, 4)
          ctx.fillStyle = color; ctx.globalAlpha = 0.92; ctx.fill()
          // White border for readability
          ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1; ctx.globalAlpha = 1; ctx.stroke()
          ctx.font = 'bold 10px Inter, monospace'
          ctx.fillStyle = '#fff'; ctx.globalAlpha = 1
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText((app.code || app.name)[0].toUpperCase(), bx + BADGE / 2, badgeY + BADGE / 2)
          ctx.restore()
          appBadgeRectsRef.current.push({ app, x: bx, y: badgeY, size: BADGE })
        })
      }
    }

    // Bottom hint
    ctx.save()
    ctx.font = '10px Inter, sans-serif'; ctx.fillStyle = 'rgba(139,147,168,0.4)'
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillText('Glisser pour déplacer · Cliquer pour détails', W - 10, H - 6)
    ctx.restore()
  }, [edges, highlightedPath, selectedNode, showFlows, showRoutes, showVRF, flowsOverlay, routesOverlay, vrfOverlay, zoneMode, overlayApps])

  // Always keep a ref to the latest draw (for rAF)
  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])

  // Initial force layout + restore saved positions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !rawNodes.length) return
    const W = canvas.offsetWidth
    canvas.width = W; canvas.height = height
    const laid = runForce(rawNodes as GraphNode[], edges, W, height)
    try {
      const saved = JSON.parse(localStorage.getItem('ipfm_graph_positions') || '{}')
      for (const n of laid) { if (saved[n.name]) { n.x = saved[n.name].x; n.y = saved[n.name].y } }
    } catch {}
    nodesRef.current = laid
    draw()
  }, [rawNodes, edges, height])

  // Zone fade animation
  useEffect(() => {
    const target = zoneMode !== 'none' ? 1 : 0
    let id: number
    const step = () => {
      const d = target - zoneAlphaRef.current
      if (Math.abs(d) < 0.02) { zoneAlphaRef.current = target; drawRef.current(); return }
      zoneAlphaRef.current += d * 0.14
      drawRef.current()
      id = requestAnimationFrame(step)
    }
    id = requestAnimationFrame(step)
    return () => cancelAnimationFrame(id)
  }, [zoneMode])

  // Redraw on prop changes
  useEffect(() => { draw() }, [draw])

  // Animation loop (flows + routes)
  useEffect(() => {
    if (!showFlows && !showRoutes) {
      cancelAnimationFrame(rafIdRef.current)
      return
    }
    let alive = true
    const loop = () => {
      if (!alive) return
      dashOffRef.current = (dashOffRef.current + 0.4) % 24
      drawRef.current()
      rafIdRef.current = requestAnimationFrame(loop)
    }
    rafIdRef.current = requestAnimationFrame(loop)
    return () => { alive = false; cancelAnimationFrame(rafIdRef.current) }
  }, [showFlows, showRoutes])

  // ── Mouse helpers ──────────────────────────────────────────────────────────
  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const getNodeAt = (x: number, y: number): GraphNode | null => {
    for (const n of nodesRef.current)
      if (Math.hypot(n.x - x, n.y - y) <= NODE_R + 4) return n
    return null
  }
  const getOverlayAt = (x: number, y: number): OverlayTip | null => {
    const byName = new Map(nodesRef.current.map(n => [n.name, n]))
    if (showFlows) {
      for (const flow of flowsOverlay) {
        for (let i = 0; i < flow.path.length - 1; i++) {
          const a = byName.get(flow.path[i]), b = byName.get(flow.path[i + 1])
          if (a && b && distToSeg(x, y, a.x, a.y, b.x, b.y) < 12)
            return { kind: 'flow', item: flow, x, y }
        }
      }
    }
    if (showRoutes) {
      for (const r of routesOverlay) {
        if (!r.gateway_equipment) continue
        const a = byName.get(r.equipment_name), b = byName.get(r.gateway_equipment)
        if (a && b && distToSeg(x, y, a.x, a.y, b.x, b.y) < 10)
          return { kind: 'route', item: r, x, y }
      }
    }
    if (showVRF) {
      const node = getNodeAt(x, y)
      if (node) {
        const vrf = vrfOverlay.find(v => v.equipment_names.includes(node.name))
        if (vrf) return { kind: 'vrf', vrf, nodeName: node.name, x, y }
      }
    }
    for (const { app, x: bx, y: by, size } of appBadgeRectsRef.current) {
      if (x >= bx && x <= bx + size && y >= by && y <= by + size)
        return { kind: 'app', app, x, y }
    }
    return null
  }

  const savePositions = () => {
    const pos: Record<string, {x:number;y:number}> = {}
    for (const n of nodesRef.current) pos[n.name] = { x: Math.round(n.x), y: Math.round(n.y) }
    localStorage.setItem('ipfm_graph_positions', JSON.stringify(pos))
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    const n = getNodeAt(x, y)
    if (n) { dragRef.current = { id: n.id, ox: x - n.x, oy: y - n.y }; return }
    // Zone drag
    if (zoneMode !== 'none') {
      for (const [name, box] of zoneBoxesRef.current) {
        if (x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY) {
          const zns = nodesRef.current.filter(nd =>
            (zoneMode === 'physical' ? nd.physical_zone : nd.logical_zone) === name
          )
          dragZoneRef.current = { name, nodeStarts: zns.map(nd => ({ node: nd, sx: nd.x, sy: nd.y })), mx0: x, my0: y }
          return
        }
      }
    }
  }
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    const canvas = canvasRef.current!
    if (dragRef.current) {
      const n = nodesRef.current.find(n => n.id === dragRef.current!.id)
      if (n) { n.x = x - dragRef.current.ox; n.y = y - dragRef.current.oy; draw() }
      return
    }
    if (dragZoneRef.current) {
      const dz = dragZoneRef.current, dx = x - dz.mx0, dy = y - dz.my0
      const W = canvas.width, H = canvas.height
      for (const { node, sx, sy } of dz.nodeStarts) {
        node.x = Math.max(NODE_R + 10, Math.min(W - NODE_R - 10, sx + dx))
        node.y = Math.max(NODE_R + 20, Math.min(H - NODE_R - 20, sy + dy))
      }
      draw(); return
    }
    const node = getNodeAt(x, y)
    if (node) {
      setNodeTip({ node, x, y }); setOverlayTip(null)
      canvas.style.cursor = 'grab'
    } else {
      setNodeTip(null)
      // Check zone hover
      let onZone = false
      if (zoneMode !== 'none') {
        for (const box of zoneBoxesRef.current.values()) {
          if (x >= box.minX && x <= box.maxX && y >= box.minY && y <= box.maxY) { onZone = true; break }
        }
      }
      const hit = getOverlayAt(x, y)
      setOverlayTip(hit)
      canvas.style.cursor = onZone ? 'move' : hit ? 'pointer' : 'default'
    }
  }
  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const wasDragging = dragRef.current !== null || dragZoneRef.current !== null
    if (!wasDragging) {
      const { x, y } = getPos(e)
      // Check app badge click first (when overlay is active)
      if (onSelectApp) {
        for (const { app, x: bx, y: by, size } of appBadgeRectsRef.current) {
          if (x >= bx && x <= bx + size && y >= by && y <= by + size) {
            onSelectApp(app.id)
            dragRef.current = null
            dragZoneRef.current = null
            return
          }
        }
      }
      const n = getNodeAt(x, y)
      setSelectedNode(prev => prev?.id === n?.id ? null : n ?? null)
    }
    if (dragRef.current || dragZoneRef.current) savePositions()
    dragRef.current = null
    dragZoneRef.current = null
  }

  // ── Tooltip helpers ────────────────────────────────────────────────────────
  const STATUS_BADGE: Record<string, string> = {
    deployed: '#22c55e', validated: '#3b82f6', pending: '#eab308', rejected: '#ef4444',
  }
  const STATUS_LABEL: Record<string, string> = {
    deployed: 'Déployé', validated: 'Validé', pending: 'En attente', rejected: 'Refusé',
  }
  const CRIT_LABEL: Record<string, string> = {
    critique: 'Critique', haute: 'Haute', moyenne: 'Moyenne', basse: 'Basse',
  }

  return (
    <div style={{ position: 'relative', background: 'var(--bg-app)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setNodeTip(null); setOverlayTip(null); dragRef.current = null }}
      />

      {/* Equipment type legend */}
      <div style={{ position: 'absolute', bottom: 28, left: 8, background: 'rgba(15,20,30,0.82)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', pointerEvents: 'none' }}>
        {Object.entries(TYPE_COLORS).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', border: `2px solid ${color}`, background: '#161b27', flexShrink: 0 }} />
            <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{TYPE_LABELS[type] || type}</span>
          </div>
        ))}
      </div>

      {/* Node tooltip */}
      {nodeTip && !dragRef.current && (
        <div style={{ position: 'absolute', left: nodeTip.x + 14, top: nodeTip.y - 10, background: '#1c2233', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 12px', fontSize: 12, pointerEvents: 'none', zIndex: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: 180 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{nodeTip.node.name}</div>
          <div style={{ color: 'var(--text-2)' }}>{nodeTip.node.vendor} · {nodeTip.node.model}</div>
          {nodeTip.node.management_ip && <div style={{ color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>🖥 {nodeTip.node.management_ip}</div>}
          {nodeTip.node.team && <div style={{ color: 'var(--text-3)', marginTop: 2 }}>👥 {nodeTip.node.team}</div>}
          {nodeTip.node.physical_zone && <div style={{ color: 'var(--text-3)' }}>📍 {nodeTip.node.physical_zone}</div>}
          {nodeTip.node.logical_zone && <div style={{ color: nodeTip.node.logical_zone_color || 'var(--text-3)', marginTop: 2 }}>◈ {nodeTip.node.logical_zone}</div>}
        </div>
      )}

      {/* Overlay tooltip — flow */}
      {overlayTip?.kind === 'flow' && (
        <div style={{ position: 'absolute', left: Math.min(overlayTip.x + 14, 500), top: overlayTip.y - 10, background: '#1c2233', border: `1px solid ${CRITICALITY_COLOR[overlayTip.item.criticality || ''] || '#3b82f6'}40`, borderRadius: 8, padding: '12px 14px', fontSize: 12, pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 220, maxWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: 'var(--text-1)', fontSize: 13 }}>FLUX: {overlayTip.item.name}</span>
            <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: `${STATUS_BADGE[overlayTip.item.status || ''] || '#64748b'}22`, color: STATUS_BADGE[overlayTip.item.status || ''] || '#64748b' }}>● {STATUS_LABEL[overlayTip.item.status || ''] || overlayTip.item.status || '—'}</span>
          </div>
          {[
            ['Application', overlayTip.item.application],
            ['Protocole',   overlayTip.item.protocol?.toUpperCase()],
            ['Source',      overlayTip.item.src_ip],
            ['Destination', overlayTip.item.dst_ip],
            ['Port',        overlayTip.item.port],
            ['VRF',         overlayTip.item.vrf_name],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 8 }}>
              <span style={{ color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{k}</span>
              <span style={{ color: 'var(--text-2)', fontFamily: ['Source','Destination','Port','VRF'].includes(k as string) ? 'monospace' : 'inherit', textAlign: 'right' }}>{v}</span>
            </div>
          ))}
          {overlayTip.item.criticality && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CRITICALITY_COLOR[overlayTip.item.criticality] || '#64748b' }} />
              <span style={{ color: CRITICALITY_COLOR[overlayTip.item.criticality] || '#64748b', fontWeight: 600 }}>Criticité {CRIT_LABEL[overlayTip.item.criticality] || overlayTip.item.criticality}</span>
            </div>
          )}
          {overlayTip.item.path.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)' }}>
              Chemin ({overlayTip.item.path.length} sauts) · {overlayTip.item.path.join(' → ')}
            </div>
          )}
        </div>
      )}

      {/* Overlay tooltip — route */}
      {overlayTip?.kind === 'route' && (
        <div style={{ position: 'absolute', left: Math.min(overlayTip.x + 14, 500), top: overlayTip.y - 10, background: '#1c2233', border: `1px solid ${ROUTE_COLOR[overlayTip.item.route_type] || '#64748b'}40`, borderRadius: 8, padding: '12px 14px', fontSize: 12, pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: ROUTE_COLOR[overlayTip.item.route_type] || '#64748b' }} />
            Route {overlayTip.item.route_type.toUpperCase()}
          </div>
          {[
            ['Destination', overlayTip.item.destination],
            ['Next-hop',    overlayTip.item.gateway],
            ['Équipement',  overlayTip.item.equipment_name],
            ['Via',         overlayTip.item.gateway_equipment],
            ['Métrique',    overlayTip.item.metric?.toString()],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>{k}</span>
              <span style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Overlay tooltip — VRF */}
      {overlayTip?.kind === 'vrf' && (
        <div style={{ position: 'absolute', left: Math.min(overlayTip.x + 14, 500), top: overlayTip.y - 10, background: '#1c2233', border: `1px solid ${overlayTip.vrf.color}40`, borderRadius: 8, padding: '12px 14px', fontSize: 12, pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 200 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: overlayTip.vrf.color }} />
            {overlayTip.vrf.name}
          </div>
          <div style={{ color: 'var(--text-3)', marginBottom: 6 }}>{overlayTip.nodeName}</div>
          {[
            ['RD',        overlayTip.vrf.rd],
            ['RT Import', overlayTip.vrf.rt_import],
            ['RT Export', overlayTip.vrf.rt_export],
            ['Équipements', overlayTip.vrf.equipment_count?.toString()],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
              <span style={{ color: 'var(--text-3)' }}>{k}</span>
              <span style={{ color: 'var(--text-2)', fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
          {overlayTip.vrf.description && <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>{overlayTip.vrf.description}</div>}
        </div>
      )}

      {/* Overlay tooltip — Application */}
      {overlayTip?.kind === 'app' && (() => {
        const { app, x, y } = overlayTip
        const color = CRIT_APP_COLOR[app.criticality] || '#64748b'
        return (
          <div style={{ position: 'absolute', left: Math.min(x + 14, 500), top: y - 10, background: '#1c2233', border: `1px solid ${color}40`, borderRadius: 8, padding: '12px 14px', fontSize: 12, pointerEvents: 'none', zIndex: 20, boxShadow: '0 8px 32px rgba(0,0,0,0.6)', minWidth: 210 }}>
            <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
              {app.name}
            </div>
            {app.code && <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>{app.code}</div>}
            {[
              ['Criticité',    app.criticality],
              ['Environnement',app.environment],
              ['Équipements',  app.equipment_names.join(', ')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
                <span style={{ color: 'var(--text-3)' }}>{k}</span>
                <span style={{ color: 'var(--text-2)', fontFamily: k === 'Équipements' ? 'monospace' : 'inherit', fontSize: 11 }}>{v}</span>
              </div>
            ))}
          </div>
        )
      })()}

      {/* Selected node panel */}
      {selectedNode && (
        <div style={{ position: 'absolute', right: 12, top: 12, width: 200, background: '#1c2233', border: '1px solid var(--border-focus)', borderRadius: 8, padding: '12px 14px', fontSize: 12, zIndex: 5 }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{selectedNode.name}</div>
          {[
            ['Type', selectedNode.type], ['Vendor', selectedNode.vendor],
            ['Modèle', selectedNode.model], ['IP MGMT', selectedNode.management_ip],
            ['Équipe', selectedNode.team], ['Zone', selectedNode.physical_zone],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-3)' }}>{k}</span>
              <span style={{ color: 'var(--text-2)', fontFamily: k === 'IP MGMT' ? 'monospace' : 'inherit', fontSize: k === 'IP MGMT' ? 11 : 12 }}>{v}</span>
            </div>
          ))}
          <button onClick={() => setSelectedNode(null)} style={{ marginTop: 8, width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', padding: '4px 0', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit' }}>Fermer</button>
        </div>
      )}
    </div>
  )
})

export default TopologyGraph
