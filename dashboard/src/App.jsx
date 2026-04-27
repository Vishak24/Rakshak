import { useState, useCallback } from 'react';
import { useRakshakData } from './hooks/useRakshakData';
import Sidebar from './components/Sidebar/Sidebar';
import HeatmapSection from './components/HeatmapSection/HeatmapSection';
import StatsCard from './components/StatsCard/StatsCard';
import AlertsPanel from './components/AlertsPanel/AlertsPanel';
import SelectionPanel from './components/SelectionPanel/SelectionPanel';
import PatrolStats from './components/PatrolStats/PatrolStats';
import PatrolDetailPanel from './components/PatrolDetailPanel/PatrolDetailPanel';
import Reports from './components/Reports/Reports';
import { ZONES } from './config/api';
import styles from './App.module.css';

function mockScore() {
  const r = Math.random() * 100;
  if (r > 60) return { score: r, risk: 'LOW',    fillColor: '#22c55e', fillOpacity: 0.3 };
  if (r > 30) return { score: r, risk: 'MEDIUM',  fillColor: '#f59e0b', fillOpacity: 0.4 };
  return       { score: r, risk: 'HIGH',   fillColor: '#ef4444', fillOpacity: 0.5 };
}

export default function App() {
  const { data, loading, error } = useRakshakData();
  const [selectedZone,        setSelectedZone]        = useState(null);
  const [selectedPatrol,      setSelectedPatrol]      = useState(null);
  const [lang,                setLang]                = useState('en');
  const [activeView,          setActiveView]          = useState('dashboard');
  const [isRefreshing,        setIsRefreshing]        = useState(false);
  const [zoneScoreOverrides,  setZoneScoreOverrides]  = useState(null);

  const zoneRisks = data?.zoneRisks ?? null;
  const sosToday  = data?.stats?.sosToday          ?? null;
  const avgResp   = data?.stats?.avgResponseTime   ?? null;

  const highRiskCount = zoneRisks
    ? Object.values(zoneRisks).filter((d) => d.riskLevel === 'HIGH').length
    : null;

  const handleZoneSelect = (zone) => setSelectedZone(zone);
  const handleDismiss    = () => setSelectedZone(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    const payload = {
      zones: ZONES.map((z) => ({
        pincode: z.c,
        time: new Date().toISOString(),
        units: Math.floor(Math.random() * 3) + 1,
      })),
    };

    let results;
    try {
      const res = await fetch('/api/score/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('API error');
      const json = await res.json();
      // Expect array of { pincode, safe_score, risk_level }
      results = json.map((item) => {
        const risk = item.risk_level ?? 'LOW';
        const fillColor   = risk === 'HIGH' ? '#ef4444' : risk === 'MEDIUM' ? '#f59e0b' : '#22c55e';
        const fillOpacity = risk === 'HIGH' ? 0.5       : risk === 'MEDIUM' ? 0.4       : 0.3;
        return { pincode: item.pincode, risk, fillColor, fillOpacity, score: item.safe_score };
      });
    } catch {
      // Mock fallback
      results = ZONES.map((z) => ({ pincode: z.c, ...mockScore() }));
    }

    setZoneScoreOverrides(results);
    setIsRefreshing(false);
  }, []);

  return (
    <div className={styles.app}>
      <Sidebar
        lang={lang}
        onToggleLang={() => setLang((l) => (l === 'en' ? 'ta' : 'en'))}
        patrols={data?.patrols ?? null}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        activeView={activeView}
        onNavChange={setActiveView}
      />

      {activeView === 'reports' ? (
        <main className={styles.main}>
          <Reports lang={lang} />
        </main>
      ) : (
        <main className={styles.main}>
          {error && <div className={styles.errorBanner}>{error}</div>}

          <HeatmapSection
            zoneRisks={zoneRisks}
            onZoneSelect={handleZoneSelect}
            onPatrolSelect={setSelectedPatrol}
            zoneScoreOverrides={zoneScoreOverrides}
          />

          <div className={styles.statRow}>
            <StatsCard
              variant="danger"
              icon="alert"
              value={loading && !data ? null : sosToday}
              label={lang === 'ta' ? 'இன்று SOS' : 'SOS Today'}
            />
            <StatsCard
              variant="warning"
              icon="shield"
              value={loading && !data ? null : highRiskCount}
              label={lang === 'ta' ? 'அதிக ஆபத்து மண்டலங்கள்' : 'High Risk Zones'}
            />
            <StatsCard
              variant="safe"
              icon="clock"
              value={loading && !data ? null : avgResp}
              label={lang === 'ta' ? 'சராசரி மறுமொழி நேரம்' : 'Avg Response Time'}
              unit="min"
            />
          </div>

          <div className={styles.chartsRow}>
            <SelectionPanel
              zone={selectedZone}
              zoneRisks={zoneRisks}
              onDismiss={handleDismiss}
              lang={lang}
            />
            <PatrolStats
              patrols={data?.patrols ?? null}
              loading={loading}
            />
          </div>
        </main>
      )}

      <AlertsPanel
        events={data?.sosEvents ?? null}
        loading={loading}
        lang={lang}
      />

      <PatrolDetailPanel
        patrol={selectedPatrol}
        onClose={() => setSelectedPatrol(null)}
      />
    </div>
  );
}
