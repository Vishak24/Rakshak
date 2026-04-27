import React from 'react'
import s from './PatrolStats.module.css'

const STATUS_COLOR = {
  Patrolling: '#3b82f6',
  Responding: '#ef4444',
  AtScene:    '#22c55e',
}

const STATUS_LABEL = {
  Patrolling: 'Patrolling',
  Responding: 'Responding',
  AtScene:    'At Scene',
}

/**
 * PatrolStats
 * Props:
 *   patrolStates — array of patrol state objects from usePatrolSimulation
 */
export default function PatrolStats({ patrolStates = [] }) {
  const patrolling = patrolStates.filter(p => p.status === 'Patrolling').length
  const responding = patrolStates.filter(p => p.status === 'Responding').length
  const atScene    = patrolStates.filter(p => p.status === 'AtScene').length
  const total      = patrolStates.length

  return (
    <div className={s.card}>
      <div className={s.hdr}>
        <div className={s.bar} />
        <span className={s.title}>PATROLS ON DUTY</span>
        <span className={s.totalBadge}>{total} units</span>
      </div>

      {/* Summary counts */}
      <div className={s.counts}>
        <div className={s.countItem}>
          <span className={s.countVal} style={{ color: '#3b82f6' }}>{patrolling}</span>
          <span className={s.countLbl}>Patrolling</span>
        </div>
        <div className={s.countItem}>
          <span className={s.countVal} style={{ color: '#ef4444' }}>{responding}</span>
          <span className={s.countLbl}>Responding</span>
        </div>
        <div className={s.countItem}>
          <span className={s.countVal} style={{ color: '#22c55e' }}>{atScene}</span>
          <span className={s.countLbl}>At Scene</span>
        </div>
      </div>

      {/* Scrollable unit list */}
      <div className={s.unitList}>
        {patrolStates.map(p => {
          const col = STATUS_COLOR[p.status] ?? '#3b82f6'
          return (
            <div key={p.id} className={s.unitRow}>
              <div className={s.unitDot} style={{ background: col }} />
              <span className={s.unitVehicle}>{p.vehicle}</span>
              <span className={s.unitName}>{p.name}</span>
              <span className={s.unitStatus} style={{ color: col }}>
                {STATUS_LABEL[p.status] ?? p.status}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
