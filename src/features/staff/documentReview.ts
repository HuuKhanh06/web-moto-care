import { db } from '@/db';
import { engine } from '@/engine';
import { fn_request_more_docs, fn_end_cancel } from '@/engine/fn';
import { documentNamesMismatch, IDENTITY_MISMATCH_MESSAGE } from '@/ai/documentIdentity';
import { isValidBirthDate } from '@/ai/validation';
import type { Actor, CustomerDocument } from '@/db/types';

export interface ReviewedIdentity { fullName: string; idNumber: string; dob: string; licenseClass: string }
function assertStaff(actor: Actor) {
  if (!['nhan_vien', 'quan_ly'].includes(actor.role)) throw new Error('Chỉ nhân viên hoặc quản lý được kiểm tra hồ sơ.');
}
const photoSnapshot = (docs: CustomerDocument[]) => JSON.stringify(docs.map(doc => [doc.id, doc.doc_type, doc.file_url]).sort((a, b) => a[0].localeCompare(b[0])));
export async function approveDocumentReview(requestId: string, actor: Actor, profile: ReviewedIdentity, reviewedPhotos: CustomerDocument[]) {
  assertStaff(actor);
  if (!profile.fullName.trim() || !/^0\d{11}$/.test(profile.idNumber) || !isValidBirthDate(profile.dob) || !profile.licenseClass.trim()) {
    throw new Error('Vui lòng nhập đúng họ tên, số CCCD 12 chữ số, ngày sinh và hạng bằng lái.');
  }
  await db.transaction('rw', db.rental_requests, db.customer_documents, db.process_state, async () => {
    const request = await db.rental_requests.get(requestId);
    const state = await db.process_state.get(requestId);
    if (!request || !['MOI', 'CHO_HO_SO'].includes(request.status) || !state?.waiting_node_ids.includes('M_CheckDocs')) {
      throw new Error('Hồ sơ đã chuyển bước. Vui lòng làm mới danh sách.');
    }
    const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
    if (photoSnapshot(docs) !== photoSnapshot(reviewedPhotos)) throw new Error('Ảnh giấy tờ đã thay đổi. Vui lòng làm mới và đối chiếu lại trước khi duyệt.');
    if (!['CCCD_TRUOC', 'CCCD_SAU', 'BANG_LAI_TRUOC'].every(type => docs.some(doc => doc.doc_type === type && doc.file_url))) {
      throw new Error('Khách chưa tải đủ ba ảnh giấy tờ. Vui lòng yêu cầu khách bổ sung.');
    }
    if (documentNamesMismatch(docs) || state.variables.document_identity_mismatch === true) throw new Error(IDENTITY_MISMATCH_MESSAGE);
    for (const doc of docs) await db.customer_documents.update(doc.id, { is_valid: true, check_note: 'Nhân viên đã đối chiếu giấy tờ' });
    await db.process_state.update(requestId, { variables: { ...state.variables,
      customer_full_name: profile.fullName.trim(), customer_id_number: profile.idNumber,
      customer_date_of_birth: profile.dob, customer_license_class: profile.licenseClass.trim().toUpperCase(),
    } });
  });
  await engine.advance(requestId, 'M_CheckDocs', undefined, actor);
}

export async function requestDocumentSupplement(requestId: string, actor: Actor) {
  assertStaff(actor);
  const request = await db.rental_requests.get(requestId);
  const state = await db.process_state.get(requestId);
  if (!request || !['MOI', 'CHO_HO_SO'].includes(request.status) || !state?.waiting_node_ids.includes('M_CheckDocs')) throw new Error('Hồ sơ đã chuyển bước. Vui lòng làm mới.');
  const count = await fn_request_more_docs(requestId, actor);
  if (count > 3) await fn_end_cancel(requestId, actor, 'HO_SO_KHONG_DAT');
  return count;
}
