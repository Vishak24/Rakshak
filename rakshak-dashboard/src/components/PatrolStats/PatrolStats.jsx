import React from 'react'
import s from './PatrolStats.module.css'
import { useLivePatrols } from '../../hooks/useLivePatrols'

const STATUS_COLOR = {
  Patrolling: '#3b82f6',
  Responding: '#ef4444',
  AtScene:    '#22c55e',
}

const STATUS_LABEL = {
  Patrolling: 'Patrolling',
  Responding: '🚔 En Route',
  AtScene:    'At Scene',
}

/**
 * PatrolStats — shows all live patrol units from /patrols API.
 * Status colour reflects actual patrol state (Patrolling / Responding / AtScene).
 */
export default function PatrolStats() {
  const { patrolStates } = useLivePatrols()
  const total = patrolStates.length

  if (total === 0) return null

  return (
    <div className={s.card}>
      <div className={s.hdr}>
        <div className={s.bar} />
        <span className={s.title}>PATROLS ON DUTY</span>
        <span className={s.totalBadge}>{total} units</span>
      </div>

      <div className={s.unitList}>
        {patrolStates.map(p => {
          const col   = STATUS_COLOR[p.status] ?? '#3b82f6'
          const label = STATUS_LABEL[p.status] ?? p.status
          return (
            <div key={p.id} className={s.unitRow}>
              <div className={s.unitDot} style={{ background: col }} />
              <span className={s.unitVehicle}>{p.vehicle}</span>
              <span className={s.unitName}>{p.name}</span>
              <span className={s.unitStatus} style={{ color: col }}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
