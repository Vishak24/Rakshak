import { useState, useEffect, useCallback, useRef } from 'react'
import { ENDPOINTS } from '../config/api'
import { ZONES } from '../constants/zones'

/**
 * Fetches risk predictions for all zones from the score/refresh endpoint.
 * Returns { data: Map<code, apiResult>, loading, error, refetch }
 */
export function useRiskData() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)
  const intervalRef           = useRef(null)

  const buildMockMap = useCallback(() => {
    const map = new Map()
    ZONES.forEach(z => {
      map.set(z.c, {
        riskLevel:  z.r,
        riskIndex:  z.r === 'HIGH' ? 0.82 : z.r === 'MEDIUM' ? 0.51 : 0.17,
        confidence: 0.74,
      })
    })
    return map
  }, [])

  const fetchAll = useCallback(async () => {
    const now  = new Date()
    const hour = now.getHours()
    const dow  = now.getDay()

    // Build zone payload for the score/refresh endpoint
    const zones = ZONES.map(z => ({
      pincode:   z.c,
      latitude:  z.lat,
      longitude: z.lon,
      time:      now.toISOString(),
      hour,
      day_of_week: dow,
      is_weekend:  (dow === 0 || dow === 6) ? 1 : 0,
      is_night:    (hour < 6 || hour >= 22) ? 1 : 0,
      is_evening:  (hour >= 17 && hour <= 21) ? 1 : 0,
      is_rush_hour: [8, 9, 17, 18, 19].includes(hour) ? 1 : 0,
    }))

    try {
      const res = await fetch(ENDPOINTS.scoreRefresh, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ zones }),
        signal:  AbortSignal.timeout(8000),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const results = await res.json()

      // results is an array of { pincode, safe_score, risk_level }
      const map = new Map()

      // Seed with mock data first so every zone has a fallback
      ZONES.forEach(z => {
        map.set(z.c, {
          riskLevel:  z.r,
          riskIndex:  z.r === 'HIGH' ? 0.82 : z.r === 'MEDIUM' ? 0.51 : 0.17,
          confidence: 0.74,
        })
      })

      // Overlay with live API results
      if (Array.isArray(results)) {
        results.forEach(r => {
          const code = String(r.pincode)
          map.set(code, {
            riskLevel:  r.risk_level  ?? 'LOW',
            riskIndex:  r.safe_score  != null ? r.safe_score : 0.17,
            confidence: 0.90,
          })
        })
      }

      setData(map)
      setError(null)
    } catch (err) {
      console.warn('API unavailable, using mock data')
      if (!data) setData(buildMockMap())
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [buildMockMap]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAll()
    intervalRef.current = setInterval(fetchAll, 60_000)
    return () => clearInterval(intervalRef.current)
  }, [fetchAll])

  return { data, loading, error, refetch: fetchAll }
}
