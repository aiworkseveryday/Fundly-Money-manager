const MAX_SHORT = 10;

/** First word of a display name (or email-style handle), capitalised and capped, e.g. "dharmesh.kumar99" -> "Dharmesh". */
export function shortName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/[\s._\-@\d]+/).find(Boolean) ?? '';
  if (!first) return 'there';
  const cap = first[0].toUpperCase() + first.slice(1).toLowerCase();
  return cap.length > MAX_SHORT ? `${cap.slice(0, MAX_SHORT)}…` : cap;
}

/** Two-letter avatar text: initials of the first two words, or the first two letters of a single word. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s._\-@\d]+/).filter(Boolean);
  if (!words.length) return '?';
  const raw = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return raw.toUpperCase();
}
