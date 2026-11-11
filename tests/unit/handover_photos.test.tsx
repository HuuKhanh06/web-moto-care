import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { FileUpload } from '@/components/ui/FileUpload';
import { durableHandoverPhotos } from '@/lib/handoverPhotos';
import { KH05Page } from '@/features/customer/KH05Page';
import { NV04Page } from '@/features/staff/NV04Page';
import { engine } from '@/engine';
import { db } from '@/db';

const auth = vi.hoisted(() => ({ currentActor: { id: 'customer', role: 'khach_hang' } }));
vi.mock('@/features/auth/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select(auth) }));
const image = 'data:image/jpeg;base64,c3ludGhldGlj';
beforeEach(async () => { auth.currentActor = { id: 'customer', role: 'khach_hang' }; await db.clearAllTables(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Durable handover images', () => {
  it('upload returns compressed image bytes rather than a browser-local object URL', async () => {
    vi.stubGlobal('Image', class {
      width = 800; height = 600; onload?: () => void;
      set src(_value: string) { queueMicrotask(() => this.onload?.()); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage: vi.fn() } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(callback => callback(new Blob(['synthetic'], { type: 'image/jpeg' })));
    const onFileSelect = vi.fn();
    const view = render(<FileUpload onFileSelect={onFileSelect} />);
    fireEvent.change(view.container.querySelector('input[type=file]')!, { target: { files: [new File(['source'], 'photo.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onFileSelect).toHaveBeenCalledOnce());
    const result = onFileSelect.mock.calls[0][0];
    expect(result.previewUrl).toBe(image);
    expect(JSON.parse(JSON.stringify({ photo_urls: [result.previewUrl] })).photo_urls[0]).toBe(image);
  });
  it('converts a legacy blob while available on the uploading browser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['synthetic'], { type: 'image/jpeg' }) }));
    await expect(durableHandoverPhotos(['blob:local-photo', image])).resolves.toEqual([image, image]);
  });
  it('asks for a new upload when a legacy blob is no longer readable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('missing blob')));
    await expect(durableHandoverPhotos(['blob:lost'])).rejects.toThrow('chọn lại ảnh');
  });
  it('customer sees new images when synchronization updates the latest passed inspection', async () => {
    await db.rental_requests.add({ id: 'rental', customer_id: 'customer', status: 'CHO_KHACH_NHAN', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 });
    await db.inspections.bulkAdd([
      { id: 'z-old', request_id: 'rental', vehicle_id: 'vehicle', kind: 'PRE_HANDOVER', result: 'DAT', attempt_no: 1, photo_urls: ['blob:old-browser'] },
      { id: 'a-new', request_id: 'rental', vehicle_id: 'vehicle', kind: 'PRE_HANDOVER', result: 'DAT', attempt_no: 2, photo_urls: [image] },
    ]);
    render(<MemoryRouter initialEntries={['/kh/05?requestId=rental']}><KH05Page /></MemoryRouter>);
    expect(await screen.findByAltText('Ảnh bàn giao 1')).toHaveAttribute('src', image);
    const replacement = 'data:image/jpeg;base64,bmV3';
    await db.inspections.update('a-new', { photo_urls: [replacement] });
    await act(async () => { window.dispatchEvent(new CustomEvent('motocare_data_updated')); });
    await waitFor(() => expect(screen.getByAltText('Ảnh bàn giao 1')).toHaveAttribute('src', replacement));
  });
  it('staff can resend photos for a waiting customer without replaying the completed photo step', async () => {
    auth.currentActor = { id: 'staff', role: 'nhan_vien' };
    await db.vehicles.add({ id: 'vehicle', plate: 'TEST-001', model: 'Honda Vision', vehicle_type: 'tay_ga', daily_price: 100000, status: 'SAN_SANG' });
    await db.rental_requests.add({ id: 'rental', customer_id: 'customer', vehicle_id: 'vehicle', status: 'CHO_KHACH_NHAN', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 });
    await db.inspections.add({ id: 'inspection', request_id: 'rental', vehicle_id: 'vehicle', kind: 'PRE_HANDOVER', result: 'DAT', attempt_no: 1, photo_urls: Array(5).fill(image) });
    await db.process_state.add({ request_id: 'rental', waiting_node_ids: ['Activity_0d0qzp6'], loop_counters: {}, variables: {}, updated_at: new Date().toISOString() });
    const advance = vi.spyOn(engine, 'complete');
    const update = vi.spyOn(db.inspections, 'update');
    render(<MemoryRouter initialEntries={['/nv/04?requestId=rental']}><NV04Page /></MemoryRouter>);
    const submit = await screen.findByTestId('node-M_Photo');
    expect(submit).toBeEnabled(); fireEvent.click(submit);
    await waitFor(() => expect(update).toHaveBeenCalledWith('inspection', { photo_urls: Array(5).fill(image) }));
    expect(advance).not.toHaveBeenCalled();
    expect((await db.process_state.get('rental'))?.waiting_node_ids).toEqual(['Activity_0d0qzp6']);
  });
});
