import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

export type RawSms = {
  id: string;
  address: string;
  body: string;
  /** Unix epoch milliseconds */
  date: number;
};

type SmsReaderNative = {
  readInbox(sinceMs: number, limit: number): Promise<RawSms[]>;
};

const native = Platform.OS === 'android' ? requireOptionalNativeModule<SmsReaderNative>('SmsReader') : null;

export const isSmsReaderAvailable = native != null;

export function readInbox(sinceMs: number, limit = 500): Promise<RawSms[]> {
  if (!native) return Promise.resolve([]);
  return native.readInbox(sinceMs, limit);
}
