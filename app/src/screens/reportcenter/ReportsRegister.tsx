import { useState, type CSSProperties } from 'react';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { Dropdown } from '../../components/Dropdown';
import { Drawer, Modal } from '../../components/ui';
import type { RegReport } from '../../data/types';
import { REGST } from './shared';
import { LEGACY_YEAR, periodsForFreq, periodStatus, currentStatus, registerYears } from './reportPeriods';
import { pushUpdateReq } from '../member/workflow';

const PAGE = 15;
const regTh: CSSProperties = { padding: '12px 14px', fontSize: 11, color: '#7d867f', fontWeight: 700, textAlign: 'start' };

export function ReportsRegister() {
  const { t, tr, dl, lang } = useI18n();
  const RG = useStore((s) => s.data.regReports);
  const mutate = useStore((s) => s.mutate);
  const { showToast } = useToast();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);

  const [search, setSearch] = useState('');
  const [dept, setDept] = useState('');
  const [type, setType] = useState('');
  const [freq, setFreq] = useState('');
  const [resp, setResp] = useState('');
  const [status, setStatus] = useState('');
  const [late, setLate] = useState(false);
  const [year, setYear] = useState(LEGACY_YEAR);
  const [view, setView] = useState<'table' | 'periods'>('table');
  const [sel, setSel] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [dirId, setDirId] = useState<string | null>(null);
  const [dirDraft, setDirDraft] = useState('');

  const years = registerYears(RG);
  const regCur = (r: RegReport) => currentStatus(r, year);
  const isReceived = (s: string) => s === 'معتمد' || s === 'تم التسليم';
  const regNeedFollow = (s: string) => s === 'لم يستلم' || s === 'بانتظار الاعتماد' || s === 'قيد المراجعة';
  const cnt = (f: (r: RegReport) => boolean) => RG.filter(f).length;

  // KPIs (for the selected year)
  type KpiKind = 'all' | 'late' | 'freqShahri' | string;
  const kpis: { label: string; value: number; accent: string; fk: KpiKind }[] = [
    { label: rl('إجمالي التقارير', 'Total reports'), value: RG.length, accent: '#1f4a37', fk: 'all' },
    { label: rl('مستلمة / معتمدة', 'Received / approved'), value: cnt((r) => isReceived(regCur(r))), accent: '#2e7d55', fk: 'معتمد' },
    { label: rl('غير مستلمة', 'Not received'), value: cnt((r) => regCur(r) === 'لم يستلم'), accent: '#b0433b', fk: 'لم يستلم' },
    { label: rl('بانتظار الاعتماد', 'Pending approval'), value: cnt((r) => regCur(r) === 'بانتظار الاعتماد'), accent: '#a9791f', fk: 'بانتظار الاعتماد' },
    { label: rl('قيد المراجعة', 'Under review'), value: cnt((r) => regCur(r) === 'قيد المراجعة'), accent: '#3a6ea5', fk: 'قيد المراجعة' },
    { label: rl('متأخرة', 'Overdue'), value: cnt((r) => regCur(r) === 'لم يستلم'), accent: '#9a2f2a', fk: 'late' },
    { label: rl('مستحقة شهرياً', 'Monthly due'), value: cnt((r) => r.freq === 'شهري' && !isReceived(regCur(r)) && regCur(r) !== 'مدمج' && regCur(r) !== 'غير مطلوب'), accent: '#7a4d94', fk: 'freqShahri' },
  ];
  const kpiActive = (fk: KpiKind) => fk === 'all' ? (!status && !late && !freq) : fk === 'late' ? late : fk === 'freqShahri' ? freq === 'شهري' : status === fk;
  const clearBasics = () => { setDept(''); setType(''); setResp(''); setSearch(''); };
  const kpiClick = (fk: KpiKind) => {
    setLimit(PAGE);
    if (fk === 'all') { setStatus(''); setLate(false); setFreq(''); clearBasics(); }
    else if (fk === 'late') { setStatus(''); setLate(!late); setFreq(''); }
    else if (fk === 'freqShahri') { setStatus(''); setLate(false); setFreq(freq === 'شهري' ? '' : 'شهري'); }
    else { setStatus(status === fk ? '' : fk); setLate(false); setFreq(''); }
  };

  // decorate
  const decReg = (r: RegReport) => {
    const cur = regCur(r); const [cb, cf] = REGST[cur] || REGST['—'];
    const periods = periodsForFreq(r.freq).map((p) => {
      const s = periodStatus(r, year, p.key); const [b, f] = REGST[s] || REGST['—'];
      return { key: p.key, label: tr(p.label), short: s === '—' ? '—' : tr(s), bg: b, fg: f };
    });
    return { ...r, title: tr(r.title), type: tr(r.type), freq: tr(r.freq), resp: tr(r.resp), dept: tr(r.dept), due: tr(r.due),
      notes: r.notes ? tr(r.notes) : '—', approval: r.approval ? tr(r.approval) : '—', hasApproval: !!r.approval,
      curLabel: cur === '—' ? '—' : tr(cur), curBg: cb, curFg: cf, periods, lastDate: r.lastDate ? dl(r.lastDate) : '—', needsFollow: regNeedFollow(cur) };
  };

  const rq = search.trim();
  const filtered = RG.filter((r) => {
    const cur = regCur(r);
    if (dept && r.dept !== dept) return false;
    if (type && r.type !== type) return false;
    if (freq && r.freq !== freq) return false;
    if (resp && r.resp !== resp) return false;
    if (status && cur !== status) return false;
    if (late && cur !== 'لم يستلم') return false;
    if (rq && !(r.title.includes(rq) || r.type.includes(rq) || r.dept.includes(rq) || r.resp.includes(rq))) return false;
    return true;
  });
  const rowsAll = filtered.map(decReg);
  const rows = rowsAll.slice(0, limit);
  const needFollow = RG.filter((r) => regNeedFollow(regCur(r))).map(decReg);
  const selDetail = sel ? decReg(RG.find((r) => r.id === sel)!) : null;

  // actions — mark the latest tracked period of the selected year
  const latestKey = (r: RegReport) => {
    const ps = periodsForFreq(r.freq);
    if (!ps.length) return null;
    for (let i = ps.length - 1; i >= 0; i--) if (periodStatus(r, year, ps[i].key) !== '—') return ps[i].key;
    return ps[0].key;
  };
  const setLatest = (id: string, st: string) => mutate((d) => {
    const r = d.regReports.find((x) => x.id === id); if (!r) return;
    const k = latestKey(r); if (!k) return;
    r.periods = r.periods || {}; r.periods[year] = r.periods[year] || {}; r.periods[year][k] = st;
  });
  const reqUpdate = (id: string) => { mutate((d) => { const r = d.regReports.find((x) => x.id === id); if (r) pushUpdateReq(d, { owner: r.resp, title: r.title, section: 'reportLog' }); }); showToast(rl('تم إرسال طلب تحديث — وصل إشعارٌ للمسؤول', 'Update request sent — the owner was notified')); };
  const markReceived = (id: string) => { setLatest(id, 'تم التسليم'); showToast(rl('تم وضع علامة: تم الاستلام', 'Marked received')); };
  const markApproved = (id: string) => { setLatest(id, 'معتمد'); showToast('تم وضع علامة: معتمد'); };
  const saveDirective = () => {
    const txt = dirDraft.trim();
    if (!txt || !dirId) { setDirId(null); return; }
    mutate((d) => { const r = d.regReports.find((x) => x.id === dirId); if (r) r.notes = (r.notes ? r.notes + ' — ' : '') + txt; });
    showToast(rl('تمت إضافة التوجيه', 'Directive added'));
    setDirId(null); setDirDraft('');
  };

  const uniq = (k: keyof RegReport) => [...new Set(RG.map((r) => r[k]).filter(Boolean) as string[])];
  const deptOpts = [{ v: '', label: rl('كل الإدارات', 'All departments') }, ...uniq('dept').map((d) => ({ v: d, label: tr(d) }))];
  const typeOpts = [{ v: '', label: rl('كل الأنواع', 'All types') }, ...uniq('type').map((d) => ({ v: d, label: tr(d) }))];
  const freqOpts = [{ v: '', label: rl('كل الدوريات', 'All frequencies') }, ...uniq('freq').map((d) => ({ v: d, label: tr(d) }))];
  const respOpts = [{ v: '', label: rl('كل المسؤولين', 'All owners') }, ...uniq('resp').map((d) => ({ v: d, label: tr(d) }))];
  const statusOpts = [{ v: '', label: t('allStatuses') }, ...['معتمد', 'تم التسليم', 'بانتظار الاعتماد', 'لم يستلم', 'قيد المراجعة', 'مدمج', 'غير مطلوب'].map((s) => ({ v: s, label: tr(s) }))];
  const ddBg = '#f9faf8';

  const viewBtn = (on: boolean): CSSProperties => ({ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid ' + (on ? '#1f4a37' : '#e2e6df'), background: on ? '#1f4a37' : '#fff', color: on ? '#fff' : '#7d867f' });

  return (
    <div style={{ animation: 'fadeUp .16s ease' }}>
      {/* header */}
      <div style={{ background: 'linear-gradient(120deg,#132b20,#1f4a37 55%,#2b5c44)', borderRadius: 22, padding: '22px 26px', color: '#eaf1ec', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ width: 50, height: 50, flex: 'none', borderRadius: 14, background: 'rgba(233,200,119,.18)', color: '#e9c877', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"></path></svg></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('reg_title')}</h2>
          <div style={{ fontSize: 12.5, color: '#bcd2c3', marginTop: 3 }}>{t('reg_intro')}</div>
        </div>
        {/* year filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: 'rgba(255,255,255,.08)', borderRadius: 12, padding: 5 }}>
          {years.map((y) => {
            const on = y === year;
            return <button key={y} onClick={() => { setYear(y); setLimit(PAGE); }} style={{ borderRadius: 9, padding: '7px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none', background: on ? '#e9c877' : 'transparent', color: on ? '#132b20' : '#cfe0d5' }}>{y}</button>;
          })}
        </div>
      </div>

      {/* KPI cards */}
      <div className="regkpi" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 12, marginBottom: 20 }}>
        {kpis.map((k) => {
          const active = kpiActive(k.fk);
          return (
            <div key={k.fk + k.label} onClick={() => kpiClick(k.fk)} style={{ background: active ? '#f6faf7' : '#fff', borderRadius: 16, padding: '16px 18px', boxShadow: '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.25)', cursor: 'pointer', borderTop: '3px solid ' + (active ? k.accent : 'transparent'), outline: active ? '2px solid ' + k.accent : '1px solid #eef1ec', outlineOffset: -1 }}>
              <div style={{ fontSize: 11, color: '#7d867f', fontWeight: 600, marginBottom: 8, lineHeight: 1.4, minHeight: 30 }}>{k.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.accent }}>{k.value}</div>
            </div>
          );
        })}
      </div>

      {/* reports needing follow-up */}
      {needFollow.length > 0 && (
        <div style={{ background: '#fff', borderRadius: 18, padding: '18px 20px', boxShadow: '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.22)', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><span style={{ width: 8, height: 22, borderRadius: 6, background: '#b0433b', flex: 'none' }}></span><h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#17211c' }}>{t('reg_needFollow')}</h3><span style={{ fontSize: 11, fontWeight: 700, color: '#b0433b', background: '#faf0ef', borderRadius: 20, padding: '2px 9px' }}>{needFollow.length}</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12, maxHeight: 340, overflowY: 'auto' }}>
            {needFollow.map((r) => (
              <div key={r.id} style={{ background: '#faf8f5', borderRadius: 13, padding: '13px 15px', borderInlineStart: '3px solid ' + r.curFg }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.45 }}>{r.title}</div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: r.curFg, background: r.curBg, borderRadius: 20, padding: '3px 8px', whiteSpace: 'nowrap', flex: 'none' }}>{r.curLabel}</span>
                </div>
                <div style={{ fontSize: 11, color: '#7d867f', marginBottom: 10 }}>{r.dept} · {r.resp} · {r.freq}</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  <button onClick={() => reqUpdate(r.id)} style={{ background: "#f0f2ee", color: '#3a6ea5', border: 'none', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('reg_reqUpdate')}</button>
                  <button onClick={() => markReceived(r.id)} style={{ background: '#e2f0e8', color: '#2e7d55', border: 'none', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('reg_markReceived')}</button>
                  <button onClick={() => setSel(r.id)} style={{ background: '#fff', color: '#7d867f', border: '1px solid #e2e6df', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('rc_view')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* filters + view toggle */}
      <div style={{ background: '#fff', borderRadius: 16, padding: '15px 18px', boxShadow: '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.22)', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setLimit(PAGE); }} placeholder={t('reg_report') + '…'} style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', borderRadius: 9, padding: '9px 13px', fontSize: 12.5, fontFamily: 'inherit', background: '#f9faf8' }} />
          </div>
          <Dropdown value={dept} options={deptOpts} onChange={(v) => { setDept(v); setLimit(PAGE); }} opt={{ size: 'sm', minWidth: '120px', bg: ddBg, popMaxWidth: '340px' }} />
          <Dropdown value={type} options={typeOpts} onChange={(v) => { setType(v); setLimit(PAGE); }} opt={{ size: 'sm', minWidth: '112px', bg: ddBg }} />
          <Dropdown value={freq} options={freqOpts} onChange={(v) => { setFreq(v); setLimit(PAGE); }} opt={{ size: 'sm', minWidth: '110px', bg: ddBg }} />
          <Dropdown value={resp} options={respOpts} onChange={(v) => { setResp(v); setLimit(PAGE); }} opt={{ size: 'sm', minWidth: '120px', bg: ddBg }} />
          <Dropdown value={status} options={statusOpts} onChange={(v) => { setStatus(v); setLimit(PAGE); }} opt={{ size: 'sm', minWidth: '116px', bg: ddBg }} />
          <button onClick={() => { setLate(!late); setLimit(PAGE); }} style={{ display: 'flex', alignItems: 'center', gap: 6, borderRadius: 9, padding: '9px 13px', fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (late ? '#b0433b' : '#e2e6df'), background: late ? '#faf0ef' : '#fff', color: late ? '#b0433b' : '#7d867f' }}>{t('reg_late')}</button>
          <div style={{ flex: 1 }}></div>
          <div style={{ display: 'flex', gap: 7 }}>
            <button onClick={() => setView('table')} style={viewBtn(view === 'table')}>{t('reg_tableView')}</button>
            <button onClick={() => setView('periods')} style={viewBtn(view === 'periods')}>{rl('حسب الفترات', 'By period')}</button>
          </div>
        </div>
      </div>

      {/* table view */}
      {view === 'table' && (
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.22)', overflow: 'hidden' }}>
          {/* phone: register rows as cards */}
          <div className="mob-only" style={{ flexDirection: 'column', gap: 10, padding: 12 }}>
            {rows.map((r) => (
              <div key={r.id} style={{ border: '1px solid #eef1ec', borderRadius: 14, padding: '13px 14px', background: '#fbfcfa', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, fontWeight: 700, color: '#17211c', lineHeight: 1.5 }}>{r.title}</div>
                  <span style={{ flex: 'none', fontSize: 10, fontWeight: 700, color: r.curFg, background: r.curBg, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{r.curLabel}</span>
                </div>
                <div style={{ fontSize: 11, color: '#7d867f' }}>{r.type} · {r.freq} · {r.dept}</div>
                <div style={{ fontSize: 11, color: '#9aa39b' }}>{r.resp}{r.lastDate !== '—' ? ' · ' + r.lastDate : ''}</div>
                <button onClick={() => setSel(r.id)} style={{ alignSelf: 'flex-start', background: '#1f4a37', color: '#fff', border: 'none', borderRadius: 9, padding: '9px 16px', fontSize: 11.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', minHeight: 38 }}>{t('rc_view')}</button>
              </div>
            ))}
            {rowsAll.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('noResults')}</div>}
          </div>
          <div className="desk-only" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><tr style={{ background: '#f6f8f4' }}>
                <th style={regTh}>{t('reg_report')}</th><th style={regTh}>{t('reg_type')}</th><th style={regTh}>{t('reg_freq')}</th><th style={regTh}>{t('reg_resp')}</th><th style={regTh}>{t('reg_dept')}</th><th style={regTh}>{t('reg_status')} ({year})</th><th style={regTh}>{t('reg_lastDate')}</th><th style={regTh}>{t('reg_action')}</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => setSel(r.id)} style={{ borderTop: '1px solid #f2f4f0', cursor: 'pointer' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 600, color: '#17211c', maxWidth: 320 }}>{r.title}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#7d867f' }}>{r.type}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#7d867f' }}>{r.freq}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#7d867f' }}>{r.resp}</td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#7d867f' }}>{r.dept}</td>
                    <td style={{ padding: '12px 14px' }}><span style={{ fontSize: 10.5, fontWeight: 700, color: r.curFg, background: r.curBg, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>{r.curLabel}</span></td>
                    <td style={{ padding: '12px 14px', fontSize: 11.5, color: '#7d867f' }}>{r.lastDate}</td>
                    <td style={{ padding: '12px 14px' }}><button onClick={(e) => { e.stopPropagation(); setSel(r.id); }} style={{ background: '#f0f2ee', color: '#1f4a37', border: 'none', borderRadius: 8, padding: '6px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>{t('rc_view')}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rowsAll.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('noResults')}</div>}
          {limit < rowsAll.length && (
            <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid #f2f4f0' }}>
              <button onClick={() => setLimit(limit + PAGE)} style={{ background: '#f0f2ee', color: '#1f4a37', border: '1px solid #e2e6df', borderRadius: 10, padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{rl('عرض المزيد', 'Show more')} ({rowsAll.length - limit})</button>
            </div>
          )}
        </div>
      )}

      {/* by-period view: each report shows its own frequency's periods for the selected year */}
      {view === 'periods' && (
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.22)', overflow: 'hidden' }}>
          {rows.map((r) => (
            <div key={r.id} onClick={() => setSel(r.id)} style={{ borderTop: '1px solid #f2f4f0', padding: '13px 16px', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: '#17211c' }}>{r.title}</span>
                <span style={{ fontSize: 10.5, color: '#9aa39b' }}>{r.freq} · {r.dept}</span>
                <span style={{ marginInlineStart: 'auto', fontSize: 10, fontWeight: 700, color: r.curFg, background: r.curBg, borderRadius: 20, padding: '3px 10px' }}>{r.curLabel}</span>
              </div>
              {r.periods.length === 0
                ? <span style={{ fontSize: 11, color: '#b8bfb6' }}>{rl('حسب الحاجة — لا فترات ثابتة', 'On demand — no fixed periods')}</span>
                : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {r.periods.map((m) => (
                      <span key={m.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: m.fg, background: m.bg, borderRadius: 8, padding: '4px 9px' }}>
                        <span style={{ color: '#9aa39b', fontWeight: 600 }}>{m.label}</span>{m.short}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          ))}
          {rowsAll.length === 0 && <div style={{ padding: 36, textAlign: 'center', color: '#9aa39b', fontSize: 13 }}>{t('noResults')}</div>}
          {limit < rowsAll.length && (
            <div style={{ padding: '14px', textAlign: 'center', borderTop: '1px solid #f2f4f0' }}>
              <button onClick={() => setLimit(limit + PAGE)} style={{ background: '#f0f2ee', color: '#1f4a37', border: '1px solid #e2e6df', borderRadius: 10, padding: '9px 20px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{rl('عرض المزيد', 'Show more')} ({rowsAll.length - limit})</button>
            </div>
          )}
        </div>
      )}

      {/* register detail drawer */}
      <Drawer open={!!selDetail} onClose={() => setSel(null)} width={460}>
        {selDetail && (
          <div style={{ background: '#f6f8f4', minHeight: '100%' }}>
            <div style={{ background: 'linear-gradient(120deg,#132b20,#1f4a37)', padding: '22px 24px', color: '#eaf1ec', position: 'sticky', top: 0, zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: selDetail.curFg, background: selDetail.curBg, borderRadius: 20, padding: '4px 11px' }}>{selDetail.curLabel}</span>
                <button onClick={() => setSel(null)} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800, lineHeight: 1.5 }}>{selDetail.title}</h2>
              <div style={{ fontSize: 12, color: '#bcd2c3', marginTop: 6 }}>{selDetail.type} · {selDetail.freq} · {year}</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => reqUpdate(selDetail.id)} style={{ background: "#1e4634", color: '#fff', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('reg_reqUpdate')}</button>
                <button onClick={() => markReceived(selDetail.id)} style={{ background: '#e2f0e8', color: '#2e7d55', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('reg_markReceived')}</button>
                <button onClick={() => markApproved(selDetail.id)} style={{ background: '#fbf0d6', color: '#a9791f', border: 'none', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('reg_markApproved')}</button>
                <button onClick={() => { setDirId(selDetail.id); setDirDraft(''); }} style={{ background: '#fff', color: '#7d867f', border: '1px solid #e2e6df', borderRadius: 9, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('reg_addDirective')}</button>
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 11 }}>
                <Row label={t('reg_resp')} value={selDetail.resp} />
                <Row label={t('reg_dept')} value={selDetail.dept} />
                <Row label={t('reg_freq')} value={selDetail.freq} />
                <Row label={t('reg_due')} value={selDetail.due} />
                <Row label={t('reg_lastDate')} value={selDetail.lastDate} />
                {selDetail.hasApproval && <Row label={t('reg_approval')} value={selDetail.approval} valueColor="#7a4d94" />}
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#17211c' }}>{rl('سجل الاستلام', 'Receipt log')} — {year}</h4>
                {selDetail.periods.length === 0
                  ? <div style={{ fontSize: 12, color: '#7d867f' }}>{rl('حسب الحاجة — لا فترات ثابتة', 'On demand — no fixed periods')}</div>
                  : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                      {selDetail.periods.map((m) => (
                        <div key={m.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><span style={{ fontSize: 12, color: '#7d867f' }}>{m.label}</span><span style={{ fontSize: 10.5, fontWeight: 700, color: m.fg, background: m.bg, borderRadius: 20, padding: '3px 11px' }}>{m.short}</span></div>
                      ))}
                    </div>
                  )}
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px' }}>
                <h4 style={{ margin: '0 0 10px', fontSize: 13, fontWeight: 800, color: '#17211c' }}>{t('reg_notes')}</h4>
                <div style={{ fontSize: 12, color: '#5b6b62', lineHeight: 1.65 }}>{selDetail.notes}</div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      <Modal open={dirId !== null} onClose={() => setDirId(null)} width={460}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16.5, fontWeight: 700, color: '#17211c' }}>{t('reg_addDirective')}</h3>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#9aa39b' }}>{rl('يُضاف التوجيه إلى ملاحظات التقرير ويظهر للمسؤول عنه.', 'The directive is appended to the report notes and shown to its owner.')}</p>
        <textarea value={dirDraft} onChange={(e) => setDirDraft(e.target.value)} rows={4} autoFocus
          placeholder={rl('اكتب التوجيه…', 'Write the directive…')}
          style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e2e6df', background: '#f7f8f6', borderRadius: 11, padding: '11px 13px', fontSize: 13, fontFamily: 'inherit', color: '#17211c', outline: 'none', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
          <button onClick={() => setDirId(null)} style={{ background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 10, padding: '10px 16px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إلغاء', 'Cancel')}</button>
          <button onClick={saveDirective} style={{ background: '#1e4634', border: 'none', color: '#fff', borderRadius: 10, padding: '10px 18px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('حفظ التوجيه', 'Save directive')}</button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ label, value, valueColor = '#17211c' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}><span style={{ color: '#9aa39b' }}>{label}</span><b style={{ color: valueColor }}>{value}</b></div>
  );
}
