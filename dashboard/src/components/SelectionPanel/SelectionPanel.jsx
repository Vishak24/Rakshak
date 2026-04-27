import styles from './SelectionPanel.module.css';

function riskColor(r) {
  return r === 'HIGH' ? 'var(--danger)' : r === 'MEDIUM' ? 'var(--warning)' : 'var(--safe)';
}

export default function SelectionPanel({ zone, zoneRisks, onDismiss, lang }) {
  if (!zone) {
    return <CityOverview zoneRisks={zoneRisks} lang={lang} />;
  }

  const apiData = zoneRisks?.[zone.pin];
  const risk    = apiData?.riskLevel ?? zone.risk;
  const idx     = apiData?.riskIndex  != null ? Math.round(apiData.riskIndex  * 100) + '/100' : '—';
  const conf    = apiData?.confidence != null ? Math.round(apiData.confidence * 100) + '%'    : '—';
  const col     = riskColor(risk);

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        📍 {lang === 'ta' ? 'தேர்வு விவரங்கள்' : 'SELECTION DETAILS'}
      </div>

      <div className={styles.zoneDetail}>
        <div className={styles.ziHead}>ZONE DETAIL</div>
        <div className={styles.ziName}>
          {zone.name} <span className={styles.ziPin}>({zone.pin})</span>
        </div>

        <div className={styles.ziRow}>
          <span className={styles.ziKey}>Risk Level</span>
          <span className={styles.ziVal} style={{ color: col }}>{risk} ●</span>
        </div>
        <div className={styles.ziRow}>
          <span className={styles.ziKey}>Risk Index</span>
          <span className={styles.ziVal}>{idx}</span>
        </div>
        <div className={styles.ziRow}>
          <span className={styles.ziKey}>Confidence</span>
          <span className={styles.ziVal}>{conf}</span>
        </div>
        <div className={styles.ziRow}>
          <span className={styles.ziKey}>Last Updated</span>
          <span className={styles.ziVal}>just now</span>
        </div>

        <div className={styles.ziFooter}>
          <button className={styles.dismiss} onClick={onDismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  );
}

function CityOverview({ zoneRisks, lang }) {
  const high   = zoneRisks ? Object.values(zoneRisks).filter((d) => d.riskLevel === 'HIGH').length   : null;
  const medium = zoneRisks ? Object.values(zoneRisks).filter((d) => d.riskLevel === 'MEDIUM').length : null;
  const low    = zoneRisks ? Object.values(zoneRisks).filter((d) => d.riskLevel === 'LOW').length    : null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>
        📍 {lang === 'ta' ? 'நகர கண்ணோட்டம்' : 'CITY OVERVIEW'}
      </div>
      <div className={styles.overviewGrid}>
        <OverviewItem color="var(--danger)"  label="High Risk"   value={high}   />
        <OverviewItem color="var(--warning)" label="Medium Risk" value={medium} />
        <OverviewItem color="var(--safe)"    label="Low Risk"    value={low}    />
      </div>
      <div className={styles.overviewHint}>
        Click a zone on the map to view details
      </div>
    </div>
  );
}

function OverviewItem({ color, label, value }) {
  return (
    <div className={styles.overviewItem}>
      <span className={styles.overviewDot} style={{ background: color }} />
      <span className={styles.overviewLabel}>{label}</span>
      <span className={styles.overviewCount} style={{ color }}>
        {value == null ? '—' : value}
      </span>
    </div>
  );
}
