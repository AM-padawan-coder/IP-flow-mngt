const BASE = 'https://backend-web-service-python.onrender.com'

async function req<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return res.json()
}

export const api = {
  // Flows
  analyzeFlow: (data: object) => req('/flows/analyze', { method: 'POST', body: JSON.stringify(data) }),
  submitFlow:  (data: object) => req('/flows',         { method: 'POST', body: JSON.stringify(data) }),
  getFlows:    ()             => req('/flows'),
  getFlow:     (id: number)   => req(`/flows/${id}`),
  getAuditSummary: ()         => req('/flows/audit/summary'),

  // Topology — read
  getZones:     () => req('/topology/zones'),
  getEquipment: () => req('/topology/equipment'),
  getNetworks:  () => req('/topology/networks'),
  getLinks:     () => req('/topology/links'),
  getGraph:     () => req('/topology/graph'),

  // Zones CRUD
  createZone: (data: object)              => req('/topology/zones',      { method: 'POST',   body: JSON.stringify(data) }),
  updateZone: (id: number, data: object)  => req(`/topology/zones/${id}`,{ method: 'PUT',    body: JSON.stringify(data) }),
  deleteZone: (id: number)                => req(`/topology/zones/${id}`,{ method: 'DELETE' }),

  // Equipment CRUD
  createEquipment: (data: object)             => req('/topology/equipment',       { method: 'POST',   body: JSON.stringify(data) }),
  updateEquipment: (id: number, data: object) => req(`/topology/equipment/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteEquipment: (id: number)               => req(`/topology/equipment/${id}`, { method: 'DELETE' }),

  // Network CRUD
  createNetwork: (data: object)             => req('/topology/networks',       { method: 'POST',   body: JSON.stringify(data) }),
  updateNetwork: (id: number, data: object) => req(`/topology/networks/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteNetwork: (id: number)               => req(`/topology/networks/${id}`, { method: 'DELETE' }),

  // Links CRUD
  createLink: (data: object) => req('/topology/links',       { method: 'POST',   body: JSON.stringify(data) }),
  deleteLink: (id: number)   => req(`/topology/links/${id}`, { method: 'DELETE' }),

  // Interfaces
  createInterface: (data: object) => req('/topology/interfaces',       { method: 'POST',   body: JSON.stringify(data) }),
  deleteInterface: (id: number)   => req(`/topology/interfaces/${id}`, { method: 'DELETE' }),

  // Import / Export
  importJson:         (data: object)  => req('/topology/import/json',         { method: 'POST', body: JSON.stringify(data) }),
  importCsvEquipment: (csv: string)   => req('/topology/import/csv/equipment', { method: 'POST', body: JSON.stringify({ csv }) }),
  importCsvNetworks:  (csv: string)   => req('/topology/import/csv/networks',  { method: 'POST', body: JSON.stringify({ csv }) }),
  importCsvLinks:     (csv: string)   => req('/topology/import/csv/links',     { method: 'POST', body: JSON.stringify({ csv }) }),

  // Flows — delete + status
  deleteFlow:      (id: number)              => req(`/flows/${id}`,         { method: 'DELETE' }),
  updateFlowStatus:(id: number, status: string) => req(`/flows/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Simulation
  whatif:          (data: object) => req('/simulation/whatif',           { method: 'POST', body: JSON.stringify(data) }),
  detectLoops:     ()             => req('/simulation/loops'),
  detectSpof:      ()             => req('/simulation/spof'),
  equipmentImpact: (name: string) => req(`/simulation/impact/${encodeURIComponent(name)}`),
  listEquipment:   ()             => req('/simulation/equipment-list'),

  // Policies — events
  listPolicyEvents: (limit?: number) => req(`/policies/events${limit ? `?limit=${limit}` : ''}`),

  // Policies — routing
  listRouting:   (equipmentId?: number) => req(`/policies/routing${equipmentId ? `?equipment_id=${equipmentId}` : ''}`),
  createRoute:   (data: object) => req('/policies/routing', { method: 'POST', body: JSON.stringify(data) }),
  updateRoute:   (id: number, data: object) => req(`/policies/routing/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteRoute:   (id: number) => req(`/policies/routing/${id}`, { method: 'DELETE' }),

  // Policies — ACL
  listAcl:        (equipmentId?: number) => req(`/policies/acl${equipmentId ? `?equipment_id=${equipmentId}` : ''}`),
  createAcl:      (data: object) => req('/policies/acl', { method: 'POST', body: JSON.stringify(data) }),
  updateAcl:      (id: number, data: object) => req(`/policies/acl/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteAcl:      (id: number) => req(`/policies/acl/${id}`, { method: 'DELETE' }),
  generateFromFlow: (flowId: number) => req(`/policies/generate-from-flow/${flowId}`, { method: 'POST' }),
  listPolicyEquipment: () => req('/policies/equipment'),

  // Teams & Organisation
  getTeams:    () => req('/org/teams'),
  createTeam:  (data: object)             => req('/org/teams',       { method: 'POST',   body: JSON.stringify(data) }),
  updateTeam:  (id: number, data: object) => req(`/org/teams/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deleteTeam:  (id: number)               => req(`/org/teams/${id}`, { method: 'DELETE' }),

  getPhysicalZones:    () => req('/org/physical-zones'),
  createPhysicalZone:  (data: object)             => req('/org/physical-zones',       { method: 'POST',   body: JSON.stringify(data) }),
  updatePhysicalZone:  (id: number, data: object) => req(`/org/physical-zones/${id}`, { method: 'PUT',    body: JSON.stringify(data) }),
  deletePhysicalZone:  (id: number)               => req(`/org/physical-zones/${id}`, { method: 'DELETE' }),
}
