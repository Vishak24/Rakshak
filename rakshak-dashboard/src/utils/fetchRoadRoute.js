/**
 * Fetches a road-accurate route from the free public OSRM demo server.
 * No API key or signup required.
 *
 * Coordinates are passed as longitude,latitude (OSRM requirement).
 *
 * @param {Array<{lat: number, lng: number}>} waypoints
 * @returns {Promise<Array<{lat: number, lng: number}>>}
 *   Densely-sampled road coordinates, or the original waypoints on failure.
 */
export async function fetchRoadRoute(waypoints) {
  try {
    // OSRM requires coordinates in lng,lat order
    const coords = waypoints.map(w => `${w.lng},${w.lat}`).join(';')
    const url = `http://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`

    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) throw new Error(`OSRM HTTP ${res.status}`)

    const data = await res.json()
    if (!data.routes || data.routes.length === 0) throw new Error('No route found')

    const roadCoords = data.routes[0].geometry.coordinates
    // Treat fewer than 3 points as a failed/degenerate route
    if (roadCoords.length < 3) throw new Error(`Too few road points (${roadCoords.length})`)

    console.log(`Route loaded for patrol: ${roadCoords.length} road points`)
    // OSRM GeoJSON returns [lng, lat] — convert to {lat, lng}
    return roadCoords.map(([lng, lat]) => ({ lat, lng }))
  } catch (e) {
    console.warn(`Road routing failed for waypoints, using direct path: ${e.message}`)
    return waypoints
  }
}
