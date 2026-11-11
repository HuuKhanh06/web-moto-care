import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { fn_check_documents } from '@/engine/fn';
import { aiService } from '@/ai';
import { documentNamesMismatch } from '@/ai/documentIdentity';
import type { CustomerDocument } from '@/db/types';

const docs: CustomerDocument[] = [
  { id: 'front', request_id: 'mismatch-test', doc_type: 'CCCD_TRUOC', file_url: 'data:image/jpeg;base64,YQ==', is_valid: true, ai_result: { full_name: { value: 'NGUYỄN VĂN A' } } },
  { id: 'back', request_id: 'mismatch-test', doc_type: 'CCCD_SAU', file_url: 'data:image/jpeg;base64,YQ==', is_valid: true },
  { id: 'license', request_id: 'mismatch-test', doc_type: 'BANG_LAI_TRUOC', file_url: 'data:image/jpeg;base64,YQ==', is_valid: true, ai_result: { full_name: { value: 'TRAN VAN B' } } },
];
beforeEach(async () => { vi.restoreAllMocks(); await db.clearAllTables(); });
describe('Document identity gate', () => {
  it('normalizes accents, case and spacing before comparing', () => {
    expect(documentNamesMismatch(docs)).toBe(true);
    expect(documentNamesMismatch(docs.map(doc => doc.id === 'license' ? { ...doc, ai_result: { full_name: { value: '  nguyen van a  ' } } } : doc))).toBe(false);
  });
  it('engine rejects mismatched names despite customer-set is_valid=true', async () => {
    await db.customer_documents.bulkAdd(docs);
    const provider = vi.spyOn(aiService, 'processOcr');
    expect((await fn_check_documents('mismatch-test', { id: 'customer', role: 'khach_hang' })).allValid).toBe(false);
    expect(provider).not.toHaveBeenCalled();
  });
  it('engine preserves mismatch block after a retry clears extracted fields', async () => {
    await db.customer_documents.bulkAdd(docs.map(doc => ({ ...doc, ai_result: null })));
    await db.process_state.add({ request_id: 'mismatch-test', waiting_node_ids: ['M_CheckDocs'], loop_counters: {}, variables: { document_identity_mismatch: true }, updated_at: new Date().toISOString() });
    expect((await fn_check_documents('mismatch-test', { id: 'customer', role: 'khach_hang' })).allValid).toBe(false);
  });
});
