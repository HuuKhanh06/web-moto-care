import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { KH06Page } from '@/features/customer/KH06Page';
import { dataAdapter } from '@/db/adapter';
import { db } from '@/db';
import type { RentalRequest } from '@/db/types';
vi.mock('@/db/adapter', () => ({ dataAdapter: { getCustomerRentalRequests: vi.fn() }, STATUS_TO_NODES: {} }));
vi.mock('@/features/auth/authStore', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select({ currentActor: { id: 'customer', role: 'khach_hang' } }) }));
const request: RentalRequest = { id: 'trip-361D7D', customer_id: 'customer', status: 'CHO_HO_SO', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 };
const mount = () => render(<MemoryRouter><KH06Page /></MemoryRouter>);
beforeEach(async () => { vi.mocked(dataAdapter.getCustomerRentalRequests).mockReset(); await db.clearAllTables(); });
afterEach(cleanup);

describe('Customer trip status updates', () => {
  it('shows active/completed cloud rows instead of stale pending browser copies', async () => {
    await db.rental_requests.bulkAdd([request, { ...request, id: 'old-local-trip' }]);
    vi.mocked(dataAdapter.getCustomerRentalRequests).mockResolvedValue([{ ...request, status: 'HOAN_TAT' }, { ...request, id: 'trip-F8A561', status: 'DANG_THUE' }]);
    mount();
    expect(await screen.findByText('Đã hoàn tất')).toBeInTheDocument();
    expect(screen.getByText('Đang thuê xe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Lịch sử\s*\(\s*1\s*\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chờ xử lý\s*\(\s*0\s*\)/ })).toBeInTheDocument();
    expect(dataAdapter.getCustomerRentalRequests).toHaveBeenCalledWith('customer');
  });
  it('moves a finished trip from pending into history on a synchronization event', async () => {
    vi.mocked(dataAdapter.getCustomerRentalRequests).mockResolvedValueOnce([request]).mockResolvedValue([{ ...request, status: 'HOAN_TAT' }]);
    mount();
    await screen.findByText('Chờ thẩm định hồ sơ');
    await act(async () => { window.dispatchEvent(new CustomEvent('motocare_data_updated')); });
    await screen.findByText('Đã hoàn tất');
    fireEvent.click(screen.getByRole('button', { name: /Lịch sử\s*\(\s*1\s*\)/ }));
    expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
  });
  it('ignores an older pending response that arrives after a newer completed response', async () => {
    let finish!: (rows: RentalRequest[]) => void;
    vi.mocked(dataAdapter.getCustomerRentalRequests).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue([{ ...request, status: 'HOAN_TAT' }]);
    mount();
    await waitFor(() => expect(dataAdapter.getCustomerRentalRequests).toHaveBeenCalledTimes(1));
    await act(async () => { window.dispatchEvent(new CustomEvent('motocare_data_updated')); });
    await screen.findByText('Đã hoàn tất');
    await act(async () => { finish([request]); });
    expect(screen.queryByText('Chờ thẩm định hồ sơ')).not.toBeInTheDocument();
    expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
  });
  it('names the final staff evaluation stage explicitly instead of generic pending', async () => {
    vi.mocked(dataAdapter.getCustomerRentalRequests).mockResolvedValue([{ ...request, status: 'CHO_DANH_GIA_XE' }]);
    mount();
    expect(await screen.findByText('Chờ đánh giá chất lượng xe')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chờ xử lý\s*\(\s*1\s*\)/ })).toBeInTheDocument();
  });
});
