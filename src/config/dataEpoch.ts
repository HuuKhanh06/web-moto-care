// Must match supabase/admin/reset-for-launch.sql. This is a reset generation, not a secret or authorization token.
export const DATA_EPOCH = 'motocare-fresh-20261111-1';
const MARKER = 'motocare_data_epoch';

export function clearPreviousBrowserSession(local: Storage, session: Storage, projectRef: string): void {
  for (const storage of [local, session]) {
    if (storage.getItem(MARKER) === DATA_EPOCH) continue;
    const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter((key): key is string => Boolean(key));
    for (const key of keys) {
      if (key.startsWith('motocare_') || key === `sb-${projectRef}-auth-token` || key.startsWith(`sb-${projectRef}-auth-token-`)) storage.removeItem(key);
    }
    storage.setItem(MARKER, DATA_EPOCH);
  }
}
