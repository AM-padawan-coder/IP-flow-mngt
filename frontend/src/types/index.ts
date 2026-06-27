export interface Check {
  name: string
  status: 'ok' | 'error' | 'warning' | 'info'
  message: string
}

export interface Hop {
  equipment: string
  vendor: string
  type: string
  model: string
  management_ip: string
  action: string
  interfaces: { interface: string; ip: string; network: string; role: string }[]
}

export interface PathResult {
  found: boolean
  error?: string
  hops: Hop[]
  summary?: string
}

export interface Script {
  vendor: string
  equipment: string
  action: string
  script: string
}

export interface ScriptsResult {
  rule_id?: string
  scripts: Record<string, Script>
}

export interface ValidationResult {
  valid: boolean
  checks: Check[]
  src_zone?: string
  dst_zone?: string
  src_network?: { name: string; cidr: string }
  dst_network?: { name: string; cidr: string }
}

export interface ComplianceFinding {
  control_id: string
  control_label: string
  control_version: string
  title: string
  group: string
  severity: string
  status: string
  frameworks: string[]
  citations: { title: string; text: string; source_version?: string }[]
}

export interface ComplianceResult {
  catalog_version: string
  source: string | null
  summary: { total: number; satisfied: number; violations: number; errors: number; compliant: boolean }
  findings: ComplianceFinding[]
}

export interface AnalyzeResponse {
  validation: ValidationResult
  path: PathResult
  scripts: ScriptsResult
  compliance?: ComplianceResult | null
}

export interface FlowSummary {
  id: number
  created_at: string
  src_ip: string
  dst_ip: string
  port: string
  protocol: string
  application: string
  status: string
  analyst: string
}

export interface Zone {
  id: number
  name: string
  color: string
  description: string
  trust_level: number
  networks: { id: number; name: string; cidr: string; vlan_id: number | null }[]
}

export interface Equipment {
  id: number
  name: string
  type: string
  vendor: string
  model: string
  management_ip: string
  description: string
  interfaces: {
    name: string; ip: string; network: string; network_name: string
    zone: string; zone_color: string; role: string
  }[]
}

export interface Network {
  id: number
  name: string
  cidr: string
  vlan_id: number | null
  gateway: string
  description: string
  zone: string
  zone_color: string
}

export interface AuditSummary {
  total: number
  validated: number
  deployed: number
  rejected: number
  pending: number
  top_applications: { name: string; count: number }[]
  top_analysts: { name: string; count: number }[]
}
