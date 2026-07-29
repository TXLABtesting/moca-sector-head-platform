import { Fade } from '../components/ui';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';
import { useCurrentUser } from '../store/useCurrentUser';
import { can } from '../domain/permissions';

interface Result { kind: string; title: string; sub: string; open: () => void }

export function GlobalSearch() {
  const { lang, tr } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { search, goto } = useNav();
  const data = useStore((s) => s.data);
  const cu = useCurrentUser();
  const q = search.trim().toLowerCase();

  const match = (s: string | undefined) => !!s && (s.toLowerCase().includes(q) || tr(s).toLowerCase().includes(q));
  // Search must respect the same visibility rules as the screens: only surface
  // records from sections the user may view, and never leak one user's personal
  // office tasks to another (the Sector Head sees everything).
  const isChair = cu.type === 'chair';
  const mayView = (section: string) => isChair || can(cu, section, 'view');
  const ownTask = (o: { owner: string; _mowner?: string }) => isChair || o.owner === cu.name || o._mowner === cu.id;

  const results: Result[] = [];
  if (mayView('projects')) data.projects.filter((p) => match(p.name)).forEach((p) => results.push({ kind: rl('مشروع', 'Project'), title: tr(p.name), sub: tr(p.owner) + ' · ' + tr(p.status), open: () => goto('projectDetail', { selProject: p.id }) }));
  if (mayView('correspondence')) data.correspondence.filter((c) => match(c.name) || match(c.entity)).forEach((c) => results.push({ kind: rl('مستند', 'Document'), title: tr(c.name), sub: tr(c.entity) + ' · ' + tr(c.dir), open: () => goto('docDetail', { selDoc: c.id }) }));
  if (mayView('minutes')) data.meetings.filter((m) => match(m.title)).forEach((m) => results.push({ kind: rl('محضر', 'Minutes'), title: tr(m.title), sub: tr(m.owner), open: () => goto('meetingDetail', { selMeeting: m.id }) }));
  if (mayView('minuteTasks')) data.mtasks.filter((m) => match(m.task)).forEach((m) => results.push({ kind: rl('مهمة محضر', 'Minute task'), title: tr(m.task), sub: tr(m.meeting), open: () => goto('mtasks') }));
  if (mayView('myTasks')) data.otasks.filter((o) => match(o.title) && ownTask(o)).forEach((o) => results.push({ kind: rl('مهمة مكتب', 'Office task'), title: tr(o.title), sub: tr(o.owner) + ' · ' + tr(o.dept), open: () => goto('otasks') }));
  if (mayView('committees')) data.committees.filter((c) => match(c.name)).forEach((c) => results.push({ kind: rl('لجنة', 'Committee'), title: tr(c.name), sub: tr(c.rapporteur), open: () => goto('committees') }));
  if (mayView('leaves')) data.leaves.filter((l) => match(l.person)).forEach((l) => results.push({ kind: rl('إجازة', 'Leave'), title: tr(l.person), sub: tr(l.type) + ' · ' + tr(l.status), open: () => goto('leaves') }));

  return (
    <Fade>
      <div style={{ fontSize: 13, color: '#6d7973', marginBottom: 16 }}>
        {rl('نتائج البحث عن', 'Search results for')} "<strong style={{ color: '#17211c' }}>{search}</strong>" — {results.length} {rl('نتيجة', 'results')}
      </div>
      {results.map((r, i) => (
        <div key={i} onClick={r.open} className="glass" style={{ border: '1px solid #eef1ec', borderRadius: 16, padding: '15px 18px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 1px 2px rgba(20,45,32,.03),0 8px 22px rgba(20,45,32,.045)' }}>
          <span style={{ fontSize: 10.5, fontWeight: 600, color: '#5b6b62', background: '#eef0ec', borderRadius: 6, padding: '4px 9px', whiteSpace: 'nowrap' }}>{r.kind}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#17211c' }}>{r.title}</div>
            <div style={{ fontSize: 12, color: '#8a938c', marginTop: 2 }}>{r.sub}</div>
          </div>
          <svg className="flip-x" width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#c0c8bf" strokeWidth={2}><path d="m14 6-6 6 6 6" /></svg>
        </div>
      ))}
      {results.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#9aa39b', fontSize: 14 }}>{rl('لا توجد نتائج مطابقة', 'No matching results')}</div>}
    </Fade>
  );
}
