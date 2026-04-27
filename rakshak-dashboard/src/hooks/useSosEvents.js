import { useState, useEffect, useRef } from 'react'
import { ENDPOINTS } from '../config/api'
import { ZONES } from '../constants/zones'

/**
 * Combines a live SOS feed (polled from backend every 10s) with a
 * simulated local event generator so the panel is never empty.
 * Returns { events, total }
 */
export function useSosEvents(apiData) {
  const [events, setEvents] = useState([])
  const [total,  setTotal]  = useState(0)
  const apiDataRef    = useRef(apiData)
  const seenIdsRef    = useRef(new Set())   // backend sos_ids already merged

  useEffect(() => { apiDataRef.current = apiData }, [apiData])

  // ── Poll backend SOS feed every 10s ──────────────────────────────────────
  useEffect(() => {
    const pollSos = async () => {
      try {
        const res = await fetch(ENDPOINTS.sosLive, {
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const items = await res.json()
        if (!Array.isArray(items) || items.length === 0) return

        const newEvs = items
          .filter(item => !seenIdsRef.current.has(item.sos_id))
          .map(item => {
            seenIdsRef.current.add(item.sos_id)
            return {
              id:     item.sos_id,
              name:   item.zone_name ?? item.pincode ?? 'Unknown Zone',
              risk:   item.risk_level ?? 'HIGH',
              ts:     new Date(item.created_at ?? Date.now()),
              status: item.status === 'resolved' ? 'resolved'
                    : item.status === 'dispatched' ? 'resolving'
                    : 'dispatched',
              lat:    item.latitude  ?? null,
              lng:    item.longitude ?? null,
              pincode: item.pincode  ?? null,
              sos_id: item.sos_id,
            }
          })

        if (newEvs.length > 0) {
          setEvents(prev => [...newEvs, ...prev].slice(0, 8))
          setTotal(t => t + newEvs.length)
        }
      } catch {
        // Backend unavailable — silently keep simulated events
      }
    }

    pollSos()
    const pollId = setInterval(pollSos, 10_000)
    return () => clearInterval(pollId)
  }, [])

  // ── Local simulation — keeps the feed alive when backend is quiet ─────────
  useEffect(() => {
    const generate = () => {
      const pool = ZONES.filter(z => z.r === 'HIGH' || z.r === 'MEDIUM')
      if (!pool.length) return
      const z    = pool[Math.floor(Math.random() * pool.length)]
      const risk = apiDataRef.current?.get(z.c)?.riskLevel ?? z.r
      const id   = `sim-${Date.now()}-${Math.floor(Math.random() * 900 + 1)}`
      const ev   = {
        id, name: z.n, risk, ts: new Date(), status: 'dispatched',
        lat: z.lat, lng: z.lon, pincode: z.c, sos_id: null,
      }

      setEvents(prev => [ev, ...prev].slice(0, 8))
      setTotal(t => t + 1)

      // dispatched → resolving → resolved
      setTimeout(() => {
        setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'resolving' } : e))
        setTimeout(() => {
          setEvents(prev => prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e))
        }, 20_000 + Math.random() * 10_000)
      }, 15_000 + Math.random() * 10_000)
    }

    generate()
    const t1 = setTimeout(generate, 600)
    const loop = () => {
      const delay = 8_000 + Math.random() * 4_000
      const t = setTimeout(() => { generate(); loop() }, delay)
      return t
    }
    const loopTimer = loop()

    return () => {
      clearTimeout(t1)
      clearTimeout(loopTimer)
    }
  }, [])

  return { events, total }
}
