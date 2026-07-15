import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';

interface ToastCtx { showToast: (msg: string) => void }
const Ctx = createContext<ToastCtx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<number | null>(null);

  const showToast = useCallback((m: string) => {
    setMsg(m);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 3200);
  }, []);

  return (
    <Ctx.Provider value={{ showToast }}>
      {children}
      {msg && (
        <div style={{
          position: 'fixed', bottom: 26, left: '50%', transform: 'translateX(-50%)',
          zIndex: 400, background: '#132b20', color: '#fff', fontSize: 13, fontWeight: 600,
          padding: '12px 20px', borderRadius: 13, boxShadow: '0 16px 40px -12px rgba(19,43,32,.5)',
          animation: 'asstIn .22s ease', maxWidth: '90vw', textAlign: 'center',
        }}>{msg}</div>
      )}
    </Ctx.Provider>
  );
}

export function useToast(): ToastCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast must be used within ToastProvider');
  return c;
}
