import { useEffect, useState } from 'react';
import { useNav } from '../store/nav';
import { useCurrentUser } from '../store/useCurrentUser';
import { canSee } from '../domain/permissions';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { NAV_SECTION } from './navConfig';
import { Router } from './Router';
import { GlobalSearch } from '../screens/GlobalSearch';
import { ExecutiveAssistant } from '../screens/ExecutiveAssistant';
import { useI18n } from '../i18n/i18n';

const COLLAPSE_KEY = 'moca.sideCollapsed';

export function Shell() {
  const { page, goto, search } = useNav();
  const cu = useCurrentUser();
  const { dir } = useI18n();
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(COLLAPSE_KEY) === '1'; } catch { return false; }
  });
  const [menuOpen, setMenuOpen] = useState(false);

  const toggleCollapse = () => setCollapsed((v) => { const nv = !v; try { localStorage.setItem(COLLAPSE_KEY, nv ? '1' : '0'); } catch { /* ignore */ } return nv; });

  // Redirect to dashboard when the current user loses access to the current page.
  useEffect(() => {
    const sec = NAV_SECTION[page];
    if (sec && sec !== 'dashboard' && cu.type !== 'chair' && !canSee(cu, sec)) {
      goto('dashboard');
    }
  }, [cu, page, goto]);

  const isSearching = search.trim().length > 0;

  return (
    <div dir={dir} className="app-root">
      <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} menuOpen={menuOpen} onCloseMenu={() => setMenuOpen(false)} />
      <div className={'app-scrim' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="app-scroll app-main" style={{ flex: 1, overflowY: 'auto', padding: '26px 28px 104px' }}>
          {isSearching ? <GlobalSearch /> : <Router />}
        </main>
      </div>
      <ExecutiveAssistant />
    </div>
  );
}
