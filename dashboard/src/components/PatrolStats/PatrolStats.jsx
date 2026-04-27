import { PATROL_UNITS } from '../../config/api';
import styles from './PatrolStats.module.css';

const STATUS_COLOR = {
  patrolling: 'var(--safe)',
  responding: 'var(--warning)',
  'at scene': 'var(--danger)',
};

export default function PatrolStats({ patrols, loading }) {
  const units = patrols?.units ?? PATROL_UNITS;

  return (
    <div className={styles.card}>
      <div className={styles.hdr}>
        <div className={styles.bar} />
        <span className={styles.title}>PATROLS ON DUTY</span>
      </div>

      <div className={styles.body}>
        {loading && !patrols ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : (
          units.map((u) => {
            const status = patrols?.units?.find((p) => p.id === u.id)?.status ?? u.status;
            return (
              <div key={u.id} className={styles.row}>
                <span className={styles.dot} style={{ background: STATUS_COLOR[status] ?? 'var(--dim)' }} />
                <span className={styles.id}>{u.id}</span>
                <span className={styles.zone}>{u.zone}</span>
                <span className={styles.status} style={{ color: STATUS_COLOR[status] ?? 'var(--muted)' }}>
                  {status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className={styles.row}>
      <span className={`${styles.dot} ${styles.skeleton}`} />
      <span className={styles.skeletonLine} style={{ width: 32 }} />
      <span className={styles.skeletonLine} style={{ flex: 1 }} />
      <span className={styles.skeletonLine} style={{ width: 64 }} />
    </div>
  );
}
