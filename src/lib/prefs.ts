import Storage from 'expo-sqlite/kv-store';

/** Small synchronous key/value prefs that live only on this device. */
export const prefs = {
  get(key: string): string | null {
    try {
      return Storage.getItemSync(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value == null) Storage.removeItemSync(key);
      else Storage.setItemSync(key, value);
    } catch {
      // prefs are best-effort
    }
  },
};
