import { useState } from 'react'

interface Phase {
  v: string
  title: string
  status: string
  label: string
  eta: string
  items: string[]
  subOf?: string
}

const PHASES: Phase[] = [
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
  { v: 'v2.4.1', title: 'Correctifs & améliorations flux', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.4',
    items: ['Correctif bouton Enregistrer routes + feedback erreur', 'Politiques réseau déplacées dans Topologie', 'Journal des événements politiques réseau dans Historique', 'Vue Flux dans Topologie avec export Excel (CSV)', 'Correctif visuel Import/Export (overflow)', 'Graphe ⬡ affiché en modal inline (sans quitter le formulaire)'] },

  { v: 'v2.5', title: 'Workflow & Simulation avancée', status: 'done', label: '✓ Livré', eta: '',
    items: ['Soumission flux → statut En attente (workflow manuel)', 'Valider / Déployer / Refuser depuis l\'Historique', 'Scénarios rapides = derniers flux créés', 'Détail équipement : routing + ACL depuis Administration', 'Détection SPOF (points d\'articulation du graphe)', 'Analyse d\'impact : actions proposées (ACL deny, routes)'] },

  { v: 'v2.6', title: 'Overlays graphe réseau & Import flux', status: 'done', label: '✓ Livré', eta: '',
    items: [
      'Overlay Flux : chemins animés sur le graphe (criticité, SLA, VRF)',
      'Overlay Routes : liens BGP/OSPF/IS-IS/Static colorés avec flèches',
      'Overlay VRF : halos colorés + transparence des équipements hors-VRF',
      'Panneau filtres Flux (application, protocole, criticité, statut)',
      'Légende dynamique + compteurs ÉLÉMENTS VISIBLES',
      'Tooltips hover sur flux, routes et nœuds VRF ; statut réel du flux',
      'Animation dashes temps-réel ; arrowhead bézier (suit la tangente du chemin)',
      'Autocomplete sur les 5 champs filtres flux',
      'Bouton « Voir sur le graphe » depuis Nouveau flux',
      'Zones physiques sur le graphe : conteneurs à bordure tiretée',
      'Zones logiques sur le graphe : conteneurs à bordure pointillée',
      'Toggle Physique / Logique / Aucune avec animation de fondu',
      'Drag de zone : déplacement groupé de tous les nœuds du conteneur',
      'Sauvegarde automatique des positions en localStorage',
      'Import flux JSON : modal 4 étapes (Saisie → Aperçu → Validation → Import)',
      'Constructeur visuel drag & drop 3 panneaux (Palette / Constructeur / Aperçu JSON)',
      'Validation 3 niveaux : syntaxique → règles métier → doublons',
    ] },

  { v: 'v2.7', title: 'Import flux JSON, Modal Builder & Validation', status: 'done', label: '✓ Livré', eta: '',
    items: ['Import JSON multi-flux : format structuré (source, destination, zones, ports, protocoles)', 'Modal Builder avec palette de champs glisser-déposer', 'Constructeur visuel avec sections SOURCE / DESTINATION / RÈGLE', 'Aperçu JSON temps réel synchronisé avec le constructeur', 'Validation 3 niveaux : syntaxique (bloquant) → règles métier (avertissements) → doublons existants', 'Workflow 4 étapes : Saisie → Aperçu → Validation → Import', 'Affichage erreurs par champ et par flux ; clic sur erreur → focus champ'] },
  { v: 'v2.7.1', title: 'Zones — toggle Physique / Logique', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.7',
    items: ['Toggle Physique / Logique / Aucune sur le graphe topologie', 'Conteneurs zone physique et logique affichés séparément selon le mode actif', 'Animation de fondu lors du changement de mode'] },

  { v: 'v2.8', title: 'Sauvegarde & Restauration, VRF, moteur de conformité', status: 'done', label: '✓ Livré', eta: '',
    items: [
      'Sauvegarde complète hebdomadaire : copie binaire SQLite (dimanche 03h00 UTC)',
      'Sauvegarde incrémentale quotidienne : export JSON par domaine (02h00 UTC)',
      'Domaines séparés : Métier, Audits, Simulation (VRF)',
      'Vérification d\'intégrité PRAGMA integrity_check après chaque backup',
      'Restauration avec double confirmation et vérification pré-restauration',
      'Déclenchement manuel : complète ou incrémentale par domaine',
      'Vérification quotidienne à 08h00 UTC + alerte log CRITICAL si backup absent ou corrompu',
      'Historique horodaté avec taille, statut et résultat d\'intégrité',
      'Page dédiée "Sauvegardes" dans la navigation avec tableau de bord planificateur',
    ] },
  { v: 'v2.8.1', title: 'Administration nav + guide + UX sauvegardes', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.8',
    items: ['Section "Administration" ajoutée dans la barre latérale', 'Guide d\'utilisation mis à jour avec la section Sauvegardes', 'UX page Sauvegardes : retours visuels améliorés, confirmations plus claires'] },
  { v: 'v2.8.2', title: 'Socle de conformité OSCAL', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.8',
    items: [
      'Catalogue de contrôles au format OSCAL 1.1.2 (SEG-001, FLT-001, EXP-001, ADM-001, CRY-001)',
      'Profils OSCAL : NIS2, ANSSI Guide d\'hygiène, CIS v8 — sélection de source',
      'Moteur générique réutilisable : interface ComplianceProvider + LocalEngineProvider',
      'Évaluateur d\'expressions sûr basé sur ast (sans eval)',
      'API REST : /compliance/sources, /catalog, /controls, /evaluate',
      'Page "Conformité" dans la section Administration',
    ] },
  { v: 'v2.8.3', title: 'Conformité — branchement moteur réel', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.8',
    items: [
      'Analyse flux (/flows/analyze) : verdict de conformité sur le chemin réellement calculé',
      'Conformité évaluée même sur un flux rejeté (dès que zones src/dst résolues)',
      'Panneau Conformité dans "Nouveau flux" : verdict + violations détaillées',
      '/compliance/evaluate/flow/{id} utilise le chemin réel',
      'Correctif compatibilité Python 3.9 (Optional[str])',
      'Configuration : zones physiques avec boutons modifier/supprimer et formulaire dédié',
    ] },
  { v: 'v2.8.4', title: 'Réorg navigation & VRF config', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.8',
    items: [
      '"Équipes & Sites" renommé en "Équipes" ; "Conformité" déplacée en section Référentiel',
      'Configuration : onglet "Zones logiques" épuré (sans sélecteur de type)',
      'Configuration : nouvel onglet "Zones physiques" dédié (DC / Salle / Baie)',
      'Configuration : nouvel onglet "VRF" — création, édition, suppression, affectation équipements',
      'Topologie : onglets "Zones logiques" + "Zones physiques" (vue cartes)',
      'Badge "Confiance X%" sur une seule ligne ; trait résiduel VRF supprimé',
    ] },
  { v: 'v2.8.5', title: 'VRF — équipements membres dès la création', status: 'done', label: '✓ Livré', eta: '', subOf: 'v2.8',
    items: [
      'Section "Équipements membres" visible dès la création d\'une VRF (pas seulement en édition)',
      'Équipements en attente stockés localement (pendingEq) ; rattachés à la VRF lors de la confirmation',
      'Boutons Créer / Mettre à jour / Annuler repositionnés sous la liste des membres',
    ] },

  { v: 'v2.9', title: 'Logs & Traçabilité', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Journal d\'actions utilisateurs : création, validation, suppression, import/export', 'Export des logs en CSV / JSON horodaté'] },
  { v: 'v2.10', title: 'Tests de non régression', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Suite pytest (backend) : endpoints API, validation flux, calcul de chemin, règles ACL', 'Suite Playwright (frontend) : parcours utilisateur clés', 'Rapport de couverture avant/après chaque release', 'CI/CD : GitHub Actions sur chaque push', 'Données de test dédiées : fixtures isolées sans impact sur la base de démo'] },
  { v: 'v3.0', title: 'Parcours de validation', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Workflow multi-niveaux : Demandeur → Validateur → Admin', 'Rôles & permissions différenciés', 'Notifications email + webhook par changement de statut', 'Commentaires & justifications sur chaque demande', 'SLA, rappels automatiques, flux expirés'] },
  { v: 'v3.1', title: 'Simulation basique', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Validation flux enrichie : règles de firewall appliquées au chemin', 'Cas de routage indirect : flux valides sans chemin direct', 'Détection de conflits de règles entre équipements du chemin'] },
  { v: 'v3.2', title: 'Réseau réaliste', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Chemins réels : calcul basé sur les tables de routage configurées', 'Prise en compte des interfaces, métriques et politiques de routage', 'Simulation multi-chemin et load balancing'] },
  { v: 'v3.3', title: 'Audit intelligent', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Explication des règles appliquées en langage lisible', 'Analyse de conflits entre règles ACL sur un même équipement', 'Détection du shadowing : règles masquées par des règles plus permissives'] },
  { v: 'v3.4', title: 'Impact analysis', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Impacts : liste des flux, services et équipements affectés par un changement', 'Blast radius score', 'Simulation diff avant/après : comparaison de l\'état réseau', 'Heatmap des flux impactés sur le graphe'] },
  { v: 'v3.5', title: 'Conformité — enrichissement du moteur', status: 'inprog', label: '⚙ En cours', eta: '',
    items: [
      'Amélioration du moteur de conformité introduit en v2.8.2 (OSCAL 1.1.2, LocalEngineProvider)',
      'Nouvelles règles de contrôle : chiffrement inter-zones (CRY-002), isolation DMZ (SEG-002), accès administration hors-bande (ADM-002)',
      'Extension des profils existants : NIS2, ANSSI Guide d\'hygiène, CIS v8 — couverture élargie',
      'Scoring de conformité agrégé par profil (% de contrôles satisfaits / en échec / non évalués)',
      'Vue synthèse par framework dans la page Conformité : progression par domaine de contrôle',
      'Amélioration des messages de violation : contexte réseau et recommandation de remédiation inclus',
    ] },

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
    items: ['Overlay Services : couche applicative sur le graphe réseau', 'Cartographie des dépendances inter-services', 'SLA par service avec alertes de dépassement', 'Criticité métier propagée aux flux et équipements'] },
  { v: 'v5.1', title: 'Forward Validation', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Simulation avant changement : vérification d\'impact avant déploiement', 'Score de risque calculé par changement proposé', 'Flux impactés identifiés et listés automatiquement', 'Recommandations d\'actions correctives'] },
  { v: 'v5.2', title: 'Path Explorer', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Recherche de chemin entre deux points quelconques', 'Traceroute logique sur le modèle réseau', 'Animation du paquet hop-by-hop sur le graphe', 'Analyse détaillée par saut (interfaces, ACL traversées, routes)'] },
  { v: 'v5.3', title: 'Firewall Analyzer', status: 'planned', label: '🗓 Planifié', eta: '',
    items: ['Cleanup : détection des règles inutilisées ou redondantes', 'Shadowing : règles masquées par d\'autres plus permissives', 'Optimisation : suggestions de consolidation de règles', 'Rapport de conformité par équipement'] },
  { v: 'v6.0', title: 'Digital Twin', status: 'vision', label: '🔭 Vision', eta: '',
    items: ['Découverte automatique du réseau (SNMP, SSH, API constructeurs)', 'Synchronisation en temps réel de la topologie', 'Snapshots périodiques de l\'état du réseau', 'Comparaison entre snapshots : topology diff coloré'] },
  { v: 'v7.0', title: 'Intelligence & Langage naturel', status: 'vision', label: '🔭 Vision', eta: '', items: [] },
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

// Build index: parent → children
const SUB_VERSIONS: Record<string, Phase[]> = {}
PHASES.forEach(p => {
  if (p.subOf) {
    if (!SUB_VERSIONS[p.subOf]) SUB_VERSIONS[p.subOf] = []
    SUB_VERSIONS[p.subOf].push(p)
  }
})
const TOP_PHASES = PHASES.filter(p => !p.subOf)

interface PhaseRowProps {
  phase: Phase
  open: string[]
  toggle: (v: string) => void
  indent?: boolean
}

function PhaseRow({ phase, open, toggle, indent = false }: PhaseRowProps) {
  const s = STATUS_STYLE[phase.status]
  const isOpen = open.includes(phase.v)
  return (
    <div style={{ display: 'flex', gap: 0, marginBottom: indent ? 4 : 8 }}>
      {/* Label column */}
      <div style={{ width: indent ? 88 : 68, minWidth: indent ? 88 : 68, paddingRight: 18, paddingTop: 12, textAlign: 'right', position: 'relative', flexShrink: 0 }}>
        <span style={{ fontSize: indent ? 10 : 11, fontWeight: 700, color: indent ? 'var(--text-3)' : 'var(--text-3)', letterSpacing: '0.3px', opacity: indent ? 0.75 : 1 }}>{phase.v}</span>
        {!indent && (
          <div style={{ position: 'absolute', right: -6, top: 17, width: 12, height: 12, borderRadius: '50%', background: s.dot, border: '2px solid var(--bg-panel)', boxShadow: phase.status === 'inprog' ? `0 0 0 3px ${s.border}` : 'none' }} />
        )}
        {indent && (
          <div style={{ position: 'absolute', right: -4, top: 18, width: 8, height: 8, borderRadius: '50%', background: s.dot, border: '2px solid var(--bg-panel)', opacity: 0.8 }} />
        )}
      </div>

      {/* Card */}
      <div style={{ flex: 1, paddingLeft: indent ? 16 : 20 }}>
        <div
          onClick={() => toggle(phase.v)}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: indent ? '8px 12px' : '10px 14px', background: isOpen ? s.bg : 'var(--bg-card)', border: `1px solid ${isOpen ? s.border : 'var(--border)'}`, borderRadius: isOpen ? '6px 6px 0 0' : 6, cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s', opacity: indent ? 0.9 : 1 }}
        >
          {!indent && <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.badge, color: s.badgeText, whiteSpace: 'nowrap' }}>{phase.label}</span>}
          {indent && <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: s.badge, color: s.badgeText, whiteSpace: 'nowrap' }}>{phase.label}</span>}
          <span style={{ fontWeight: indent ? 500 : 600, fontSize: indent ? 12 : 13, color: 'var(--text-1)', flex: 1 }}>{phase.title}</span>
          {phase.eta && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⏱ {phase.eta}</span>}
          {phase.items.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
          )}
        </div>

        {isOpen && phase.items.length > 0 && (
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
}

export default function RoadmapModal({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState<string[]>([])
  const [subExpanded, setSubExpanded] = useState<string[]>([])

  const toggle = (v: string) =>
    setOpen(o => o.includes(v) ? o.filter(x => x !== v) : [...o, v])

  const toggleSub = (v: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSubExpanded(o => o.includes(v) ? o.filter(x => x !== v) : [...o, v])
  }

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

            {TOP_PHASES.map(phase => {
              const subs = SUB_VERSIONS[phase.v] || []
              const hasSubs = subs.length > 0
              const isSubOpen = subExpanded.includes(phase.v)
              const s = STATUS_STYLE[phase.status]
              const isOpen = open.includes(phase.v)

              return (
                <div key={phase.v}>
                  {/* Main version row */}
                  <div style={{ display: 'flex', gap: 0, marginBottom: hasSubs && isSubOpen ? 2 : 8 }}>
                    <div style={{ width: 68, minWidth: 68, paddingRight: 18, paddingTop: 12, textAlign: 'right', position: 'relative', flexShrink: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.3px' }}>{phase.v}</span>
                      <div style={{ position: 'absolute', right: -6, top: 17, width: 12, height: 12, borderRadius: '50%', background: s.dot, border: '2px solid var(--bg-panel)', boxShadow: phase.status === 'inprog' ? `0 0 0 3px ${s.border}` : 'none' }} />
                    </div>

                    <div style={{ flex: 1, paddingLeft: 20 }}>
                      <div
                        onClick={() => toggle(phase.v)}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: isOpen ? s.bg : 'var(--bg-card)', border: `1px solid ${isOpen ? s.border : 'var(--border)'}`, borderRadius: isOpen ? '6px 6px 0 0' : 6, cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s' }}
                      >
                        <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: s.badge, color: s.badgeText, whiteSpace: 'nowrap' }}>{phase.label}</span>
                        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)', flex: 1 }}>{phase.title}</span>
                        {phase.eta && <span style={{ fontSize: 11, color: 'var(--text-3)' }}>⏱ {phase.eta}</span>}
                        {/* Sub-versions toggle */}
                        {hasSubs && (
                          <button
                            onClick={e => toggleSub(phase.v, e)}
                            title={isSubOpen ? 'Masquer les sous-versions' : 'Voir les sous-versions'}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, padding: '2px 7px', borderRadius: 20, background: isSubOpen ? s.badge : 'var(--bg-input)', border: `1px solid ${isSubOpen ? s.border : 'var(--border)'}`, color: isSubOpen ? s.badgeText : 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                          >
                            <span style={{ transform: isSubOpen ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s', fontSize: 9 }}>▶</span>
                            {subs.length} patch{subs.length > 1 ? 's' : ''}
                          </button>
                        )}
                        {phase.items.length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--text-3)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                        )}
                      </div>

                      {isOpen && phase.items.length > 0 && (
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

                  {/* Sub-versions (indented, with connecting line) */}
                  {hasSubs && isSubOpen && (
                    <div style={{ marginLeft: 89, marginBottom: 8, borderLeft: `2px dashed ${s.border}` }}>
                      {subs.map((sub, idx) => (
                        <div key={sub.v} style={{ position: 'relative', marginBottom: idx < subs.length - 1 ? 4 : 8 }}>
                          {/* horizontal connector */}
                          <div style={{ position: 'absolute', left: -12, top: 18, width: 12, height: 1, background: s.border }} />
                          <div style={{ display: 'flex', gap: 0 }}>
                            {/* Sub version label */}
                            <div style={{ width: 52, minWidth: 52, paddingRight: 12, paddingTop: 10, textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', letterSpacing: '0.2px', opacity: 0.8 }}>{sub.v}</span>
                            </div>
                            {/* Sub card */}
                            <div style={{ flex: 1 }}>
                              {(() => {
                                const ss = STATUS_STYLE[sub.status]
                                const subOpen = open.includes(sub.v)
                                return (
                                  <>
                                    <div
                                      onClick={() => toggle(sub.v)}
                                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: subOpen ? ss.bg : 'var(--bg-card)', border: `1px solid ${subOpen ? ss.border : 'var(--border)'}`, borderRadius: subOpen ? '5px 5px 0 0' : 5, cursor: 'pointer', userSelect: 'none', transition: 'all 0.15s', opacity: 0.9 }}
                                    >
                                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 20, background: ss.badge, color: ss.badgeText, whiteSpace: 'nowrap' }}>{sub.label}</span>
                                      <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--text-1)', flex: 1 }}>{sub.title}</span>
                                      {sub.items.length > 0 && (
                                        <span style={{ fontSize: 10, color: 'var(--text-3)', transform: subOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▶</span>
                                      )}
                                    </div>
                                    {subOpen && sub.items.length > 0 && (
                                      <div style={{ background: ss.bg, border: `1px solid ${ss.border}`, borderTop: 'none', borderRadius: '0 0 5px 5px', padding: '8px 12px 10px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                          {sub.items.map((item, i) => (
                                            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 11, color: 'var(--text-2)' }}>
                                              <span style={{ color: ss.badgeText, fontWeight: 700, flexShrink: 0, marginTop: 1 }}>·</span>
                                              {item}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )
                              })()}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
