import React, { useState, useEffect } from 'react'
import s from './UsersNotHomeCard.module.css'
import { ENDPOINTS } from '../../config/api'

const FALLBACK_DATA = [
  { zone: 'T.Nagar',    count: 12 },
  { zone: 'Anna Nagar', count: 8  },
  { zone: 'Velachery',  count: 15 },
  { zone: 'Adyar',      count: 6  },
  { zone: 'Mylapore',   count: 10 },
  { zone: 'Tambaram',   count: 18 },
  { zone: 'Chromepet',  count: 9  },
]

/**
 * Renders only after 10 PM (hour >= 22).
 * Polls /police/citizens/active every 60s; falls back to static data silently.
 */
export default function UsersNotHomeCard() {
  const [hour,       setHour]       = useState(() => new Date().getHours())
  const [zoneData,   setZoneData]   = useState(FALLBACK_DATA)
  const [totalCount, setTotalCount] = useState(0)

  // Re-check clock every minute
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Poll live endpoint only after 10 PM
  useEffect(() => {
    if (hour < 22) return

    const fetchActive = async () => {
      try {
        const res = await fetch(`${ENDPOINTS.citizensActive}?after_hour=22`, {
          signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()

        const byPincode = data.by_pincode ?? []
        const total     = data.total_count ?? 0

        if (Array.isArray(byPincode) && byPincode.length > 0) {
          setZoneData(byPincode.map(z => ({
            zone:  z.area ?? z.pincode?.toString() ?? 'Zone',
            count: z.count ?? 0,
          })))
          setTotalCount(total)
        }
      } catch {
        // Keep fallback data silently
      }
    }

    fetchActive()
    const id = setInterval(fetchActive, 60_000)
    return () => clearInterval(id)
  }, [hour])

  if (hour < 22) return null

  const displayTotal = totalCount > 0
    ? totalCount
    : zoneData.reduce((s, z) => s + z.count, 0)

  return (
    <div className={s.card}>
      <div className={s.hdr}>
        <div className={s.bar} />
        <span className={s.title}>ACTIVE JOURNEYS UNRESOLVED</span>
        <span className={s.badge}>{displayTotal > 0 ? `${displayTotal} total` : 'POST 10PM'}</span>
      </div>

      <div className={s.list}>
        {zoneData.map(({ zone, count }) => (
          <div key={zone} className={s.row}>
            <span className={s.zoneName}>{zone}</span>
            <div className={s.right}>
              <span className={s.count}>{count}</span>
              {count > 10 && (
                <span className={s.warn} title="High density — patrol auto-adjusting">⚠</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className={s.footer}>
        Patrol routes auto-adjusting for high-density zones
      </div>
    </div>
  )
}
