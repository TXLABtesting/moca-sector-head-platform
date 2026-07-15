import { createContext, useContext, useState, useCallback, useMemo, useRef, type ReactNode } from 'react';

export type Page =
  | 'dashboard' | 'team' | 'projects' | 'projectDetail'
  | 'meetings' | 'meetingDetail' | 'mtasks' | 'actions' | 'reqmeetings'
  | 'correspondence' | 'docDetail'
  | 'committees'
  | 'reportcenter' | 'reportDetail' | 'auditDetail' | 'finDetail' | 'reglog'
  | 'otasks' | 'leaves' | 'workspace' | 'settings' | 'notifications';

export interface NavParams {
  selProject?: string | null;
  selMeeting?: string | null;
  selDoc?: string | null;
  [k: string]: unknown;
}

interface NavCtx {
  page: Page;
  params: NavParams;
  goto: (page: Page, params?: NavParams) => void;
  back: () => void;
  search: string;
  setSearch: (s: string) => void;
}

const Ctx = createContext<NavCtx | null>(null);

const DETAIL_PARENT: Partial<Record<Page, Page>> = {
  projectDetail: 'projects',
  meetingDetail: 'meetings',
  docDetail: 'correspondence',
  reportDetail: 'reportcenter',
  auditDetail: 'reportcenter',
  finDetail: 'reportcenter',
  reglog: 'reportcenter',
  mtasks: 'meetings',
};

export function NavProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('dashboard');
  const [params, setParams] = useState<NavParams>({});
  const [search, setSearch] = useState('');
  const prev = useRef<Page>('dashboard');

  const goto = useCallback((next: Page, p?: NavParams) => {
    setPage((cur) => { prev.current = cur; return next; });
    setParams(p || {});
    setSearch('');
    const main = document.querySelector('.app-main');
    if (main) main.scrollTop = 0;
  }, []);

  const back = useCallback(() => {
    setPage((cur) => {
      const from = prev.current;
      const parent = DETAIL_PARENT[cur] || 'dashboard';
      const target = (from && from !== cur) ? from : parent;
      prev.current = cur;
      setParams({});
      return target;
    });
  }, []);

  const value = useMemo<NavCtx>(() => ({ page, params, goto, back, search, setSearch }), [page, params, goto, back, search]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNav(): NavCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useNav must be used within NavProvider');
  return c;
}
