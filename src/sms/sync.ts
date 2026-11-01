import { PermissionsAndroid, Platform } from 'react-native';

import { isSmsReaderAvailable, readInbox } from '@modules/sms-reader';
import { prefs } from '@/lib/prefs';
import { supabase, unwrap } from '@/lib/supabase';
import { parseBankSms, smsHash } from './parser';

const LAST_SYNC_KEY = 'sms.lastSync';
/** First sync looks back this far */
const INITIAL_LOOKBACK_DAYS = 45;

export const smsSupported = Platform.OS === 'android' && isSmsReaderAvailable;

export async function hasSmsPermission() {
  if (!smsSupported) return false;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_SMS);
}

export async function requestSmsPermission() {
  if (!smsSupported) return false;
  const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Let Fundy read bank SMS?',
    message:
      'Fundly scans bank and UPI alerts on this phone to suggest transactions. Nothing is saved until you review it, and personal chats are skipped.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });
  return res === PermissionsAndroid.RESULTS.GRANTED;
}

/** Reads new bank SMS, parses them and queues them in the review inbox. Returns how many were queued. */
export async function syncSms(): Promise<number> {
  if (!(await hasSmsPermission())) return 0;

  const stored = Number(prefs.get(LAST_SYNC_KEY));
  const since = stored > 0 ? stored : Date.now() - INITIAL_LOOKBACK_DAYS * 86_400_000;
  const messages = await readInbox(since, 500);
  if (!messages.length) return 0;

  const rows = messages.flatMap((sms) => {
    const parsed = parseBankSms(sms.body, sms.address);
    if (!parsed) return [];
    return [
      {
        sms_hash: smsHash(sms.address, sms.date, sms.body),
        sender: sms.address,
        body: sms.body,
        kind: parsed.kind,
        amount: parsed.amount,
        merchant: parsed.merchant,
        account_last4: parsed.accountLast4,
        occurred_at: new Date(sms.date).toISOString(),
      },
    ];
  });

  if (rows.length) {
    const inserted = unwrap(
      await supabase.from('sms_pending').upsert(rows, { onConflict: 'user_id,sms_hash', ignoreDuplicates: true }).select('id'),
    ) as { id: string }[];
    prefs.set(LAST_SYNC_KEY, String(Math.max(...messages.map((m) => m.date))));
    return inserted.length;
  }
  prefs.set(LAST_SYNC_KEY, String(Math.max(...messages.map((m) => m.date))));
  return 0;
}

export function resetSmsSync() {
  prefs.set(LAST_SYNC_KEY, null);
}
