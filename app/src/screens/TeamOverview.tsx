import { Fade, Avatar } from '../components/ui';
import { useStore } from '../store/store';
import { useNav } from '../store/nav';
import { useI18n } from '../i18n/i18n';

const WS_COLORS: Record<string, [string, string]> = {
  'ضمن الخطة': ['#e2f0e8', '#2e7d55'],
  'يحتاج متابعة': ['#fbf0d6', '#a9791f'],
  'حِمل مرتفع': ['#f7e6e4', '#b0433b'],
};

export function TeamOverview() {
  const { lang, t, tr, dl } = useI18n();
  const rl = (a: string, b: string) => (lang === 'en' ? b : a);
  const { goto } = useNav();
  const members = useStore((s) => s.data.members);

  return (
    <Fade>
      <div className="rg3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
        {members.map((m) => {
          const [lateBg, lateFg] = m.lateTasks > 0 ? ['#f7e6e4', '#b0433b'] : ['#f7f8f6', '#17211c'];
          const [stBg, stFg] = WS_COLORS[m.workStatus] || ['#eef1ec', '#6d7973'];
          return (
            <div key={m.id} style={{ background: '#ffffff', borderRadius: 24, boxShadow: '0 2px 6px rgba(23,40,32,.04),0 18px 40px -14px rgba(23,40,32,.13)', padding: 20, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
                <span style={{ width: 52, height: 52, flex: 'none', borderRadius: 14, overflow: 'hidden' }}><Avatar name={m.name} size={52} radius={14} /></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15.5, fontWeight: 600, color: '#17211c' }}>{tr(m.name)}</div>
                  <div style={{ fontSize: 12, color: '#7d867f', marginTop: 2 }}>{tr(m.role)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 14 }}>
                <Stat v={m.projects} label={t('assignedProjects')} />
                <Stat v={m.openTasks} label={t('openTasks')} />
                <Stat v={m.updates} label={t('recentUpdates')} />
                <Stat v={m.lateTasks} label={t('overdueTasks')} bg={lateBg} fg={lateFg} />
              </div>
              <div style={{ fontSize: 11, color: '#8a938c', marginBottom: 3 }}>{t('lastUpdate')}</div>
              <div style={{ fontSize: 12.5, color: '#2a332d', lineHeight: 1.5, marginBottom: 14, flex: 1 }}>{tr(m.last)} <span style={{ color: '#9aa39b' }}>· {dl(m.lastDate)}</span></div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, borderTop: '1px solid #f2f4f0' }}>
                <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '5px 11px', background: stBg, color: stFg }}>{tr(m.workStatus)}</span>
                <a onClick={() => goto('projects')} style={{ fontSize: 12.5, color: '#2b5c44', fontWeight: 600, cursor: 'pointer' }}>{rl('عرض المشاريع', 'View projects')}</a>
              </div>
            </div>
          );
        })}
      </div>
    </Fade>
  );
}

function Stat({ v, label, bg = '#f7f8f6', fg = '#17211c' }: { v: number; label: string; bg?: string; fg?: string }) {
  return (
    <div style={{ background: bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ fontSize: 19, fontWeight: 700, color: fg }}>{v}</div>
      <div style={{ fontSize: 10.5, color: '#8a938c' }}>{label}</div>
    </div>
  );
}
