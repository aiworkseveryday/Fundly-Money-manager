/** Groups an integer string the Indian way: 1234567 -> 12,34,567 */
function groupIndian(intPart: string): string {
  if (intPart.length <= 3) return intPart;
  const last3 = intPart.slice(-3);
  const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

type FormatOptions = {
  /** Show "+" for positive values */
  signed?: boolean;
  /** Always show two decimals instead of dropping ".00" */
  decimals?: boolean;
  /** 1.2L / 3.4Cr / 12.5K style */
  compact?: boolean;
};

export function formatINR(value: number, opts: FormatOptions = {}): string {
  const negative = value < 0;
  const abs = Math.abs(value);
  let body: string;

  if (opts.compact && abs >= 1000) {
    const units: [number, string][] = [
      [1e7, 'Cr'],
      [1e5, 'L'],
      [1e3, 'K'],
    ];
    const [div, suffix] = units.find(([d]) => abs >= d)!;
    body = `${parseFloat((abs / div).toFixed(1))}${suffix}`;
  } else {
    const fixed = abs.toFixed(2);
    const [intPart, frac] = fixed.split('.');
    const showFrac = opts.decimals || frac !== '00';
    body = groupIndian(intPart) + (showFrac ? `.${frac}` : '');
  }

  const sign = negative ? '-' : opts.signed && value > 0 ? '+' : '';
  return `${sign}₹${body}`;
}

/** Parses user input like "1,250.5" into a number, or null when invalid. */
export function parseAmount(input: string): number | null {
  const cleaned = input.replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return n > 0 ? n : null;
}

/** Supabase returns numeric columns as strings; normalise to numbers. */
export function num(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}
