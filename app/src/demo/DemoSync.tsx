/* Bootstraps shared-database sync WITHOUT changing the store's public API, so
 * every screen keeps using `data` / `mutate` exactly as before.
 *
 *   backend → store : initial load + Realtime pushes from other clients
 *   store → backend : debounced save on every local change
 *
 * A re-entrancy guard stops a remote update from immediately being echoed back.
 * When the backend is disabled this component renders nothing and does nothing —
 * the app stays on its browser-local store. */
import { useEffect } from 'react';
import { useStore } from '../store/store';
import { demoSeed } from '../data/seed.demo';
import { SEED_USERS } from '../domain/permissions';
import { backendEnabled, loadState, saveState, seedBaselineIfEmpty, subscribe, type DemoState } from './demoBackend';

let applyingRemote = false;

export function DemoSync() {
  useEffect(() => {
    if (!backendEnabled) return;
    let unsubStore = () => {};
    let unsubRealtime = () => {};
    let cancelled = false;

    (async () => {
      // 1) Hydrate from the shared record (or seed it on first run).
      const remote = await loadState();
      if (cancelled) return;
      // Establish the reset baseline from the SHIPPED seed (not the possibly
      // mutated local cache) on first ever run.
      await seedBaselineIfEmpty({ data: demoSeed, users: SEED_USERS, changeLog: [], seq: 1 });
      if (cancelled) return;
      if (remote) {
        applyRemote(remote);
      } else {
        saveState({ data: demoSeed, users: SEED_USERS, changeLog: [], seq: 1 });
      }

      // 2) Push local changes to the backend (debounced), skipping remote echoes.
      unsubStore = useStore.subscribe((s) => {
        if (applyingRemote) return;
        saveState({ data: s.data, users: s.users, changeLog: s.changeLog, seq: s.seq });
      });

      // 3) Apply changes made by other clients.
      unsubRealtime = subscribe((state) => applyRemote(state));
    })();

    return () => { cancelled = true; unsubStore(); unsubRealtime(); };
  }, []);

  return null;
}

function applyRemote(state: DemoState) {
  applyingRemote = true;
  try {
    useStore.setState({
      data: state.data,
      users: state.users,
      changeLog: state.changeLog,
      ...(state.seq != null ? { seq: state.seq } : {}),
    });
  } finally {
    // Release after the current tick so the triggered subscriptions see the flag.
    setTimeout(() => { applyingRemote = false; }, 0);
  }
}
