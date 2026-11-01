import { isLikelyBankSender, parseBankSms, smsHash } from './parser';

describe('parseBankSms', () => {
  it('parses HDFC multi-line UPI debit', () => {
    const sms =
      'Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 01/11/26\nRef 123456789012\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808';
    expect(parseBankSms(sms, 'VM-HDFCBK')).toEqual({ kind: 'expense', amount: 250, merchant: 'Swiggy', accountLast4: '1234' });
  });

  it('parses SBI debit without a currency marker', () => {
    const sms =
      'Dear UPI user A/C X5678 debited by 120.0 on date 01Nov26 trf to ZOMATO Refno 430512345678. If not u? call 1800111109. -SBI';
    expect(parseBankSms(sms, 'AD-SBIUPI')).toEqual({ kind: 'expense', amount: 120, merchant: 'Zomato', accountLast4: '5678' });
  });

  it('parses ICICI debit where the payee is "credited"', () => {
    const sms =
      'ICICI Bank Acct XX901 debited for Rs 1,499.00 on 31-Oct-26; AMAZON PAY credited. UPI:430598765432. Call 18002662 for dispute. SMS BLOCK 901 to 9215676766.';
    expect(parseBankSms(sms, 'JD-ICICIT')).toEqual({ kind: 'expense', amount: 1499, merchant: 'Amazon Pay', accountLast4: '901' });
  });

  it('parses Axis credit card spend', () => {
    const sms =
      'Spent INR 2,340.50 Axis Bank Card no. XX4321 31-10-26 19:22:10 IST Reliance Smart Avl Limit: INR 45,000.00 Not you? SMS BLOCK 4321 to 919951860002';
    expect(parseBankSms(sms, 'AX-AXISBK')).toEqual({
      kind: 'expense',
      amount: 2340.5,
      merchant: 'Reliance Smart',
      accountLast4: '4321',
    });
  });

  it('parses salary credit and ignores the available balance', () => {
    const sms =
      'Your A/c XX1234 is credited with INR 55,000.00 on 01-11-2026 by NEFT from ACME TECHNOLOGIES PVT LTD. Avl Bal INR 82,340.12 -HDFC Bank';
    expect(parseBankSms(sms, 'VM-HDFCBK')).toEqual({
      kind: 'income',
      amount: 55000,
      merchant: 'Acme Technologies Pvt Ltd',
      accountLast4: '1234',
    });
  });

  it('extracts merchant from a UPI VPA', () => {
    const sms = 'Sent Rs.99.00 from Kotak Bank AC X7788 to netflix@ybl on 30-10-26.UPI Ref 430511112222. Not you, https://kotak.com/fraud';
    expect(parseBankSms(sms, 'VK-KOTAKB')).toMatchObject({ kind: 'expense', amount: 99, merchant: 'Netflix', accountLast4: '7788' });
  });

  it('parses a card purchase "at" a merchant', () => {
    const sms = 'Rs.840.00 spent on your SBI Credit Card ending 3344 at DMART AVENUE on 29/10/26. Trxn. not done by you? Report at https://sbicard.com';
    expect(parseBankSms(sms, 'BZ-SBICRD')).toMatchObject({ kind: 'expense', amount: 840, merchant: 'Dmart Avenue', accountLast4: '3344' });
  });

  it('parses a refund as income', () => {
    const sms = 'Refund of Rs 349.00 has been credited to your A/c XX1234 from FLIPKART on 28-10-26.';
    expect(parseBankSms(sms, 'VM-HDFCBK')).toMatchObject({ kind: 'income', amount: 349, merchant: 'Flipkart' });
  });

  it.each([
    ['OTP', '123456 is your OTP for txn of Rs 500 at Amazon. Do not share it with anyone.'],
    ['promo', 'Get flat Rs.500 cashback on your first UPI payment! Download the app now.'],
    ['autopay reminder', 'Rs 499 will be debited from your a/c XX1234 on 05-11-26 for Netflix autopay.'],
    ['card statement', 'Your HDFC Card XX1234 statement is ready. Total amount due Rs 12,345. Min amount due Rs 620.'],
    ['failed txn', 'Your txn of Rs 1,200.00 at MYNTRA has failed. Any amount debited will be refunded.'],
    ['collect request', 'ZOMATO has requested money from you on PhonePe. Pay Rs 300 to approve.'],
  ])('skips %s messages', (_label, sms) => {
    expect(parseBankSms(sms, 'VM-HDFCBK')).toBeNull();
  });

  it('ignores SMS from personal phone numbers', () => {
    expect(parseBankSms('I sent you Rs 500 yesterday, check it', '+919876543210')).toBeNull();
  });
});

describe('helpers', () => {
  it('detects bank senders', () => {
    expect(isLikelyBankSender('VM-HDFCBK')).toBe(true);
    expect(isLikelyBankSender('+91 98765 43210')).toBe(false);
  });

  it('hashes deterministically', () => {
    expect(smsHash('A', 1, 'x')).toBe(smsHash('A', 1, 'x'));
    expect(smsHash('A', 1, 'x')).not.toBe(smsHash('A', 2, 'x'));
  });
});
