import React, { useState, useEffect } from 'react'
import s from './UsersNotHomeCard.module.css'

const ZONE_DATA = [
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
 * Shows zones with unresolved active journeys.
 */
export default function UsersNotHomeCard() {
  const [hour, setHour] = useState(() => new Date().getHours())

  // Re-check every minute so the card appears/disappears at the right time
  useEffect(() => {
    const id = setInterval(() => setHour(new Date().getHours()), 60_000)
    return () => clearInterval(id)
  }, [])

  if (hour < 22) return null

  return (
    <div className={s.card}>
      <div className={s.hdr}>
        <div className={s.bar} />
        <span className={s.title}>ACTIVE JOURNEYS UNRESOLVED</span>
        <span className={s.badge}>POST 10PM</span>
      </div>

      <div className={s.list}>
        {ZONE_DATA.map(({ zone, count }) => (
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
