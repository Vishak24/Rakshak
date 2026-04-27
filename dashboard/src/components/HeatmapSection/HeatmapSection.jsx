import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.heat';
import { ZONES, ROAD_WAYPOINTS, PATROL_UNITS } from '../../config/api';
import styles from './HeatmapSection.module.css';

const CHENNAI_BOUNDS = L.latLngBounds(
  L.latLng(12.8, 80.1),
  L.latLng(13.23, 80.32)
);

function riskColor(r) {
  return r === 'HIGH' ? '#FF3B5C' : r === 'MEDIUM' ? '#F59E0B' : '#22C55E';
}

function getRiskStyle(risk, hover) {
  const fill = hover
    ? (risk === 'HIGH' ? 0.45 : risk === 'MEDIUM' ? 0.35 : 0.25)
    : (risk === 'HIGH' ? 0.30 : risk === 'MEDIUM' ? 0.20 : 0.12);
  const col = riskColor(risk);
  return {
    fillColor: col,
    fillOpacity: fill,
    color: col,
    weight: hover ? 2.5 : (risk === 'HIGH' ? 1.5 : risk === 'MEDIUM' ? 1.0 : 0.8),
    opacity: 0.9,
  };
}

function makePatrolIcon(id, status) {
  const badgeCls = status === 'responding' ? 'responding' : status === 'at scene' ? 'at-scene' : '';
  const dotColor = status === 'patrolling' ? '#22C55E' : status === 'responding' ? '#F59E0B' : '#FF3B5C';
  return L.divIcon({
    className: '',
    html: `<div class="patrol-icon">
      <div class="p-badge ${badgeCls}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L3 6.5V12C3 17 7 21.5 12 23C17 21.5 21 17 21 12V6.5L12 2Z"/>
          <path d="M9 12L11 14L15 10" stroke="#080D1A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
        <div class="p-sdot" style="background:${dotColor}"></div>
      </div>
      <div class="p-label">${id}</div>
    </div>`,
    iconSize: [40, 42],
    iconAnchor: [20, 13],
  });
}

