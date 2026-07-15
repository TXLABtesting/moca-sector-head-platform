import { useState, type CSSProperties } from 'react';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { useToast } from '../../components/Toast';
import { Drawer } from '../../components/ui';
import { entColors, agingColors, agingRisk, fmt, pct } from './shared';

const sectionHead = (barColor: string, title: string, note?: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 13 }}>
    <span style={{ width: 8, height: 24, borderRadius: 6, background: barColor, flex: 'none' }}></span>
    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#17211c' }}>{title}</h3>
    {note && <span style={{ fontSize: 11.5, color: '#9aa39b', fontWeight: 600 }}>· {note}</span>}
  </div>
);
const cardSh = '0 1px 2px rgba(23,40,32,.04),0 12px 26px -18px rgba(23,40,32,.22)';
const finTh: CSSProperties = { padding: '11px 16px', fontSize: 11, color: '#7d867f', fontWeight: 700, textAlign: 'start' };

export function FinancialSummary() {
  const { t, tr, lang } = useI18n();
  const FM = useStore((s) => s.data.finModel);
  const { showToast } = useToast();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const mAED = (v: number) => rl(fmt(v) + ' م.د', fmt(v) + 'M');

  const [selEntity, setSelEntity] = useState<string | null>(null);
  const [selAging, setSelAging] = useState<string | null>(null);

  const finUtil = pct(FM.used, FM.budget);
  const entityCards = FM.entities.map((e) => {
    const u = pct(e.used, e.alloc);
    const col = entColors[e.code] || '#1f4a37';
    return { code: e.code, name: tr(e.name), alloc: mAED(e.alloc), used: mAED(e.used), due: mAED(e.due), util: u, utilLabel: u + '%', color: col, hasOverdue: e.overdue > 0, overdueLabel: rl(e.overdue + ' عقد متأخر', e.overdue + ' overdue') };
  });
  const finCommit = { paid: mAED(FM.commitPaid), due: mAED(FM.commitDue), total: mAED(FM.commit), paidPct: pct(FM.commitPaid, FM.commit), duePct: pct(FM.commitDue, FM.commit) };
  const expBlocks = [
    { label: rl('المصروفات التشغيلية', 'Operating expenses'), expected: FM.opex.expected, paid: FM.opex.paid, accent: '#3a6ea5' },
    { label: rl('المصروفات الرأسمالية', 'Capital expenses'), expected: FM.capex.expected, paid: FM.capex.paid, accent: '#7a4d94' },
  ].map((b) => { const due = b.expected - b.paid; const sp = pct(b.paid, b.expected); return { label: b.label, accent: b.accent, expected: mAED(b.expected), paid: mAED(b.paid), due: mAED(due), spentLabel: sp + '%' }; });
  const finBigProjects = FM.bigProjects.map((p) => {
    const sp = pct(p.paid, p.alloc); const col = entColors[p.entity || ''] || '#1f4a37';
    return { name: tr(p.name), entity: p.entity, alloc: mAED(p.alloc), paid: mAED(p.paid), remain: mAED(p.alloc - p.paid), spentLabel: sp + '%', color: col,
      statusLabel: sp >= 80 ? rl('صرف مرتفع', 'High spend') : sp >= 40 ? rl('ضمن الخطة', 'On track') : rl('صرف منخفض', 'Low spend'),
      statusBg: sp >= 80 ? '#faf0ef' : sp >= 40 ? '#e2f0e8' : '#fbf0d6', statusFg: sp >= 80 ? '#b0433b' : sp >= 40 ? '#2e7d55' : '#a9791f' };
  });
  const relRows = FM.related.map((r) => { const total = r.items.reduce((s, x) => s + x.v, 0); return { from: r.from, to: r.to, fromColor: entColors[r.from] || '#5b6b62', toColor: entColors[r.to] || '#5b6b62', totalLabel: fmt(total), items: r.items.map((x) => ({ n: tr(x.n), v: fmt(x.v) })) }; });
  const relT = FM.relTotals;
  const relTotalCards = [
    { label: rl('إجمالي الأرصدة بين الجهات', 'Total inter-entity balances'), value: fmt(relT.allPeriods), accent: '#1f4a37' },
    { label: rl('إجمالي جارى التسوية', 'Total under settlement'), value: fmt(relT.settling), accent: '#7a4d94' },
    { label: rl('عقود مرحلة من العام السابق', 'Prior-year carried contracts'), value: fmt(relT.prior), accent: '#a9791f' },
    { label: rl('أرصدة العام الحالي (عقود – رواتب)', 'Current-year balances'), value: fmt(relT.current), accent: '#3a6ea5' },
  ];
  const finAging = FM.aging.map((a, i) => {
    const total = a.items.reduce((s, x) => s + x.amount, 0); const supp = new Set(a.items.map((x) => x.supplier)).size;
    const [rb, rf] = agingRisk[a.risk] || ['#eee', '#555']; const sel = selAging === a.bucket;
    return { bucket: a.bucket, bucketLabel: rl(a.bucket + ' يوم', a.bucket + ' d'), total: fmt(total), suppliers: supp, contracts: a.items.length, riskLabel: tr(a.risk), riskBg: rb, riskFg: rf, color: agingColors[i] || '#b0433b', cardBg: sel ? '#1f4a37' : '#fff', cardFg: sel ? '#fff' : '#17211c' };
  });
  const agingSel = (() => { if (!selAging) return null; const a = FM.aging.find((x) => x.bucket === selAging); if (!a) return null; return { bucketLabel: rl(a.bucket + ' يوم', '(' + a.bucket + ' days)'), rows: a.items.map((x) => ({ supplier: tr(x.supplier), num: x.num, entity: x.entity, entColor: entColors[x.entity] || '#5b6b62', contract: x.contract, amount: fmt(x.amount), status: tr(x.status), notes: x.notes ? tr(x.notes) : '—' })) }; })();
  const agingTotal = FM.aging.reduce((s, a) => s + a.items.reduce((t2, x) => t2 + x.amount, 0), 0);
  const over60 = FM.aging.slice(2).reduce((s, a) => s + a.items.reduce((t2, x) => t2 + x.amount, 0), 0);
  const finBankInterest = [
    { label: rl('إجمالي الفوائد البنكية اليومية المحصلة على الحسابات للجهات', 'Total daily bank interest collected on entity accounts'), value: fmt(1192902), bg: '#eaf3ee', dot: '#2e7d55' },
    { label: rl('إجمالي الفوائد البنكية المحصلة على الودائع الثابتة للجهات', 'Total bank interest collected on entity fixed deposits'), value: fmt(2265002), bg: '#e9f0f6', dot: '#3a6ea5' },
    { label: rl('إجمالي الودائع الثابتة الجارية خلال الربع الحالي', 'Total active fixed deposits during the current quarter'), value: fmt(200343098), bg: '#f3ecf6', dot: '#7a4d94' },
  ];
  const finRisks = [
    { label: rl('الجهة الأعلى استخداماً للميزانية', 'Highest budget utilisation'), value: 'MOCA · ' + pct(FM.entities[0].used, FM.entities[0].alloc) + '%', tone: 'gold' },
    { label: rl('الأعلى مستحقات دفع', 'Highest payable'), value: 'MOCA · ' + mAED(FM.entities[0].due), tone: 'red' },
    { label: rl('عقود متجاوزة أكثر من 60 يوم', 'Contracts overdue >60 days'), value: fmt(over60) + rl(' درهم', ' AED'), tone: 'red' },
    { label: rl('إجمالي المبالغ جارى تسويتها', 'Total amounts under settlement'), value: fmt(relT.settling) + rl(' درهم', ' AED'), tone: 'amber' },
  ].map((r) => ({ label: r.label, value: r.value, dot: r.tone === 'red' ? '#b0433b' : '#a9791f', bg: r.tone === 'red' ? '#faf0ef' : '#fbf7ee' }));

  const period = rl('حتى 30 مايو 2026', 'to 30 May 2026');
  const entityPanel = (() => { if (!selEntity) return null; const e = FM.entities.find((x) => x.code === selEntity); if (!e) return null; const col = entColors[e.code] || '#1f4a37'; return { code: e.code, name: tr(e.name), color: col, alloc: mAED(e.alloc), used: mAED(e.used), remain: mAED(e.alloc - e.used), utilLabel: pct(e.used, e.alloc) + '%', commit: mAED(e.commit), paid: mAED(e.paid), due: mAED(e.due), opExpected: mAED(e.opex.expected), opPaid: mAED(e.opex.paid), capExpected: mAED(e.capex.expected), capPaid: mAED(e.capex.paid), overdue: e.overdue, overdueLabel: rl(e.overdue + ' عقد متأخر', e.overdue + ' overdue contracts'), projects: e.projects.map((p) => ({ name: tr(p.name), alloc: mAED(p.alloc), paid: mAED(p.paid), spentLabel: pct(p.paid, p.alloc) + '%' })) }; })();

  return (
    <div style={{ animation: 'fadeUp .16s ease' }}>
      {/* header */}
      <div style={{ background: 'linear-gradient(120deg,#132b20,#1f4a37 55%,#2b5c44)', borderRadius: 22, padding: '24px 26px', color: '#eaf1ec', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 15, background: 'rgba(233,200,119,.18)', color: '#e9c877', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 3.5 7.5V9h17V7.5zM5 9v8m4-8v8m6-8v8m4-8v8M3.5 17h17v2.5h-17z"></path></svg></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{t('fin_title')}</h2>
          <div style={{ fontSize: 12.5, color: '#bcd2c3', marginTop: 3 }}>{t('rc_period')} · {period} · {t('rc_crumb')}</div>
        </div>
        <button onClick={() => showToast(rl('يبدأ تنزيل ملف الملخص التنفيذي المالي', 'Downloading financial summary'))} style={{ background: '#e9c877', color: '#3a2c08', border: 'none', borderRadius: 11, padding: '11px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"></path></svg>{t('fin_download')}</button>
      </div>

      {/* budget hero + commitments strip */}
      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', boxShadow: cardSh }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
            <div>
              <div style={{ fontSize: 12, color: '#7d867f', fontWeight: 600, marginBottom: 6 }}>{t('fin_title')} · {period}</div>
              <div style={{ fontSize: 30, fontWeight: 800, color: '#1f4a37', letterSpacing: '-.5px' }}>{mAED(FM.budget)}</div>
            </div>
            <div style={{ textAlign: 'end' }}><div style={{ fontSize: 12, color: '#7d867f', fontWeight: 600, marginBottom: 4 }}>{t('fin_util')}</div><div style={{ fontSize: 24, fontWeight: 800, color: '#3a6ea5' }}>{finUtil}%</div></div>
          </div>
          <div style={{ display: 'flex', height: 13, borderRadius: 8, overflow: 'hidden', marginBottom: 12, background: '#eef1ec' }}><div style={{ height: '100%', width: finUtil + '%', background: '#a9791f' }}></div></div>
          <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#a9791f', flex: 'none' }}></span><span style={{ fontSize: 12, color: '#7d867f' }}>{t('fin_used')}</span><b style={{ fontSize: 13.5, color: '#a9791f' }}>{mAED(FM.used)}</b></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ width: 11, height: 11, borderRadius: 3, background: '#dfe4dd', flex: 'none' }}></span><span style={{ fontSize: 12, color: '#7d867f' }}>{t('fin_remain')}</span><b style={{ fontSize: 13.5, color: '#1f8a5b' }}>{mAED(FM.remain)}</b></div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, padding: '22px 24px', boxShadow: cardSh, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14 }}>
          <div style={{ fontSize: 12, color: '#7d867f', fontWeight: 700 }}>{t('fin_commitments')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', textAlign: 'center' }}>
            <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#7a4d94' }}>{mAED(FM.commit)}</div><div style={{ fontSize: 11, color: '#9aa39b', marginTop: 4 }}>{t('fin_commitments')}</div></div>
            <div style={{ width: 1, background: '#eef1ec' }}></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#2e7d55' }}>{mAED(FM.commitPaid)}</div><div style={{ fontSize: 11, color: '#9aa39b', marginTop: 4 }}>{t('fin_paid')}</div></div>
            <div style={{ width: 1, background: '#eef1ec' }}></div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 22, fontWeight: 800, color: '#b0433b' }}>{mAED(FM.commitDue)}</div><div style={{ fontSize: 11, color: '#9aa39b', marginTop: 4 }}>{t('fin_due')}</div></div>
          </div>
        </div>
      </div>

      {/* budget distribution by entity */}
      {sectionHead('#2b5c44', t('fin_distribution'), t('fin_clickEntity'))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 14, marginBottom: 24 }}>
        {entityCards.map((e) => (
          <div key={e.code} onClick={() => setSelEntity(e.code)} style={{ background: '#fff', borderRadius: 16, padding: '17px 18px', boxShadow: cardSh, cursor: 'pointer', borderTop: '3px solid ' + e.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: e.color }}>{e.code}</span>
                {e.hasOverdue && <span style={{ fontSize: 10, fontWeight: 700, color: '#b0433b', background: '#faf0ef', borderRadius: 20, padding: '2px 8px' }}>{e.overdueLabel}</span>}
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: e.color }}>{e.utilLabel}</span>
            </div>
            <div style={{ fontSize: 11.5, color: '#7d867f', lineHeight: 1.5, marginBottom: 12, minHeight: 32 }}>{e.name}</div>
            <div style={{ height: 7, borderRadius: 6, background: '#eef1ec', overflow: 'hidden', marginBottom: 12 }}><div style={{ height: '100%', width: e.utilLabel, background: e.color, borderRadius: 6 }}></div></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
              <div><div style={{ color: '#9aa39b', marginBottom: 2 }}>{t('fin_alloc')}</div><div style={{ fontWeight: 700, color: '#17211c' }}>{e.alloc}</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ color: '#9aa39b', marginBottom: 2 }}>{t('fin_used')}</div><div style={{ fontWeight: 700, color: '#a9791f' }}>{e.used}</div></div>
              <div style={{ textAlign: 'end' }}><div style={{ color: '#9aa39b', marginBottom: 2 }}>{t('fin_due')}</div><div style={{ fontWeight: 700, color: '#b0433b' }}>{e.due}</div></div>
            </div>
          </div>
        ))}
      </div>

      {/* commitments + expenses */}
      <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 22px', boxShadow: cardSh }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#17211c' }}>{t('fin_commitments')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ color: '#7d867f', fontWeight: 600 }}>{t('fin_paid')}</span><span style={{ fontWeight: 800, color: '#2e7d55' }}>{finCommit.paid}</span></div>
              <div style={{ height: 8, borderRadius: 6, background: '#eef1ec', overflow: 'hidden' }}><div style={{ height: '100%', width: finCommit.paidPct + '%', background: '#2e7d55', borderRadius: 6 }}></div></div>
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ color: '#7d867f', fontWeight: 600 }}>{t('fin_due')}</span><span style={{ fontWeight: 800, color: '#b0433b' }}>{finCommit.due}</span></div>
              <div style={{ height: 8, borderRadius: 6, background: '#eef1ec', overflow: 'hidden' }}><div style={{ height: '100%', width: finCommit.duePct + '%', background: '#b0433b', borderRadius: 6 }}></div></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #eef1ec', paddingTop: 12, fontSize: 13 }}><span style={{ color: '#17211c', fontWeight: 700 }}>{t('fin_commitments')}</span><span style={{ fontWeight: 800, color: '#7a4d94' }}>{finCommit.total}</span></div>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: 18, padding: '20px 22px', boxShadow: cardSh }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 800, color: '#17211c' }}>{t('fin_expenses')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {expBlocks.map((x, i) => (
              <div key={i}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}><span style={{ fontSize: 13, fontWeight: 700, color: x.accent }}>{x.label}</span><span style={{ fontSize: 12, fontWeight: 700, color: '#7d867f' }}>{x.spentLabel}</span></div>
                <div style={{ height: 8, borderRadius: 6, background: '#eef1ec', overflow: 'hidden', marginBottom: 7 }}><div style={{ height: '100%', width: x.spentLabel, background: x.accent, borderRadius: 6 }}></div></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#9aa39b' }}><span>{t('fin_expected')}: <b style={{ color: '#17211c' }}>{x.expected}</b></span><span>{t('fin_paid')}: <b style={{ color: '#2e7d55' }}>{x.paid}</b></span><span>{t('fin_due')}: <b style={{ color: '#b0433b' }}>{x.due}</b></span></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* biggest projects */}
      {sectionHead('#c9a24b', t('fin_bigProjects'))}
      <div style={{ background: '#fff', borderRadius: 18, padding: '10px 22px', boxShadow: cardSh, marginBottom: 24 }}>
        {finBigProjects.map((p, i) => (
          <div key={i} style={{ padding: '16px 0', borderBottom: '1px solid #f2f4f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ fontSize: 14, fontWeight: 700, color: '#17211c' }}>{p.name}</span><span style={{ fontSize: 10.5, fontWeight: 700, color: p.color, background: '#f4f6f2', borderRadius: 20, padding: '2px 9px' }}>{p.entity}</span></div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: p.statusFg, background: p.statusBg, borderRadius: 20, padding: '3px 10px' }}>{p.statusLabel}</span>
            </div>
            <div style={{ height: 9, borderRadius: 6, background: '#eef1ec', overflow: 'hidden', marginBottom: 8 }}><div style={{ height: '100%', width: p.spentLabel, background: p.color, borderRadius: 6 }}></div></div>
            <div style={{ display: 'flex', gap: 20, fontSize: 11.5, color: '#9aa39b' }}><span>{t('fin_alloc')}: <b style={{ color: '#17211c' }}>{p.alloc}</b></span><span>{t('fin_paid')}: <b style={{ color: '#2e7d55' }}>{p.paid}</b></span><span>{t('fin_remain')}: <b style={{ color: '#a9791f' }}>{p.remain}</b></span></div>
          </div>
        ))}
      </div>

      {/* related parties */}
      {sectionHead('#7a4d94', t('fin_related'))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 13, marginBottom: 15 }}>
        {relTotalCards.map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 15, padding: '15px 16px', boxShadow: cardSh, borderInlineStart: '4px solid ' + r.accent }}>
            <div style={{ fontSize: 11, color: '#7d867f', fontWeight: 600, marginBottom: 8, lineHeight: 1.4, minHeight: 30 }}>{r.label}</div>
            <div style={{ fontSize: 19, fontWeight: 800, color: r.accent }}>{r.value}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14, marginBottom: 24 }}>
        {relRows.map((r, i) => (
          <div key={i} style={{ background: '#fff', borderRadius: 16, padding: '17px 18px', boxShadow: cardSh, borderInlineStart: '4px solid ' + r.toColor }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 13 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 800 }}>
                <span style={{ color: r.fromColor }}>{r.from}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa39b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: lang === 'en' ? 'none' : 'scaleX(-1)' }}><path d="M5 12h14m-6-6-6 6 6 6"></path></svg>
                <span style={{ color: r.toColor }}>{r.to}</span>
              </div>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#17211c', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", whiteSpace: 'nowrap' }}>{r.totalLabel}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {r.items.map((it, j) => (
                <div key={j} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: '#f7f9f6', borderRadius: 11, padding: '9px 12px' }}>
                  <div style={{ fontSize: 11.5, color: '#5b6b62', lineHeight: 1.5 }}>{it.n}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#17211c', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", whiteSpace: 'nowrap' }}>{it.v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* AP aging */}
      {sectionHead('#b0433b', t('fin_aging'), t('fin_clickAging') + ' · ' + t('fin_totalAmount') + ': ' + fmt(agingTotal))}
      <div className="fin-aging-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 12, marginBottom: 15 }}>
        {finAging.map((a) => (
          <div key={a.bucket} onClick={() => setSelAging(selAging === a.bucket ? null : a.bucket)} style={{ background: a.cardBg, borderRadius: 15, padding: '15px 16px', cursor: 'pointer', boxShadow: cardSh, borderTop: '3px solid ' + a.color }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}><span style={{ fontSize: 12.5, fontWeight: 800, color: a.cardFg }}>{a.bucketLabel}</span><span style={{ fontSize: 9.5, fontWeight: 700, color: a.riskFg, background: a.riskBg, borderRadius: 20, padding: '2px 8px' }}>{a.riskLabel}</span></div>
            <div style={{ fontSize: 19, fontWeight: 800, color: a.cardFg, marginBottom: 6 }}>{a.total}</div>
            <div style={{ fontSize: 11, color: a.cardFg, opacity: .75 }}>{a.suppliers} {t('fin_supplier')} · {a.contracts}</div>
          </div>
        ))}
      </div>
      {agingSel && (
        <div style={{ background: '#fff', borderRadius: 18, boxShadow: cardSh, overflow: 'hidden', marginBottom: 24, animation: 'fadeUp .16s ease' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #eef1ec', fontSize: 13.5, fontWeight: 800, color: '#17211c' }}>{t('fin_aging')} · {agingSel.bucketLabel}</div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead><tr style={{ background: '#f6f8f4' }}>
                <th style={finTh}>{t('fin_supplier')}</th><th style={finTh}>{t('fin_supplierNo')}</th><th style={finTh}>{t('fin_entity')}</th><th style={finTh}>{t('fin_contract')}</th><th style={finTh}>{t('fin_amount')}</th><th style={finTh}>{t('fin_status')}</th><th style={finTh}>{t('fin_notes')}</th>
              </tr></thead>
              <tbody>
                {agingSel.rows.map((s, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f2f4f0' }}>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 700, color: '#17211c' }}>{s.supplier}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#7d867f' }}>{s.num}</td>
                    <td style={{ padding: '12px 16px' }}><span style={{ fontSize: 11, fontWeight: 800, color: s.entColor }}>{s.entity}</span></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#7d867f' }}>{s.contract}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12.5, fontWeight: 800, color: '#b0433b' }}>{s.amount}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#17211c' }}>{s.status}</td>
                    <td style={{ padding: '12px 16px', fontSize: 11.5, color: '#9aa39b' }}>{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* bank interest */}
      {sectionHead('#1f8a5b', rl('الفوائد البنكية', 'Bank interest'))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 13, marginBottom: 24 }}>
        {finBankInterest.map((b, i) => (
          <div key={i} style={{ background: b.bg, borderRadius: 15, padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}><span style={{ width: 10, height: 10, flex: 'none', borderRadius: '50%', background: b.dot, marginTop: 4 }}></span><div style={{ fontSize: 12, color: '#5b6b62', fontWeight: 600, lineHeight: 1.55 }}>{b.label}</div></div>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#17211c', fontFamily: "ui-monospace,'SF Mono',Menlo,monospace", letterSpacing: '-.5px' }}>{b.value}</div>
          </div>
        ))}
      </div>

      {/* financial risk highlights */}
      {sectionHead('#9a2f2a', t('fin_risks'))}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 13 }}>
        {finRisks.map((r, i) => (
          <div key={i} style={{ background: r.bg, borderRadius: 15, padding: '16px 17px', display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <span style={{ width: 10, height: 10, flex: 'none', borderRadius: '50%', background: r.dot, marginTop: 5 }}></span>
            <div><div style={{ fontSize: 12, color: '#7d867f', fontWeight: 600, marginBottom: 5, lineHeight: 1.4 }}>{r.label}</div><div style={{ fontSize: 14.5, fontWeight: 800, color: '#17211c' }}>{r.value}</div></div>
          </div>
        ))}
      </div>

      {/* entity panel drawer */}
      <Drawer open={!!entityPanel} onClose={() => setSelEntity(null)} width={440}>
        {entityPanel && (
          <div>
            <div style={{ background: 'linear-gradient(120deg,#132b20,#1f4a37)', padding: '22px 24px', color: '#eaf1ec', position: 'sticky', top: 0, zIndex: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: entityPanel.color, background: '#fff', borderRadius: 10, padding: '4px 12px' }}>{entityPanel.code}</span>
                <button onClick={() => setSelEntity(null)} style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none', borderRadius: 9, width: 34, height: 34, cursor: 'pointer', fontSize: 18 }}>✕</button>
              </div>
              <div style={{ fontSize: 13.5, color: '#bcd2c3', lineHeight: 1.5 }}>{entityPanel.name}</div>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', borderRadius: 13, padding: '13px 14px' }}><div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 600, marginBottom: 6 }}>{t('fin_alloc')}</div><div style={{ fontSize: 16, fontWeight: 800, color: '#1f4a37' }}>{entityPanel.alloc}</div></div>
                <div style={{ background: '#fff', borderRadius: 13, padding: '13px 14px' }}><div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 600, marginBottom: 6 }}>{t('fin_used')}</div><div style={{ fontSize: 16, fontWeight: 800, color: '#a9791f' }}>{entityPanel.used}</div></div>
                <div style={{ background: '#fff', borderRadius: 13, padding: '13px 14px' }}><div style={{ fontSize: 10.5, color: '#9aa39b', fontWeight: 600, marginBottom: 6 }}>{t('fin_remain')}</div><div style={{ fontSize: 16, fontWeight: 800, color: '#1f8a5b' }}>{entityPanel.remain}</div></div>
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 8 }}><span style={{ color: '#7d867f', fontWeight: 600 }}>{t('fin_util')}</span><span style={{ fontWeight: 800, color: entityPanel.color }}>{entityPanel.utilLabel}</span></div>
                <div style={{ height: 8, borderRadius: 6, background: '#eef1ec', overflow: 'hidden' }}><div style={{ height: '100%', width: entityPanel.utilLabel, background: entityPanel.color, borderRadius: 6 }}></div></div>
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#17211c' }}>{t('fin_commitments')}</h4>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}><span style={{ color: '#9aa39b' }}>{t('fin_commitments')}</span><b style={{ color: '#7a4d94' }}>{entityPanel.commit}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}><span style={{ color: '#9aa39b' }}>{t('fin_paid')}</span><b style={{ color: '#2e7d55' }}>{entityPanel.paid}</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span style={{ color: '#9aa39b' }}>{t('fin_due')}</span><b style={{ color: '#b0433b' }}>{entityPanel.due}</b></div>
              </div>
              <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 15, padding: '15px 16px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#3a6ea5', marginBottom: 9 }}>{t('fin_expenses')} · {t('n_operating')}</div><div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 4 }}>{t('fin_expected')}: <b style={{ color: '#17211c' }}>{entityPanel.opExpected}</b></div><div style={{ fontSize: 11.5, color: '#9aa39b' }}>{t('fin_paid')}: <b style={{ color: '#2e7d55' }}>{entityPanel.opPaid}</b></div></div>
                <div style={{ background: '#fff', borderRadius: 15, padding: '15px 16px' }}><div style={{ fontSize: 11.5, fontWeight: 700, color: '#7a4d94', marginBottom: 9 }}>{t('fin_expenses')} · {t('n_capital')}</div><div style={{ fontSize: 11.5, color: '#9aa39b', marginBottom: 4 }}>{t('fin_expected')}: <b style={{ color: '#17211c' }}>{entityPanel.capExpected}</b></div><div style={{ fontSize: 11.5, color: '#9aa39b' }}>{t('fin_paid')}: <b style={{ color: '#2e7d55' }}>{entityPanel.capPaid}</b></div></div>
              </div>
              <div style={{ background: '#fff', borderRadius: 15, padding: '16px 18px' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 800, color: '#17211c' }}>{t('fin_bigProjects')}</h4>
                {entityPanel.projects.map((p, i) => (
                  <div key={i} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ fontWeight: 700, color: '#17211c' }}>{p.name}</span><span style={{ fontWeight: 700, color: '#7d867f' }}>{p.spentLabel}</span></div>
                    <div style={{ height: 7, borderRadius: 6, background: '#eef1ec', overflow: 'hidden', marginBottom: 5 }}><div style={{ height: '100%', width: p.spentLabel, background: entityPanel.color, borderRadius: 6 }}></div></div>
                    <div style={{ fontSize: 11, color: '#9aa39b' }}>{t('fin_alloc')}: <b style={{ color: '#17211c' }}>{p.alloc}</b> · {t('fin_paid')}: <b style={{ color: '#2e7d55' }}>{p.paid}</b></div>
                  </div>
                ))}
              </div>
              {entityPanel.overdue > 0 && (
                <div style={{ background: '#faf0ef', borderRadius: 15, padding: '15px 18px', display: 'flex', alignItems: 'center', gap: 11 }}><span style={{ width: 10, height: 10, borderRadius: '50%', background: '#b0433b', flex: 'none' }}></span><span style={{ fontSize: 12.5, fontWeight: 700, color: '#b0433b' }}>{entityPanel.overdueLabel}</span></div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
