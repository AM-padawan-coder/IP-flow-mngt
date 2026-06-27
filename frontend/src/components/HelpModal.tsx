import { useState } from 'react'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  { id: 'intro',      icon: '🏠', label: 'Introduction' },
  { id: 'flux',       icon: '＋', label: 'Saisir un flux' },
  { id: 'historique', icon: '📋', label: 'Historique' },
  { id: 'validation', icon: '✅', label: 'Validation' },
  { id: 'chemin',     icon: '⬡',  label: 'Chemin réseau' },
  { id: 'scripts',    icon: '📄', label: 'Scripts générés' },
  { id: 'overlays',   icon: '⬡',  label: 'Overlays graphe' },
  { id: 'simulation', icon: '🔬', label: 'Simulation' },
  { id: 'policies',   icon: '🔒', label: 'Politiques réseau' },
  { id: 'topo',       icon: '⚙',  label: 'Administration' },
  { id: 'import',     icon: '⬆',  label: 'Import / Export' },
  { id: 'equipes',    icon: '👥', label: 'Équipes & Sites' },
  { id: 'audit',      icon: '◎',  label: 'Audit' },
  { id: 'faq',        icon: '❓', label: 'FAQ' },
]

// ── Style constants (declared before CONTENT to avoid temporal dead zone) ─────
const H2: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10, marginTop: 0 }
const H3: React.CSSProperties = { fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 10, marginTop: 24 }
const P:  React.CSSProperties = { color: 'var(--text-2)', fontSize: 13, lineHeight: 1.65, marginBottom: 12, marginTop: 0 }
const UL: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 7, listStyle: 'none', padding: 0, margin: '0 0 16px' }
const LI: React.CSSProperties = { color: 'var(--text-2)', fontSize: 13, lineHeight: 1.5 }
const CALLOUT: React.CSSProperties = {
  background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
  borderRadius: 6, padding: '12px 16px', fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6,
}
const BTN_DOC: React.CSSProperties = {
  display: 'flex', gap: 12, alignItems: 'flex-start',
  padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 13, color: 'var(--text-2)',
}
const BTN_LABEL: React.CSSProperties = {
  minWidth: 160, fontWeight: 600, color: 'var(--blue)',
  fontFamily: 'JetBrains Mono, monospace', fontSize: 12,
}
const ARCH_GRID: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginTop: 12 }
const ARCH_CARD: React.CSSProperties = {
  background: 'var(--bg-input)', border: '1px solid var(--border)',
  borderRadius: 8, padding: '14px 10px', textAlign: 'center',
}
const ROW: React.CSSProperties = { display: 'flex', gap: 12, padding: '7px 12px', background: 'var(--bg-input)', borderRadius: 6, fontSize: 13 }
const MONO: React.CSSProperties = { fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }

