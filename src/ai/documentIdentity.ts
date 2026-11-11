import type { CustomerDocument } from '@/db/types';

export const IDENTITY_MISMATCH_MESSAGE = 'Họ tên trên CCCD và bằng lái không khớp. Không thể xác nhận hoặc đặt cọc. Vui lòng tải lại giấy tờ cùng một người và quét lại.';
export const normalizeDocumentName = (name: string) => name.toUpperCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();

export function documentNamesMismatch(docs: CustomerDocument[]): boolean {
  const name = (type: CustomerDocument['doc_type']) => {
    const field = docs.find(doc => doc.doc_type === type)?.ai_result?.full_name;
    if (!field || typeof field !== 'object' || !('value' in field) || typeof field.value !== 'string') return '';
    return normalizeDocumentName(field.value);
  };
  const cccd = name('CCCD_TRUOC'), license = name('BANG_LAI_TRUOC');
  return Boolean(cccd && license && cccd !== license);
}