export default function HeatmapSection({ zoneRisks, onZoneSelect, onPatrolSelect, zoneScoreOverrides }) {
  const containerRef   = useRef(null);
  const mapRef         = useRef(null);
  const heatRef        = useRef(null);
  const circlesRef     = useRef({});        // pincode -> L.circle
  const patrolStateRef = useRef({});        // unit id -> { marker, wayptIdx, wayptProgress, status }
  const selectedRef    = useRef(null);
  const onSelectRef    = useRef(onZoneSelect);
  const onPatrolRef    = useRef(onPatrolSelect);

  useEffect(() => { onSelectRef.current = onZoneSelect; }, [onZoneSelect]);
  useEffect(() => { onPatrolRef.current = onPatrolSelect; }, [onPatrolSelect]);

  // Init map once
  useEffect(() => {
    // Guard against double-mount in React StrictMode — Leaflet sets _leaflet_id on init
    if (mapRef.current) return;
    if (containerRef.current && containerRef.current._leaflet_id) return;

    const map = L.map(containerRef.current, {
      center: [13.0827, 80.2707],
      zoom: 12,
      minZoom: 11,
      maxZoom: 16,
      maxBounds: CHENNAI_BOUNDS,
      maxBoundsViscosity: 1.0,
      attributionControl: false,
    });
    mapRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    // Heat layer seeded with static zone weights
    const heatPts = ZONES.map((z) => [z.lat, z.lon, z.r === 'HIGH' ? 0.9 : z.r === 'MEDIUM' ? 0.55 : 0.18]);
    const heat = L.heatLayer(heatPts, {
      radius: 38, blur: 28, maxZoom: 14,
      gradient: { 0: '#22C55E', 0.45: '#F59E0B', 1: '#FF3B5C' },
      max: 1,
    }).addTo(map);
    heatRef.current = heat;

    // Zone circles + pincode labels
    ZONES.forEach((z) => {
      const circle = L.circle([z.lat, z.lon], { ...getRiskStyle(z.r, false), radius: 650, interactive: true });
      circle._pin  = z.c;
      circle._zone = z;

      circle.on('mouseover', function (e) {
        if (selectedRef.current === this) return;
        const col = riskColor(z.r);
        this.setStyle(getRiskStyle(z.r, true));
        const tc = `zone-tip ${z.r === 'HIGH' ? 'tip-high' : z.r === 'MEDIUM' ? 'tip-med' : 'tip-low'}`;
        this.bindTooltip(
          `<span style="font-size:9px;font-weight:700;letter-spacing:1px;color:#94A3B8">ZONE ${z.c}</span><br>` +
          `<span style="font-weight:700;font-size:12px">${z.n}</span><br>` +
          `<span style="color:${col};font-weight:700">Risk: ${z.r}</span>`,
          { className: tc, sticky: true, direction: 'top', offset: [0, -6] }
        ).openTooltip(e.latlng);
      });

      circle.on('mouseout', function () {
        this.closeTooltip();
        this.unbindTooltip();
        if (selectedRef.current !== this) this.setStyle(getRiskStyle(z.r, false));
      });

      circle.on('click', function () {
        if (selectedRef.current && selectedRef.current !== this) {
          const prev = selectedRef.current;
          prev.setStyle(getRiskStyle(prev._zone.r, false));
        }
        selectedRef.current = this;
        this.setStyle({ ...getRiskStyle(z.r, false), weight: 3, fillOpacity: 0.35 });
        onSelectRef.current?.({ pin: z.c, name: z.n, risk: z.r });
      });

      circle.addTo(map);
      circlesRef.current[z.c] = circle;

      L.marker([z.lat, z.lon], {
        icon: L.divIcon({
          className: 'pincode-label',
          html: `<span>${z.c}</span>`,
          iconSize: [50, 16],
          iconAnchor: [25, 8],
        }),
        interactive: false,
        zIndexOffset: -100,
      }).addTo(map);
    });

    heat.bringToFront();

    // Patrol markers
    const patrolLayer = L.layerGroup().addTo(map);
    PATROL_UNITS.forEach((unit) => {
      const route = ROAD_WAYPOINTS[unit.routeIdx % ROAD_WAYPOINTS.length];
      const pt    = route.pts[unit.wayptIdx % route.pts.length];
      const marker = L.marker([pt[0], pt[1]], {
        icon: makePatrolIcon(unit.id, unit.status),
        zIndexOffset: 900,
      }).addTo(patrolLayer);

      marker.on('click', () => {
        const pincode = ZONES.find((z) => z.n === unit.zone)?.c ?? null;
        onPatrolRef.current?.({ ...unit, pincode });
      });

      patrolStateRef.current[unit.id] = { marker, wayptIdx: unit.wayptIdx, wayptProgress: 0, status: unit.status, routeIdx: unit.routeIdx };
    });

    // Animate patrols
    const moveInterval = setInterval(() => {
      PATROL_UNITS.forEach((unit) => {
        const s = patrolStateRef.current[unit.id];
        if (!s?.marker) return;
        const route = ROAD_WAYPOINTS[s.routeIdx % ROAD_WAYPOINTS.length];
        const pts   = route.pts;
        const from  = pts[s.wayptIdx % pts.length];
        const to    = pts[(s.wayptIdx + 1) % pts.length];
        s.wayptProgress = (s.wayptProgress ?? 0) + 0.12;
        if (s.wayptProgress >= 1) { s.wayptProgress = 0; s.wayptIdx = (s.wayptIdx + 1) % pts.length; }
        const t   = s.wayptProgress;
        const lat = from[0] + (to[0] - from[0]) * t;
        const lon = from[1] + (to[1] - from[1]) * t;
        s.marker.setLatLng([lat, lon]);
        s.marker.setIcon(makePatrolIcon(unit.id, s.status));
      });
    }, 3000);

    return () => {
      clearInterval(moveInterval);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update heatmap + circle colours when API risk data arrives
  useEffect(() => {
    if (!zoneRisks) return;

    if (heatRef.current) {
      const pts = ZONES.map((z) => {
        const d = zoneRisks[z.c];
        const w = d ? (d.riskIndex ?? 0) : (z.r === 'HIGH' ? 0.85 : z.r === 'MEDIUM' ? 0.52 : 0.15);
        return [z.lat, z.lon, w];
      });
      heatRef.current.setLatLngs(pts);
    }

    ZONES.forEach((z) => {
      const circle = circlesRef.current[z.c];
      if (!circle || selectedRef.current === circle) return;
      const risk = zoneRisks[z.c]?.riskLevel ?? z.r;
      circle._zone = { ...z, r: risk };
      circle.setStyle(getRiskStyle(risk, false));
    });
  }, [zoneRisks]);

  // Apply score overrides from Refresh Scores button
  useEffect(() => {
    if (!zoneScoreOverrides) return;
    zoneScoreOverrides.forEach(({ pincode, risk, fillColor, fillOpacity }) => {
      const circle = circlesRef.current[pincode];
      if (!circle) return;
      if (fillColor && fillOpacity !== undefined) {
        circle.setStyle({ fillColor, fillOpacity, color: fillColor });
      } else if (risk) {
        circle._zone = { ...circle._zone, r: risk };
        circle.setStyle(getRiskStyle(risk, false));
      }
    });
  }, [zoneScoreOverrides]);

  return (
    <div className={styles.mapArea}>
      <div ref={containerRef} className={styles.map} />

      <div className={styles.mapHdr}>
        <span className={styles.mapTtl}>RISK MAP</span>
        <span className={styles.mapBadge}>LIVE · {ZONES.length} ZONES</span>
      </div>

      <div className={styles.legend}>
        <div className={styles.legTitle}>RISK LEVEL</div>
        {[
          { color: '#FF3B5C', label: 'High Risk' },
          { color: '#F59E0B', label: 'Medium Risk' },
          { color: '#22C55E', label: 'Low Risk' },
        ].map(({ color, label }) => (
          <div key={label} className={styles.legRow}>
            <span className={styles.legDot} style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
