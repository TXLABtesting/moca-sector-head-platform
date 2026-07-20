import { useI18n } from '../i18n/i18n';

/* eslint-disable @typescript-eslint/no-explicit-any */

/** A consistent Sector-Head workflow banner for any record carrying the shared
 *  review flags (_mrev / _mret / _mapproved / _mdirective). Renders the
 *  return-for-edit reason, pending-review state, approval, or a directive —
 *  so every module surfaces the same status vocabulary and the return reason. */
export function WorkflowBanner({ rec, style }: { rec: any; style?: React.CSSProperties }) {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  if (!rec) return null;

  const base: React.CSSProperties = { borderRadius: 12, padding: '11px 14px', fontSize: 12.5, lineHeight: 1.6, display: 'flex', alignItems: 'flex-start', gap: 9, ...style };
  const dot = (c: string) => <span style={{ width: 9, height: 9, flex: 'none', borderRadius: '50%', background: c, marginTop: 4 }} />;

  const nodes: React.ReactNode[] = [];
  if (rec._mret) {
    nodes.push(
      <div key="ret" style={{ ...base, background: '#fdf3f2', border: '1px solid #f3d9d6', color: '#8f3a33' }}>
        {dot('#b0433b')}
        <div><b>{rl('أعيد للتعديل من رئيس القطاع', 'Returned for editing by the Sector Head')}</b><div style={{ marginTop: 3 }}>{rl('السبب: ', 'Reason: ')}{tr(rec._mret)}</div></div>
      </div>
    );
  } else if (rec._mrev) {
    nodes.push(
      <div key="rev" style={{ ...base, background: '#fbf7ee', border: '1px solid #ecdcae', color: '#8a6a1f' }}>
        {dot('#a9791f')}
        <div>{rl('بانتظار اعتماد رئيس القطاع — سيصلك القرار فور اتخاذه.', 'Awaiting Sector Head approval — you will be notified once decided.')}</div>
      </div>
    );
  } else if (rec._mapproved) {
    nodes.push(
      <div key="app" style={{ ...base, background: '#eef6f0', border: '1px solid #d6e8dd', color: '#2e7d55' }}>
        {dot('#2e7d55')}
        <div>{rl('معتمد من رئيس القطاع', 'Approved by the Sector Head')}</div>
      </div>
    );
  }
  if (rec._mdirective) {
    nodes.push(
      <div key="dir" style={{ ...base, background: '#fbf7ee', border: '1px solid #ecdcae', color: '#6a5a2b' }}>
        {dot('#c9a24b')}
        <div><b>{rl('توجيه من رئيس القطاع', 'Directive from the Sector Head')}:</b> {tr(rec._mdirective)}</div>
      </div>
    );
  }
  if (!nodes.length) return null;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{nodes}</div>;
}
