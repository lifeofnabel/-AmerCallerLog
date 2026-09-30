import { latinDigits } from './text';

/**
 * Vergleichsschlüssel für Telefonnummern: nur Ziffern, deutsche Vorwahl vereinheitlicht.
 * „+49 176 123“, „0049176123“ und „0176-123“ ergeben alle „0176123“.
 */
export function phoneKey(value: string): string {
  let digits = latinDigits(value).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = `00${digits.slice(1)}`;
  digits = digits.replace(/\D/g, '');
  if (digits.startsWith('0049')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('49') && digits.length >= 11) digits = `0${digits.slice(2)}`;
  return digits;
}

/** Eingabe aufräumen: lateinische Ziffern, nur übliche Zeichen, einfache Leerzeichen. */
export function cleanPhone(value: string): string {
  return latinDigits(value)
    .replace(/[^\d+ ()/-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Mindestens so viele Ziffern, damit eine Nummer als Nummer gilt. */
export const MIN_PHONE_DIGITS = 5;

/** Beim Tippen: Ziffern vereinheitlichen und Fremdzeichen entfernen, aber nichts kürzen. */
export function typingPhone(value: string): string {
  return latinDigits(value).replace(/[^\d+ ()/-]/g, '');
}
