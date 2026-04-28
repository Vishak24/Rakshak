import { useState, useEffect, useRef } from 'react'
import { ENDPOINTS } from '../config/api'
import { ZONES } from '../constants/zones'

// Build a pincode → area name lookup from ZONES
const _pincodeToName = {}
ZONES.forEach(z => { _pincodeToName[z.c] = z.n })

// Resolve a raw zone_name/pincode string to a human-readable area name.
// If zone_name looks like a pincode (all digits), look it up; otherwise use as-is.
function resolveZoneName(zone_name, pincode) {
  const raw = zone_name ?? pincode ?? null
  if (!raw) return 'Unknown Zone'
  const str = String(raw).trim()
  // If it's a 6-digit pincode, look up the area name
  if (/^\d{6}$/.test(str)) return _pincodeToName[str] ? `${_pincodeToName[str]} (${str})` : str
  return str
}

/**
 * Polls /sos/live every 10s.
 * Returns only real API items — no simulation, no fallback mock entries.
 * If the API returns empty, events = [] and the panel shows "No active SOS alerts".
 */
export function useSosEvents() {
  const [events, setEvents] = useState([])
  const [total,  setTotal]  = useState(0)
  const seenIdsRef = useRef(new Set())

  useEffect(() => {
    const pollSos = async () => {
      try {
        const res = await fetch(ENDPOINTS.sosLive, {
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items = await res.json()
        if (!Array.isArray(items)) return

        const newEvs = items
          .filter(item => !seenIdsRef.current.has(item.sos_id))
          .map(item => {
            seenIdsRef.current.add(item.sos_id)
            return {
              id:      item.sos_id,
              name:    resolveZoneName(item.zone_name, item.pincode),
              risk:    (item.risk_level ?? 'HIGH').toUpperCase(),
              ts:      new Date(item.created_at ?? Date.now()),
              status:  item.status === 'resolved'   ? 'resolved'
                     : item.status === 'dispatched' ? 'resolving'
                     : 'dispatched',
              lat:     item.lat ?? item.latitude  ?? null,
              lng:     item.lng ?? item.longitude ?? null,
              pincode: item.pincode ?? null,
              sos_id:  item.sos_id,
            }
          })

        if (newEvs.length > 0) {
          setEvents(prev => [...newEvs, ...prev].slice(0, 20))
          setTotal(t => t + newEvs.length)
        }

        // Also update status of existing events from the full list
        setEvents(prev => prev.map(ev => {
          const live = items.find(i => i.sos_id === ev.sos_id)
          if (!live) return ev
          const status = live.status === 'resolved'   ? 'resolved'
                       : live.status === 'dispatched' ? 'resolving'
                       : 'dispatched'
          return { ...ev, status }
        }))
      } catch {
        // Backend unavailable — keep current events, don't add mocks
      }
    }

    pollSos()
    const id = setInterval(pollSos, 10_000)
    return () => clearInterval(id)
  }, [])

  return { events, total }
}
