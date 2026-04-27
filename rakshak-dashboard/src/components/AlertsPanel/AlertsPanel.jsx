import React, { useState, useEffect, useRef } from 'react'
import s from './AlertsPanel.module.css'
import { ENDPOINTS } from '../../config/api'

function timeAgo(ts) {
  const diff = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

/**
 * AlertsPanel
 * Props:
 *   events             — SOS event array from useSosEvents
 *   total              — cumulative SOS count
 *   lang               — 'en' | 'ta'
 *   onSosDispatched    — (sosLocation) => unitName | null
 *   onIncidentResolved — (incidentData) => void  — called when event → resolving/resolved
 */
export default function AlertsPanel({ events, total, lang, onSosDispatched, onIncidentResolved }) {
  const [toast, setToast]       = useState(null)
  const prevEventsRef           = useRef([])
  const toastTimerRef           = useRef(null)
  const resolvedEmittedRef      = useRef(new Set()) // track which ids we've already emitted

  // ── Auto-dispatch new events + emit resolved incidents ────────────────────
  useEffect(() => {
    const prev = prevEventsRef.current

    events.forEach(ev => {
      const wasNew = !prev.find(p => p.id === ev.id)

      // Dispatch on brand-new event
      if (wasNew && onSosDispatched) {
        const loc = ev.lat != null && ev.lng != null
          ? { lat: ev.lat, lng: ev.lng }
          : { lat: 13.0827 + Math.random() * 0.05, lng: 80.2707 + Math.random() * 0.05 }
        const unitName = onSosDispatched(loc)
        if (unitName) showToast(`${unitName} dispatched to ${ev.name}`)

        // Fire-and-forget backend dispatch if we have a real sos_id
        if (ev.sos_id) {
          fetch(ENDPOINTS.sosDispatch(ev.sos_id), {
            method: 'POST',
            signal: AbortSignal.timeout(8000),
          }).catch(() => {})
        }
      }

      // Emit incident data when status becomes resolving or resolved (once per event)
      if (
        (ev.status === 'resolving' || ev.status === 'resolved') &&
        !resolvedEmittedRef.current.has(ev.id) &&
        onIncidentResolved
      ) {
        resolvedEmittedRef.current.add(ev.id)

        // Fire-and-forget backend resolve if we have a real sos_id
        if (ev.sos_id && ev.status === 'resolved') {
          fetch(ENDPOINTS.sosResolve(ev.sos_id), {
            method: 'PATCH',
            signal: AbortSignal.timeout(8000),
          }).catch(() => {})
        }
        const now  = new Date()
        const hour = now.getHours()
        const dow  = now.getDay()
        const s7   = Math.floor(Math.random() * 20) + 1
        const s30  = Math.floor(Math.random() * 60) + 10
        onIncidentResolved({
          pincode:                   ev.pincode  ?? 600001,
          latitude:                  ev.lat      ?? 13.0827,
          longitude:                 ev.lng      ?? 80.2707,
          hour,
          day_of_week:               dow,
          is_weekend:                (dow === 0 || dow === 6) ? 1 : 0,
          is_night:                  (hour >= 22 || hour <= 5) ? 1 : 0,
          is_evening:                (hour >= 17 && hour <= 21) ? 1 : 0,
          is_rush_hour:              [8, 9, 17, 18, 19].includes(hour) ? 1 : 0,
          reporting_delay_minutes:   Math.floor(Math.random() * 20) + 2,
          response_time_minutes:     Math.floor(Math.random() * 15) + 3,
          victim_age:                Math.floor(Math.random() * 30) + 18,
          signal_count_last_7d:      s7,
          signal_count_last_30d:     s30,
          signal_density_ratio:      parseFloat((s7 / s30).toFixed(2)),
          area_encoded:              Math.floor(Math.random() * 15),
          neighborhood_encoded:      Math.floor(Math.random() * 20),
          approvalStatus:            'pending',
        })
      }
    })

    prevEventsRef.current = events
  }, [events, onSosDispatched, onIncidentResolved])

  // ── Manual dispatch on click ──────────────────────────────────────────────
  const handleClick = (ev) => {
    if (!onSosDispatched) return
    const loc = ev.lat != null && ev.lng != null
      ? { lat: ev.lat, lng: ev.lng }
      : { lat: 13.0827 + Math.random() * 0.05, lng: 80.2707 + Math.random() * 0.05 }
    const unitName = onSosDispatched(loc)
    if (unitName) showToast(`${unitName} dispatched to ${ev.name}`)
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

      {/* Dispatch toast */}
      {toast && (
        <div key={toast.id} className={s.toast}>
          🚔 {toast.msg}
        </div>
      )}

      <div className={s.list}>
        {events.length === 0 && (
          <div style={{ color: 'var(--dim)', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
            Waiting for events…
          </div>
        )}
        {events.map((ev, i) => (
          <div
            key={ev.id}
            className={`${s.evt}${i === 0 ? ' ' + s.fresh : ''}`}
            onClick={() => handleClick(ev)}
            title="Click to dispatch nearest patrol"
          >
            <div className={s.evtTop}>
              <span className={s.evtLoc}>{ev.name}</span>
              <span className={`${s.riskBadge} ${s[ev.risk]}`}>{riskLabel(ev.risk)}</span>
            </div>
            <div className={s.evtBot}>
              <span className={s.evtTime}>{timeAgo(ev.ts)}</span>
              <span className={`${s.pill} ${s[ev.status]}`}>
                {ev.status === 'resolved'
                  ? 'Resolved'
                  : ev.status === 'resolving'
                  ? 'Resolving'
                  : 'Dispatched'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}
