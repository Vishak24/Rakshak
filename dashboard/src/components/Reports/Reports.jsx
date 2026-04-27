import { useState, useCallback } from 'react';
import styles from './Reports.module.css';

const COLUMNS = [
  { key: 'pincode',               label: 'Pincode',              sticky: true },
  { key: 'lateNightFootfall',     label: 'Late Night Footfall'   },
  { key: 'streetLighting',        label: 'Street Lighting'       },
  { key: 'cctvCoverage',          label: 'CCTV Coverage'         },
  { key: 'patrolFrequency',       label: 'Patrol Frequency'      },
  { key: 'reportedIncidents',     label: 'Reported Incidents'    },
  { key: 'eveTeasing',            label: 'Eve Teasing'           },
  { key: 'theftCases',            label: 'Theft Cases'           },
  { key: 'assaultCases',          label: 'Assault Cases'         },
  { key: 'drunkDisorderly',       label: 'Drunk & Disorderly'    },
  { key: 'abandonedProperties',   label: 'Abandoned Properties'  },
  { key: 'publicTransport',       label: 'Public Transport'      },
  { key: 'safeHouses',            label: 'Safe Houses'           },
  { key: 'responseTime',          label: 'Response Time (min)'   },
  { key: 'communityWatch',        label: 'Community Watch'       },
  { key: 'drugActivity',          label: 'Drug Activity'         },
  { key: 'harassmentComplaints',  label: 'Harassment Complaints' },
  { key: 'overallSafetyScore',    label: 'Overall Safety Score'  },
];

const INITIAL_DATA = [
  { pincode: '600001', lateNightFootfall: 85, streetLighting: 60, cctvCoverage: 70, patrolFrequency: 8, reportedIncidents: 42, eveTeasing: 12, theftCases: 18, assaultCases: 6, drunkDisorderly: 9, abandonedProperties: 4, publicTransport: 7, safeHouses: 2, responseTime: 8, communityWatch: 1, drugActivity: 5, harassmentComplaints: 14, overallSafetyScore: 38 },
  { pincode: '600006', lateNightFootfall: 72, streetLighting: 55, cctvCoverage: 60, patrolFrequency: 6, reportedIncidents: 35, eveTeasing: 10, theftCases: 14, assaultCases: 5, drunkDisorderly: 7, abandonedProperties: 6, publicTransport: 6, safeHouses: 1, responseTime: 10, communityWatch: 0, drugActivity: 7, harassmentComplaints: 11, overallSafetyScore: 42 },
  { pincode: '600007', lateNightFootfall: 68, streetLighting: 50, cctvCoverage: 55, patrolFrequency: 5, reportedIncidents: 38, eveTeasing: 9, theftCases: 16, assaultCases: 7, drunkDisorderly: 8, abandonedProperties: 5, publicTransport: 5, safeHouses: 1, responseTime: 12, communityWatch: 0, drugActivity: 9, harassmentComplaints: 13, overallSafetyScore: 36 },
  { pincode: '600058', lateNightFootfall: 78, streetLighting: 58, cctvCoverage: 65, patrolFrequency: 7, reportedIncidents: 40, eveTeasing: 11, theftCases: 17, assaultCases: 5, drunkDisorderly: 10, abandonedProperties: 3, publicTransport: 8, safeHouses: 2, responseTime: 9, communityWatch: 1, drugActivity: 6, harassmentComplaints: 12, overallSafetyScore: 40 },
  { pincode: '600081', lateNightFootfall: 55, streetLighting: 45, cctvCoverage: 40, patrolFrequency: 4, reportedIncidents: 28, eveTeasing: 7, theftCases: 11, assaultCases: 4, drunkDisorderly: 6, abandonedProperties: 8, publicTransport: 4, safeHouses: 1, responseTime: 15, communityWatch: 0, drugActivity: 11, harassmentComplaints: 9, overallSafetyScore: 44 },
];

function makeBlankRow() {
  const row = { pincode: '' };
  COLUMNS.forEach((c) => { if (c.key !== 'pincode') row[c.key] = ''; });
  return row;
}

export default function Reports({ lang }) {
  const [zonesData, setZonesData] = useState(INITIAL_DATA);
  const [editCell, setEditCell]   = useState(null); // { rowIdx, key }
  const [saveState, setSaveState] = useState({});   // { [rowIdx]: 'ok' | 'err' | 'saving' }

  const handleChange = useCallback((rowIdx, key, value) => {
    setZonesData((prev) => {
      const next = [...prev];
      next[rowIdx] = { ...next[rowIdx], [key]: value };
      return next;
    });
  }, []);

  const handleSave = useCallback(async (rowIdx) => {
    setSaveState((s) => ({ ...s, [rowIdx]: 'saving' }));
    try {
      const res = await fetch('/api/reports/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zonesData[rowIdx]),
      });
      setSaveState((s) => ({ ...s, [rowIdx]: res.ok ? 'ok' : 'err' }));
    } catch {
      setSaveState((s) => ({ ...s, [rowIdx]: 'err' }));
    }
  }, [zonesData]);

  const addZone = () => {
    setZonesData((prev) => [...prev, makeBlankRow()]);
  };

  const title = lang === 'ta' ? 'மண்டல அறிக்கைகள்' : 'Zone Reports';

  return (
    <div className={styles.container}>
      <div className={styles.topBar}>
        <h2 className={styles.heading}>{title}</h2>
        <button className={styles.addBtn} onClick={addZone}>+ Add Zone</button>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={`${styles.th} ${col.sticky ? styles.stickyCol : ''}`}
                >
                  {col.label}
                </th>
              ))}
              <th className={styles.th}>Save</th>
            </tr>
          </thead>
          <tbody>
            {zonesData.map((row, rowIdx) => (
              <tr key={rowIdx} className={styles.tr}>
                {COLUMNS.map((col) => {
                  const isEditing = editCell?.rowIdx === rowIdx && editCell?.key === col.key;
                  return (
                    <td
                      key={col.key}
                      className={`${styles.td} ${col.sticky ? styles.stickyCol : ''}`}
                      onClick={() => setEditCell({ rowIdx, key: col.key })}
                    >
                      {isEditing ? (
                        <input
                          className={styles.cellInput}
                          autoFocus
                          value={row[col.key] ?? ''}
                          onChange={(e) => handleChange(rowIdx, col.key, e.target.value)}
                          onBlur={() => setEditCell(null)}
                          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditCell(null); }}
                        />
                      ) : (
                        <span className={styles.cellVal}>{row[col.key] ?? ''}</span>
                      )}
                    </td>
                  );
                })}
                <td className={styles.td}>
                  <div className={styles.saveCell}>
                    <button
                      className={styles.saveBtn}
                      onClick={() => handleSave(rowIdx)}
                      disabled={saveState[rowIdx] === 'saving'}
                    >
                      {saveState[rowIdx] === 'saving' ? '…' : 'Save'}
                    </button>
                    {saveState[rowIdx] === 'ok'  && <span className={styles.badgeOk}>✅</span>}
                    {saveState[rowIdx] === 'err' && <span className={styles.badgeErr}>❌</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
