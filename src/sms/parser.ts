export type ParsedSms = {
  kind: 'expense' | 'income';
  amount: number;
  merchant: string | null;
  accountLast4: string | null;
};

const AMOUNT = String.raw`([\d,]+(?:\.\d{1,2})?)`;
const CURRENCY_AMOUNT = new RegExp(String.raw`(?:rs\.?|inr|₹)\s*` + AMOUNT, 'i');
// SBI style: "debited by 120.0" with no currency marker
const VERB_AMOUNT = new RegExp(String.raw`(?:debited|credited)\s+(?:by|for|with)\s+(?:rs\.?|inr|₹)?\s*` + AMOUNT, 'i');

const DEBIT_WORDS = /\b(debited|spent|paid|withdrawn|sent|purchase[d]?|deducted|transferred)\b/i;
const CREDIT_WORDS = /\b(credited|received|deposited|refund(?:ed)?)\b/i;

// Messages that mention money but are not completed transactions
const SKIP_PATTERNS = [
  /\b(otp|one[- ]time password|verification code|passcode)\b/i,
  /\bwill be (debited|charged|deducted)\b/i,
  /\b(collect request|requested money|has requested)\b/i,
  /\b(due date|min(?:imum)? amount due|total amount due|amt due)\b/i,
  /\b(failed|declined|reversed)\b/i,
];

const ACCOUNT_LAST4 =
  /(?:a\/c|acct|account|card|\bac)\.?\s*(?:no\.?)?\s*(?:ending\s*(?:with|in)?\s*)?[x*\s]*(\d{3,6})\b/i;

const STOP = String.raw`(?=\s+(?:on|via|ref|refno|upi|using|txn|avl|for|thru|through|dated|info)\b|[.,;\n]|$)`;
const MERCHANT_PATTERNS: RegExp[] = [
  // UPI VPA: "to swiggy@icici" -> swiggy
  /\bto\s+(?:vpa\s+)?([a-z0-9._-]+)@[a-z]+/i,
  // ICICI: "...; AMAZON PAY credited."
  /;\s*([A-Za-z0-9 .&'-]{2,40}?)\s+credited\b/i,
  // Axis cards: "... 19:22:10 IST Reliance Smart Avl Limit"
  /\bIST\s+(.+?)\s+Avl\b/i,
  // "trf to ZOMATO Refno", "To SWIGGY\n", "at DMART on", "towards NETFLIX"
  new RegExp(String.raw`\b(?:trf to|to|at|towards|info:?)\s+([A-Za-z0-9][A-Za-z0-9 .&'*/-]{1,40}?)` + STOP, 'i'),
];
const INCOME_SOURCE = new RegExp(String.raw`\b(?:from|by)\s+(?:neft\s+from\s+|imps\s+from\s+)?([A-Za-z0-9][A-Za-z0-9 .&'-]{1,50}?)` + STOP, 'i');

// Words that show up after "to/at/from" but are not merchants
const NOT_MERCHANT = /^(your|you|the|a\/c|ac|acct|account|card|bank|upi|neft|imps|rtgs|self|mobile|beneficiary|hdfc bank a\/c|\d+)$/i;

function cleanMerchant(raw: string | undefined): string | null {
  if (!raw) return null;
  let m = raw.replace(/\s+/g, ' ').replace(/[.,;:\-*/]+$/, '').trim();
  if (m.length < 2 || NOT_MERCHANT.test(m) || /\ba\/c\b|\bx{2,}\d+/i.test(m)) return null;
  if (m === m.toUpperCase() || m === m.toLowerCase()) {
    m = m.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
  }
  return m;
}

function toNumber(s: string): number {
  return Number(s.replace(/,/g, ''));
}

/** Personal phone numbers send chat SMS, not bank alerts. */
export function isLikelyBankSender(address: string | null | undefined): boolean {
  if (!address) return false;
  return !/^\+?\d{6,}$/.test(address.replace(/\s/g, ''));
}

/** Extracts a completed debit/credit from an Indian bank or UPI SMS, or null if it is not one. */
export function parseBankSms(body: string, sender?: string): ParsedSms | null {
  if (sender !== undefined && !isLikelyBankSender(sender)) return null;
  if (SKIP_PATTERNS.some((p) => p.test(body))) return null;

  const debit = DEBIT_WORDS.exec(body);
  const credit = CREDIT_WORDS.exec(body);
  if (!debit && !credit) return null;
  // The earliest verb decides, e.g. ICICI "Acct debited ...; MERCHANT credited"
  const kind: ParsedSms['kind'] = debit && (!credit || debit.index < credit.index) ? 'expense' : 'income';

  const amountMatch = CURRENCY_AMOUNT.exec(body) ?? VERB_AMOUNT.exec(body);
  if (!amountMatch) return null;
  const amount = toNumber(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const accountLast4 = ACCOUNT_LAST4.exec(body)?.[1] ?? null;

  let merchant: string | null = null;
  if (kind === 'income') {
    merchant = cleanMerchant(INCOME_SOURCE.exec(body)?.[1]);
  } else {
    for (const p of MERCHANT_PATTERNS) {
      merchant = cleanMerchant(p.exec(body)?.[1]);
      if (merchant) break;
    }
  }

  return { kind, amount, merchant, accountLast4 };
}

/** Stable 53-bit hash (cyrb53) so the same SMS is never imported twice. */
export function smsHash(sender: string, date: number, body: string): string {
  const str = `${sender}|${date}|${body}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
