import { formatINR, parseAmount } from './money';

describe('formatINR', () => {
  it('uses Indian digit grouping', () => {
    expect(formatINR(123456789)).toBe('₹12,34,56,789');
    expect(formatINR(1000)).toBe('₹1,000');
    expect(formatINR(999)).toBe('₹999');
  });

  it('keeps decimals only when needed', () => {
    expect(formatINR(1250.5)).toBe('₹1,250.50');
    expect(formatINR(1250, { decimals: true })).toBe('₹1,250.00');
  });

  it('handles signs and compact form', () => {
    expect(formatINR(-500)).toBe('-₹500');
    expect(formatINR(500, { signed: true })).toBe('+₹500');
    expect(formatINR(150000, { compact: true })).toBe('₹1.5L');
    expect(formatINR(25000000, { compact: true })).toBe('₹2.5Cr');
    expect(formatINR(12500, { compact: true })).toBe('₹12.5K');
  });
});

describe('parseAmount', () => {
  it('parses valid input', () => {
    expect(parseAmount('1,250.5')).toBe(1250.5);
    expect(parseAmount('₹ 99')).toBe(99);
  });

  it('rejects invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('12.345')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});
