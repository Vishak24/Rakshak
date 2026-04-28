import React, { useState, useRef } from 'react'
import s from './AlertsPanel.module.css'
import { ENDPOINTS } from '../../config/api'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

/**
 * AlertsPanel — renders only live SOS events from useSosEvents.
 * No simulation, no mock entries.
 * Shows "No active SOS alerts" when the feed is empty.
 */
export default function AlertsPanel({ events, total, lang, onEventStatusChange }) {
  const [toast, setToast]         = useState(null)
  const [localStatus, setLocalStatus] = useState({}) // sos_id → overridden status
  const toastTimerRef             = useRef(null)

  const handleDispatch = async (ev) => {
    if (!ev.sos_id) return
    try {
      await fetch(ENDPOINTS.sosDispatch(ev.sos_id), {
        method: 'POST',
        signal: AbortSignal.timeout(8000),
      })
      // Immediately reflect dispatched/en-route status in the UI
      setLocalStatus(prev => ({ ...prev, [ev.sos_id]: 'resolving' }))
      showToast(`Dispatched to ${ev.name}`)
      if (onEventStatusChange) onEventStatusChange(ev.sos_id, 'resolving')
    } catch {
      showToast(`Dispatch failed`)
    }
  }

  const showToast = (msg) => {
    clearTimeout(toastTimerRef.current)
    setToast({ msg, id: Date.now() })
    toastTimerRef.current = setTimeout(() => setToast(null), 4000)
  }

  const riskLabel = (r) => {
    if (lang !== 'ta') return r
    return r === 'HIGH' ? 'அதிக ஆபத்து' : r === 'MEDIUM' ? 'நடுத்தர' : 'குறைந்த'
  }

  return (
    <aside className={s.panel}>
      <div className={s.hdr}>
        <div className={s.pulse} />
        <span className={s.ttl}>{lang === 'ta' ? 'நேரடி SOS பீட்' : 'LIVE SOS FEED'}</span>
        <span className={s.badge}>{total ?? 0}</span>
      </div>

      {toast && (
        <div key={toast.id} className={s.toast}>
          🚔 {toast.msg}
        </div>
      )}

      <div className={s.list}>
        {events.length === 0 && (
          <div style={{ color: 'var(--dim)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            No active SOS alerts
          </div>
        )}
        {events.map((ev, i) => {
          const effectiveStatus = localStatus[ev.sos_id] ?? ev.status
          return (
          <div
            key={ev.id}
            className={`${s.evt}${i === 0 ? ' ' + s.fresh : ''}`}
            onClick={() => handleDispatch(ev)}
            title={ev.sos_id ? 'Click to dispatch' : ''}
            style={{ cursor: ev.sos_id ? 'pointer' : 'default' }}
          >
            <div className={s.evtTop}>
              <span className={s.evtLoc}>{ev.name}</span>
              <span className={`${s.riskBadge} ${s[ev.risk]}`}>{riskLabel(ev.risk)}</span>
            </div>
            <div className={s.evtBot}>
              <span className={s.evtTime}>{timeAgo(ev.ts)}</span>
              <span className={`${s.pill} ${s[effectiveStatus]}`}>
                {effectiveStatus === 'resolved'  ? 'Resolved'
               : effectiveStatus === 'resolving' ? '🚔 En Route'
               : 'Active'}
              </span>
            </div>
          </div>
          )
        })}
      </div>
    </aside>
  )
}
