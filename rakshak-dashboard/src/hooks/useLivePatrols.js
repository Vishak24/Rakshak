import { useState, useEffect, useRef } from 'react'
import { ENDPOINTS } from '../config/api'

/**
 * Fetches live patrol data from /patrols every 30s.
 * Returns { patrolStates } — each entry has id, name, vehicle, status, position.
 * All patrols default to 'Patrolling' (blue) unless the API says otherwise.
 */
export function useLivePatrols() {
  const [patrolStates, setPatrolStates] = useState([])
  const intervalRef = useRef(null)

  const normaliseStatus = (raw) => {
    const s = (raw ?? '').toLowerCase().replace(/[_\s]+/g, ' ').trim()
    if (s === 'responding' || s === 'on the way' || s === 'en route') return 'Responding'
    if (s === 'at scene' || s === 'atscene') return 'AtScene'
    return 'Patrolling'
  }

  const fetchPatrols = async () => {
    try {
      const res = await fetch(ENDPOINTS.patrolsList, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Don't bail on empty — keep existing state if API returns nothing
      if (!Array.isArray(data)) return

      setPatrolStates(data.map((item, idx) => ({
        id:      item.patrol_id ?? item.id ?? `P-${idx + 1}`,
        name:    item.officer   ?? item.name ?? 'Officer',
        vehicle: item.vehicle   ?? 'TN-01-PA-XXXX',
        zone:    item.zone      ?? '',
        status:  normaliseStatus(item.status),
        position: { lat: 13.0827, lng: 80.2707 },
      })))
    } catch {
      // Keep existing state on error
    }
  }

  // Update a single patrol's status (e.g. after SOS dispatch)
  const updatePatrolStatus = (patrolId, newStatus) => {
    setPatrolStates(prev =>
      prev.map(p => p.id === patrolId ? { ...p, status: normaliseStatus(newStatus) } : p)
    )
  }

  useEffect(() => {
    fetchPatrols()
    intervalRef.current = setInterval(fetchPatrols, 30_000)
    return () => clearInterval(intervalRef.current)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { patrolStates, updatePatrolStatus }
}
