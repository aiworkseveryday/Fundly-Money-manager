/** Two-letter avatar text: initials of the first two words, or the first two letters of a single word. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/[\s._\-@\d]+/).filter(Boolean);
  if (!words.length) return '?';
  const raw = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2);
  return raw.toUpperCase();
}
