import { useEffect, useState } from 'react'
import { api } from '../api/client'
import TopologyGraph from './TopologyGraph'

interface Props {
  highlightedPath: string[]
  onClose: () => void
}

export default function TopologyModal({ highlightedPath, onClose }: Props) {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getGraph().then((d: any) => { setGraph(d); setLoading(false) })
  }, [])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '92vw', maxWidth: 1100, height: '85vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>⬡ Graphe réseau</div>
            {highlightedPath.length > 0 && (
              <div style={{ fontSize: 11, color: '#f97316', marginTop: 2 }}>
                Chemin : {highlightedPath.join(' → ')}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '5px 12px', fontSize: 12, fontFamily: 'inherit' }}>
            ✕ Fermer
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="spinner" />
            </div>
          ) : (
            <TopologyGraph nodes={graph.nodes} edges={graph.edges} highlightedPath={highlightedPath} height={650} />
          )}
        </div>
      </div>
    </div>
  )
}
