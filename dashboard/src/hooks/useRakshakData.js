import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { ENDPOINTS, ZONES } from '../config/api';

/**
 * Returns { data, loading, error, refresh }
 *
 * data shape:
 *   zoneRisks  : { [pincode]: { riskLevel, riskIndex, confidence } } | null
 *   sosEvents  : Array<{ id, location, risk, timestamp, status }>   | null
 *   patrols    : { patrolling, responding, atScene, units }          | null
 *   stats      : { sosToday, avgResponseTime }                       | null
 */
export function useRakshakData() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const abortRef = useRef(null);

  const apiFailed = useRef(false);

  const fetchZoneRisks = useCallback(async () => {
    const now       = new Date();
    const hour      = now.getHours();
    const dow       = now.getDay();
    const isnight   = hour < 6 || hour >= 20 ? 1 : 0;
    const isweekend = dow === 0 || dow === 6  ? 1 : 0;

    // Fallback: derive a deterministic mock risk from the static zone data
    const mockResult = () => {
      const result = {};
      ZONES.forEach((z) => {
        const riskIndex = z.r === 'HIGH' ? 0.85 : z.r === 'MEDIUM' ? 0.52 : 0.15;
        result[z.c] = { riskLevel: z.r, riskIndex, confidence: 0.5 };
      });
      return result;
    };

    // If the API already failed this session, skip and return mock immediately
    if (apiFailed.current) return mockResult();

    const settled = await Promise.allSettled(
      ZONES.map((z) =>
        axios
          .post(
            ENDPOINTS.predict,
            { lat: z.lat, lon: z.lon, hour, dayofweek: dow, isnight, isweekend },
            { signal: AbortSignal.timeout(5000), timeout: 5000 }
          )
          .then((r) => {
            if (r.status === 503) throw new Error('503');
            return { code: z.c, data: r.data };
          })
      )
    );

    // Check if every single call failed (API is down)
    const allFailed = settled.every((r) => r.status === 'rejected');
    if (allFailed) {
      if (!apiFailed.current) {
        console.warn('Prediction API unavailable, using fallback data');
        apiFailed.current = true;
      }
      return mockResult();
    }

    const result = {};
    settled.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        result[ZONES[i].c] = r.value.data;
      } else {
        // Individual zone failed — fill in with static fallback
        const z = ZONES[i];
        result[z.c] = {
          riskLevel: z.r,
          riskIndex: z.r === 'HIGH' ? 0.85 : z.r === 'MEDIUM' ? 0.52 : 0.15,
          confidence: 0.5,
        };
      }
    });
    return result;
  }, []);

  const refresh = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();

    setError(null);

    const [zoneResult, sosResult, patrolResult, statsResult] =
      await Promise.allSettled([
        fetchZoneRisks(),
        axios.get(ENDPOINTS.sosEvents, { signal: AbortSignal.timeout(5000) }).then((r) => r.data),
        axios.get(ENDPOINTS.patrols,   { signal: AbortSignal.timeout(5000) }).then((r) => r.data),
        axios.get(ENDPOINTS.stats,     { signal: AbortSignal.timeout(5000) }).then((r) => r.data),
      ]);

    setData({
      zoneRisks:  zoneResult.status   === 'fulfilled' ? zoneResult.value   : null,
      sosEvents:  sosResult.status    === 'fulfilled' ? sosResult.value    : null,
      patrols:    patrolResult.status === 'fulfilled' ? patrolResult.value : null,
      stats:      statsResult.status  === 'fulfilled' ? statsResult.value  : null,
    });

    if (zoneResult.status === 'rejected') {
      setError(zoneResult.reason?.message ?? 'Failed to load zone data');
    }

    setLoading(false);
  }, [fetchZoneRisks]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => {
      clearInterval(id);
      abortRef.current?.abort();
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
