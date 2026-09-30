import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_RULES, subscribeRules, type Rules } from '@/services/settings';

const RulesContext = createContext<Rules>(DEFAULT_RULES);

/** Regeln live aus Firestore – ändert jemand die Einstellungen, gilt es sofort auf allen Geräten. */
export function RulesProvider({ children }: { children: ReactNode }): JSX.Element {
  const [rules, setRules] = useState<Rules>(DEFAULT_RULES);
  useEffect(() => subscribeRules(setRules), []);
  return <RulesContext.Provider value={rules}>{children}</RulesContext.Provider>;
}

export function useRules(): Rules {
  return useContext(RulesContext);
}
