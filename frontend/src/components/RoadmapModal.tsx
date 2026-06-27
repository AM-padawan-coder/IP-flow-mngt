import { useState } from 'react'

interface Props { onClose: () => void }

const PHASES = [
  { v: 'v1.0', title: 'Core — Flux & Validation', status: 'done', label: '✓ Livré', eta: '',
    items: ['Moteur de chemin NetworkX (plus court chemin multi-hop)', 'Scripts Stormshield & PAN-OS natifs', 'Moteur de validation (RFC 1918, zones, ports)', 'Historique & Audit KPIs'] },
  { v: 'v2.0', title: 'Topologie & Organisation', status: 'done', label: '✓ Livré', eta: '',
    items: ['Graphe interactif canvas force-directed', 'Admin CRUD équipements / zones / réseaux / liens', 'Import/Export JSON + CSV', 'Équipes & Sites physiques (DC > Salle > Baie)'] },
  { v: 'v2.1', title: 'Guide · Dark/Light · Render', status: 'done', label: '✓ Livré', eta: '',
    items: ['Guide d\'utilisation intégré (10 sections, FAQ)', 'Roadmap interactive accessible depuis la sidebar', 'Dark / Light mode + persistance localStorage', 'Déploiement Render (backend Python + Static Site)'] },
  { v: 'v2.2', title: 'Vérification avant production', status: 'done', label: '✓ Livré', eta: '',
    items: ['Simulation What-if — impact sur les flux existants', 'Détection de boucles L2/L3 (NetworkX cycles)', 'Analyse d\'impact — flux interrompus si équipement tombe', 'Page Simulation dédiée dans la navigation'] },
  { v: 'v2.3', title: 'Gestion avancée des flux', status: 'done', label: '✓ Livré', eta: '',
    items: ['Vue détail par flux (validation, chemin, scripts)', 'Filtres par statut (Validé / Refusé / En attente / Déployé)', 'Suppression de flux avec confirmation', 'KPIs statuts en en-tête (compteurs colorés)'] },
  { v: 'v2.4', title: 'Tables de routage & ACL', status: 'done', label: '✓ Livré', eta: '',
    items: ['Tables de routage par équipement (CRUD statique/OSPF/BGP)', 'Règles ACL par équipement (permit/deny, direction in/out)', 'Génération automatique de règles ACL depuis un flux validé', 'Traçabilité flux → règles ACL générées'] },
  { v: 'v2.4.1', title: 'Correctifs & améliorations flux', status: 'done', label: '✓ Livré', eta: '',
    items: ['Correctif bouton Enregistrer routes + feedback erreur', 'Politiques réseau déplacées dans Topologie', 'Journal des événements politiques réseau dans Historique', 'Vue Flux dans Topologie avec export Excel (CSV)', 'Correctif visuel Import/Export (overflow)', 'Graphe ⬡ affiché en modal inline (sans quitter le formulaire)'] },
  { v: 'v2.5', title: 'Workflow & Simulation avancée', status: 'done', label: '✓ Livré', eta: '',
    items: ['Soumission flux → statut En attente (workflow manuel)', 'Valider / Déployer / Refuser depuis l\'Historique', 'Scénarios rapides = derniers flux créés', 'Détail équipement : routing + ACL depuis Administration', 'Détection SPOF (points d\'articulation du graphe)', 'Analyse d\'impact : actions proposées (ACL deny, routes)'] },
  { v: 'v3.0', title: 'Parcours de validation', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Workflow multi-niveaux : Demandeur → Validateur → Admin', 'Rôles & permissions différenciés', 'Notifications email + webhook par changement de statut', 'Commentaires & justifications sur chaque demande', 'SLA, rappels automatiques, flux expirés'] },
  { v: 'v4.0', title: 'Connecteur IPAM Infoblox', status: 'soon', label: '🔜 Prochain', eta: '',
    items: ['Pull CIDR / allocation IPs via REST Infoblox', 'Mock IPAM service Render (démo sans licence)', 'Sync bidirectionnelle réseaux validés → IPAM'] },
  { v: 'v4.1', title: 'VRF · ACL · Services + Snapshots', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Gestion des VRF (routage multi-instances, détection fuites)', 'Visualisation ACL par interface + détection shadowing', 'Objets de service réutilisables (groupes ports/protos)', 'Snapshots topologie + comparaison entre états', 'Simulation NAT dans le calcul de chemin'] },
  { v: 'v4.2', title: 'Graphe réseau avancé', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Vue hiérarchique (zones comme groupes visuels)', 'Mini-map de navigation pour grands graphes', 'Filtres dynamiques (zone, équipe, vendor)', 'Topology diff coloré (ajouts/suppressions)', 'Sélection lien/nœud + infobulle détaillée au hover'] },
  { v: 'v4.3', title: 'Connecteurs étendus', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['CMDB ServiceNow (sync bidirectionnelle équipements)', 'NSX-T live state (pull règles DFW actives en temps réel)', 'Palo Alto Panorama (lecture policies + détection conflits)', 'Syslog / SIEM — envoi événements vers Splunk / Elastic'] },
  { v: 'v5.0', title: 'Intelligence & Langage naturel', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['"Le serveur RH peut-il joindre la BDD port 5432 ?" → analyse auto', 'Détection anomalies (règles orphelines, conflits, sur-exposition)', 'Auto-documentation — matrice de flux générée automatiquement', 'LLM + graph — prédiction effets de bord d\'un changement'] },
]

const STATUS_STYLE: Record<string, { dot: string; badge: string; badgeText: string; border: string; bg: string }> = {
  done:    { dot: '#2ea043', badge: 'rgba(34,197,94,0.15)',   badgeText: '#3fb950', border: 'rgba(34,197,94,0.25)',   bg: 'rgba(15,43,20,0.5)' },
  inprog:  { dot: '#388bfd', badge: 'rgba(59,130,246,0.15)',  badgeText: '#58a6ff', border: 'rgba(59,130,246,0.3)',   bg: 'rgba(12,32,65,0.5)' },
  soon:    { dot: '#d29922', badge: 'rgba(234,179,8,0.15)',   badgeText: '#e3b341', border: 'rgba(210,153,34,0.3)',   bg: 'rgba(42,31,10,0.5)' },
  planned: { dot: '#8b5cf6', badge: 'rgba(139,92,246,0.15)', badgeText: '#c4b5fd', border: 'rgba(139,92,246,0.25)',  bg: 'rgba(30,16,64,0.5)' },
  vision:  { dot: '#484f58', badge: 'rgba(72,79,88,0.2)',    badgeText: '#8b949e', border: 'rgba(72,79,88,0.3)',     bg: 'rgba(22,27,34,0.5)' },
}

export default function RoadmapModal({ onClose }: Props) {
  const [open, setOpen] = useState<string[]>(['v2.4.1', 'v2.5', 'v3.0'])

  const toggle = (v: string) =>
    setOpen(o => o.includes(v) ? o.filter(x => x !== v) : [...o, v])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '90vw', maxWidth: 860, height: '88vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>Roadmap — IP Flow Manager</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Plateforme de vérification réseau avant production · Inspirée de Forward Networks</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 14, marginRight: 8 }}>
              {[['#2ea043','Livré'],['#388bfd','En cours'],['#d29922','Prochain'],['#8b5cf6','Planifié'],['#484f58','Vision']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />{l}
                </div>
              ))}
            </div>
            <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontFamily: 'inherit' }}>✕ Fermer</button>
          </div>
        </div>

        {/* Timeline */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>
          <div style={{ position: 'relative' }}>
            {/* vertical line */}
            <div style={{ position: 'absolute', left: 68, top: 0, bottom: 0, width: 2, background: 'var(--border)' }} />

            {PHASES.map(phase => {
              const s = STATUS_STYLE[phase.status]
              const isOpen = open.includes(phase.v)
              return (
                <div key={phase.v} style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
                  {/* Label */}
                  <div style={{ width: 68, minWidth: 68, paddingRight: 18, paddingTop: 12, textAlign: 'right', position: 'relative' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.3px' }}>{phase.v}</span>
                    <div style={{ position: 'absolute', right: -6, top: 17, width: 12, height: 12, borderRadius: '50%', background: s.dot, border: `2px solid var(--bg-panel)`, boxShadow: phase.status === 'inprog' ? `0 0 0 3px ${s.border}` : 'none' }} />
                  </div>

                  {/* Card */}
                  <div style={{ flex: 1, paddingLeft: 20 }}>
                    <div
                      onClick={() => toggle(phase.v)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isOpen ? s.bg : 'var(--bg-card)', border: `1px solid ${isOpen ? s.border : 'var(--border)'}`, borderRadius: isOpen ? '6px 6px 0 0' : 6, cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.badge, color: s.badgeText, whiteSpace: 'nowrap' }}>{phase.label}</span>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{phase.title}</span>
                      {phase.eta && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⏱ {phase.eta}</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                    </div>

                    {isOpen && (
                      <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderTop: 'none', borderRadius: '0 0 6px 6px', padding: '10px 14px 12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {phase.items.map((item, i) => (
                            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 12, color: 'var(--text-2)' }}>
                              <span style={{ color: s.badgeText, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
