import styles from './StatsCard.module.css';

const ICONS = {
  alert: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12,6 12,12 16,14" />
    </svg>
  ),
};

export default function StatsCard({ variant, icon, value, label, unit }) {
  return (
    <div className={styles.card}>
      <div className={`${styles.ico} ${styles[variant]}`}>
        {ICONS[icon]}
      </div>
      <div>
        <div className={`${styles.val} ${styles[variant]}`}>
          {value == null ? (
            <span className={styles.skeleton} />
          ) : (
            <>
              {value}
              {unit && <span className={styles.unit}> {unit}</span>}
            </>
          )}
        </div>
        <div className={styles.lbl}>{label}</div>
      </div>
    </div>
  );
}
