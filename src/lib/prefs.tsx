import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

/** Device-level preferences (notifications, privacy), remembered on this phone. */
export interface Prefs {
  notify: {
    expenses: boolean;
    comments: boolean;
    payments: boolean;
    reminders: boolean;
    weekly: boolean;
  };
  privacy: {
    appLock: boolean;
    hideBalances: boolean;
    showPhone: boolean;
  };
}

export const DEFAULT_PREFS: Prefs = {
  notify: { expenses: true, comments: true, payments: true, reminders: true, weekly: false },
  privacy: { appLock: false, hideBalances: false, showPhone: true },
};

const KEY = 'splitwiser.prefs';

interface PrefsState {
  prefs: Prefs;
  /** What was saved on the device when the app launched (null until read). */
  atLaunch: Prefs | null;
  set: <S extends keyof Prefs>(section: S, key: keyof Prefs[S], value: boolean) => void;
}

const PrefsContext = createContext<PrefsState>({ prefs: DEFAULT_PREFS, atLaunch: null, set: () => {} });

export function PrefsProvider({ children }: PropsWithChildren) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [atLaunch, setAtLaunch] = useState<Prefs | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const saved = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
        const loaded = { notify: { ...DEFAULT_PREFS.notify, ...saved.notify }, privacy: { ...DEFAULT_PREFS.privacy, ...saved.privacy } };
        setPrefs(loaded);
        setAtLaunch(loaded);
      })
      .catch(() => setAtLaunch(DEFAULT_PREFS));
  }, []);

  const set = useCallback<PrefsState['set']>((section, key, value) => {
    setPrefs((prev) => {
      const next = { ...prev, [section]: { ...prev[section], [key]: value } };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return <PrefsContext.Provider value={{ prefs, atLaunch, set }}>{children}</PrefsContext.Provider>;
}

export const usePrefs = () => useContext(PrefsContext);
