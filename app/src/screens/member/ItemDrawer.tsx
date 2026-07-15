import { Drawer, Badge } from '../../components/ui';
import { useStore } from '../../store/store';
import { useI18n } from '../../i18n/i18n';
import { WFS, SECTIONS } from '../../domain/permissions';
import { mColl } from './workflow';

/* eslint-disable @typescript-eslint/no-explicit-any */

const FIELD_LABELS: Record<string, [string, string]> = {
  owner: ['المسؤول', 'Owner'], respOwner: ['المسؤول', 'Owner'], followup: ['المتابع', 'Follow-up'],
  fstatus: ['الحالة', 'Status'], due: ['الاستحقاق', 'Due'], start: ['البداية', 'Start'],
  deadline: ['الموعد النهائي', 'Deadline'], entity: ['الجهة', 'Entity'], docType: ['النوع', 'Type'],
  dir: ['الاتجاه', 'Direction'], sender: ['المرسل', 'Sender'], recipient: ['المستلم', 'Recipient'],
  fdate: ['التاريخ', 'Date'], next: ['الخطوة القادمة', 'Next step'], final: ['المخرج النهائي', 'Final deliverable'],
  budget: ['الميزانية', 'Budget'], progress: ['نسبة الإنجاز %', 'Progress %'], risks: ['المخاطر', 'Risks'],
  imp: ['الأهمية', 'Importance'], action: ['آلية الإغلاق', 'Corrective action'], priority: ['الأولوية', 'Priority'],
  backup: ['البديل', 'Backup'], note: ['ملاحظات', 'Notes'],
};

export interface DrawerTarget { id: string; sec: string; isWork: boolean }

interface Props {
  target: DrawerTarget | null;
  onClose: () => void;
  onEdit: (t: DrawerTarget) => void;
  onSend: (t: DrawerTarget) => void;
  canSend: boolean;
}

