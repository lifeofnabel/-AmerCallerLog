export type Category = 'passport' | 'id' | 'poa';
export type Status = 'open' | 'completed' | 'cancelled';

export const CATEGORIES: readonly Category[] = ['passport', 'id', 'poa'];
export const STATUSES: readonly Status[] = ['open', 'completed', 'cancelled'];

export const CATEGORY_LABELS: Record<Category, { ar: string; de: string }> = {
  passport: { ar: 'جواز', de: 'Pass' },
  id: { ar: 'وطنية', de: 'Ausweis' },
  poa: { ar: 'وكالة', de: 'Vollmacht' },
};

export const STATUS_LABELS: Record<Status, { ar: string; de: string }> = {
  open: { ar: 'مفتوح', de: 'Offen' },
  completed: { ar: 'مكتمل', de: 'Erledigt' },
  cancelled: { ar: 'ملغى', de: 'Storniert' },
};

export interface Person {
  uid: string;
  name: string;
}

/** Ein Antrag, wie ihn die Oberfläche sieht (Zeiten als Date). */
export interface Application {
  id: string;
  sequenceNumber: number;
  name: string;
  phone: string;
  category: Category;
  details: string;
  status: Status;
  /** Status vor dem Stornieren – beim Wiederherstellen gilt er wieder. */
  previousStatus: Exclude<Status, 'cancelled'> | null;
  /** Datum/Uhrzeit des Antrags (standardmäßig der Zeitpunkt der Erfassung). */
  receivedAt: Date;
  /** Kalendertag von receivedAt (JJJJ-MM-TT, Ortszeit) – für „Heute“. */
  day: string;
  createdAt: Date | null;
  createdBy: Person;
  updatedAt: Date | null;
  updatedBy: Person;
  cancelledAt: Date | null;
  /** Noch nicht beim Server angekommen (offline). */
  pending: boolean;
}

/** Eingaben aus Formular oder Bearbeiten-Dialog. */
export interface ApplicationInput {
  name: string;
  phone: string;
  category: Category;
  details: string;
  /** null = jetzt */
  receivedAt: Date | null;
}
