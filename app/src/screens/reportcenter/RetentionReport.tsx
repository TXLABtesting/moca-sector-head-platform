import { useState, type CSSProperties } from 'react';
import { useI18n } from '../../i18n/i18n';
import { Avatar } from '../../components/ui';
import { Dropdown } from '../../components/Dropdown';
import { impMap } from './shared';

const RET_AVAIL: Record<string, boolean> = { '2026-q2': true };
const latestYear = '2026', latestQ = 'q2';
const recTh: CSSProperties = { textAlign: 'start', padding: '10px 12px', fontSize: 11.5, fontWeight: 700, color: '#8a938c', borderBottom: '1px solid #eef0ec' };
const recTd: CSSProperties = { padding: '13px 12px', borderBottom: '1px solid #f4f6f2', verticalAlign: 'top' };

export function RetentionReport() {
  const { t, tr, lang } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const [year, setYear] = useState(latestYear);
  const [quarter, setQuarter] = useState(latestQ);

  const QLAB: Record<string, string> = { q1: rl('الربع الأول', 'Q1'), q2: rl('الربع الثاني', 'Q2'), q3: rl('الربع الثالث', 'Q3'), q4: rl('الربع الرابع', 'Q4') };
  const selKey = year + '-' + quarter;
  const available = !!RET_AVAIL[selKey];
  const periodOf = (y: string, q: string) => QLAB[q] + ' ' + y;

  const kpis = [
    { label: rl('إجمالي الدفعات', 'Total payments'), value: '57', unit: rl('دفعة', 'payments'), accent: '#3a6ea5' },
    { label: rl('إجمالي القيمة', 'Total value'), value: '9.35', unit: rl('مليون درهم', 'AED million'), accent: '#2e7d55' },
    { label: rl('الدفعات المغلقة', 'Closed payments'), value: '25', unit: rl('دفعة', 'payments'), accent: '#2e7d55' },
    { label: rl('الدفعات غير المغلقة', 'Unclosed payments'), value: '11', unit: rl('دفعة', 'payments'), accent: '#b0433b' },
    { label: rl('الدفعات المستمرة', 'Ongoing payments'), value: '21', unit: rl('دفعة', 'payments'), accent: '#a9791f' },
    { label: rl('أعلى جهة قيمةً — مكتب رئاسة مجلس الوزراء', 'Top entity by value — PMO'), value: '52%', unit: rl('من إجمالي القيمة', 'of total value'), accent: '#7a4d94' },
  ];
  const summary = [
    rl('بلغ إجمالي الدفعات المستبقاة 57 دفعة عبر 6 جهات بقيمة 9.35 مليون درهم.', 'Retention payments totalled 57 across 6 entities, valued at AED 9.35M.'),
    rl('تم إغلاق 47.5% من إجمالي القيمة.', '47.5% of total value has been closed.'),
    rl('توجد 11 دفعة متجاوزة للمهلة التعاقدية بقيمة 1.12 مليون درهم.', '11 overdue payments remain past the contractual term, worth AED 1.12M.'),
    rl('تتركز 52% من إجمالي القيمة لدى مكتب رئاسة مجلس الوزراء.', '52% of total value is concentrated in PMO.'),
  ];
  const strengths = [
    rl('معدل إقفال جيد للدفعات المستبقاة.', 'Good closure rate for retention payments.'),
    rl('الالتزام بمدة الاستبقاء التعاقدية البالغة 90 يوماً.', 'Adherence to the 90-day contractual retention term.'),
    rl('تسجيل أسباب التأخير لكل دفعة غير مغلقة.', 'Delay reasons logged for every unclosed payment.'),
    rl('أداء جيد لبعض الجهات مثل مكتب التبادل المعرفي والمركز الاتحادي للتنافسية والإحصاء.', 'Strong performance by some entities such as GEEO and FCSC.'),
  ];
  const weaknesses = [
    rl('تركز المخاطر لدى مكتب رئاسة مجلس الوزراء.', 'Risk concentration at PMO.'),
    rl('وجود 11 دفعة متجاوزة للمهلة التعاقدية.', '11 payments overdue past the contractual term.'),
    rl('تأخر الموردين في تسليم الفواتير أو رسائل براءة الذمة.', 'Suppliers delayed in submitting invoices or clearance letters.'),
    rl('الحاجة إلى آلية تصعيد أكثر فعالية.', 'Need for a more effective escalation mechanism.'),
  ];
  const recommendations = [
    { note: rl('تركز 52% من إجمالي القيمة لدى مكتب رئاسة مجلس الوزراء.', '52% of total value concentrated in PMO.'), rec: rl('وضع خطة إقفال ذات أولوية لدفعات المكتب.', 'Set a priority closure plan for PMO payments.'), imp: 'عالية' },
    { note: rl('11 دفعة متجاوزة للمهلة التعاقدية بقيمة 1.12 مليون درهم.', '11 overdue payments worth AED 1.12M.'), rec: rl('تفعيل آلية تصعيد أسبوعية للحالات المتجاوزة.', 'Activate a weekly escalation mechanism for overdue cases.'), imp: 'عالية' },
    { note: rl('تأخر الموردين في تسليم الفواتير ورسائل براءة الذمة.', 'Suppliers delayed invoices and clearance letters.'), rec: rl('مخاطبة الموردين وتحديد مهلة نهائية للتسليم.', 'Notify suppliers and set a final submission deadline.'), imp: 'متوسطة' },
    { note: rl('غياب آلية تصعيد موحدة بين الجهات.', 'No unified escalation mechanism across entities.'), rec: rl('اعتماد إجراء تصعيد معياري موحد عبر الجهات.', 'Adopt a standard unified escalation procedure across entities.'), imp: 'متوسطة' },
    { note: rl('تفاوت الأداء بين الجهات.', 'Performance varies across entities.'), rec: rl('تعميم ممارسات الجهات الأعلى أداءً.', 'Roll out best practices from top-performing entities.'), imp: 'منخفضة' },
  ];
  const entities = [
    { code: 'PMO', count: 30, value: '4,856,373', pct: '51.9%', w: 100, c: '#a9791f' },
    { code: 'GEEO', count: 6, value: '1,751,932', pct: '18.7%', w: 36, c: '#2e7d55' },
    { code: 'GSOC', count: 9, value: '1,422,068', pct: '15.2%', w: 29, c: '#2e7d55' },
    { code: 'FCSC', count: 5, value: '593,150', pct: '6.3%', w: 12, c: '#2e7d55' },
    { code: 'MAIO', count: 3, value: '534,993', pct: '5.7%', w: 11, c: '#2e7d55' },
    { code: 'MOCA', count: 4, value: '191,016', pct: '2.0%', w: 4, c: '#2e7d55' },
  ];
  const topCases = [
    { code: 'PMO-PO-25-0406', value: rl('520,000 درهم', 'AED 520,000'), statusLabel: rl('غير مغلق', 'Unclosed'), reason: rl('مقاولات', 'Contracting') },
    { code: 'GSOC-PO-24-0124', value: rl('216,223 درهم', 'AED 216,223'), statusLabel: rl('غير مغلق', 'Unclosed'), reason: rl('مقاولات', 'Contracting') },
  ];
  const conclusion = rl('أداء الإدارة جيد عموماً، لكن تراكم 11 دفعة متجاوزة بقيمة 1.1 مليون درهم، معظمها لدى مكتب رئاسة مجلس الوزراء، يستوجب أولوية لإقفال الحالات الأعلى قيمة خلال الفترة القادمة.', 'Overall departmental performance is good, but the buildup of 11 overdue payments worth AED 1.1M — mostly at PMO — calls for prioritising closure of the highest-value cases in the coming period.');

  return (
    <div style={{ animation: 'fadeUp .16s ease' }}>
      {/* header strip */}
      <div style={{ background: 'linear-gradient(120deg,#1e4634,#2b5c44)', borderRadius: 22, padding: '24px 26px', color: '#eaf1ec', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 18 }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><span style={{ fontSize: 11, fontWeight: 700, background: 'rgba(255,255,255,.16)', borderRadius: 20, padding: '5px 12px' }}>{rl('ربع سنوي', 'Quarterly')}</span><span style={{ fontSize: 11, fontWeight: 700, background: '#e2f0e8', color: '#1f4a37', borderRadius: 20, padding: '5px 12px' }}>{rl('مكتمل', 'Completed')}</span></div>
          <h2 style={{ margin: '0 0 6px', fontSize: 23, fontWeight: 700, color: '#fff', lineHeight: 1.35 }}>{rl('تقرير الدفعات المستبقاة', 'Retention Payments Report')}</h2>
          <div style={{ fontSize: 13, color: '#bcd2c3' }}>{periodOf(year, quarter)} · {rl('إدارة الخدمات المالية', 'Financial Services Dept.')}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.12)', borderRadius: 14, padding: '11px 15px' }}>
          <Avatar name="حسن همام" size={40} />
          <div style={{ lineHeight: 1.4 }}><div style={{ fontSize: 10.5, color: '#a9c0b1' }}>{t('rc_responsible')}</div><div style={{ fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{rl('حسن همام', 'Hasan Hammam')}</div><div style={{ fontSize: 10.5, color: '#a9c0b1' }}>{rl('خبير الجودة والامتثال', 'Quality and Compliance Expert')}</div></div>
        </div>
        <button style={{ background: '#e9c877', color: '#3a2f10', border: 'none', borderRadius: 11, padding: '12px 18px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14"></path></svg>{t('rc_downloadFile')}</button>
      </div>

      {/* version filter bar */}
      <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 12px 30px -16px rgba(23,40,32,.14)', padding: '15px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><span style={{ fontSize: 12, color: '#7d867f', fontWeight: 600 }}>{t('rc_year')}</span>
          <Dropdown value={year} options={[{ v: '2026', label: '2026' }, { v: '2025', label: '2025' }]} onChange={setYear} opt={{ minWidth: '92px', weight: 600 }} />
        </div>
        <div style={{ width: 1, height: 26, background: '#eef0ec' }}></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}><span style={{ fontSize: 12, color: '#7d867f', fontWeight: 600 }}>{t('rc_quarters')}</span>
          {['q1', 'q2', 'q3', 'q4'].map((q) => {
            const av = !!RET_AVAIL[year + '-' + q]; const s = q === quarter;
            return (
              <button key={q} onClick={() => setQuarter(q)} style={{ display: 'flex', alignItems: 'center', gap: 7, borderRadius: 10, padding: '9px 15px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: '1px solid ' + (s ? '#1e4634' : av ? '#cfe0d5' : '#e6e3de'), background: s ? '#1e4634' : av ? '#eef4f0' : '#f4f3f1', color: s ? '#fff' : av ? '#1f4a37' : '#a7a29a' }}><span style={{ width: 7, height: 7, borderRadius: '50%', background: s ? '#e9c877' : av ? '#2e7d55' : '#c9c4bc' }}></span>{QLAB[q]}</button>
            );
          })}
        </div>
      </div>

      {available ? (
        <>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(165px,1fr))', gap: 14, marginBottom: 22 }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ background: '#fff', borderRadius: 18, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 34px -16px rgba(23,40,32,.16)', padding: '18px 18px 16px', borderTop: '3px solid ' + k.accent }}>
                <div style={{ fontSize: 11.5, color: '#7d867f', marginBottom: 9, lineHeight: 1.4, minHeight: 32 }}>{k.label}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#17211c', lineHeight: 1.05 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: '#9aa39b', marginTop: 4 }}>{k.unit}</div>
              </div>
            ))}
          </div>

          {/* executive summary */}
          <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#e9f0ec', color: '#1f4a37', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16M4 12h16M4 18h10"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_summary')}</h3></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 12 }}>
              {summary.map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 11, alignItems: 'flex-start', background: '#f7f9f6', borderRadius: 13, padding: '14px 15px' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2e7d55', marginTop: 6, flex: 'none' }}></span><span style={{ fontSize: 13, color: '#3c4a42', lineHeight: 1.6 }}>{s}</span></div>
              ))}
            </div>
          </div>

          {/* strengths + weaknesses */}
          <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 20 }}>
            <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#e2f0e8', color: '#2e7d55', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 13 4 4L19 7"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_strengths')}</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {strengths.map((s, i) => (<div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2e7d55" strokeWidth="2.2" style={{ marginTop: 2, flex: 'none' }}><path d="M20 6 9 17l-5-5"></path></svg><span style={{ fontSize: 13, color: '#3c4a42', lineHeight: 1.6 }}>{s}</span></div>))}
              </div>
            </div>
            <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px', borderTop: '3px solid #b0433b' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#f7e6e4', color: '#b0433b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_weaknesses')}</h3></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {weaknesses.map((w, i) => (<div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}><span style={{ width: 6, height: 6, borderRadius: '50%', background: '#b0433b', marginTop: 7, flex: 'none' }}></span><span style={{ fontSize: 13, color: '#3c4a42', lineHeight: 1.6 }}>{w}</span></div>))}
              </div>
            </div>
          </div>

          {/* recommendations */}
          <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#fbf0d6', color: '#a9791f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_recommendations')}</h3></div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 520 }}>
                <thead><tr><th style={recTh}>{t('rc_note')}</th><th style={recTh}>{t('rc_recommendation')}</th><th style={{ ...recTh, whiteSpace: 'nowrap' }}>{t('rc_importance')}</th></tr></thead>
                <tbody>
                  {recommendations.map((r, i) => {
                    const [b, f] = impMap[r.imp];
                    return (
                      <tr key={i}>
                        <td style={{ ...recTd, color: '#3c4a42', lineHeight: 1.55 }}>{r.note}</td>
                        <td style={{ ...recTd, color: '#17211c', fontWeight: 500, lineHeight: 1.55 }}>{r.rec}</td>
                        <td style={{ ...recTd, whiteSpace: 'nowrap' }}><span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: b, color: f }}>{tr(r.imp)}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* metrics by entity */}
          <div style={{ background: '#fff', borderRadius: 22, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: '24px 26px', marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#e6eef6', color: '#3a6ea5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_byEntity')}</h3></div>
            <p style={{ margin: '0 0 14px 42px', fontSize: 11.5, color: '#9aa39b' }}>{t('rc_byEntityNote')}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {entities.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 74, flex: 'none' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#17211c' }}>{e.code}</div><div style={{ fontSize: 10, color: '#9aa39b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.count} {t('rc_paymentsWord')}</div></div>
                  <div style={{ flex: 1, height: 26, borderRadius: 8, background: '#f0f2ee', overflow: 'hidden', position: 'relative' }}><div style={{ height: '100%', background: e.c, width: e.w + '%', borderRadius: 8, minWidth: 3 }}></div></div>
                  <div style={{ width: 130, flex: 'none', textAlign: 'end' }}><div style={{ fontSize: 13, fontWeight: 700, color: '#17211c' }}>{e.value}</div><div style={{ fontSize: 10.5, color: '#9aa39b' }}>{e.pct}</div></div>
                </div>
              ))}
            </div>
          </div>

          {/* top cases */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: '#f7e6e4', color: '#b0433b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2 3 7v6c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7z"></path><path d="M12 8v4m0 4h.01"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#17211c' }}>{t('rc_topCases')}</h3></div>
            <div className="rg2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {topCases.map((c, i) => (
                <div key={i} style={{ background: '#fff', borderInlineStart: '4px solid #b0433b', borderRadius: 14, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 14px 30px -16px rgba(23,40,32,.14)', padding: '18px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}><span style={{ fontSize: 14, fontWeight: 800, color: '#17211c', letterSpacing: '.02em' }}>{c.code}</span><span style={{ fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 11px', background: '#f7e6e4', color: '#b0433b' }}>{c.statusLabel}</span></div>
                  <div style={{ display: 'flex', gap: 24 }}>
                    <div><div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{t('rc_value')}</div><div style={{ fontSize: 16, fontWeight: 700, color: '#17211c' }}>{c.value}</div></div>
                    <div><div style={{ fontSize: 10.5, color: '#9aa39b', marginBottom: 3 }}>{t('rc_reason')}</div><div style={{ fontSize: 14, fontWeight: 600, color: '#3c4a42' }}>{c.reason}</div></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* conclusion */}
          <div style={{ background: 'linear-gradient(120deg,#1e4634,#2b5c44)', borderRadius: 22, padding: '26px 28px', color: '#eaf1ec' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}><span style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(233,200,119,.2)', color: '#e9c877', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg></span><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>{t('rc_conclusion')}</h3></div>
            <p style={{ margin: 0, fontSize: 14.5, color: '#eaf1ec', lineHeight: 1.85 }}>{conclusion}</p>
          </div>
        </>
      ) : (
        <div style={{ background: '#fff', border: '1px dashed #d8ddd4', borderRadius: 22, padding: '56px 30px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span style={{ width: 60, height: 60, borderRadius: 16, background: '#f4f6f2', color: '#a7b0a8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 3H14l5 5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19V4.5A1.5 1.5 0 0 1 6.5 3Z"></path><path d="M14 3v4a1 1 0 0 0 1 1h4"></path><path d="M9 15h6"></path></svg></span>
          <div><h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: '#17211c' }}>{t('rc_noReport')}</h3><p style={{ margin: 0, fontSize: 13, color: '#8a938c' }}>{periodOf(year, quarter)}</p></div>
          <button onClick={() => { setYear(latestYear); setQuarter(latestQ); }} style={{ background: '#1e4634', color: '#fff', border: 'none', borderRadius: 11, padding: '12px 22px', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5"></path><path d="M4 9h11a5 5 0 0 1 5 5v3"></path></svg>{t('rc_backLatest')}</button>
          <div style={{ fontSize: 11.5, color: '#a7b0a8' }}>{periodOf(latestYear, latestQ)}</div>
        </div>
      )}
    </div>
  );
}