/** Member-side item drawer: full fields + the entry history log (سجل الإدخالات). */
export function ItemDrawer({ target, onClose, onEdit, onSend, canSend }: Props) {
  const { lang, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const data = useStore((s) => s.data);
  const work = useStore((s) => s.work);

  if (!target) return null;

  const coll = target.isWork ? null : mColl(target.sec);
  const rec: any = coll ? coll.get(data).find((x: any) => x.id === target.id) : null;
  const wi = target.isWork ? work.find((x) => x.id === target.id) : null;
  if (!rec && !wi) return null;

  const title = rec ? coll!.title(rec) : wi!.title;
  const status = rec
    ? (rec._mrev ? 'بانتظار مراجعة رئيس القطاع' : (rec._mret ? 'أعيد للتعديل' : coll!.status(rec)))
    : wi!.status;
  const [stBg, stFg] = WFS[status] || WFS['مسودة'];
  const reason = rec ? rec._mret : wi!.reason;
  const secObj = SECTIONS.find((s) => s.k === target.sec);
  const secName = secObj ? (lang === 'en' ? secObj.en : secObj.ar) : target.sec;

  const fields: [string, string][] = rec
    ? Object.entries(coll!.load(rec) as Record<string, unknown>)
        .filter(([k, v]) => k !== 'title' && v != null && String(v).trim() && String(v) !== '—')
        .map(([k, v]) => [FIELD_LABELS[k] ? FIELD_LABELS[k][lang === 'en' ? 1 : 0] : k, dl(tr(String(v)))])
    : [[rl('التاريخ', 'Date'), dl(wi!.date)]];

  const log: any[] = rec ? (rec._mlog || []) : [];
  const sent = status === 'بانتظار مراجعة رئيس القطاع';

  return (
    <Drawer open onClose={onClose} width={470}>
      <div style={{ padding: '22px 24px 18px', borderBottom: '1px solid #eef1ec', background: 'linear-gradient(160deg,#f6f8f4,#eef3ef)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#5b6b62', background: '#e6ece7', borderRadius: 7, padding: '4px 10px' }}>{secName}</span>
          <Badge bg={stBg} fg={stFg}>{tr(status)}</Badge>
          <button onClick={onClose} style={{ marginInlineStart: 'auto', width: 30, height: 30, border: 'none', borderRadius: 9, background: '#fff', color: '#5b6b62', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(23,40,32,.08)' }}>
            <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </button>
        </div>
        <h3 style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: '#17211c', lineHeight: 1.55 }}>{tr(title)}</h3>
      </div>

      <div style={{ padding: '18px 24px 26px' }}>
        {reason && (
          <div style={{ background: '#fdf3f2', border: '1px solid #f3d9d6', borderRadius: 12, padding: '11px 14px', marginBottom: 16, fontSize: 12.5, color: '#9a3f38', lineHeight: 1.65 }}>
            <b>{rl('سبب الإرجاع من رئيس القطاع', 'Return reason from the Sector Head')}:</b> {reason}
          </div>
        )}
        {rec && rec._mdirective && (
          <div style={{ background: '#fbf7ee', border: '1px solid #f0e6cf', borderRadius: 12, padding: '11px 14px', marginBottom: 16, fontSize: 12.5, color: '#6a5a2b', lineHeight: 1.65 }}>
            <b>{rl('توجيه رئيس القطاع', 'Sector Head directive')}:</b> {rec._mdirective}
          </div>
        )}

        {fields.length > 0 && (
          <div style={{ border: '1px solid #eef1ec', borderRadius: 14, overflow: 'hidden', marginBottom: 18 }}>
            {fields.map(([k, v], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 14px', borderBottom: i < fields.length - 1 ? '1px solid #f4f6f3' : 'none', background: i % 2 ? '#fbfcfa' : '#fff' }}>
                <span style={{ flex: 'none', width: 120, fontSize: 11.5, fontWeight: 700, color: '#9aa39b' }}>{k}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: '#2a332d', lineHeight: 1.6 }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        <h4 style={{ margin: '0 0 10px', fontSize: 13.5, fontWeight: 700, color: '#17211c', display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#2b5c44" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          {rl('سجل الإدخالات والقرارات', 'Entry & decision history')}
        </h4>
        {log.length === 0 && <div style={{ padding: 16, textAlign: 'center', fontSize: 12, color: '#9aa39b', background: '#f7f9f6', borderRadius: 11 }}>{rl('لا توجد إدخالات مسجّلة بعد', 'No logged entries yet')}</div>}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {log.map((e: any, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 11, paddingBottom: i < log.length - 1 ? 14 : 0, position: 'relative' }}>
              <div style={{ flex: 'none', width: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', marginTop: 5, background: e.chair ? '#c9a24b' : '#1f8a5b', flex: 'none' }} />
                {i < log.length - 1 && <span style={{ flex: 1, width: 1.5, background: '#e6ece7', marginTop: 3 }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingBottom: 2 }}>
                <div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.55 }}>
                  {e.chair ? <b style={{ color: '#a9791f' }}>{rl('رئيس القطاع', 'Sector Head')}: </b> : (e.by ? <b>{e.by}: </b> : null)}
                  {tr(e.to || '')}{e.sent ? ' · ' + rl('أُرسل للمراجعة', 'sent for review') : ''}
                </div>
                {e.note && <div style={{ fontSize: 11.5, color: '#6d7973', marginTop: 3, lineHeight: 1.6 }}>{e.note}</div>}
                <div style={{ fontSize: 10.5, color: '#9aa39b', marginTop: 3 }}>{e.at || ''}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 22 }}>
          <button onClick={() => onEdit(target)} style={{ flex: 1, background: '#f2f4f0', border: '1px solid #e2e6df', color: '#3c4a42', borderRadius: 11, padding: '11px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('تعديل / تحديث', 'Edit / update')}</button>
          {canSend && !sent && status !== 'معتمد' && (
            <button onClick={() => onSend(target)} style={{ flex: 1, background: '#1e4634', border: 'none', color: '#fff', borderRadius: 11, padding: '11px 14px', fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer' }}>{rl('إرسال لرئيس القطاع', 'Send to Sector Head')}</button>
          )}
        </div>
      </div>
    </Drawer>
  );
}
