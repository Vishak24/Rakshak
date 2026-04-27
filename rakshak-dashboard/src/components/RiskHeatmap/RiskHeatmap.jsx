import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import s from './RiskHeatmap.module.css'
import { ZONES, riskColor } from '../../constants/zones'
import { usePatrolSimulation } from '../../hooks/usePatrolSimulation'

const CHENNAI_CENTER = [13.0827, 80.2707]

// ── Circle marker style per patrol status ────────────────────────────────────
function getPatrolStyle(status) {
  if (status === 'Responding') return { radius: 8, fillColor: '#ef4444', color: '#fff', weight: 2, fillOpacity: 1 }
  if (status === 'AtScene')    return { radius: 8, fillColor: '#22c55e', color: '#fff', weight: 2, fillOpacity: 1 }
  return                              { radius: 8, fillColor: '#3b82f6', color: '#fff', weight: 2, fillOpacity: 1 }
}

function tooltipHtml(patrol) {
  const color = patrol.status === 'Patrolling' ? '#3b82f6'
    : patrol.status === 'Responding' ? '#ef4444' : '#22c55e'
  return `<b>${patrol.name}</b> (${patrol.vehicle})<br/>` +
    `Status: <span style="color:${color};font-weight:700">${patrol.status}</span>`
}

function getRiskStyle(risk, hover) {
  const base = hover
    ? (risk === 'HIGH' ? 0.45 : risk === 'MEDIUM' ? 0.35 : 0.25)
    : (risk === 'HIGH' ? 0.30 : risk === 'MEDIUM' ? 0.20 : 0.12)
  const col = riskColor(risk)
  return {
    fillColor: col, fillOpacity: base, color: col,
    weight: hover ? 2.5 : (risk === 'HIGH' ? 1.5 : risk === 'MEDIUM' ? 1.0 : 0.8),
    opacity: 0.9,
  }
}

/**
 * Props:
 *   apiData        — Map<code, {riskLevel, riskIndex, confidence}>
 *   lang           — 'en' | 'ta'
 *   dispatchPatrol — (sosLocation) => unitName  (unused here, kept for API compat)
 *   onPatrolClick  — (patrolState) => void  — called when a patrol marker is clicked
 */
