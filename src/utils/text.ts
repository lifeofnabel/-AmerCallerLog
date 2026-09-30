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
 * Vergleichsschlüssel für Namen: Groß/klein, Leerzeichen, Satzzeichen, unsichtbare Richtungszeichen,
 * arabische Diakritika und häufige Schreibvarianten spielen keine Rolle:
 * أ/إ/آ/ٱ → ا · ة → ه · ى/ی/ئ → ي · ؤ → و · ک → ك · ـ (Tatweel) weg.
 */
export function nameKey(value: string): string {
  return latinDigits(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g, '')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىیئ]/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ک/g, 'ك')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:'"`´()\-_/]+/g, ' ')
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