// ── Section content ───────────────────────────────────────────────────────────
const CONTENT: Record<string, JSX.Element> = {
  intro: (
    <div>
      <h2 style={H2}>Bienvenue dans IP Flow Manager</h2>
      <p style={P}>IP Flow Manager est un outil de gestion et de validation des ouvertures de flux IP réseau. Il vous permet de :</p>
      <ul style={UL}>
        <li style={LI}>✅ <strong>Valider</strong> la conformité d'un flux avant ouverture (nomenclature, zones, ports interdits)</li>
        <li style={LI}>⬡ <strong>Visualiser</strong> le chemin réseau traversé (équipements, zones, interfaces)</li>
        <li style={LI}>📄 <strong>Générer automatiquement</strong> les scripts de configuration par équipement (Stormshield, Palo Alto, Juniper, NSX-T, Fortinet, Check Point)</li>
        <li style={LI}>⚙ <strong>Maintenir</strong> le référentiel d'architecture (équipements, réseaux, zones)</li>
        <li style={LI}>◎ <strong>Auditer</strong> les demandes passées et mesurer la conformité</li>
      </ul>

      <div style={CALLOUT}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>🚀 Pour une démo rapide</div>
        <p style={{ margin: 0 }}>Allez sur <strong>Nouveau flux</strong>, cliquez sur un scénario de démonstration (ex: <em>LAN → Serveur App (HTTPS)</em>), puis cliquez sur <strong>Analyser</strong>. Vous verrez en quelques secondes la validation, le chemin réseau et les scripts générés.</p>
      </div>

      <h3 style={H3}>Architecture de l'outil</h3>
      <div style={ARCH_GRID}>
        {[
          { icon: '⬡', label: 'Flux IP',      desc: 'Saisie, validation, historique' },
          { icon: '⬡', label: 'Topologie',     desc: 'Graphe, administration, import' },
          { icon: '👥', label: 'Organisation', desc: 'Équipes, sites physiques' },
          { icon: '◎', label: 'Référentiel',   desc: 'Audit et indicateurs' },
        ].map(item => (
          <div key={item.label} style={ARCH_CARD}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{item.icon}</div>
            <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{item.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{item.desc}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  flux: (
    <div>
      <h2 style={H2}>Saisir et analyser un flux IP</h2>
      <p style={P}>La page <strong>Nouveau flux</strong> est le point d'entrée principal. Elle vous permet de décrire un flux réseau et d'obtenir instantanément son analyse.</p>

      <h3 style={H3}>Champs du formulaire</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {[
          { field: 'IP Source',      req: true,  desc: 'Adresse IP de la machine émettrice du flux (ex: 10.10.1.50)' },
          { field: 'IP Destination', req: true,  desc: 'Adresse IP de la machine réceptrice (ex: 172.16.10.100)' },
          { field: 'Port de destination', req: true,  desc: 'Port TCP/UDP de destination (1-65535)' },
          { field: 'Protocole',      req: false, desc: 'TCP, UDP, ICMP ou ANY — TCP par défaut' },
          { field: 'Application',    req: false, desc: "Nom de l'application ou du service (ex: SAP, SNMP...)" },
          { field: 'Justification',  req: false, desc: 'Motif métier de la demande — recommandé pour la traçabilité' },
        ].map(r => (
          <div key={r.field} style={ROW}>
            <div style={{ minWidth: 130, fontWeight: 600, color: 'var(--text-1)' }}>
              {r.field} {r.req && <span style={{ color: 'var(--red)', fontSize: 11 }}>*</span>}
            </div>
            <div style={{ color: 'var(--text-2)' }}>{r.desc}</div>
          </div>
        ))}
      </div>

      <h3 style={H3}>Boutons d'action</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        <div style={BTN_DOC}><span style={BTN_LABEL}>▶ Analyser</span> Lance la validation sans enregistrer. Idéal pour tester un flux avant soumission.</div>
        <div style={BTN_DOC}><span style={BTN_LABEL}>✓ Soumettre</span> Enregistre la demande dans l'historique au statut <strong>En attente</strong>. Un validateur doit ensuite l'approuver depuis l'Historique.</div>
        <div style={BTN_DOC}><span style={BTN_LABEL}>⬡ Voir sur le graphe</span> Affiche le graphe réseau en modal avec le flux animé en overlay (v2.6) — chemin coloré animé sur le graphe sans quitter le formulaire.</div>
      </div>

      <div style={CALLOUT}>
        <strong>Scénarios de démonstration</strong> : Cliquez sur l'un des boutons pré-configurés en haut de page pour charger automatiquement un cas réel (flux valide, flux refusé, etc.).
      </div>

      <h3 style={H3}>Exemples de flux</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { src: '10.10.1.50',    dst: '172.16.10.100',  port: '443',  proto: 'TCP', label: 'LAN → Serveur applicatif (HTTPS)' },
          { src: '10.20.1.30',    dst: '172.16.20.50',   port: '5432', proto: 'TCP', label: 'WiFi → Base PostgreSQL' },
          { src: '172.16.20.10',  dst: '192.168.250.100', port: '22',  proto: 'TCP', label: 'Serveur BDD → Backup (SSH)' },
        ].map(ex => (
          <div key={ex.src} style={{ padding: '7px 12px', background: '#0d1117', borderRadius: 5, border: '1px solid var(--border)', ...MONO }}>
            <span style={{ color: '#79c0ff' }}>{ex.src}</span>
            <span style={{ color: 'var(--text-3)', margin: '0 6px' }}>→</span>
            <span style={{ color: '#79c0ff' }}>{ex.dst}</span>
            <span style={{ color: 'var(--text-3)', margin: '0 6px' }}>:</span>
            <span style={{ color: '#ffa657' }}>{ex.port}/{ex.proto}</span>
            <span style={{ color: 'var(--text-3)', marginLeft: 12, fontFamily: 'Inter, sans-serif', fontSize: 13 }}>— {ex.label}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  validation: (
    <div>
      <h2 style={H2}>Comprendre les résultats de validation</h2>
      <p style={P}>Après avoir cliqué sur <strong>Analyser</strong>, le panneau de droite affiche les résultats de tous les contrôles effectués sur le flux.</p>

      <h3 style={H3}>Statuts possibles</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { icon: '✓', color: '#22c55e', label: 'Conforme',    desc: 'Le contrôle est passé sans anomalie.' },
          { icon: '!', color: '#eab308', label: 'Attention',   desc: 'Le flux est autorisé mais nécessite une vérification manuelle.' },
          { icon: '✕', color: '#ef4444', label: 'Bloquant',    desc: 'Le flux viole une règle — la demande sera refusée.' },
          { icon: 'i', color: '#3b82f6', label: 'Information', desc: 'Renseignement sans impact sur la décision finale.' },
        ].map(s => (
          <div key={s.label} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', ...ROW }}>
            <div style={{ width: 22, height: 22, borderRadius: '50%', background: s.color, color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontWeight: 600, color: s.color }}>{s.label}</div>
              <div style={{ color: 'var(--text-2)' }}>{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <h3 style={H3}>Contrôles effectués</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          'Format IPv4 valide (source et destination)',
          'Port dans la plage 1-65535',
          'Protocole reconnu (TCP, UDP, ICMP...)',
          'Adressage RFC 1918 (privé ou public)',
          'Identification de la zone source et destination',
          'Politique de zone (ex: INTERNET → LAN direct interdit)',
          'Ports restreints (ex: Telnet port 23 interdit)',
        ].map((ctrl, i) => (
          <div key={i} style={ROW}>
            <span style={{ color: 'var(--blue)', fontWeight: 700 }}>{i + 1}.</span>
            <span style={{ color: 'var(--text-2)' }}>{ctrl}</span>
          </div>
        ))}
      </div>

      <div style={{ ...CALLOUT, marginTop: 20 }}>
        <strong>Règles métier configurables</strong> : Les ports interdits et les politiques de zone sont paramétrables en base de données.
      </div>
    </div>
  ),

  chemin: (
    <div>
      <h2 style={H2}>Graphe et chemin réseau</h2>
      <p style={P}>Le graphe de topologie représente les équipements réseau et leurs interconnexions. Après une analyse valide, le chemin emprunté est mis en évidence.</p>

      <h3 style={H3}>Légende des nœuds</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { color: '#ef4444', label: 'Firewall',  vendors: 'Stormshield (S), Palo Alto (P), Fortinet (F), Check Point (C)' },
          { color: '#22c55e', label: 'Routeur',   vendors: 'Juniper MX (J)' },
          { color: '#a855f7', label: 'NSX',       vendors: 'VMware NSX-T (N) — Distributed Firewall' },
          { color: '#3b82f6', label: 'Switch L3', vendors: 'Juniper EX (J)' },
        ].map(t => (
          <div key={t.label} style={{ display: 'flex', gap: 12, alignItems: 'center', ...ROW }}>
            <div style={{ width: 18, height: 18, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--text-1)', minWidth: 80 }}>{t.label}</span>
            <span style={{ color: 'var(--text-3)', fontSize: 12 }}>{t.vendors}</span>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', ...ROW }}>
          <div style={{ width: 28, height: 3, background: '#f97316', borderRadius: 1, flexShrink: 0 }} />
          <span style={{ color: '#f97316', fontWeight: 600 }}>Chemin du flux analysé (mis en évidence en orange)</span>
        </div>
      </div>

      <h3 style={H3}>Interactions sur le graphe</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { action: 'Survoler un nœud',    result: 'Affiche une infobulle : vendor, modèle, IP de management, équipe, zone physique' },
          { action: 'Cliquer un nœud',     result: 'Ouvre un panneau de détails (coin supérieur droit du graphe)' },
          { action: 'Glisser un nœud',     result: 'Déplace le nœud pour réorganiser le graphe manuellement' },
          { action: '⬡ Voir sur le graphe', result: 'Depuis Nouveau flux — affiche le flux analysé en overlay animé sur le graphe (v2.6)' },
        ].map(item => (
          <div key={item.action} style={ROW}>
            <span style={{ minWidth: 160, fontWeight: 600, color: 'var(--blue)', ...MONO }}>{item.action}</span>
            <span style={{ color: 'var(--text-2)' }}>{item.result}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  scripts: (
    <div>
      <h2 style={H2}>Scripts de configuration générés</h2>
      <p style={P}>Pour chaque équipement traversé sur le chemin, un script de configuration est automatiquement généré au format natif du vendor.</p>

      <h3 style={H3}>Formats supportés</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Stormshield CLI',       desc: 'Commandes config object + config filter policy' },
          { label: 'PAN-OS set',            desc: 'Commandes set rulebase security + address objects' },
          { label: 'Junos set',             desc: 'Firewall filters + routing policies' },
          { label: 'NSX-T REST API (curl)', desc: 'Appels curl vers le Manager NSX — groupes + règles DFW' },
          { label: 'FortiOS CLI',           desc: 'config firewall address + config firewall policy' },
          { label: 'Check Point mgmt API',  desc: 'mgmt_cli — création objets + règle + publish + install' },
        ].map(v => (
          <div key={v.label} style={ROW}>
            <span style={{ minWidth: 200, fontWeight: 600, color: 'var(--blue)' }}>{v.label}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{v.desc}</span>
          </div>
        ))}
      </div>

      <h3 style={H3}>Utiliser les scripts</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          "Chaque onglet correspond à un équipement du chemin réseau",
          "Cliquez sur 'Copier' pour copier le script dans le presse-papiers",
          "Les scripts incluent l'ID de règle unique, la date, l'application et la justification",
          "Vérifiez et adaptez les noms d'interfaces avant d'appliquer sur l'équipement réel",
          "Le script NSX-T est un shell bash à exécuter depuis un poste avec accès au Manager",
          "Le script Check Point utilise l'API Management — nécessite un token de session valide",
        ].map((step, i) => (
          <div key={i} style={ROW}>
            <span style={{ color: 'var(--blue)', fontWeight: 700, minWidth: 20 }}>{i + 1}.</span>
            <span style={{ color: 'var(--text-2)' }}>{step}</span>
          </div>
        ))}
      </div>

      <div style={{ ...CALLOUT, marginTop: 20, borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.07)' }}>
        ⚠ <strong>Mode génération uniquement</strong> : les scripts sont générés pour être validés et appliqués manuellement. L'outil ne pousse pas de configuration directement sur les équipements.
      </div>
    </div>
  ),

  overlays: (
    <div>
      <h2 style={H2}>Overlays graphe réseau (v2.6)</h2>
      <p style={P}>La vue <strong>Graphe réseau</strong> propose trois overlays activables indépendamment depuis le panneau gauche. Chaque overlay enrichit le graphe avec une couche d'information réseau.</p>

      <h3 style={H3}>Overlay Flux</h3>
      <p style={P}>Affiche les chemins de flux approuvés sur le graphe sous forme de courbes bézier animées colorées par criticité.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {[
          { color: '#ef4444', label: 'Critique', desc: 'Flux critiques pour la production' },
          { color: '#f97316', label: 'Haute',    desc: 'Flux importants' },
          { color: '#eab308', label: 'Moyenne',  desc: 'Flux standards' },
          { color: '#22c55e', label: 'Basse',    desc: 'Flux non-critiques' },
        ].map(c => (
          <div key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'center', ...ROW }}>
            <div style={{ width: 28, height: 3, background: c.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: c.color, minWidth: 70 }}>{c.label}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{c.desc}</span>
          </div>
        ))}
      </div>
      <div style={CALLOUT}>
        Utilisez les <strong>Filtres flux</strong> (panneau gauche) pour filtrer par application, protocole, IP source/destination, port, criticité ou statut. Les champs proposent l'autocomplétion sur les valeurs disponibles.
      </div>

      <h3 style={H3}>Overlay Routes</h3>
      <p style={P}>Affiche les tables de routage sous forme de traits pointillés animés colorés par protocole, avec des flèches directionnelles.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {[
          { color: '#8b5cf6', label: 'BGP',       desc: 'Routes apprises via BGP (inter-AS)' },
          { color: '#3b82f6', label: 'OSPF',      desc: 'Routes apprises via OSPF (intra-AS)' },
          { color: '#06b6d4', label: 'IS-IS',     desc: 'Routes apprises via IS-IS' },
          { color: '#22c55e', label: 'Connecté',  desc: 'Réseaux directement connectés' },
          { color: '#f97316', label: 'Statique',  desc: 'Routes statiques configurées' },
        ].map(c => (
          <div key={c.label} style={{ display: 'flex', gap: 10, alignItems: 'center', ...ROW }}>
            <div style={{ width: 28, height: 0, borderTop: `2px dashed ${c.color}`, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: c.color, minWidth: 70 }}>{c.label}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{c.desc}</span>
          </div>
        ))}
      </div>

      <h3 style={H3}>Overlay VRF</h3>
      <p style={P}>Met en évidence les équipements membres de chaque VRF avec un halo coloré. Les équipements hors-VRF sont estompés à 18% d'opacité pour focaliser l'attention.</p>

      <h3 style={H3}>Interactions sur les overlays</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { action: 'Survoler un flux',   result: 'Tooltip : application, protocole, source/destination/port, VRF, criticité, chemin complet' },
          { action: 'Survoler une route', result: 'Tooltip : destination, next-hop, équipement, protocole, métrique' },
          { action: 'Survoler un nœud VRF', result: 'Tooltip : nom de la VRF, RD, RT import/export, nombre d\'équipements' },
          { action: 'Panneau droit',      result: 'ÉLÉMENTS VISIBLES (compteurs) + Légende colorée par criticité / protocole / VRF' },
        ].map(item => (
          <div key={item.action} style={ROW}>
            <span style={{ minWidth: 170, fontWeight: 600, color: 'var(--blue)', ...MONO }}>{item.action}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{item.result}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  topo: (
    <div>
      <h2 style={H2}>Administration de la topologie</h2>
      <p style={P}>La page <strong>Administration</strong> permet de maintenir le référentiel d'architecture : équipements, zones logiques, réseaux et liens de topologie.</p>

      <h3 style={H3}>Onglets disponibles</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { tab: 'Équipements',    desc: "Ajouter / modifier / supprimer des équipements réseau. Associez chaque équipement à une équipe et une zone physique." },
          { tab: 'Zones logiques', desc: "Gérer les zones de sécurité (INTERNET, DMZ, LAN...) avec leur niveau de confiance et leur couleur d'affichage." },
          { tab: 'Réseaux',        desc: "Déclarer les sous-réseaux IP avec leur CIDR, VLAN, passerelle et zone associée." },
          { tab: 'Liens topo',     desc: "Définir les interconnexions entre équipements (Ethernet, Logique, VXLAN, LAG) pour alimenter le graphe." },
        ].map(item => (
          <div key={item.tab} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{item.tab}</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <h3 style={H3}>Types d'équipements</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { type: 'firewall', vendors: 'Stormshield, Palo Alto, Fortinet, Check Point' },
          { type: 'router',   vendors: 'Juniper MX, EX' },
          { type: 'nsx',      vendors: 'VMware NSX-T' },
          { type: 'switch',   vendors: 'Tout vendor L2/L3' },
        ].map(item => (
          <div key={item.type} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 6 }}>
            <div style={{ fontWeight: 600, color: 'var(--blue)', fontSize: 13, marginBottom: 4 }}>{item.type}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.vendors}</div>
          </div>
        ))}
      </div>
    </div>
  ),

  import: (
    <div>
      <h2 style={H2}>Import et Export de topologie</h2>
      <p style={P}>La page <strong>Import / Export</strong> permet d'alimenter massivement le référentiel depuis des fichiers existants.</p>

      <h3 style={H3}>Formats d'import</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: '12px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
          <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 6 }}>JSON complet</div>
          <p style={{ color: 'var(--text-2)', fontSize: 13, margin: '0 0 8px' }}>Importe zones, équipements, réseaux et liens en une seule opération. Idéal pour migrer une architecture complète.</p>
          <pre style={{ fontSize: 11, color: '#c9d1d9', background: '#0d1117', padding: 10, borderRadius: 4, margin: 0, overflowX: 'auto' }}>{`{
  "zones":     [{"name":"DMZ","color":"#f97316", ...}],
  "equipment": [{"name":"FW-01","type":"firewall", ...}],
  "networks":  [{"name":"LAN","cidr":"10.0.0.0/16", ...}],
  "links":     [{"equipment_a":"FW-01","equipment_b":"RTR-01", ...}]
}`}</pre>
        </div>
        {[
          { label: 'CSV Équipements', cols: 'name, type, vendor, model, management_ip, description' },
          { label: 'CSV Réseaux',     cols: 'name, cidr, zone_name, vlan_id, gateway, description' },
          { label: 'CSV Liens',       cols: 'equipment_a, equipment_b, link_type, description' },
        ].map(item => (
          <div key={item.label} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{item.label}</div>
            <code style={{ fontSize: 11, color: '#ffa657' }}>{item.cols}</code>
          </div>
        ))}
      </div>

      <div style={CALLOUT}>
        Cliquez sur <strong>Charger un exemple</strong> pour voir le format attendu avec des données pré-remplies.
      </div>

      <h3 style={H3}>Comportement lors de l'import</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          "Si un élément existe déjà (même nom), il est ignoré — pas d'écrasement",
          "Le résumé après import indique : créés / ignorés par catégorie",
          "Les zones référencées dans les réseaux doivent déjà exister en base",
          "Les équipements référencés dans les liens doivent déjà exister en base",
        ].map((r, i) => (
          <div key={i} style={ROW}>
            <span style={{ color: 'var(--blue)' }}>→</span>
            <span style={{ color: 'var(--text-2)' }}>{r}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  equipes: (
    <div>
      <h2 style={H2}>Équipes et Zones physiques</h2>
      <p style={P}>La page <strong>Équipes & Sites</strong> permet de structurer l'organisation humaine et géographique rattachée à l'infrastructure.</p>

      <h3 style={H3}>Équipes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          { field: 'Nom',         desc: "Nom de l'équipe (ex: Équipe Infrastructure)" },
          { field: 'Description', desc: "Rôle et périmètre de responsabilité" },
          { field: 'Contact',     desc: "Adresse email de contact (ex: infra@entreprise.fr)" },
          { field: 'Couleur',     desc: "Couleur d'identification visuelle dans l'interface" },
        ].map(item => (
          <div key={item.field} style={ROW}>
            <span style={{ minWidth: 100, fontWeight: 600, color: 'var(--text-1)' }}>{item.field}</span>
            <span style={{ color: 'var(--text-2)' }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <h3 style={H3}>Zones physiques — hiérarchie</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {['🏢 Datacenter', '🚪 Salle', '📦 Baie', '🔧 Local'].map((step, i, arr) => (
          <span key={step} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: 'var(--text-1)' }}>{step}</span>
            {i < arr.length - 1 && <span style={{ color: 'var(--text-3)' }}>→</span>}
          </span>
        ))}
      </div>
      <p style={P}>Chaque zone peut avoir une zone parente (ex: une Baie appartient à une Salle, dans un Datacenter). Les équipements peuvent être rattachés à une zone physique depuis la page Administration.</p>
    </div>
  ),

  audit: (
    <div>
      <h2 style={H2}>Audit des flux</h2>
      <p style={P}>La page <strong>Audit</strong> offre une vue synthétique de toutes les demandes de flux traitées et des indicateurs de conformité.</p>

      <h3 style={H3}>Indicateurs (KPIs)</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
        {[
          { label: 'Flux total',      desc: 'Nombre de demandes soumises (toutes périodes)' },
          { label: 'Déployés',        desc: 'Flux validés et scripts appliqués sur les équipements' },
          { label: 'Validés',         desc: 'Flux approuvés mais pas encore déployés' },
          { label: 'Refusés',         desc: 'Flux rejetés par les règles de validation' },
          { label: 'Taux conformité', desc: '% de flux validés ou déployés sur le total' },
        ].map(kpi => (
          <div key={kpi.label} style={{ padding: '8px 12px', background: 'var(--bg-input)', borderRadius: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{kpi.label}</div>
            <div style={{ color: 'var(--text-3)', fontSize: 12, marginTop: 2 }}>{kpi.desc}</div>
          </div>
        ))}
      </div>

      <h3 style={H3}>Statuts des demandes</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { status: 'En attente', color: '#8b93a8', desc: 'Demande créée, pas encore traitée' },
          { status: 'Validé',     color: '#22c55e', desc: 'Flux conforme aux règles, scripts prêts à appliquer' },
          { status: 'Déployé',    color: '#14b8a6', desc: 'Scripts appliqués sur les équipements' },
          { status: 'Refusé',     color: '#ef4444', desc: 'Flux non conforme (règle de port ou de zone violée)' },
        ].map(s => (
          <div key={s.status} style={{ display: 'flex', gap: 12, alignItems: 'center', ...ROW }}>
            <span style={{ background: s.color + '20', color: s.color, padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 600, minWidth: 90, textAlign: 'center' }}>{s.status}</span>
            <span style={{ color: 'var(--text-2)' }}>{s.desc}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  historique: (
    <div>
      <h2 style={H2}>Historique des flux</h2>
      <p style={P}>La page <strong>Historique</strong> centralise tous les flux soumis et le journal des événements sur les politiques réseau (routes et ACL).</p>

      <h3 style={H3}>Onglets</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {[
          { tab: 'Flux IP',                        desc: 'Liste de toutes les demandes soumises avec KPIs (total, en attente, validés, déployés, refusés).' },
          { tab: 'Événements politiques réseau',   desc: 'Journal des créations et suppressions de routes et de règles ACL, avec horodatage et équipement.' },
        ].map(item => (
          <div key={item.tab} style={{ padding: '10px 14px', background: 'var(--bg-input)', borderRadius: 6 }}>
            <div style={{ fontWeight: 700, color: 'var(--blue)', marginBottom: 4 }}>{item.tab}</div>
            <div style={{ color: 'var(--text-2)', fontSize: 13 }}>{item.desc}</div>
          </div>
        ))}
      </div>

      <h3 style={H3}>Workflow de validation</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
        {[
          { step: '1. Soumission',  desc: 'L\'analyste soumet le flux depuis Nouveau flux → statut En attente.' },
          { step: '2. Revue',       desc: 'Un validateur clique sur la ligne dans l\'Historique pour ouvrir le détail.' },
          { step: '3. Décision',    desc: 'Boutons disponibles : Valider (vert), Déployer (bleu), Refuser (rouge), Remettre en attente.' },
          { step: '4. Traçabilité', desc: 'Chaque changement de statut est horodaté et visible dans le détail du flux.' },
        ].map(item => (
          <div key={item.step} style={ROW}>
            <span style={{ minWidth: 120, fontWeight: 600, color: 'var(--blue)' }}>{item.step}</span>
            <span style={{ color: 'var(--text-2)' }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <div style={CALLOUT}>
        <strong>Vue Flux dans Topologie</strong> : l'onglet <em>Topologie &gt; Flux</em> propose la même liste avec filtres avancés (statut, équipement, texte) et un export CSV compatible Excel (matrice de flux).
      </div>
    </div>
  ),

  simulation: (
    <div>
      <h2 style={H2}>Simulation et analyse de risques</h2>
      <p style={P}>La page <strong>Simulation</strong> regroupe quatre outils d'analyse préventive du réseau. Aucun de ces outils ne modifie la configuration réelle — tout reste en lecture seule.</p>

      <h3 style={H3}>🔬 Simulation What-if — ce qu'elle fait vraiment</h3>
      <p style={P}>Le What-if répond à une question précise : <em>"Si j'ouvre ce nouveau flux, quels flux existants partagent les mêmes équipements réseau ?"</em></p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {[
          { step: '1. Validation',   desc: 'Le flux candidat passe les mêmes contrôles que dans "Nouveau flux" : RFC 1918, zones, ports interdits, protocole reconnu.' },
          { step: '2. Chemin',       desc: 'Si valide, le chemin réseau est calculé (algorithme NetworkX sur la topologie).' },
          { step: '3. Chevauchement', desc: 'Les équipements traversés (hops) sont comparés à ceux de tous les flux validés/déployés existants. Tout flux partageant au moins un équipement est signalé.' },
          { step: '4. Niveau de risque', desc: 'Calculé d\'après le nombre de flux en chevauchement : Faible (0), Modéré (1-3), Élevé (4+), Bloqué (flux invalide).' },
        ].map(item => (
          <div key={item.step} style={ROW}>
            <span style={{ minWidth: 170, fontWeight: 600, color: 'var(--blue)' }}>{item.step}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <div style={{ ...CALLOUT, borderColor: 'rgba(234,179,8,0.3)', background: 'rgba(234,179,8,0.07)', marginBottom: 16 }}>
        ⚠ <strong>Ce que le What-if ne fait PAS</strong> : il ne détecte pas les conflits de règles ACL, ne compare pas les politiques firewall, n'analyse pas la bande passante disponible, et ne vérifie pas si les équipements partagés ont des règles de filtrage compatibles. Un chevauchement d'équipements ne signifie pas que le flux sera bloqué.
      </div>

      <h3 style={H3}>Scénarios rapides</h3>
      <p style={P}>Le panneau "Scénarios rapides" propose deux types d'entrées pré-remplies :</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          { label: 'Scénarios fixes',      desc: '3 flux de démonstration prédéfinis (LAN→App HTTPS, WiFi→Base SQL, Telnet interdit).' },
          { label: 'Derniers flux soumis', desc: 'Les 4 derniers flux enregistrés dans l\'historique, proposés en un clic pour tester leur impact.' },
        ].map(item => (
          <div key={item.label} style={ROW}>
            <span style={{ minWidth: 170, fontWeight: 600, color: 'var(--text-1)' }}>{item.label}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 12 }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <h3 style={H3}>🔁 Détection de boucles</h3>
      <p style={P}>Analyse le graphe de topologie avec NetworkX pour détecter les cycles. Chaque boucle affiche les équipements impliqués et sa longueur. Un cycle de 2 nœuds (A↔B) est ignoré — seuls les cycles de 3 équipements ou plus sont signalés.</p>

      <h3 style={H3}>💥 Analyse d'impact équipement</h3>
      <p style={P}>Sélectionnez un équipement : l'outil liste tous les flux (validés, déployés, en attente) dont le chemin calculé passe par cet équipement. Utile pour anticiper l'impact d'une maintenance ou d'une panne.</p>
      <div style={{ ...CALLOUT, marginBottom: 16 }}>
        Pour chaque flux impacté, des actions sont suggérées : désactiver la route, ajouter une règle ACL deny, désactiver un port. Ces actions sont indicatives — elles ne sont pas appliquées automatiquement.
      </div>

      <h3 style={H3}>⚡ Détection SPOF</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          'Un SPOF est un équipement dont la suppression déconnecte le graphe réseau en deux parties ou plus.',
          'L\'algorithme utilise les points d\'articulation (articulation points) de NetworkX sur le graphe de topologie.',
          'Pour chaque SPOF détecté, le nombre de flux validés/déployés dont le chemin le traverse est affiché.',
          'Un réseau sans SPOF est entièrement redondant — chaque nœud a au moins deux chemins indépendants.',
        ].map((point, i) => (
          <div key={i} style={ROW}>
            <span style={{ color: 'var(--blue)' }}>→</span>
            <span style={{ color: 'var(--text-2)' }}>{point}</span>
          </div>
        ))}
      </div>
    </div>
  ),

  policies: (
    <div>
      <h2 style={H2}>Politiques réseau (Routes & ACL)</h2>
      <p style={P}>La section <strong>Politiques réseau</strong> (accessible depuis Topologie) permet de gérer les tables de routage et les règles ACL par équipement.</p>

      <h3 style={H3}>Tables de routage</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          { field: 'Destination CIDR', desc: 'Réseau cible (ex: 10.20.0.0/24) — champ obligatoire' },
          { field: 'Passerelle',       desc: 'Next-hop IP (ex: 192.168.1.1)' },
          { field: 'Interface',        desc: 'Interface de sortie (ex: eth0, ge-0/0/1)' },
          { field: 'Métrique',         desc: 'Priorité de la route — plus la valeur est faible, plus la route est préférée' },
          { field: 'Type',             desc: 'static, ospf, bgp, connected' },
          { field: 'Commentaire',      desc: 'Contexte de la route pour la traçabilité' },
        ].map(item => (
          <div key={item.field} style={ROW}>
            <span style={{ minWidth: 150, fontWeight: 600, color: 'var(--text-1)' }}>{item.field}</span>
            <span style={{ color: 'var(--text-2)' }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <h3 style={H3}>Règles ACL</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
        {[
          { field: 'Action',     desc: 'permit ou deny' },
          { field: 'Direction',  desc: 'in (entrant) ou out (sortant) sur l\'interface' },
          { field: 'Priorité',   desc: 'Ordre d\'évaluation — valeur basse = évalué en premier' },
          { field: 'IP source',  desc: 'IP ou CIDR source, ou "any"' },
          { field: 'IP dest.',   desc: 'IP ou CIDR destination, ou "any"' },
          { field: 'Port/Proto', desc: 'Port et protocole ciblés, ou "any"' },
        ].map(item => (
          <div key={item.field} style={ROW}>
            <span style={{ minWidth: 100, fontWeight: 600, color: 'var(--text-1)' }}>{item.field}</span>
            <span style={{ color: 'var(--text-2)' }}>{item.desc}</span>
          </div>
        ))}
      </div>

      <div style={CALLOUT}>
        <strong>Génération automatique</strong> : depuis le détail d'un flux validé, le bouton <em>Générer règles ACL</em> crée automatiquement les règles nécessaires sur chaque équipement du chemin. Les modifications sont tracées dans l'onglet <em>Historique &gt; Événements politiques réseau</em>.
      </div>
    </div>
  ),

  faq: (
    <div>
      <h2 style={H2}>Foire aux questions</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[
          {
            q: "Pourquoi mon flux est-il refusé alors que les IPs semblent correctes ?",
            a: "Vérifiez les contrôles de zone dans les résultats de validation. Certains flux entre zones sont interdits par politique (ex: INTERNET → LAN direct). Les règles sont visibles dans le panneau de résultats.",
          },
          {
            q: "Le chemin réseau affiche 'Aucun chemin trouvé' — que faire ?",
            a: "Les équipements d'entrée et de sortie ne sont pas reliés dans la topologie. Vérifiez que les liens entre équipements sont configurés dans Administration > Liens topo.",
          },
          {
            q: "Comment ajouter un nouvel équipement réseau ?",
            a: "Allez dans Topologie > Administration > onglet Équipements. Renseignez le nom, type, vendor, modèle et IP de management. L'équipement apparaît sur le graphe après rechargement.",
          },
          {
            q: "Comment modifier une règle de validation (ex: autoriser le port 21) ?",
            a: "Les règles sont en base de données (table validation_rules dans backend/ip_flows.db). Modifiez-les via SQLite ou contactez votre administrateur.",
          },
          {
            q: "Les scripts générés sont-ils appliqués automatiquement ?",
            a: "Non. L'outil fonctionne en mode génération uniquement. Les scripts doivent être copiés et appliqués manuellement par un opérateur réseau habilité.",
          },
          {
            q: "Comment réinitialiser les données de démonstration ?",
            a: "Supprimez le fichier backend/ip_flows.db et redémarrez le backend. La base sera recréée automatiquement avec toutes les données de démo.",
          },
          {
            q: "Peut-on utiliser cet outil avec une vraie base de données en production ?",
            a: "Oui. Modifiez SQLALCHEMY_DATABASE_URL dans backend/database.py pour pointer vers un serveur PostgreSQL. Le reste du code est identique.",
          },
          {
            q: "Mon flux soumis est en statut 'En attente' — que se passe-t-il ?",
            a: "Depuis la v2.5.0, tous les flux soumis passent d'abord par un statut En attente. Un validateur doit ouvrir le flux dans l'Historique et cliquer Valider, Déployer ou Refuser. Ce workflow garantit une double validation avant production.",
          },
          {
            q: "Comment voir les ACL et routes d'un équipement spécifique ?",
            a: "Depuis Administration ou le Graphe réseau, cliquez sur l'icône 📋 sur la carte de l'équipement. Un modal s'ouvre avec deux onglets : Table de routage et Règles ACL. Pour modifier, allez dans Topologie > Politiques réseau.",
          },
          {
            q: "Comment exporter la liste des flux vers Excel ?",
            a: "Dans Topologie > Flux, utilisez le bouton vert '⬇ Exporter Excel (CSV)'. Le fichier CSV est encodé UTF-8 avec BOM et séparateur point-virgule, directement compatible avec Excel français.",
          },
          {
            q: "Qu'est-ce qu'un SPOF dans le contexte du réseau ?",
            a: "Un SPOF (Single Point of Failure) est un équipement dont la panne suffit à couper la connectivité entre deux parties du réseau. Détectez-les dans Simulation > SPOF. Un réseau sans SPOF dispose de redondance totale.",
          },
        ].map((item, i) => (
          <details key={i} style={{ background: 'var(--bg-input)', borderRadius: 6, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <summary style={{ padding: '12px 14px', cursor: 'pointer', fontWeight: 600, color: 'var(--text-1)', fontSize: 13, listStyle: 'none', display: 'flex', gap: 8 }}>
              <span style={{ color: 'var(--blue)' }}>Q.</span> {item.q}
            </summary>
            <div style={{ padding: '10px 14px 14px', borderTop: '1px solid var(--border)', color: 'var(--text-2)', fontSize: 13, lineHeight: 1.6 }}>
              <span style={{ color: 'var(--green)', fontWeight: 700 }}>R.</span> {item.a}
            </div>
          </details>
        ))}
      </div>
    </div>
  ),
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function HelpModal({ onClose }: Props) {
  const [section, setSection] = useState('intro')
  const currentIdx = SECTIONS.findIndex(s => s.id === section)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '90vw', maxWidth: 960, height: '85vh', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-1)' }}>Guide d'utilisation — IP Flow Manager</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>v2.5.0 · Documentation en français</div>
          </div>
          <button onClick={onClose} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-2)', cursor: 'pointer', padding: '6px 14px', fontSize: 13, fontFamily: 'inherit' }}>
            ✕ Fermer
          </button>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Left nav */}
          <div style={{ width: 200, minWidth: 200, borderRight: '1px solid var(--border)', padding: '12px 8px', overflowY: 'auto', background: 'var(--bg-card)' }}>
            {SECTIONS.map(s => (
              <button key={s.id} onClick={() => setSection(s.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 10px', borderRadius: 6, border: 'none', background: section === s.id ? 'rgba(59,130,246,0.15)' : 'transparent', color: section === s.id ? 'var(--blue)' : 'var(--text-2)', fontWeight: section === s.id ? 600 : 400, fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}>
                <span style={{ width: 18, textAlign: 'center' }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {CONTENT[section]}
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '10px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
            {currentIdx + 1} / {SECTIONS.length} — {SECTIONS[currentIdx]?.label}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => { if (currentIdx > 0) setSection(SECTIONS[currentIdx - 1].id) }} disabled={currentIdx === 0} style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-2)', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: currentIdx === 0 ? 0.4 : 1 }}>
              ← Précédent
            </button>
            <button onClick={() => { if (currentIdx < SECTIONS.length - 1) setSection(SECTIONS[currentIdx + 1].id) }} disabled={currentIdx === SECTIONS.length - 1} style={{ background: 'var(--blue)', border: 'none', borderRadius: 5, color: '#fff', padding: '5px 14px', cursor: 'pointer', fontSize: 12, fontFamily: 'inherit', opacity: currentIdx === SECTIONS.length - 1 ? 0.4 : 1 }}>
              Suivant →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