export default function RiskHeatmap({ apiData, lang, onPatrolClick }) {
  const mapRef           = useRef(null)
  const mapInstance      = useRef(null)
  const heatRef          = useRef(null)
  const circlesRef       = useRef([])
  const patrolLayerRef   = useRef(null)
  // id → { marker, status }  — avoids recreating markers every 100ms tick
  const patrolMarkersRef = useRef({})
  // Stable ref to onPatrolClick so marker click closures never go stale
  const onPatrolClickRef = useRef(onPatrolClick)
  useEffect(() => { onPatrolClickRef.current = onPatrolClick }, [onPatrolClick])

  const [selected, setSelected] = useState(null)

  // ── Patrol simulation (100ms ticks) ──────────────────────────────────────
  const { patrolStates } = usePatrolSimulation()

  // ── Init map once ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInstance.current) return

    const bounds = L.latLngBounds(L.latLng(12.80, 80.10), L.latLng(13.23, 80.32))
    const map = L.map(mapRef.current, {
      center: CHENNAI_CENTER, zoom: 12, minZoom: 10, maxZoom: 16,
      maxBounds: bounds, maxBoundsViscosity: 1.0,
      zoomControl: true, attributionControl: false,
    })
    map.fitBounds(bounds, { padding: [20, 20] })
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }).addTo(map)
    mapInstance.current = map

    // Heat layer
    const heatPts = ZONES.map(z => [z.lat, z.lon, z.r === 'HIGH' ? 0.9 : z.r === 'MEDIUM' ? 0.55 : 0.18])
    if (window.L?.heatLayer) {
      heatRef.current = window.L.heatLayer(heatPts, {
        radius: 38, blur: 28, maxZoom: 14,
        gradient: { 0: '#22C55E', 0.45: '#F59E0B', 1: '#FF3B5C' }, max: 1,
      }).addTo(map)
    }

    // KML zones
    fetch('/Final_Chennai_Pincode.kml')
      .then(r => { if (!r.ok) throw new Error('no kml'); return r.text() })
      .then(kmlText => renderKML(map, kmlText))
      .catch(() => renderCircles(map))

    // Patrol layer — markers created/updated in separate effect
    patrolLayerRef.current = L.layerGroup().addTo(map)

    return () => {
      map.remove()
      mapInstance.current = null
      patrolMarkersRef.current = {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Smooth patrol marker updates — called every 100ms ────────────────────
  useEffect(() => {
    const layer = patrolLayerRef.current
    if (!layer || !mapInstance.current) return

    patrolStates.forEach(patrol => {
      const latlng = [patrol.position.lat, patrol.position.lng]
      const entry  = patrolMarkersRef.current[patrol.id]

      if (entry) {
        // Always update position (smooth motion)
        entry.marker.setLatLng(latlng)

        // Only update style + tooltip when status changes (avoids DOM churn)
        if (entry.status !== patrol.status) {
          entry.marker.setStyle(getPatrolStyle(patrol.status))
          entry.marker.unbindTooltip()
          entry.marker.bindTooltip(tooltipHtml(patrol), {
            permanent: false, direction: 'top', offset: [0, -10], className: 'patrol-tooltip',
          })
          entry.status = patrol.status
        }
      } else {
        // First time — create circle marker
        const marker = L.circleMarker(latlng, getPatrolStyle(patrol.status))
        marker.bindTooltip(tooltipHtml(patrol), {
          permanent: false, direction: 'top', offset: [0, -10], className: 'patrol-tooltip',
        })
        // Click → open detail panel via stable ref
        marker.on('click', () => onPatrolClickRef.current?.(patrol))
        layer.addLayer(marker)
        patrolMarkersRef.current[patrol.id] = { marker, status: patrol.status }
      }
    })

    // Keep click handler data fresh — update patrol data on marker without recreating
    // (the ref closure already reads the latest patrol via the forEach above)
  }, [patrolStates])

  // ── KML renderer ──────────────────────────────────────────────────────────
  function renderKML(map, kmlText) {
    const parser = new DOMParser()
    const kml    = parser.parseFromString(kmlText, 'text/xml')
    const group  = L.layerGroup().addTo(map)

    Array.from(kml.querySelectorAll('Placemark')).forEach(pm => {
      const coordsEl = pm.querySelector('coordinates')
      if (!coordsEl) return
      const latLngs = coordsEl.textContent.trim().split(/\s+/)
        .filter(c => c.includes(','))
        .map(c => { const p = c.split(','); return [parseFloat(p[1]), parseFloat(p[0])] })
        .filter(ll => !isNaN(ll[0]) && !isNaN(ll[1]))
      if (latLngs.length < 3) return

      const sd      = [...pm.querySelectorAll('SimpleData')].find(el => el.getAttribute('name') === 'Pincode')
      const pincode = sd?.textContent?.trim() || pm.querySelector('name')?.textContent?.trim() || ''
      const zone    = ZONES.find(z => z.c === pincode)
      const risk    = zone?.r || 'LOW'
      const col     = riskColor(risk)
      const fills   = { HIGH: 0.20, MEDIUM: 0.15, LOW: 0.10 }
      const weights = { HIGH: 1.5,  MEDIUM: 1.0,  LOW: 0.8  }

      const poly = L.polygon(latLngs, {
        color: col, weight: weights[risk], opacity: 0.8,
        fillColor: col, fillOpacity: fills[risk], interactive: true,
      })
      poly.on('mouseover', () => poly.setStyle({ fillOpacity: fills[risk] + 0.15 }))
      poly.on('mouseout',  () => poly.setStyle({ fillOpacity: fills[risk] }))
      poly.on('click', () => {
        const d = apiData?.get(pincode)
        setSelected({
          pin: pincode, name: zone?.n || pincode, risk,
          riskIndex:  d?.riskIndex  != null ? Math.round(d.riskIndex  * 100) : (risk === 'HIGH' ? 82 : risk === 'MEDIUM' ? 51 : 18),
          confidence: d?.confidence != null ? Math.round(d.confidence * 100) : 80,
        })
      })
      group.addLayer(poly)
    })

    try {
      const gb = group.getLayers().reduce((b, l) => b.extend(l.getBounds()), L.latLngBounds())
      if (gb.isValid()) map.fitBounds(gb, { padding: [20, 20] })
    } catch (_) { /* keep current view */ }
  }

  // ── Circle fallback ───────────────────────────────────────────────────────
  function renderCircles(map) {
    circlesRef.current.forEach(c => map.removeLayer(c))
    circlesRef.current = []
    ZONES.forEach(z => {
      const risk   = apiData?.get(z.c)?.riskLevel ?? z.r
      const circle = L.circle([z.lat, z.lon], { ...getRiskStyle(risk, false), radius: 650, interactive: true })
      circle.on('mouseover', () => circle.setStyle(getRiskStyle(apiData?.get(z.c)?.riskLevel ?? z.r, true)))
      circle.on('mouseout',  () => circle.setStyle(getRiskStyle(apiData?.get(z.c)?.riskLevel ?? z.r, false)))
      circle.on('click', () => {
        const d = apiData?.get(z.c)
        const r = d?.riskLevel ?? z.r
        setSelected({
          pin: z.c, name: z.n, risk: r,
          riskIndex:  d?.riskIndex  != null ? Math.round(d.riskIndex  * 100) : (r === 'HIGH' ? 82 : r === 'MEDIUM' ? 51 : 18),
          confidence: d?.confidence != null ? Math.round(d.confidence * 100) : 80,
        })
      })
      circle.addTo(map)
      circlesRef.current.push(circle)
    })
  }

  // ── Update heat layer when apiData changes ────────────────────────────────
  useEffect(() => {
    if (!heatRef.current || !apiData) return
    const pts = ZONES.map(z => {
      const d = apiData.get(z.c)
      const w = d ? (d.riskIndex ?? 0) : (z.r === 'HIGH' ? 0.85 : z.r === 'MEDIUM' ? 0.52 : 0.15)
      return [z.lat, z.lon, w]
    })
    heatRef.current.setLatLngs(pts)
  }, [apiData])

  const col = selected ? riskColor(selected.risk) : '#fff'

  return (
    <div className={s.wrap}>
      <div ref={mapRef} className={s.mapEl} />

      <div className={s.hdr}>
        <span className={s.ttl}>{lang === 'ta' ? 'ஆபத்து வரைபடம்' : 'RISK MAP'}</span>
        <span className={s.badge}>{lang === 'ta' ? 'நேரடி · 44 மண்டலங்கள்' : 'LIVE · 44 ZONES'}</span>
      </div>

      <div className={s.legend}>
        <div className={s.legLbl}>{lang === 'ta' ? 'ஆபத்து நிலை' : 'RISK LEVEL'}</div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#FF3B5C'}}/><span>{lang === 'ta' ? 'அதிக ஆபத்து' : 'High Risk'}</span></div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#F59E0B'}}/><span>{lang === 'ta' ? 'நடுத்தர ஆபத்து' : 'Medium Risk'}</span></div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#22C55E'}}/><span>{lang === 'ta' ? 'குறைந்த ஆபத்து' : 'Low Risk'}</span></div>
        <div className={s.legLbl} style={{marginTop:8}}>PATROL STATUS</div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#3b82f6'}}/><span>Patrolling</span></div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#ef4444'}}/><span>Responding</span></div>
        <div className={s.legRow}><div className={s.legDot} style={{background:'#22c55e'}}/><span>At Scene</span></div>
      </div>

      {selected && (
        <div className={s.zonePanel}>
          <div className={s.zpHead}>ZONE DETAIL</div>
          <div className={s.zpName}>{selected.name} <span style={{color:'var(--dim)',fontWeight:400,fontSize:11}}>({selected.pin})</span></div>
          <div className={s.zpRow}><span className={s.zpKey}>Risk Level</span><span className={s.zpVal} style={{color:col}}>{selected.risk}</span></div>
          <div className={s.zpRow}><span className={s.zpKey}>Risk Index</span><span className={s.zpVal}>{selected.riskIndex}/100</span></div>
          <div className={s.zpRow}><span className={s.zpKey}>Confidence</span><span className={s.zpVal}>{selected.confidence}%</span></div>
          <div className={s.zpRow}><span className={s.zpKey}>Last Updated</span><span className={s.zpVal}>just now</span></div>
          <div className={s.zpFooter}><button className={s.zpDismiss} onClick={() => setSelected(null)}>Dismiss</button></div>
        </div>
      )}
    </div>
  )
}
