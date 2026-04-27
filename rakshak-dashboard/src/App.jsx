import React, { useState, useCallback } from 'react'
import Sidebar            from './components/Sidebar/Sidebar'
import StatsRow           from './components/StatsCard/StatsCard'
import RiskHeatmap        from './components/RiskHeatmap/RiskHeatmap'
import AlertsPanel        from './components/AlertsPanel/AlertsPanel'
import Reports            from './components/Reports/Reports'
import UsersNotHomeCard   from './components/UsersNotHomeCard/UsersNotHomeCard'
import PatrolDetailPanel  from './components/PatrolDetailPanel/PatrolDetailPanel'
import PatrolStats        from './components/PatrolStats/PatrolStats'
import { useRiskData }         from './hooks/useRiskData'
import { useSosEvents }        from './hooks/useSosEvents'
import { usePatrolSimulation } from './hooks/usePatrolSimulation'
import styles from './App.module.css'

export default function App() {
  const [lang, setLang]               = useState('en')
  const [activeView, setActiveView]   = useState('dashboard')
  const [selectedPatrolId, setSelectedPatrolId] = useState(null)
  const [resolvedIncidents, setResolvedIncidents] = useState([])

  const { data: apiData, loading, error, refetch } = useRiskData()
  const { events, total }                          = useSosEvents(apiData)
  const { patrolStates, dispatchPatrol }           = usePatrolSimulation()

  // Always show the live version of the selected patrol (position updates every 100ms)
  const selectedPatrol = selectedPatrolId
    ? patrolStates.find(p => p.id === selectedPatrolId) ?? null
    : null

  const handlePatrolClick = useCallback((patrol) => {
    setSelectedPatrolId(patrol.id)
  }, [])

  const handleIncidentResolved = useCallback((data) => {
    setResolvedIncidents(prev => [data, ...prev])
  }, [])

  return (
    <div className={activeView === 'reports' ? styles.appReports : styles.app}>
      <Sidebar
        lang={lang}
        onLangToggle={() => setLang(l => l === 'en' ? 'ta' : 'en')}
        onRefetch={refetch}
        isRefetching={loading}
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <main className={styles.main}>
        {error && (
          <div className={styles.errorBanner}>
            ⚠ API error: {error} — showing fallback data
          </div>
        )}

        {activeView === 'dashboard' && (
          <>
            <RiskHeatmap
              apiData={apiData}
              lang={lang}
              dispatchPatrol={dispatchPatrol}
              onPatrolClick={handlePatrolClick}
            />

            <StatsRow apiData={apiData} sosTotal={total} lang={lang} />

            <div className={styles.chartsRow}>
              {/* Zone overview table */}
              <div className={styles.chartCard}>
                <div className={styles.chartHdr}>
                  <div className={styles.chartBar} style={{background:'var(--accent)'}}/>
                  <span className={styles.chartTtl}>ZONE OVERVIEW</span>
                </div>
                <div className={styles.overviewBody}>
                  {loading && <span style={{color:'var(--muted)',fontSize:12}}>Loading…</span>}
                  {!loading && apiData && (
                    <table className={styles.ovTable}>
                      <thead>
                        <tr><th>Zone</th><th>Risk</th><th>Index</th><th>Conf.</th></tr>
                      </thead>
                      <tbody>
                        {Array.from(apiData.entries()).slice(0, 8).map(([code, d]) => {
                          const col = d.riskLevel === 'HIGH' ? '#FF3B5C'
                            : d.riskLevel === 'MEDIUM' ? '#F59E0B' : '#22C55E'
                          return (
                            <tr key={code}>
                              <td>{code}</td>
                              <td style={{color:col,fontWeight:700}}>{d.riskLevel}</td>
                              <td>{d.riskIndex  != null ? Math.round(d.riskIndex  * 100) : '—'}</td>
                              <td>{d.confidence != null ? Math.round(d.confidence * 100) + '%' : '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Live patrol stats — 20 units with scrollable list */}
              <PatrolStats patrolStates={patrolStates} />

              {/* Post-10PM unresolved journeys card (returns null before 22:00) */}
              <UsersNotHomeCard />
            </div>
          </>
        )}

        {activeView === 'reports' && (
          <Reports resolvedIncidents={resolvedIncidents} />
        )}
      </main>

      {activeView === 'dashboard' && (
        <AlertsPanel
          events={events}
          total={total}
          lang={lang}
          onSosDispatched={dispatchPatrol}
          onIncidentResolved={handleIncidentResolved}
        />
      )}

      {/* Patrol detail panel — fixed bottom-right card */}
      <PatrolDetailPanel
        patrol={selectedPatrol}
        onClose={() => setSelectedPatrolId(null)}
        dispatchPatrol={dispatchPatrol}
      />
    </div>
  )
}
