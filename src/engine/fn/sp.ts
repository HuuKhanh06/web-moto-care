// src/engine/fn/sp.ts
// Hiện thực hóa toàn bộ các Service Task, Business Rule Task và Điều kiện cổng XOR của SP1 (Gia hạn) và SP2 (Sự cố)

import { db } from '@/db';
import { clock } from '@/lib/clock';
import { logEvent } from '@/db/repo';
import { BUSINESS_RULES } from '@/config/rules';
import { integrations } from '@/integrations';
import { getIntegrationConfig } from '@/config/integrations';
import type {
  Actor,
  ExtensionRequest,
  Payment,
  Incident,
  IncidentDispatch,
} from '@/db/types';

// ==============================================================
// 1. SUB-PROCESS SP1: XỬ LÝ GIA HẠN
// ==============================================================

/**
 * GH_GetRequest (GH01 • Ghi yêu cầu gia hạn)
 */
export async function fn_record_extension(
  requestId: string,
  newEndAt: string,
  actor: Actor
): Promise<ExtensionRequest> {
  const extRequest: ExtensionRequest = {
    id: crypto.randomUUID(),
    request_id: requestId,
    new_end_at: newEndAt,
    status: 'YEU_CAU',
  };

  await db.extension_requests.add(extRequest);
  await db.rental_requests.update(requestId, { status: 'DANG_GIA_HAN' });

  await logEvent(requestId, 'GH_GetRequest', 'RECORD_EXTENSION', actor, {
    extension_id: extRequest.id,
    new_end_at: newEndAt,
  });

  return extRequest;
}

/**
 * GH_Check (GH02 • Kiểm tra lịch + điều kiện)
 * Kiểm tra xem xe có bị đặt lịch kế tiếp hoặc bảo trì trong khoảng [cũ_end_at, new_end_at] không
 */
export async function fn_check_extension_rule(
  requestId: string,
  actor: Actor
): Promise<{ eligible: boolean; reject_reason?: string }> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Không tìm thấy hồ sơ hoặc xe cho ${requestId}`);

  const ext = await db.extension_requests
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!ext) throw new Error(`Không tìm thấy yêu cầu gia hạn cho hồ sơ ${requestId}`);

  const currentEndMs = new Date(req.end_at).getTime();
  const newEndMs = new Date(ext.new_end_at).getTime();

  if (newEndMs <= currentEndMs) {
    const reason = 'Thời gian gia hạn phải lớn hơn thời gian kết thúc hiện tại';
    await db.extension_requests.update(ext.id, { eligible: false, reject_reason: reason });
    return { eligible: false, reject_reason: reason };
  }

  // Kiểm tra lịch xe khác
  const schedules = await db.vehicle_schedule.where('vehicle_id').equals(req.vehicle_id).toArray();
  let hasOverlap = false;

  for (const s of schedules) {
    if (s.request_id === requestId) continue; // Bỏ qua chính lịch hiện tại của hồ sơ này
    const sStart = new Date(s.start_at).getTime();
    const sEnd = new Date(s.end_at).getTime();

    // Giao nhau giữa [currentEndMs, newEndMs] và [sStart, sEnd]
    if (currentEndMs < sEnd && newEndMs > sStart) {
      hasOverlap = true;
      break;
    }
  }

  const eligible = !hasOverlap;
  const reject_reason = hasOverlap ? 'Xe đã có lịch đặt hoặc bảo trì sau thời điểm kết thúc hiện tại' : undefined;

  await db.extension_requests.update(ext.id, { eligible, reject_reason });

  await logEvent(requestId, 'GH_Check', 'CHECK_EXTENSION_RULE', actor, {
    eligible,
    reject_reason,
  });

  return { eligible, reject_reason };
}

/**
 * Cổng GH_GEligible (Có thể gia hạn?)
 */
export function eval_GH_GEligible(eligible: boolean): 'Có' | 'Không' {
  return eligible ? 'Có' : 'Không';
}

/**
 * GH_Offer (GH03 • Tính phí và gửi đề xuất)
 */
export async function fn_offer_extension(
  requestId: string,
  actor: Actor
): Promise<{ extra_fee: number; offer_expires_at: string }> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Hồ sơ ${requestId} chưa gắn xe`);

  const ext = await db.extension_requests
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!ext) throw new Error(`Không tìm thấy yêu cầu gia hạn`);

  const vehicle = await db.vehicles.get(req.vehicle_id);
  const dailyPrice = vehicle?.daily_price || 150000;

  const currentEndMs = new Date(req.end_at).getTime();
  const newEndMs = new Date(ext.new_end_at).getTime();
  const extraDays = Math.max(1, Math.ceil((newEndMs - currentEndMs) / (24 * 3600 * 1000)));
  const extraFee = extraDays * dailyPrice;

  const offerExpiresAt = new Date(
    clock.now().getTime() + BUSINESS_RULES.TIMERS.EXTENSION_OFFER_HOURS * 3600 * 1000
  ).toISOString();

  await db.extension_requests.update(ext.id, {
    extra_fee: extraFee,
    status: 'DA_DE_XUAT',
    offer_expires_at: offerExpiresAt,
  });

  await db.notifications.add({
    id: crypto.randomUUID(),
    user_id: req.customer_id,
    request_id: requestId,
    template: 'extension_offer',
    message: `Đề xuất gia hạn xe đến ${new Date(ext.new_end_at).toLocaleString('vi-VN')} với phụ phí ${extraFee.toLocaleString()} đ. Vui lòng xác nhận trong vòng 2 giờ.`,
    is_read: false,
    created_at: clock.nowISO(),
  });

  await logEvent(requestId, 'GH_Offer', 'OFFER_EXTENSION', actor, {
    extra_fee: extraFee,
    offer_expires_at: offerExpiresAt,
  });

  return { extra_fee: extraFee, offer_expires_at: offerExpiresAt };
}

