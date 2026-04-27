import { useState, useEffect, useRef, useCallback } from 'react'
import { PATROL_ROUTES, findNearestPatrol, haversineDistance } from '../utils/patrolSimulation'
import { fetchRoadRoute } from '../utils/fetchRoadRoute'

const TICK_MS       = 100       // 100ms → smooth continuous motion
const STEP          = 0.000025  // degrees per tick — slowed down for realism
const AT_SCENE_MS   = 15000     // 15 seconds at scene before resuming
const ARRIVE_METERS = 300       // within 300m of SOS → AtScene

/**
 * Initialise patrol state from PATROL_ROUTES.
 * Each entry: { id, name, vehicle, position:{lat,lng}, waypointIndex, status, respondingTo, atSceneStart }
 */
function initPatrols() {
  return PATROL_ROUTES.map(route => ({
    id:            route.id,
    name:          route.name,
    vehicle:       route.vehicle,
    position:      { ...route.waypoints[0] },
    waypointIndex: 0,
    status:        'Patrolling',  // 'Patrolling' | 'Responding' | 'AtScene'
    respondingTo:  null,          // { lat, lng } of SOS
    atSceneStart:  null,          // timestamp when AtScene began
  }))
}

export function usePatrolSimulation() {
  const [patrolStates, setPatrolStates] = useState(initPatrols)
  const [routesReady, setRoutesReady]   = useState(false)

  // Ref so dispatchPatrol always reads latest state without stale closure
  const patrolRef      = useRef(patrolStates)
  // Stores road-expanded waypoints per patrol id once OSRM resolves
  const expandedRoutes = useRef({})

  useEffect(() => { patrolRef.current = patrolStates }, [patrolStates])

  // ── Load road-accurate routes once on mount — sequential to avoid rate limiting
  useEffect(() => {
    async function loadRoutes() {
      for (const patrol of PATROL_ROUTES) {
        const roadWaypoints = await fetchRoadRoute(patrol.waypoints)
        expandedRoutes.current[patrol.id] = roadWaypoints
        await new Promise(resolve => setTimeout(resolve, 300))
      }
      setRoutesReady(true)
    }
    loadRoutes()
  }, [])

  // ── Simulation tick — 100ms smooth interpolation ──────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      // Wait until road routes are loaded before moving
      if (!routesReady) return

      const now = Date.now()
      setPatrolStates(prev =>
        prev.map(patrol => {
          const expandedWaypoints = expandedRoutes.current[patrol.id]
          if (!expandedWaypoints || expandedWaypoints.length === 0) return patrol

          // ── AtScene: hold for AT_SCENE_MS then resume patrolling ────────
          if (patrol.status === 'AtScene') {
            if (now - patrol.atSceneStart >= AT_SCENE_MS) {
              return {
                ...patrol,
                status:       'Patrolling',
                respondingTo: null,
                atSceneStart: null,
              }
            }
            return patrol  // stay put
          }

          // ── Responding: step toward SOS target ─────────────────────────
          if (patrol.status === 'Responding' && patrol.respondingTo) {
            const target = patrol.respondingTo
            const cur    = patrol.position
            const dist   = haversineDistance(cur, target)

            if (dist <= ARRIVE_METERS) {
              return {
                ...patrol,
                position:     { ...target },
                status:       'AtScene',
                atSceneStart: now,
              }
            }

            const dx  = target.lng - cur.lng
            const dy  = target.lat - cur.lat
            const mag = Math.sqrt(dx * dx + dy * dy)
            return {
              ...patrol,
              position: {
                lat: cur.lat + (dy / mag) * STEP,
                lng: cur.lng + (dx / mag) * STEP,
              },
            }
          }

          // ── Patrolling: interpolate along road-expanded waypoints ───────
          const routeLen = expandedWaypoints.length
          const target   = expandedWaypoints[(patrol.waypointIndex + 1) % routeLen]
          const cur      = patrol.position
          const dx       = target.lng - cur.lng
          const dy       = target.lat - cur.lat
          const dist     = Math.sqrt(dx * dx + dy * dy)

          if (dist < STEP) {
            // Reached this waypoint — snap and advance index
            const nextIdx = (patrol.waypointIndex + 1) % routeLen
            return {
              ...patrol,
              position:      { ...expandedWaypoints[nextIdx] },
              waypointIndex: nextIdx,
            }
          }

          // Move STEP degrees toward next road waypoint
          return {
            ...patrol,
            position: {
              lat: cur.lat + (dy / dist) * STEP,
              lng: cur.lng + (dx / dist) * STEP,
            },
          }
        })
      )
    }, TICK_MS)

    return () => clearInterval(id)
  }, [routesReady])

  // ── Dispatch nearest patrol to SOS location ───────────────────────────────
  const dispatchPatrol = useCallback((sosLocation) => {
    const nearest = findNearestPatrol(patrolRef.current, sosLocation)
    if (!nearest) return null

    setPatrolStates(prev =>
      prev.map(p =>
        p.id === nearest.id
          ? { ...p, status: 'Responding', respondingTo: sosLocation, atSceneStart: null }
          : p
      )
    )
    return nearest.name
  }, [])

  return { patrolStates, dispatchPatrol }
}
