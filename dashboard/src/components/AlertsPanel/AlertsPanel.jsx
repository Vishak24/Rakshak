import { useState, useEffect, useRef } from 'react';
import styles from './AlertsPanel.module.css';

const RISK_LABELS = {
  en: { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' },
  ta: { HIGH: 'அதிக ஆபத்து', MEDIUM: 'நடுத்தர', LOW: 'குறைந்த' },
};

function timeAgo(ts) {
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)   return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function AlertsPanel({ events, loading, lang }) {
  const title = lang === 'ta' ? 'நேரடி SOS பீட்' : 'LIVE SOS FEED';
  const [showAll, setShowAll] = useState(false);
  const [visibleIds, setVisibleIds] = useState(null);
  const timerRefs = useRef({});

  // Auto-remove resolved events after 2 minutes
  useEffect(() => {
    if (!events) return;

    const resolved = events.filter((ev) => ev.status === 'resolved');
    resolved.forEach((ev) => {
      if (timerRefs.current[ev.id]) return; // already scheduled
      timerRefs.current[ev.id] = setTimeout(() => {
        setVisibleIds((prev) => {
          const next = new Set(prev ?? events.map((e) => e.id));
          next.delete(ev.id);
          return next;
        });
        delete timerRefs.current[ev.id];
      }, 2 * 60 * 1000);
    });

    // Clean up timers for events that are no longer resolved
    return () => {
      // Only clear on unmount
    };
  }, [events]);

  // Reset visibleIds when events list changes (new data)
  useEffect(() => {
    setVisibleIds(null);
  }, [events]);

  const allEvents = events ?? [];
  const filtered = visibleIds
    ? allEvents.filter((ev) => visibleIds.has(ev.id))
    : allEvents;

  const displayed = showAll ? filtered : filtered.slice(0, 5);
  const hasMore   = filtered.length > 5;
  const count     = filtered.length;

  return (
    <aside className={styles.panel}>
      <div className={styles.hdr}>
        <div className={styles.pulse} />
        <span className={styles.title}>{title}</span>
        <span className={styles.badge}>{count}</span>
      </div>

      <div className={styles.list} style={showAll ? { maxHeight: 256, overflowY: 'auto' } : {}}>
        {loading && !events && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {!loading && !events && (
          <div className={styles.empty}>No live feed available</div>
        )}

        {displayed.map((ev, i) => (
          <EventCard
            key={ev.id}
            ev={ev}
            fresh={i === 0 && !showAll}
            lang={lang}
            dimmed={ev.status === 'resolved'}
          />
        ))}
      </div>

      {hasMore && (
        <button
          className={styles.viewAllBtn}
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? '↑ Show Less' : `View All → (${filtered.length})`}
        </button>
      )}
    </aside>
  );
}

function EventCard({ ev, fresh, lang, dimmed }) {
  const riskLabel = RISK_LABELS[lang]?.[ev.risk] ?? ev.risk;
  const pillLabel =
    ev.status === 'resolved'  ? 'Resolved'   :
    ev.status === 'resolving' ? 'Resolving'  :
    'Dispatched';

  return (
    <div
      className={`${styles.evt} ${fresh ? styles.fresh : ''}`}
      style={{ opacity: dimmed ? 0.4 : 1, transition: 'opacity 0.3s' }}
    >
      <div className={styles.evtTop}>
        <span className={styles.evtLoc}>{ev.location}</span>
        <span className={`${styles.riskBadge} ${styles[ev.risk?.toLowerCase()]}`}>{riskLabel}</span>
      </div>
      <div className={styles.evtBot}>
        <span className={styles.evtTime}>{timeAgo(ev.timestamp)}</span>
        <span className={`${styles.pill} ${styles[ev.status ?? 'dispatched']}`}>{pillLabel}</span>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className={`${styles.evt} ${styles.skeletonCard}`}>
      <div className={styles.skeletonLine} style={{ width: '60%', marginBottom: 8 }} />
      <div className={styles.skeletonLine} style={{ width: '40%' }} />
    </div>
  );
}