/**
 * Cổng GH_GAccept (Khách đồng ý? Quyết định người tại GH_WaitAccept)
 */
export function eval_GH_GAccept(customerAnswer: 'DONG_Y' | 'TU_CHOI'): 'Có' | 'Không' {
  return customerAnswer === 'DONG_Y' ? 'Có' : 'Không';
}

/**
 * Cổng GH_NeedPayment (Có phí bổ sung?)
 */
export function eval_GH_NeedPayment(extraFee: number): 'Có' | 'Không' {
  return extraFee > 0 ? 'Có' : 'Không';
}

/**
 * GH_CreateQR (Tạo QR bổ sung)
 */
export async function fn_create_extension_qr(requestId: string, actor: Actor): Promise<Payment> {
  const ext = await db.extension_requests
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!ext || !ext.extra_fee) throw new Error(`Không tìm thấy phụ phí gia hạn`);

  const qrRef = `MC_EXT_${requestId.slice(0, 8)}_${Date.now().toString().slice(-4)}`;
  const expiresAt = new Date(
    clock.now().getTime() + BUSINESS_RULES.TIMERS.EXTENSION_PAY_MINUTES * 60 * 1000
  ).toISOString();

  const payment: Payment = {
    id: crypto.randomUUID(),
    request_id: requestId,
    kind: 'EXTENSION',
    amount: ext.extra_fee,
    qr_ref: qrRef,
    status: 'PENDING',
    expires_at: expiresAt,
  };

  await db.payments.add(payment);

  // Tích hợp sinh VietQR gia hạn
  const cfg = getIntegrationConfig();
  await integrations.paymentQr.generateQr({
    accountNo: cfg.accountNo,
    accountName: cfg.accountName,
    bankBin: cfg.bankBin,
    amount: payment.amount,
    description: qrRef,
    requestId,
    bpmnNodeId: 'GH_CreateQR',
  });

  await logEvent(requestId, 'GH_CreateQR', 'CREATE_EXTENSION_QR', actor, {
    payment_id: payment.id,
    amount: payment.amount,
    qr_ref: qrRef,
  });

  return payment;
}

/**
 * GH_Update (GH03c • Cập nhật thời hạn/lịch/giá)
 */
