/**
 * Haversine distance between two {lat, lng} points in meters.
 */
export function haversineDistance(a, b) {
  const R = 6371000
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

/**
 * Find the nearest patrol unit (status === 'Patrolling') to a given SOS location.
 * Falls back to any patrol if none are patrolling.
 */
export function findNearestPatrol(patrols, sosLocation) {
  const candidates = patrols.filter(p => p.status === 'Patrolling')
  const pool = candidates.length > 0 ? candidates : patrols
  return pool.reduce((nearest, patrol) => {
    const dist = haversineDistance(patrol.position, sosLocation)
    return dist < nearest.dist ? { patrol, dist } : nearest
  }, { patrol: null, dist: Infinity }).patrol
}

/**
 * 20 patrol units with circular waypoint routes around Chennai zones.
 */
export const PATROL_ROUTES = [
  {
    id: 'P1', name: 'Unit Alpha', vehicle: 'PCR-01',
    waypoints: [
      { lat: 13.0827, lng: 80.2707 }, { lat: 13.0850, lng: 80.2750 },
      { lat: 13.0900, lng: 80.2780 }, { lat: 13.0870, lng: 80.2720 },
      { lat: 13.0827, lng: 80.2707 },
    ],
  },
  {
    id: 'P2', name: 'Unit Bravo', vehicle: 'PCR-02',
    waypoints: [
      { lat: 13.0600, lng: 80.2500 }, { lat: 13.0650, lng: 80.2550 },
      { lat: 13.0700, lng: 80.2520 }, { lat: 13.0640, lng: 80.2470 },
      { lat: 13.0600, lng: 80.2500 },
    ],
  },
  {
    id: 'P3', name: 'Unit Charlie', vehicle: 'PCR-03',
    waypoints: [
      { lat: 13.1000, lng: 80.2900 }, { lat: 13.1050, lng: 80.2950 },
      { lat: 13.1100, lng: 80.2920 }, { lat: 13.1040, lng: 80.2870 },
      { lat: 13.1000, lng: 80.2900 },
    ],
  },
  {
    id: 'P4', name: 'Unit Delta', vehicle: 'PCR-04',
    waypoints: [
      { lat: 13.0400, lng: 80.2300 }, { lat: 13.0450, lng: 80.2350 },
      { lat: 13.0500, lng: 80.2320 }, { lat: 13.0440, lng: 80.2270 },
      { lat: 13.0400, lng: 80.2300 },
    ],
  },
  {
    id: 'P5', name: 'Unit Echo', vehicle: 'PCR-05',
    waypoints: [
      { lat: 13.0750, lng: 80.2600 }, { lat: 13.0800, lng: 80.2650 },
      { lat: 13.0820, lng: 80.2610 }, { lat: 13.0770, lng: 80.2570 },
      { lat: 13.0750, lng: 80.2600 },
    ],
  },
  {
    id: 'P6', name: 'Unit Foxtrot', vehicle: 'PCR-06',
    waypoints: [
      { lat: 13.1200, lng: 80.2800 }, { lat: 13.1250, lng: 80.2850 },
      { lat: 13.1280, lng: 80.2820 }, { lat: 13.1220, lng: 80.2770 },
      { lat: 13.1200, lng: 80.2800 },
    ],
  },
  {
    id: 'P7', name: 'Unit Golf', vehicle: 'PCR-07',
    waypoints: [
      { lat: 13.0300, lng: 80.2100 }, { lat: 13.0350, lng: 80.2150 },
      { lat: 13.0380, lng: 80.2120 }, { lat: 13.0320, lng: 80.2070 },
      { lat: 13.0300, lng: 80.2100 },
    ],
  },
  {
    id: 'P8', name: 'Unit Hotel', vehicle: 'PCR-08',
    waypoints: [
      { lat: 13.0950, lng: 80.2400 }, { lat: 13.1000, lng: 80.2450 },
      { lat: 13.1020, lng: 80.2420 }, { lat: 13.0960, lng: 80.2370 },
      { lat: 13.0950, lng: 80.2400 },
    ],
  },
  {
    id: 'P9', name: 'Unit India', vehicle: 'PCR-09',
    waypoints: [
      { lat: 13.0500, lng: 80.2700 }, { lat: 13.0550, lng: 80.2750 },
      { lat: 13.0580, lng: 80.2720 }, { lat: 13.0520, lng: 80.2670 },
      { lat: 13.0500, lng: 80.2700 },
    ],
  },
  {
    id: 'P10', name: 'Unit Juliet', vehicle: 'PCR-10',
    waypoints: [
      { lat: 13.0700, lng: 80.2200 }, { lat: 13.0750, lng: 80.2250 },
      { lat: 13.0780, lng: 80.2220 }, { lat: 13.0720, lng: 80.2170 },
      { lat: 13.0700, lng: 80.2200 },
    ],
  },
  // ── P11–P20: south and west Chennai zones ─────────────────────────────────
  {
    id: 'P11', name: 'Unit Kilo', vehicle: 'PCR-11',
    waypoints: [
      { lat: 13.0100, lng: 80.2100 }, { lat: 13.0150, lng: 80.2150 },
      { lat: 13.0180, lng: 80.2120 }, { lat: 13.0120, lng: 80.2070 },
      { lat: 13.0100, lng: 80.2100 },
    ],
  },
  {
    id: 'P12', name: 'Unit Lima', vehicle: 'PCR-12',
    waypoints: [
      { lat: 13.0200, lng: 80.2400 }, { lat: 13.0250, lng: 80.2450 },
      { lat: 13.0280, lng: 80.2420 }, { lat: 13.0220, lng: 80.2370 },
      { lat: 13.0200, lng: 80.2400 },
    ],
  },
  {
    id: 'P13', name: 'Unit Mike', vehicle: 'PCR-13',
    waypoints: [
      { lat: 13.0900, lng: 80.2100 }, { lat: 13.0950, lng: 80.2150 },
      { lat: 13.0980, lng: 80.2120 }, { lat: 13.0920, lng: 80.2070 },
      { lat: 13.0900, lng: 80.2100 },
    ],
  },
  {
    id: 'P14', name: 'Unit November', vehicle: 'PCR-14',
    waypoints: [
      { lat: 13.1100, lng: 80.2100 }, { lat: 13.1150, lng: 80.2150 },
      { lat: 13.1180, lng: 80.2120 }, { lat: 13.1120, lng: 80.2070 },
      { lat: 13.1100, lng: 80.2100 },
    ],
  },
  {
    id: 'P15', name: 'Unit Oscar', vehicle: 'PCR-15',
    waypoints: [
      { lat: 13.0650, lng: 80.2800 }, { lat: 13.0700, lng: 80.2850 },
      { lat: 13.0730, lng: 80.2820 }, { lat: 13.0670, lng: 80.2770 },
      { lat: 13.0650, lng: 80.2800 },
    ],
  },
  {
    id: 'P16', name: 'Unit Papa', vehicle: 'PCR-16',
    waypoints: [
      { lat: 13.0350, lng: 80.2600 }, { lat: 13.0400, lng: 80.2650 },
      { lat: 13.0430, lng: 80.2620 }, { lat: 13.0370, lng: 80.2570 },
      { lat: 13.0350, lng: 80.2600 },
    ],
  },
  {
    id: 'P17', name: 'Unit Quebec', vehicle: 'PCR-17',
    waypoints: [
      { lat: 13.1300, lng: 80.2600 }, { lat: 13.1350, lng: 80.2650 },
      { lat: 13.1380, lng: 80.2620 }, { lat: 13.1320, lng: 80.2570 },
      { lat: 13.1300, lng: 80.2600 },
    ],
  },
  {
    id: 'P18', name: 'Unit Romeo', vehicle: 'PCR-18',
    waypoints: [
      { lat: 12.9900, lng: 80.2200 }, { lat: 12.9950, lng: 80.2250 },
      { lat: 12.9980, lng: 80.2220 }, { lat: 12.9920, lng: 80.2170 },
      { lat: 12.9900, lng: 80.2200 },
    ],
  },
  {
    id: 'P19', name: 'Unit Sierra', vehicle: 'PCR-19',
    waypoints: [
      { lat: 13.0800, lng: 80.2100 }, { lat: 13.0850, lng: 80.2150 },
      { lat: 13.0880, lng: 80.2120 }, { lat: 13.0820, lng: 80.2070 },
      { lat: 13.0800, lng: 80.2100 },
    ],
  },
  {
    id: 'P20', name: 'Unit Tango', vehicle: 'PCR-20',
    waypoints: [
      { lat: 13.0450, lng: 80.2900 }, { lat: 13.0500, lng: 80.2950 },
      { lat: 13.0530, lng: 80.2920 }, { lat: 13.0470, lng: 80.2870 },
      { lat: 13.0450, lng: 80.2900 },
    ],
  },
]
