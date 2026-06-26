import { useRef, useEffect, useCallback, useState } from 'react'

interface GraphNode {
  id: number
  name: string
  type: string
  vendor: string
  model: string
  management_ip: string
  team?: string
  physical_zone?: string
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  id: number
  source: number
  target: number
  type: string
  description: string
}

interface Props {
  nodes: GraphNode[]
  edges: GraphEdge[]
  highlightedPath?: string[]
  height?: number
}

const TYPE_COLORS: Record<string, string> = {
  firewall: '#ef4444',
  router:   '#22c55e',
  nsx:      '#a855f7',
  switch:   '#3b82f6',
}
const VENDOR_LETTER: Record<string, string> = {
  stormshield: 'S', paloalto: 'P', juniper: 'J',
  nsx: 'N', fortinet: 'F', checkpoint: 'C',
}
const NODE_R = 28

function runForce(nodes: GraphNode[], edges: GraphEdge[], W: number, H: number): GraphNode[] {
  const ns = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length
    return { ...n, x: W / 2 + Math.cos(angle) * 220, y: H / 2 + Math.sin(angle) * 180, vx: 0, vy: 0 }
  })
  const idxById = new Map(ns.map((n, i) => [n.id, i]))

  for (let iter = 0; iter < 400; iter++) {
    // Repulsion
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x || 0.1
        const dy = ns[j].y - ns[i].y || 0.1
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = 6000 / (dist * dist)
        const fx = (force * dx) / dist
        const fy = (force * dy) / dist
        ns[i].vx -= fx; ns[i].vy -= fy
        ns[j].vx += fx; ns[j].vy += fy
      }
    }
    // Attraction (edges)
    for (const e of edges) {
      const si = idxById.get(e.source)
      const ti = idxById.get(e.target)
      if (si == null || ti == null) continue
      const dx = ns[ti].x - ns[si].x
      const dy = ns[ti].y - ns[si].y
      const dist = Math.sqrt(dx * dx + dy * dy) || 1
      const ideal = 180
      const force = 0.04 * (dist - ideal)
      const fx = (force * dx) / dist
      const fy = (force * dy) / dist
      ns[si].vx += fx; ns[si].vy += fy
      ns[ti].vx -= fx; ns[ti].vy -= fy
    }
    // Gravity
    for (const n of ns) {
      n.vx += (W / 2 - n.x) * 0.008
      n.vy += (H / 2 - n.y) * 0.008
      n.vx *= 0.82; n.vy *= 0.82
      n.x = Math.max(NODE_R + 10, Math.min(W - NODE_R - 10, n.x + n.vx))
      n.y = Math.max(NODE_R + 20, Math.min(H - NODE_R - 20, n.y + n.vy))
    }
  }
  return ns
}