export async function fn_apply_extension(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Không tìm thấy hồ sơ hoặc xe`);

  const ext = await db.extension_requests
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!ext) throw new Error(`Không tìm thấy yêu cầu gia hạn`);

  const updatedTotalPrice = (req.total_price || 0) + (ext.extra_fee || 0);

  // Cập nhật rental_requests
  await db.rental_requests.update(requestId, {
    end_at: ext.new_end_at,
    total_price: updatedTotalPrice,
  });

  // Kéo dài vehicle_schedule
  const schedule = await db.vehicle_schedule
    .where('request_id')
    .equals(requestId)
    .first();
  if (schedule) {
    await db.vehicle_schedule.update(schedule.id, {
      end_at: ext.new_end_at,
    });
  }

  // Cập nhật extension_requests
  await db.extension_requests.update(ext.id, {
    status: 'DA_AP_DUNG',
  });

  await logEvent(requestId, 'GH_Update', 'APPLY_EXTENSION', actor, {
    new_end_at: ext.new_end_at,
    total_price: updatedTotalPrice,
  });
}

/**
 * GH_NotifyOK (GH03d • Gửi xác nhận gia hạn)
 */
export async function fn_notify_extension_ok(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'extension_confirmed',
      message: `Gia hạn thành công! Thời hạn trả xe mới của bạn là: ${new Date(req.end_at).toLocaleString('vi-VN')}.`,
      is_read: false,
      created_at: clock.nowISO(),
    });
  }

  await logEvent(requestId, 'GH_NotifyOK', 'NOTIFY_EXTENSION_OK', actor);
}

/**
 * GH_NotifyOld (GH04 • Giữ hạn cũ/thông báo từ chối)
 */
export async function fn_notify_extension_old(
  requestId: string,
  actor: Actor,
  reason = 'TU_CHOI'
): Promise<void> {
  const ext = await db.extension_requests
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (ext) {
    await db.extension_requests.update(ext.id, {
      status: reason === 'HET_HAN' ? 'HET_HAN' : 'TU_CHOI',
    });
  }

  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'extension_rejected',
      message: `Yêu cầu gia hạn không được chấp thuận (${reason}). Vui lòng trả xe đúng hạn ban đầu: ${new Date(req.end_at).toLocaleString('vi-VN')}.`,
      is_read: false,
      created_at: clock.nowISO(),
    });
  }

  await logEvent(requestId, 'GH_NotifyOld', 'NOTIFY_EXTENSION_OLD', actor, { reason });
}

// ==============================================================
// 2. SUB-PROCESS SP2: HỖ TRỢ SỰ CỐ
// ==============================================================

/**
 * SC_Create (SC01 • Tạo phiếu từ vị trí/ảnh sự cố)
 */
export async function fn_create_incident_ticket(
  requestId: string,
  actor: Actor,
  data: {
    lat?: number;
    lng?: number;
    photo_urls?: string[];
    description: string;
  }
): Promise<Incident> {
  const incidentCode = `SC_${requestId.slice(0, 6)}_${Date.now().toString().slice(-4)}`;
  const nowISO = clock.nowISO();

  const incident: Incident = {
    id: crypto.randomUUID(),
    request_id: requestId,
    reported_by: actor.id,
    incident_code: incidentCode,
    lat: data.lat,
    lng: data.lng,
    photo_urls: data.photo_urls,
    description: data.description,
    status: 'MOI',
    attempt_no: 1,
    created_at: nowISO,
  };

  await db.incidents.add(incident);
  await db.rental_requests.update(requestId, { status: 'DANG_XU_LY_SU_CO' });

  await logEvent(requestId, 'SC_Create', 'CREATE_INCIDENT', actor, {
    incident_id: incident.id,
    incident_code: incidentCode,
  });

  return incident;
}

/**
 * SC_Select (Chọn đối tác theo vùng/khả dụng)
 */
export async function fn_select_partner(
  requestId: string,
  actor: Actor
): Promise<{ partner_id: string | null }> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!incident) throw new Error(`Không tìm thấy sự cố cho hồ sơ ${requestId}`);

  // Lấy các dispatch đã từng thử cho incident này
  const dispatches = await db.incident_dispatches
    .where('incident_id')
    .equals(incident.id)
    .toArray();
  const triedPartnerIds = dispatches.map((d) => d.partner_id);

  // Tìm đối tác khả dụng (available = true) chưa từng thử
  const partners = await db.partners.filter((p) => Boolean(p.available)).toArray();
  const availablePartner = partners.find((p) => !triedPartnerIds.includes(p.id));

  const partnerId = availablePartner ? availablePartner.id : null;
  if (partnerId) {
    await db.incidents.update(incident.id, { partner_id: partnerId });
  }

  await logEvent(requestId, 'SC_Select', 'SELECT_PARTNER', actor, {
    selected_partner_id: partnerId,
    tried_count: triedPartnerIds.length,
  });

  return { partner_id: partnerId };
}

/**
 * SC_Dispatch (SC02 • Gửi yêu cầu và mã sự cố)
 */
export async function fn_dispatch_partner(
  requestId: string,
  actor: Actor
): Promise<IncidentDispatch> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!incident || !incident.partner_id) {
    throw new Error(`Sự cố chưa được gắn đối tác để điều phối`);
  }

  const dispatch: IncidentDispatch = {
    id: crypto.randomUUID(),
    incident_id: incident.id,
    partner_id: incident.partner_id,
    attempt_no: incident.attempt_no,
    status: 'SENT',
    sent_at: clock.nowISO(),
  };

  await db.incident_dispatches.add(dispatch);

  await logEvent(requestId, 'SC_Dispatch', 'DISPATCH_PARTNER', actor, {
    dispatch_id: dispatch.id,
    partner_id: incident.partner_id,
    attempt_no: incident.attempt_no,
  });

  return dispatch;
}

/**
 * Cổng SC_GAccept (Đã nhận hỗ trợ? Quyết định đối tác tại SC_ReceiveAck)
 */
export function eval_SC_GAccept(status: 'ACCEPTED' | 'DECLINED' | 'TIMEOUT'): 'Có' | 'Không' {
  return status === 'ACCEPTED' ? 'Có' : 'Không';
}

/**
 * SC_TryNext (Tăng số thử, tìm đối tác khác)
 */
export async function fn_try_next_partner(
  requestId: string,
  actor: Actor
): Promise<{ hasMorePartners: boolean }> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (!incident) throw new Error(`Không tìm thấy sự cố`);

  const nextAttemptNo = incident.attempt_no + 1;
  await db.incidents.update(incident.id, {
    attempt_no: nextAttemptNo,
    partner_id: undefined,
  });

  // Kiểm tra xem còn đối tác nào chưa thử không
  const sel = await fn_select_partner(requestId, actor);
  const hasMorePartners = Boolean(sel.partner_id);

  await logEvent(requestId, 'SC_TryNext', 'TRY_NEXT_PARTNER', actor, {
    next_attempt_no: nextAttemptNo,
    has_more_partners: hasMorePartners,
  });

  return { hasMorePartners };
}

/**
 * Cổng SC_GRetry (Còn đối tác?)
 */
export function eval_SC_GRetry(hasMorePartners: boolean): 'Còn' | 'Hết' {
  return hasMorePartners ? 'Còn' : 'Hết';
}

/**
 * SC_Track (Theo dõi trạng thái hỗ trợ)
 */
export async function fn_track_incident(requestId: string, actor: Actor): Promise<void> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (incident) {
    await db.incidents.update(incident.id, { status: 'DANG_HO_TRO' });
  }

  await logEvent(requestId, 'SC_Track', 'TRACK_INCIDENT', actor);
}

/**
 * Cổng SC_GResolve (Có thể hỗ trợ? Quyết định Quản lý tại SC_Escalate)
 */
export function eval_SC_GResolve(decision: 'Có phương án' | 'Không'): 'Có phương án' | 'Không' {
  return decision === 'Có phương án' ? 'Có phương án' : 'Không';
}

/**
 * Cổng SC_SettleDecision (Tiếp tục thuê? Quyết định Nhân viên tại SC_Log)
 */
export function eval_SC_SettleDecision(continueRental: boolean): 'Có' | 'Không' {
  return continueRental ? 'Có' : 'Không';
}

/**
 * SC_SendContinue (SC06 • Thông báo tiếp tục thuê)
 */
export async function fn_send_continue_rental(requestId: string, actor: Actor): Promise<void> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (incident) {
    await db.incidents.update(incident.id, {
      status: 'DONG_TIEP_TUC',
      closed_at: clock.nowISO(),
    });
  }

  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'incident_resolved_continue',
      message: 'Sự cố xe đã được xử lý xong. Bạn có thể tiếp tục hành trình thuê xe bình thường.',
      is_read: false,
      created_at: clock.nowISO(),
    });
  }

  await logEvent(requestId, 'SC_SendContinue', 'SEND_CONTINUE_RENTAL', actor);
}

/**
 * SC_NotifyEarly (SC05/06 • Hướng dẫn trả xe sớm)
 */
export async function fn_notify_early_return(requestId: string, actor: Actor): Promise<void> {
  const incident = await db.incidents
    .where('request_id')
    .equals(requestId)
    .reverse()
    .first();
  if (incident) {
    await db.incidents.update(incident.id, {
      status: 'DONG_TRA_SOM',
      closed_at: clock.nowISO(),
    });
  }

  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'incident_early_return',
      message: 'Xe gặp sự cố nghiêm trọng không thể tiếp tục di chuyển. Vui lòng tiến hành thủ tục bàn giao trả xe sớm.',
      is_read: false,
      created_at: clock.nowISO(),
    });
  }

  await logEvent(requestId, 'SC_NotifyEarly', 'NOTIFY_EARLY_RETURN', actor);
}
