import styles from './PatrolDetailPanel.module.css';

const STATUS_COLOR = {
  patrolling: 'var(--safe)',
  responding: 'var(--warning)',
  'at scene': 'var(--danger)',
};

const STATUS_LABEL = {
  patrolling: 'PATROLLING',
  responding: 'RESPONDING',
  'at scene': 'AT SCENE',
};

// Mock badge numbers — keyed by officer name prefix
const BADGE_MAP = {
  'SI Priya Kumari':  'TN-2341', 'Const. Rajan M':    'TN-4892',
  'SI Meena Devi':    'TN-2342', 'Const. Selvam K':   'TN-4893',
  'SI Kavitha R':     'TN-2343', 'Const. Murugan S':  'TN-4894',
  'SI Lakshmi V':     'TN-2344', 'Const. Senthil P':  'TN-4895',
  'SI Divya S':       'TN-2345', 'Const. Arjun T':    'TN-4896',
  'SI Sangeetha N':   'TN-2346', 'Const. Karthi R':   'TN-4897',
  'SI Anitha B':      'TN-2347', 'Const. Vijay M':    'TN-4898',
  'SI Rekha C':       'TN-2348', 'Const. Suresh G':   'TN-4899',
  'SI Malathi D':     'TN-2349', 'Const. Prakash N':  'TN-4900',
  'SI Padma L':       'TN-2350', 'Const. Ramesh V':   'TN-4901',
  'SI Geetha M':      'TN-2351', 'Const. Kumar A':    'TN-4902',
  'SI Nithya P':      'TN-2352', 'Const. Balu S':     'TN-4903',
  'SI Vimala R':      'TN-2353', 'Const. Dinesh K':   'TN-4904',
  'SI Hema S':        'TN-2354', 'Const. Mohan T':    'TN-4905',
  'SI Saranya B':     'TN-2355', 'Const. Ganesh V':   'TN-4906',
  'SI Deepa M':       'TN-2356', 'Const. Siva R':     'TN-4907',
  'SI Jaya K':        'TN-2357', 'Const. Karthik N':  'TN-4908',
  'SI Radha P':       'TN-2358', 'Const. Balaji S':   'TN-4909',
};

function getRank(name) {
  if (name.startsWith('SI '))     return 'Sub-Inspector';
  if (name.startsWith('Const.')) return 'Constable';
  return 'Officer';
}

export default function PatrolDetailPanel({ patrol, onClose }) {
  if (!patrol) return null;

  const status    = patrol.status ?? 'patrolling';
  const statusCol = STATUS_COLOR[status] ?? 'var(--muted)';
  const statusLbl = STATUS_LABEL[status] ?? status.toUpperCase();

  return (
    <div className={`${styles.panel} ${patrol ? styles.open : ''}`}>
      {/* Header */}
      <div className={styles.hdr}>
        <span className={styles.title}>🚔 PATROL UNIT {patrol.id}</span>
        <button className={styles.close} onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className={styles.divider} />

      {/* Meta rows */}
      <div className={styles.rows}>
        <Row label="Vehicle"  value={patrol.vehicle} />
        <Row label="Zone"     value={patrol.zone} />
        <Row label="Pincode"  value={patrol.pincode ?? '—'} />
        <Row
          label="Status"
          value={<span style={{ color: statusCol, fontWeight: 700 }}>● {statusLbl}</span>}
        />
        <Row label="Contact"  value={patrol.contact} />
      </div>

      <div className={styles.divider} />

      {/* Officers */}
      <div className={styles.officersLbl}>OFFICERS ON DUTY</div>
      {patrol.officers?.map((name) => (
        <div key={name} className={styles.officer}>
          <span className={styles.officerIcon}>👮</span>
          <div className={styles.officerInfo}>
            <span className={styles.officerName}>{name}</span>
            <span className={styles.officerMeta}>
              {getRank(name)} · Badge {BADGE_MAP[name] ?? 'TN-XXXX'}
            </span>
          </div>
        </div>
      ))}

      <div className={styles.divider} />

      {/* Actions */}
      <div className={styles.actions}>
        <a
          className={styles.btnPrimary}
          href={`tel:${patrol.contact}`}
        >
          📞 Call
        </a>
        <button
          className={styles.btnSecondary}
          onClick={() => alert(`Message sent to ${patrol.id}`)}
        >
          💬 Message
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className={styles.row}>
      <span className={styles.rowKey}>{label}</span>
      <span className={styles.rowVal}>{value}</span>
    </div>
  );
}
