import { useCallback, useEffect, useState } from 'react';
import { subscribeBackupState } from '@/services/backup';
import { isoWeekKey } from '@/utils/dates';

const DISMISS_KEY = 'callerlog:backup-dismissed-week';

/**
 * Wochen-Erinnerung ans Backup: ab Montag sichtbar, bis in dieser Woche jemand (egal auf welchem Gerät)
 * das Backup geladen hat. „Später“ blendet sie auf diesem Gerät für den Rest der Woche aus.
 */
export function useBackupReminder(): { visible: boolean; dismiss: () => void } {
  const week = isoWeekKey(new Date());
  const [lastWeek, setLastWeek] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState<string | null>(() => {
    try {
      return window.localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => subscribeBackupState(setLastWeek), []);

  const dismiss = useCallback(() => {
    setDismissed(week);
    try {
      window.localStorage.setItem(DISMISS_KEY, week);
    } catch {
      /* dann eben nur bis zum Neuladen */
    }
  }, [week]);

  return { visible: lastWeek !== undefined && lastWeek !== week && dismissed !== week, dismiss };
}
