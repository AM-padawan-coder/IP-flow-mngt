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
  { v: 'v2.6', title: 'Overlays graphe réseau', status: 'done', label: '✓ Livré', eta: '',
    items: ['Overlay Flux : chemins animés sur le graphe (criticité, SLA, VRF)', 'Overlay Routes : liens BGP/OSPF/IS-IS/Static colorés avec flèches', 'Overlay VRF : halos colorés + transparence des équipements hors-VRF', 'Panneau filtres Flux (application, protocole, criticité, statut)', 'Légende dynamique + compteurs ÉLÉMENTS VISIBLES', 'Tooltips hover sur flux, routes et nœuds VRF', 'Animation dashes temps-réel pour flux et routes actifs'] },
  { v: 'v2.7', title: 'Sauvegarde & Restauration', status: 'soon', label: '🔜 Prochain', eta: '',
    items: ['Sauvegarde automatisée : incrémentale (quotidienne) et complète (hebdomadaire)', 'Vérification d\'intégrité et restauration de la base de données', 'Séparation des sauvegardes par domaine : métier, audits, simulation'] },
  { v: 'v2.8', title: 'Logs & Traçabilité', status: 'soon', label: '🔜 Prochain', eta: '',
    items: ['Journal d\'actions utilisateurs : création, validation, suppression, import/export', 'Export des logs en CSV / JSON horodaté'] },
  { v: 'v3.0', title: 'Parcours de validation', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Workflow multi-niveaux : Demandeur → Validateur → Admin', 'Rôles & permissions différenciés', 'Notifications email + webhook par changement de statut', 'Commentaires & justifications sur chaque demande', 'SLA, rappels automatiques, flux expirés'] },
  { v: 'v3.1', title: 'Simulation basique', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Validation flux enrichie : règles de firewall appliquées au chemin', 'Cas de routage indirect : flux valides sans chemin direct', 'Détection de conflits de règles entre équipements du chemin'] },
  { v: 'v3.2', title: 'Réseau réaliste', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Chemins réels : calcul basé sur les tables de routage configurées', 'Prise en compte des interfaces, métriques et politiques de routage', 'Simulation multi-chemin et load balancing'] },
  { v: 'v3.3', title: 'Audit intelligent', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Explication des règles appliquées en langage lisible', 'Analyse de conflits entre règles ACL sur un même équipement', 'Détection du shadowing : règles masquées par des règles plus permissives'] },
  { v: 'v3.4', title: 'Impact analysis', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Impacts : liste des flux, services et équipements affectés par un changement', 'Blast radius score : score d\'étendue de l\'impact', 'Simulation diff avant/après : comparaison de l\'état réseau avant et après un changement', 'Heatmap des flux impactés sur le graphe'] },
  { v: 'v4.0', title: 'Connecteur IPAM Infoblox', status: 'soon', label: '🔜 Prochain', eta: '',
    items: ['Pull CIDR / allocation IPs via REST Infoblox', 'Mock IPAM service Render (démo sans licence)', 'Sync bidirectionnelle réseaux validés → IPAM'] },
  { v: 'v4.1', title: 'VRF · ACL · Services + Snapshots', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Gestion des VRF (routage multi-instances, détection fuites)', 'Visualisation ACL par interface + détection shadowing', 'Objets de service réutilisables (groupes ports/protos)', 'Snapshots topologie + comparaison entre états', 'Simulation NAT dans le calcul de chemin'] },
  { v: 'v4.2', title: 'Graphe réseau avancé', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Vue hiérarchique (zones comme groupes visuels)', 'Mini-map de navigation pour grands graphes', 'Filtres dynamiques (zone, équipe, vendor)', 'Topology diff coloré (ajouts/suppressions)', 'Sélection lien/nœud + infobulle détaillée au hover'] },
  { v: 'v4.3', title: 'Connecteurs étendus', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['CMDB ServiceNow (sync bidirectionnelle équipements)', 'NSX-T live state (pull règles DFW actives en temps réel)', 'Palo Alto Panorama (lecture policies + détection conflits)', 'Syslog / SIEM — envoi événements vers Splunk / Elastic'] },
  { v: 'v4.4', title: 'Authentification utilisateurs', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Login / token JWT avec gestion des sessions', 'Révocation de tokens et expiration automatique', 'Protection brute-force : rate limiting et lockout'] },
  { v: 'v4.5', title: 'Validation stricte des payloads', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Schémas Pydantic renforcés sur tous les endpoints', 'Rejet des requêtes malformées avec messages d\'erreur normalisés', 'Protection contre les injections via les champs libres'] },
  { v: 'v4.6', title: 'Sécurité base de données', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Authentification des accès à la base (utilisateur dédié, moindre privilège)', 'Chiffrement au repos des données sensibles', 'Protection contre la corruption : contraintes d\'intégrité, transactions atomiques', 'Défense contre l\'injection directe en base (ORM strict, pas de requêtes brutes dynamiques)'] },
  { v: 'v5.0', title: 'Services & Dépendances', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Overlay Services : couche applicative sur le graphe réseau', 'Cartographie des dépendances inter-services', 'SLA par service avec alertes de dépassement', 'Criticité métier propagée aux flux et équipements', 'Amélioration graphe : clustering, niveaux de zoom, mini-map', 'Amélioration simulation What-If : détection de conflits ACL, analyse de bande passante, comparaison de règles firewall, liste des services touchés'] },
  { v: 'v5.1', title: 'Forward Validation', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Simulation avant changement : vérification d\'impact avant déploiement', 'Score de risque calculé par changement proposé', 'Flux impactés identifiés et listés automatiquement', 'Recommandations d\'actions correctives'] },
  { v: 'v5.2', title: 'Path Explorer', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Recherche de chemin entre deux points quelconques', 'Traceroute logique sur le modèle réseau', 'Animation du paquet hop-by-hop sur le graphe', 'Analyse détaillée par saut (interfaces, ACL traversées, routes)'] },
  { v: 'v5.3', title: 'Compliance', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Contrôles ANSSI : recommandations R43, R44, R80…', 'NIS2 : vérification des exigences de segmentation', 'Analyse de la segmentation réseau et détection de violations', 'Politiques internes : règles personnalisées de conformité'] },
  { v: 'v5.4', title: 'Firewall Analyzer', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Cleanup : détection des règles inutilisées ou redondantes', 'Shadowing : règles masquées par d\'autres plus permissives', 'Optimisation : suggestions de consolidation de règles', 'Rapport de conformité par équipement'] },
  { v: 'v6.0', title: 'Digital Twin', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Découverte automatique du réseau (SNMP, SSH, API constructeurs)', 'Synchronisation en temps réel de la topologie', 'Snapshots périodiques de l\'état du réseau', 'Comparaison entre snapshots : topology diff coloré'] },
  { v: 'v7.0', title: 'Intelligence & Langage naturel', status: 'vision', label: '🔭 Vision', eta: '',
    items: [] },
  { v: 'v7.1', title: 'Intent Based Networking', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Décrire l\'intention en langage naturel ("autoriser le serveur RH vers la BDD")', 'Génération automatique de la politique, des flux et des routes', 'Vérification de faisabilité avant application'] },
  { v: 'v7.2', title: 'Assistant réseau', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Chat intégré pour interagir avec le modèle réseau', 'Recherche conversationnelle ("quels flux traversent ce firewall ?")', 'Copilote réseau : suggestions contextuelles lors des modifications'] },
  { v: 'v7.3', title: 'Explainability', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Pourquoi ce flux échoue : analyse causale en langage naturel', 'Pourquoi ce chemin est utilisé : explication des décisions de routage', 'Pourquoi une ACL bloque : trace des règles appliquées'] },
  { v: 'v7.4', title: 'Change Advisor', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Prédiction d\'impact avant tout changement', 'Score de risque calculé par IA sur le contexte réseau', 'Recommandations de remédiation hiérarchisées'] },
  { v: 'v7.5', title: 'Rapports & Documentation AI', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Génération automatique de schémas d\'architecture réseau', 'Rapports de conformité et d\'audit enrichis par IA', 'Dossiers d\'exploitation générés automatiquement'] },
  { v: 'v7.6', title: 'Knowledge Graph', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Graphe de connaissance : services, équipements, ACL, VRF, flux', 'Cartographie des dépendances complète', 'Corrélation automatique avec les incidents réseau'] },
]

const STATUS_STYLE: Record<string, { dot: string; badge: string; badgeText: string; border: string; bg: string }> = {
  done:    { dot: '#2ea043', badge: 'rgba(34,197,94,0.15)',   badgeText: '#3fb950', border: 'rgba(34,197,94,0.25)',   bg: 'rgba(15,43,20,0.5)' },
  inprog:  { dot: '#388bfd', badge: 'rgba(59,130,246,0.15)',  badgeText: '#58a6ff', border: 'rgba(59,130,246,0.3)',   bg: 'rgba(12,32,65,0.5)' },
  soon:    { dot: '#d29922', badge: 'rgba(234,179,8,0.15)',   badgeText: '#e3b341', border: 'rgba(210,153,34,0.3)',   bg: 'rgba(42,31,10,0.5)' },
  planned: { dot: '#8b5cf6', badge: 'rgba(139,92,246,0.15)', badgeText: '#c4b5fd', border: 'rgba(139,92,246,0.25)',  bg: 'rgba(30,16,64,0.5)' },
  vision:  { dot: '#484f58', badge: 'rgba(72,79,88,0.2)',    badgeText: '#8b949e', border: 'rgba(72,79,88,0.3)',     bg: 'rgba(22,27,34,0.5)' },
}

export default function RoadmapModal({ onClose }: Props) {
  const [open, setOpen] = useState<string[]>(['v2.6', 'v3.0'])

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
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Plateforme de vérification réseau avant production</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, marginRight: 8, flexWrap: 'nowrap' }}>
              {[['#2ea043','Livré'],['#388bfd','En cours'],['#d29922','Prochain'],['#8b5cf6','Planifié'],['#484f58','Vision']].map(([c,l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />{l}
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
