import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  {
    key: 'dashboard',
    label: { en: 'Dashboard', ta: 'டாஷ்போர்டு' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    key: 'reports',
    label: { en: 'Reports', ta: 'அறிக்கைகள்' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    ),
  },
  {
    key: 'settings',
    label: { en: 'Settings', ta: 'அமைப்புகள்' },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

export default function Sidebar({ lang, onToggleLang, patrols, onRefresh, isRefreshing, activeView, onNavChange }) {
  const counts = patrols
    ? { patrolling: patrols.patrolling ?? 0, responding: patrols.responding ?? 0, atScene: patrols.atScene ?? 0 }
    : null;

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <svg className={styles.shield} viewBox="0 0 30 30" fill="none">
          <path
            d="M15 2L3 7V15C3 21.075 8.325 26.85 15 29C21.675 26.85 27 21.075 27 15V7L15 2Z"
            fill="rgba(0,212,180,0.12)"
            stroke="#00D4B4"
            strokeWidth="1.5"
          />
          <path d="M10 15L13.5 18.5L20 12" stroke="#00D4B4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div>
          <div className={styles.brandName}>RAKSHAK</div>
          <div className={styles.brandSub}>
            {lang === 'ta' ? 'பாதுகாப்பு நுண்ணறிவு' : 'Safety Intelligence'}
          </div>
        </div>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`${styles.navItem} ${activeView === item.key ? styles.active : ''}`}
            onClick={() => onNavChange?.(item.key)}
          >
            {item.icon}
            <span>{item.label[lang] ?? item.label.en}</span>
          </div>
        ))}
      </nav>

      <div className={styles.patrolCounts}>
        <div className={styles.pcTitle}>ACTIVE PATROLS</div>
        <PatrolRow color="#22C55E" label="Patrolling"  count={counts?.patrolling  ?? null} />
        <PatrolRow color="#F59E0B" label="Responding"  count={counts?.responding  ?? null} />
        <PatrolRow color="#FF3B5C" label="At Scene"    count={counts?.atScene     ?? null} />
      </div>

      <div className={styles.footer}>
        <div className={styles.liveRow}>
          <div className={styles.liveDot} />
          <div>
            <div className={styles.liveLbl}>{lang === 'ta' ? 'நேரடி' : 'LIVE'}</div>
            <div className={styles.liveSub}>{lang === 'ta' ? 'சென்னை கட்டளை' : 'Chennai Command'}</div>
          </div>
        </div>

        <button
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh zone risk scores"
        >
          {isRefreshing ? (
            <><span className={styles.spinner} /> Refreshing…</>
          ) : (
            <>⟳ Refresh Scores</>
          )}
        </button>

        <button className={styles.profileBtn} title="Officer Profile">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span>Profile</span>
        </button>

        <button className={styles.langBtn} onClick={onToggleLang}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
          <span>{lang === 'ta' ? 'English' : 'தமிழ்'}</span>
        </button>
      </div>
    </aside>
  );
}

function PatrolRow({ color, label, count }) {
  return (
    <div className={styles.pcRow}>
      <span className={styles.pcDot} style={{ background: color }} />
      <span className={styles.pcLbl}>{label}</span>
      <span className={styles.pcCnt}>{count ?? '—'}</span>
    </div>
  );
}
