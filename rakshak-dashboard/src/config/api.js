export const API_BASE = 'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com'

export const ENDPOINTS = {
  // Risk scoring
  scoreRefresh:   `${API_BASE}/score/refresh`,

  // SOS — user app creates, police app reads & acts
  sosLive:        `${API_BASE}/sos/live`,
  sosActive:      `${API_BASE}/police/sos/active`,
  sosDispatch:    (id) => `${API_BASE}/sos/dispatch/${id}`,
  sosResolve:     (id) => `${API_BASE}/sos/resolve/${id}`,

  // Police app
  policeRoute:    `${API_BASE}/police/route`,
  citizensActive: `${API_BASE}/police/citizens/active`,

  // Patrols
  patrolsList:    `${API_BASE}/patrols`,
  patrolStatus:   (id) => `${API_BASE}/patrols/${id}/status`,
  patrolOptimize: `${API_BASE}/patrol/optimize`,

  // Reports
  reportsSubmit:  `${API_BASE}/reports/submit`,
  reportsGet:     `${API_BASE}/reports`,
  reportsApprove: (id) => `${API_BASE}/reports/approve/${id}`,
  reportsReject:  (id) => `${API_BASE}/reports/reject/${id}`,
}

export default ENDPOINTS
