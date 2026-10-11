import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { loadConfig, saveConfig, supabase, activateConfig, type BackendConfig } from './supabase';

interface AuthState {
  ready: boolean;
  configured: boolean;
  session: Session | null;
  /** Switch to (or clear) a backend at runtime; signs out of the previous one. */
  setBackend: (config: BackendConfig | null) => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  ready: false,
  configured: false,
  session: null,
  setBackend: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [generation, setGeneration] = useState(0);

  // Load the stored backend once.
  useEffect(() => {
    let alive = true;
    loadConfig().then((config) => {
      if (!alive) return;
      activateConfig(config);
      setConfigured(!!config);
      setGeneration((g) => g + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // (Re)subscribe to auth whenever the client changes.
  useEffect(() => {
    if (generation === 0) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => alive && setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => alive && setSession(s));
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [generation]);

  const setBackend = useCallback(async (config: BackendConfig | null) => {
    await supabase.auth.signOut().catch(() => {});
    await saveConfig(config);
    setSession(undefined);
    setConfigured(!!config);
    setGeneration((g) => g + 1);
  }, []);

  const ready = configured !== null && (configured === false || session !== undefined);
  return (
    <AuthContext.Provider value={{ ready, configured: !!configured, session: session ?? null, setBackend }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
