import React from 'react'
import s from './StatsCard.module.css'
import { ZONES } from '../../constants/zones'

export default function StatsRow({ apiData, sosTotal, lang }) {
  const highCount = apiData
    ? ZONES.filter(z => (apiData.get(z.c)?.riskLevel ?? z.r) === 'HIGH').length
    : null

  return (
    <div className={s.row}>
      {/* SOS Today */}
      <div className={s.card}>
        <div className={`${s.ico} ${s.d}`}>
          <svg viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </div>
        <div>
          <div className={`${s.val} ${s.d}`}>{sosTotal ?? 0}</div>
          <div className={s.lbl}>{lang === 'ta' ? 'இன்று SOS' : 'SOS Today'}</div>
        </div>
      </div>

      {/* High Risk Zones */}
      <div className={s.card}>
        <div className={`${s.ico} ${s.w}`}>
          <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        </div>
        <div>
          <div className={`${s.val} ${s.w}`}>{highCount ?? '—'}</div>
          <div className={s.lbl}>{lang === 'ta' ? 'அதிக ஆபத்து மண்டலங்கள்' : 'High Risk Zones'}</div>
        </div>
      </div>

      {/* Avg Response */}
      <div className={s.card}>
        <div className={`${s.ico} ${s.s}`}>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>
        </div>
        <div>
          <div className={`${s.val} ${s.s}`}>6.2 <span style={{fontSize:13,fontWeight:500}}>min</span></div>
          <div className={s.lbl}>{lang === 'ta' ? 'சராசரி மறுமொழி நேரம்' : 'Avg Response Time'}</div>
        </div>
      </div>
    </div>
  )
}
