import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { seedData } from '../data/seed';
import type { AppData } from '../data/types';
import { WORK_ITEMS, type WorkItem } from '../domain/workflow';
import { SEED_USERS, type SeedUser } from '../domain/permissions';

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
  seq: number;

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
      seq: 1,

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
      version: 7,
      storage: createJSONStorage(safeStorage),
    }
  )
);

function todayAr(): string {
  // The prototype's "today" is anchored around early July 2026; keep it stable.
  return '15 يوليو 2026';
}

export const CURRENT_DATE = new Date(2026, 6, 6); // 6 July 2026 — prototype "today"
