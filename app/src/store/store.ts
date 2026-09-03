import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { demoSeed as seedData } from '../data/seed.demo';
import type { AppData } from '../data/types';
import { WORK_ITEMS, type WorkItem } from '../domain/workflow';
import { SEED_USERS, type SeedUser } from '../domain/permissions';
import { APP_TODAY, APP_TODAY_AR } from '../shared/today';
import { verifyCredentials } from '../demo/auth';

export interface ChangeLogEntry {
  id: string;
  by: string;        // user id
  byName: string;
  date: string;
  section: string;
  item: string;
  from?: string;
  to?: string;
  note?: string;
  sentToChair?: boolean;
}

interface AppState {
  data: AppData;
  work: WorkItem[];
  users: SeedUser[];
  changeLog: ChangeLogEntry[];
  currentUserId: string;
  authUserId: string | null;   // demo session: who is signed in (null = show login)
  seq: number;

  login: (username: string, password: string) => boolean;
  logout: () => void;
  setCurrentUser: (id: string) => void;
  mutate: (fn: (d: AppData) => void) => void;
  mutateWork: (fn: (w: WorkItem[]) => void) => void;
  setUsers: (fn: (u: SeedUser[]) => void) => void;
  log: (e: Omit<ChangeLogEntry, 'id' | 'date'> & { date?: string }) => void;
  nextId: (prefix: string) => string;
  resetAll: () => void;
}

const clone = <T,>(v: T): T => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/** localStorage when available, else in-memory (sandboxed iframes of the hosted demo
 *  throw on any localStorage access — the demo then simply resets on reload). */
function safeStorage(): Storage {
  try {
    const t = '__moca_probe__';
    window.localStorage.setItem(t, '1');
    window.localStorage.removeItem(t);
    return window.localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
      setItem: (k: string, v: string) => { mem.set(k, v); },
      removeItem: (k: string) => { mem.delete(k); },
      clear: () => mem.clear(),
      key: (i: number) => Array.from(mem.keys())[i] ?? null,
      get length() { return mem.size; },
    } as Storage;
  }
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      data: clone(seedData),
      work: clone(WORK_ITEMS),
      users: clone(SEED_USERS),
      changeLog: [],
      currentUserId: 'chair',
      authUserId: null,
      seq: 1,

      login: (username, password) => {
        const uid = verifyCredentials(username, password);
        if (!uid) return false;
        set({ authUserId: uid, currentUserId: uid });
        return true;
      },
      logout: () => set({ authUserId: null }),
      setCurrentUser: (id) => set({ currentUserId: id }),

      mutate: (fn) => set((s) => { const data = clone(s.data); fn(data); return { data }; }),
      mutateWork: (fn) => set((s) => { const work = clone(s.work); fn(work); return { work }; }),
      setUsers: (fn) => set((s) => { const users = clone(s.users); fn(users); return { users }; }),

      log: (e) => set((s) => ({
        changeLog: [{ id: 'cl' + s.seq, date: e.date || todayAr(), ...e } as ChangeLogEntry, ...s.changeLog].slice(0, 200),
        seq: s.seq + 1,
      })),

      nextId: (prefix) => { const id = prefix + get().seq; set((s) => ({ seq: s.seq + 1 })); return id; },

      resetAll: () => set({ data: clone(seedData), work: clone(WORK_ITEMS), users: clone(SEED_USERS), changeLog: [], seq: 1 }),
    }),
    {
      name: 'moca.platform',
      version: 19,
      storage: createJSONStorage(safeStorage),
      // Permission-model corrections ship in the seed (e.g. Report Center scoping).
      // Refresh persisted users to the latest seed so the change applies on existing installs.
      migrate: (persisted, from) => {
        const s = persisted as (Partial<AppState> & { data?: any }) | undefined;
        if (s && typeof from === 'number' && from < 13) s.users = clone(SEED_USERS);
        // v14: the single finModel became a per-year finModels array.
        if (s && s.data && !s.data.finModels) {
          s.data.finModels = s.data.finModel ? [{ ...s.data.finModel, year: s.data.finModel.year || '2026' }] : clone(seedData.finModels);
          delete s.data.finModel;
        }
        // v15: the bank-interest figures became editable per-year model fields.
        if (s && s.data && Array.isArray(s.data.finModels)) {
          s.data.finModels.forEach((m: any) => {
            if (m && !m.bankInterest) m.bankInterest = { dailyAccounts: 0, fixedDeposits: 0, activeDeposits: 0 };
          });
        }
        // v16: "request update" became a real, notified collection.
        if (s && s.data && !s.data.updateRequests) s.data.updateRequests = [];
        // v19: per-person leave balances. Backfill so older installs don't read
        // `undefined` when opening the balances manager or a leave form.
        if (s && s.data && !s.data.leaveBalances) s.data.leaveBalances = [];
        // v17: documents no longer submit for approval — drop the ad-hoc queue.
        if (s && typeof from === 'number' && from < 17) s.work = [];
        return s as AppState;
      },
    }
  )
);

function todayAr(): string {
  return APP_TODAY_AR;
}

/** @deprecated import APP_TODAY from '../shared/today' instead. */
export const CURRENT_DATE = APP_TODAY;