export default function TopologyGraph({ nodes: rawNodes, edges, highlightedPath = [], height = 520 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const dragRef = useRef<{ id: number; ox: number; oy: number } | null>(null)
  const [tooltip, setTooltip] = useState<{ node: GraphNode; x: number; y: number } | null>(null)
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  const highlighted = new Set(highlightedPath)

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width
    const H = canvas.height
    ctx.clearRect(0, 0, W, H)

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.03)'
    ctx.lineWidth = 1
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

    const ns = nodesRef.current
    if (!ns.length) return
    const byId = new Map(ns.map(n => [n.id, n]))

    // Draw edges
    for (const e of edges) {
      const src = byId.get(e.source)
      const dst = byId.get(e.target)
      if (!src || !dst) continue
      const inPath = highlighted.size > 0 && highlighted.has(src.name) && highlighted.has(dst.name)
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(dst.x, dst.y)
      if (inPath) {
        ctx.strokeStyle = '#f97316'
        ctx.lineWidth = 3
        ctx.setLineDash([])
        // Glow
        ctx.shadowColor = '#f97316'
        ctx.shadowBlur = 10
      } else if (e.type === 'logical') {
        ctx.strokeStyle = 'rgba(139,147,168,0.35)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 4])
      } else {
        ctx.strokeStyle = 'rgba(139,147,168,0.5)'
        ctx.lineWidth = 1.5
        ctx.setLineDash([])
      }
      ctx.stroke()
      ctx.restore()

      // Edge label
      if (e.description) {
        const mx = (src.x + dst.x) / 2
        const my = (src.y + dst.y) / 2
        ctx.save()
        ctx.font = '10px Inter, sans-serif'
        ctx.fillStyle = inPath ? '#f97316' : 'rgba(139,147,168,0.6)'
        ctx.textAlign = 'center'
        ctx.fillText(e.type === 'logical' ? '(logique)' : '', mx, my - 4)
        ctx.restore()
      }
    }

    // Draw nodes
    for (const n of ns) {
      const inPath = highlighted.size > 0 && highlighted.has(n.name)
      const isSelected = selectedNode?.id === n.id
      const color = TYPE_COLORS[n.type] || '#64748b'
      const letter = VENDOR_LETTER[n.vendor] || n.vendor[0]?.toUpperCase() || '?'

      ctx.save()

      // Glow for highlighted
      if (inPath) {
        ctx.shadowColor = '#f97316'
        ctx.shadowBlur = 20
      } else if (isSelected) {
        ctx.shadowColor = '#3b82f6'
        ctx.shadowBlur = 15
      }

      // Outer ring
      ctx.beginPath()
      ctx.arc(n.x, n.y, NODE_R + 4, 0, Math.PI * 2)
      ctx.fillStyle = inPath ? 'rgba(249,115,22,0.2)' : isSelected ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)'
      ctx.fill()

      // Node circle
      ctx.beginPath()
      ctx.arc(n.x, n.y, NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = '#161b27'
      ctx.fill()
      ctx.strokeStyle = inPath ? '#f97316' : isSelected ? '#3b82f6' : color
      ctx.lineWidth = inPath || isSelected ? 2.5 : 1.5
      ctx.stroke()

      // Vendor letter
      ctx.font = `bold 15px Inter, monospace`
      ctx.fillStyle = color
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(letter, n.x, n.y)

      ctx.restore()

      // Node name
      ctx.save()
      ctx.font = `${inPath ? '600' : '500'} 11px Inter, sans-serif`
      ctx.fillStyle = inPath ? '#f97316' : '#e8eaf0'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(n.name, n.x, n.y + NODE_R + 5)
      ctx.restore()
    }

    // Legend
    const types = [
      { label: 'Firewall', color: TYPE_COLORS.firewall },
      { label: 'Routeur',  color: TYPE_COLORS.router },
      { label: 'NSX',      color: TYPE_COLORS.nsx },
      { label: 'Switch',   color: TYPE_COLORS.switch },
    ]
    ctx.save()
    types.forEach((t, i) => {
      const lx = 16
      const ly = 16 + i * 20
      ctx.beginPath()
      ctx.arc(lx, ly, 6, 0, Math.PI * 2)
      ctx.fillStyle = t.color
      ctx.fill()
      ctx.font = '11px Inter, sans-serif'
      ctx.fillStyle = '#8b93a8'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(t.label, lx + 12, ly)
    })
    if (highlighted.size > 0) {
      const ly = 16 + types.length * 20 + 8
      ctx.beginPath(); ctx.moveTo(16, ly); ctx.lineTo(26, ly)
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 3; ctx.stroke()
      ctx.fillStyle = '#f97316'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText('Chemin flux', 30, ly)
    }
    ctx.restore()
  }, [edges, highlightedPath, selectedNode])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !rawNodes.length) return
    const W = canvas.offsetWidth
    const H = height
    canvas.width = W
    canvas.height = H
    nodesRef.current = runForce(rawNodes as GraphNode[], edges, W, H)
    draw()
  }, [rawNodes, edges, height])

  useEffect(() => { draw() }, [draw])

  const getNodeAt = (x: number, y: number): GraphNode | null => {
    for (const n of nodesRef.current) {
      const dx = n.x - x; const dy = n.y - y
      if (Math.sqrt(dx * dx + dy * dy) <= NODE_R + 4) return n
    }
    return null
  }

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    const n = getNodeAt(x, y)
    if (n) dragRef.current = { id: n.id, ox: x - n.x, oy: y - n.y }
  }

  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getPos(e)
    if (dragRef.current) {
      const n = nodesRef.current.find(n => n.id === dragRef.current!.id)
      if (n) { n.x = x - dragRef.current.ox; n.y = y - dragRef.current.oy; draw() }
      return
    }
    const n = getNodeAt(x, y)
    setTooltip(n ? { node: n, x, y } : null)
    canvasRef.current!.style.cursor = n ? 'grab' : 'default'
  }

  const onMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragRef.current) {
      const { x, y } = getPos(e)
      const n = getNodeAt(x, y)
      setSelectedNode(prev => prev?.id === n?.id ? null : n ?? null)
    }
    dragRef.current = null
  }

  return (
    <div style={{ position: 'relative', background: 'var(--bg-app)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height, display: 'block' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { setTooltip(null); dragRef.current = null }}
      />
      {tooltip && !dragRef.current && (
        <div style={{
          position: 'absolute', left: tooltip.x + 14, top: tooltip.y - 10,
          background: '#1c2233', border: '1px solid var(--border)', borderRadius: 6,
          padding: '8px 12px', fontSize: 12, pointerEvents: 'none', zIndex: 10,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)', minWidth: 180,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 4 }}>{tooltip.node.name}</div>
          <div style={{ color: 'var(--text-2)' }}>{tooltip.node.vendor} · {tooltip.node.model}</div>
          {tooltip.node.management_ip && <div style={{ color: 'var(--text-3)', fontFamily: 'monospace', marginTop: 2 }}>🖥 {tooltip.node.management_ip}</div>}
          {tooltip.node.team && <div style={{ color: 'var(--text-3)', marginTop: 2 }}>👥 {tooltip.node.team}</div>}
          {tooltip.node.physical_zone && <div style={{ color: 'var(--text-3)' }}>📍 {tooltip.node.physical_zone}</div>}
        </div>
      )}
      {selectedNode && (
        <div style={{
          position: 'absolute', right: 12, top: 12, width: 200,
          background: '#1c2233', border: '1px solid var(--border-focus)', borderRadius: 8,
          padding: '12px 14px', fontSize: 12,
        }}>
          <div style={{ fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>{selectedNode.name}</div>
          {[
            ['Type', selectedNode.type],
            ['Vendor', selectedNode.vendor],
            ['Modèle', selectedNode.model],
            ['IP MGMT', selectedNode.management_ip],
            ['Équipe', selectedNode.team],
            ['Zone physique', selectedNode.physical_zone],
          ].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ color: 'var(--text-3)' }}>{k}</span>
              <span style={{ color: 'var(--text-2)', fontFamily: k === 'IP MGMT' ? 'monospace' : 'inherit' }}>{v}</span>
            </div>
          ))}
          <button onClick={() => setSelectedNode(null)} style={{ marginTop: 8, width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text-2)', padding: '4px 0', cursor: 'pointer', fontSize: 11 }}>Fermer</button>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 10, right: 12, fontSize: 10, color: 'var(--text-3)' }}>
        Glisser pour déplacer · Cliquer pour détails
      </div>
    </div>
  )
}
