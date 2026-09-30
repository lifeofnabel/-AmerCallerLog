const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Arabische und persische Ziffern in lateinische umwandeln. */
export function latinDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_INDIC.indexOf(d);
    return String(a >= 0 ? a : PERSIAN.indexOf(d));
  });
}

/**
 * Vergleichsschlüssel für Namen: Groß/klein, Leerzeichen, arabische Diakritika und
 * häufige Schreibvarianten (أ/إ/آ → ا, ة → ه, ى → ي) spielen keine Rolle.
 */
export function nameKey(value: string): string {
  return latinDigits(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Enthält der Text arabische Schrift? Dann rechts-nach-links darstellen. */
export function hasArabic(value: string): boolean {
  return /[؀-ۿݐ-ݿ]/.test(value);
}

/** Leerzeichen am Rand weg, mehrfache Leerzeichen zusammenfassen. */
export function cleanText(value: string): string {
  return value.replace(/[ \t]+/g, ' ').trim();
}
