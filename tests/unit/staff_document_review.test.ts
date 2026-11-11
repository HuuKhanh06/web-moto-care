import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { engine } from '@/engine';
import { approveDocumentReview } from '@/features/staff/documentReview';
import type { CustomerDocument } from '@/db/types';
vi.mock('@/engine', () => ({ engine: { advance: vi.fn() } }));
const actor = { id: 'staff', role: 'nhan_vien' as const };
const profile = { fullName: 'TRAN THI TEST', idNumber: '048098001234', dob: '1998-05-20', licenseClass: 'A1' };
const docs: CustomerDocument[] = [
  { id: 'front', request_id: 'request', doc_type: 'CCCD_TRUOC', file_url: 'data:image/jpeg;base64,YQ==' },
  { id: 'back', request_id: 'request', doc_type: 'CCCD_SAU', file_url: 'data:image/jpeg;base64,Yg==' },
  { id: 'license', request_id: 'request', doc_type: 'BANG_LAI_TRUOC', file_url: 'data:image/jpeg;base64,Yw==' },
];
beforeEach(async () => {
  vi.clearAllMocks(); await db.clearAllTables();
  await db.rental_requests.add({ id: 'request', customer_id: 'customer', status: 'CHO_HO_SO', start_at: '2026-12-01', end_at: '2026-12-02', doc_request_count: 0 });
  await db.process_state.add({ request_id: 'request', waiting_node_ids: ['M_CheckDocs'], variables: {}, loop_counters: {}, updated_at: new Date().toISOString() });
  await db.customer_documents.bulkAdd(docs);
});
describe('Staff document review', () => {
  it('staff can approve a complete reviewed set and resume the existing document gateway', async () => {
    await approveDocumentReview('request', actor, profile, docs);
    expect((await db.customer_documents.toArray()).every(doc => doc.is_valid === true)).toBe(true);
    expect((await db.process_state.get('request'))?.variables.customer_id_number).toBe(profile.idNumber);
    expect(engine.advance).toHaveBeenCalledWith('request', 'M_CheckDocs', undefined, actor);
  });
  it('cannot approve a new order before the customer supplies three photos', async () => {
    await db.customer_documents.delete('back');
    await expect(approveDocumentReview('request', actor, profile, docs.filter(doc => doc.id !== 'back'))).rejects.toThrow('chưa tải đủ');
    expect(engine.advance).not.toHaveBeenCalled();
  });
  it('does not bypass detected identity mismatch', async () => {
    await db.process_state.update('request', { variables: { document_identity_mismatch: true } });
    await expect(approveDocumentReview('request', actor, profile, docs)).rejects.toThrow('không khớp');
    expect((await db.customer_documents.toArray()).some(doc => doc.is_valid)).toBe(false);
    expect(engine.advance).not.toHaveBeenCalled();
  });
  it('requires re-review if the customer changes a photo during staff review', async () => {
    await db.customer_documents.update('front', { file_url: 'data:image/jpeg;base64,bmV3' });
    await expect(approveDocumentReview('request', actor, profile, docs)).rejects.toThrow('đã thay đổi');
    expect(engine.advance).not.toHaveBeenCalled();
  });
  it('rejects customer access and already advanced orders', async () => {
    await expect(approveDocumentReview('request', { id: 'customer', role: 'khach_hang' }, profile, docs)).rejects.toThrow('Chỉ nhân viên');
    await db.rental_requests.update('request', { status: 'CHO_COC' });
    await expect(approveDocumentReview('request', actor, profile, docs)).rejects.toThrow('đã chuyển bước');
    expect(engine.advance).not.toHaveBeenCalled();
  });
});
