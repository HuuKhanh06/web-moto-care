import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const cloud = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { from: cloud.from } }));
import { dataAdapter } from '@/db/adapter';
import { db } from '@/db';

beforeEach(async () => {
  vi.clearAllMocks(); await db.clearAllTables(); dataAdapter.setMode('LIVE');
  cloud.from.mockReturnValue({ select: cloud.select }); cloud.select.mockReturnValue({ eq: cloud.eq }); cloud.eq.mockReturnValue({ order: cloud.order });
  await db.rental_requests.add({ id: 'stale-trip', customer_id: 'customer', status: 'CHO_HO_SO', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 });
});
afterEach(() => { vi.restoreAllMocks(); dataAdapter.setMode('DEMO'); });
describe('Customer trip cloud source', () => {
  it('reads authoritative status with a customer ownership filter', async () => {
    const rows = [{ id: 'stale-trip', customer_id: 'customer', status: 'HOAN_TAT' }];
    cloud.order.mockResolvedValue({ data: rows, error: null });
    expect(await dataAdapter.getCustomerRentalRequests('customer')).toEqual(rows);
    expect(cloud.eq).toHaveBeenCalledWith('customer_id', 'customer');
  });
  it('does not resurrect deleted cached trips when cloud returns zero rows', async () => {
    cloud.order.mockResolvedValue({ data: [], error: null });
    expect(await dataAdapter.getCustomerRentalRequests('customer')).toEqual([]);
    expect(await db.rental_requests.count()).toBe(1);
  });
  it('reports an online fetch failure rather than silently presenting stale pending status', async () => {
    cloud.order.mockResolvedValue({ data: null, error: new Error('cloud unavailable') });
    await expect(dataAdapter.getCustomerRentalRequests('customer')).rejects.toThrow('cloud unavailable');
  });
  it('keeps scoped local history available when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect((await dataAdapter.getCustomerRentalRequests('customer')).map(row => row.id)).toEqual(['stale-trip']);
    expect(cloud.from).not.toHaveBeenCalled();
  });
});
