import Dexie from 'dexie';
import { afterEach, describe, expect, it } from 'vitest';
import { MotoCareDatabase, db } from '@/db';
import { DATA_EPOCH, clearPreviousBrowserSession } from '@/config/dataEpoch';
import { verifyPassword } from '@/features/auth/crypto';
import { readFileSync } from 'node:fs';

afterEach(() => { localStorage.clear(); sessionStorage.clear(); });
describe('Fresh launch reset', () => {
  it('reset SQL creates exactly three staff accounts with passwords recognized by the app', async () => {
    const sql = readFileSync('supabase/admin/reset-for-launch.sql', 'utf8');
    const records = [...sql.matchAll(/INSERT INTO public\.auth_accounts\(user_id,email,password_hash,salt\) VALUES \('([^']+)','([^']+)','([^']+)','([^']+)'\);/g)];
    expect(records.map(record => record[2]).sort()).toEqual(['admin@motocare.vn', 'nhanvien1@motocare.vn', 'nhanvien2@motocare.vn']);
    for (const record of records) expect(await verifyPassword('password123', record[3], record[4])).toBe(true);
  });
  it('clears old sessions and outbox once, without deleting unrelated website settings', () => {
    localStorage.setItem('motocare_sync_outbox', '[old customer write]');
    localStorage.setItem('sb-testproject-auth-token', 'old-token');
    localStorage.setItem('unrelated-setting', 'keep');
    sessionStorage.setItem('motocare_session', 'old-customer');
    clearPreviousBrowserSession(localStorage, sessionStorage, 'testproject');
    expect(localStorage.getItem('motocare_sync_outbox')).toBeNull();
    expect(localStorage.getItem('sb-testproject-auth-token')).toBeNull();
    expect(sessionStorage.getItem('motocare_session')).toBeNull();
    expect(localStorage.getItem('unrelated-setting')).toBe('keep');
    localStorage.setItem('motocare_sync_outbox', 'new legitimate write');
    sessionStorage.setItem('motocare_session', 'new-customer');
    clearPreviousBrowserSession(localStorage, sessionStorage, 'testproject');
    expect(localStorage.getItem('motocare_sync_outbox')).toBe('new legitimate write');
    expect(sessionStorage.getItem('motocare_session')).toBe('new-customer');
    expect(localStorage.getItem('motocare_data_epoch')).toBe(DATA_EPOCH);
  });
  it('also resets an old session in another tab after localStorage was already reset', () => {
    localStorage.setItem('motocare_data_epoch', DATA_EPOCH);
    sessionStorage.setItem('motocare_session', 'old-tab');
    clearPreviousBrowserSession(localStorage, sessionStorage, 'testproject');
    expect(sessionStorage.getItem('motocare_session')).toBeNull();
  });
  it('upgrades an existing browser DB, deleting customer data while preserving fleet catalog', async () => {
    const name = 'MotoCareLaunchResetTest';
    await Dexie.delete(name);
    const schema = Object.fromEntries(db.tables.map(table => [table.name,
      [table.schema.primKey.src, ...table.schema.indexes.map(index => index.src)].join(', ')]));
    const legacy = new Dexie(name);
    legacy.version(1).stores(schema);
    await legacy.open();
    await legacy.table('profiles').add({ id: 'old-customer', role: 'khach_hang', full_name: 'Old customer' });
    await legacy.table('auth_accounts').add({ user_id: 'old-customer', email: 'old@example.test' });
    await legacy.table('customer_documents').add({ id: 'private-image', request_id: 'old-rental', file_url: 'private-image' });
    await legacy.table('vehicles').add({ id: 'vehicle-1', plate: 'TEST-001', status: 'SAN_SANG' });
    legacy.close();
    const upgraded = new MotoCareDatabase(name);
    let outgoingDeletes = 0;
    upgraded.profiles.hook('deleting', (_key, _obj, transaction) => {
      if (!(transaction as unknown as Record<string, unknown>).__motocareRemote) outgoingDeletes++;
    });
    try {
      await upgraded.open();
      expect(await upgraded.profiles.count()).toBe(0);
      expect(await upgraded.auth_accounts.count()).toBe(0);
      expect(await upgraded.customer_documents.count()).toBe(0);
      expect(await upgraded.vehicles.count()).toBe(1);
      expect(outgoingDeletes).toBe(0);
    } finally { upgraded.close(); await Dexie.delete(name); }
  });
});
