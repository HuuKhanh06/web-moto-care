import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { NV01Page } from '@/features/staff/NV01Page';
import { NVDocumentsPage } from '@/features/staff/NVDocumentsPage';
import { db } from '@/db';
import { engine } from '@/engine';
vi.mock('@/db/adapter', () => ({ dataAdapter: { syncCloudToLocal: vi.fn().mockResolvedValue(undefined) }, STATUS_TO_NODES: {} }));
const auth = vi.hoisted(() => ({ currentActor: { id: 'staff', role: 'nhan_vien' } }));
vi.mock('@/features/auth/authStore', () => ({ useAuthStore: (select: (value: unknown) => unknown) => select(auth) }));
function Destination() { return <p>{useLocation().pathname + useLocation().search}</p>; }
beforeEach(async () => {
  await db.clearAllTables();
  await db.rental_requests.add({ id: 'new-request', customer_id: 'customer', status: 'CHO_HO_SO', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 });
  await db.process_state.add({ request_id: 'new-request', waiting_node_ids: ['M_CheckDocs'], variables: {}, loop_counters: {}, updated_at: new Date().toISOString() });
});
afterEach(cleanup);
describe('Staff task routes', () => {
  it('process document task opens its review screen instead of returning to the inbox', async () => {
    render(<MemoryRouter initialEntries={['/nv/01']}><Routes><Route path="/nv/01" element={<NV01Page />} /><Route path="/nv/documents" element={<Destination />} /></Routes></MemoryRouter>);
    fireEvent.click(await screen.findByTestId('node-M_CheckDocs'));
    expect(await screen.findByText('/nv/documents?requestId=new-request')).toBeInTheDocument();
  });
  it('shows why an order with missing documents cannot yet be approved', async () => {
    render(<MemoryRouter initialEntries={['/nv/documents?requestId=new-request']}><NVDocumentsPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'Duyệt hồ sơ và chuyển đặt cọc' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Yêu cầu bổ sung giấy tờ' })).toBeEnabled();
  });
  it('does not list orphaned, completed or outdated document tasks', async () => {
    await db.process_state.add({ request_id: 'orphan', waiting_node_ids: ['M_CheckDocs'], variables: {}, loop_counters: {}, updated_at: new Date().toISOString() });
    await db.rental_requests.update('new-request', { status: 'HOAN_TAT' });
    expect(await engine.getPendingTasks('nhan_vien')).toEqual([]);
    await db.rental_requests.update('new-request', { status: 'CHO_COC' });
    expect(await engine.getPendingTasks('nhan_vien')).toEqual([]);
  });
  it('retains customer refund confirmation after a cancelled booking', async () => {
    await db.rental_requests.update('new-request', { status: 'DA_HUY' });
    await db.process_state.update('new-request', { waiting_node_ids: ['M_ConfirmRefund'] });
    expect((await engine.getPendingTasks('khach_hang', 'customer')).map(task => task.node_id)).toEqual(['M_ConfirmRefund']);
    expect(await engine.getPendingTasks('nhan_vien')).toEqual([]);
  });
});
