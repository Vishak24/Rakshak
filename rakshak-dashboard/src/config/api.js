export const API_BASE = 'https://aksdwfbnn5.execute-api.ap-south-1.amazonaws.com'

export const ENDPOINTS = {
  scoreRefresh:   `${API_BASE}/score/refresh`,
  reportsSubmit:  `${API_BASE}/reports/submit`,
  reportsGet:     `${API_BASE}/reports`,
  reportsApprove: (id) => `${API_BASE}/reports/approve/${id}`,
  reportsReject:  (id) => `${API_BASE}/reports/reject/${id}`,
  sosLive:        `${API_BASE}/sos/live`,
  sosDispatch:    (id) => `${API_BASE}/sos/dispatch/${id}`,
  sosResolve:     (id) => `${API_BASE}/sos/resolve/${id}`,
  patrolsList:    `${API_BASE}/patrols`,
  patrolStatus:   (id) => `${API_BASE}/patrols/${id}/status`,
}

export default ENDPOINTS
