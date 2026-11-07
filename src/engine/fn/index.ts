// src/engine/fn/index.ts
// Hiện thực hóa toàn bộ các Service Task, Business Rule Task và Điều kiện cổng XOR của Quy trình chính (MAIN)
// Mọi hàm đọc/ghi dữ liệu theo mapping.csv và gọi logEvent với bpmn_node_id đúng quy chuẩn.

import { db } from '@/db';
import { clock } from '@/lib/clock';
import { logEvent } from '@/db/repo';
import { BUSINESS_RULES } from '@/config/rules';
import { integrations } from '@/integrations';
import { getIntegrationConfig } from '@/config/integrations';
import { aiService } from '@/ai';
import type { AiOcrResponse } from '@/ai/types';
import type { Actor, RentalRequest, Payment, Contract, Statement, Settlement } from '@/db/types';
import { dataAdapter } from '@/db/adapter';

// ==============================================================
// 1. TIẾP NHẬN & HỒ SƠ
// ==============================================================

/**
 * M_START: Khách gửi yêu cầu thuê xe ban đầu
 */
export async function fn_create_rental_request(
  actor: Actor,
  data: {
    customer_id: string;
    vehicle_type: string;
    start_at: string;
    end_at: string;
  }
): Promise<RentalRequest> {
  const requestId = crypto.randomUUID();
  const request: RentalRequest = {
    id: requestId,
    customer_id: data.customer_id,
    start_at: data.start_at,
    end_at: data.end_at,
    status: 'MOI',
    doc_request_count: 0,
  };

  await db.rental_requests.add(request);
  dataAdapter.pushRecordToCloud('rental_requests', request as unknown as Record<string, unknown>);
  await logEvent(requestId, 'M_START', 'CREATE_REQUEST', actor, {
    vehicle_type: data.vehicle_type,
    start_at: data.start_at,
    end_at: data.end_at,
  });

  return request;
}

/**
 * M_CheckFleet (T01b • Tra cứu xe và lịch thuê):
 * Tìm xe đúng loại có status=SAN_SANG và không bị trùng lịch trong vehicle_schedule
 */
export async function fn_check_fleet(
  requestId: string,
  actor: Actor,
  preferredType?: string
): Promise<{ vehicle_id: string | null }> {
  const req = await db.rental_requests.get(requestId);
  if (!req) throw new Error(`Không tìm thấy hồ sơ ${requestId}`);

  const startReq = new Date(req.start_at).getTime();
  const endReq = new Date(req.end_at).getTime();

  // Đồng bộ mới nhất từ Cloud nếu không phải unit test để chống xung đột đặt trùng xe giữa nhiều người dùng
  if (import.meta.env.MODE !== 'test') {
    try {
      await dataAdapter.pullCloudToLocal();
    } catch {
      // Bỏ qua lỗi mạng nếu đang offline
    }
  }

  // Tìm danh sách xe đang sẵn sàng
  let vehicles = await db.vehicles.where('status').equals('SAN_SANG').toArray();
  if (preferredType) {
    vehicles = vehicles.filter((v) => v.vehicle_type === preferredType);
  }

  let selectedVehicleId: string | null = null;

  for (const v of vehicles) {
    // 1. Kiểm tra lịch xe đã khóa trong vehicle_schedule
    const schedules = await db.vehicle_schedule.where('vehicle_id').equals(v.id).toArray();
    let hasOverlap = false;

    for (const s of schedules) {
      const sStart = new Date(s.start_at).getTime();
      const sEnd = new Date(s.end_at).getTime();
      if (startReq < sEnd && endReq > sStart) {
        hasOverlap = true;
        break;
      }
    }

    // 2. Chống đặt trùng xe: Kiểm tra các đơn thuê KHÁC đang giữ xe trong cùng khung thời gian
    if (!hasOverlap) {
      const otherRentals = await db.rental_requests
        .where('vehicle_id')
        .equals(v.id)
        .toArray();

      for (const other of otherRentals) {
        if (other.id === requestId) continue;
        // Bỏ qua các đơn đã kết thúc, bị từ chối hoặc đã hủy
        if (['TU_CHOI', 'DA_HUY', 'HOAN_TAT'].includes(other.status)) continue;

        const oStart = new Date(other.start_at).getTime();
        const oEnd = new Date(other.end_at).getTime();
        if (startReq < oEnd && endReq > oStart) {
          hasOverlap = true;
          break;
        }
      }
    }

    if (!hasOverlap) {
      selectedVehicleId = v.id;
      break;
    }
  }

  if (selectedVehicleId) {
    await db.rental_requests.update(requestId, { vehicle_id: selectedVehicleId });
    const fresh = await db.rental_requests.get(requestId);
    if (fresh) {
      dataAdapter.pushRecordToCloud('rental_requests', fresh as unknown as Record<string, unknown>);
    }
  }

  await logEvent(requestId, 'M_CheckFleet', 'CHECK_FLEET_RESULT', actor, {
    found_vehicle_id: selectedVehicleId,
  });

  return { vehicle_id: selectedVehicleId };
}

/**
 * Cổng M_G01 (Có xe?)
 */
export function eval_M_G01(vehicleId: string | null | undefined): 'Có' | 'Không' {
  return vehicleId ? 'Có' : 'Không';
}

/**
 * M_RejectNoVehicle (T13 • Gửi thông báo không có xe)
 */
export async function fn_reject_no_vehicle(requestId: string, actor: Actor): Promise<void> {
  const nowISO = clock.nowISO();
  await db.rental_requests.update(requestId, {
    status: 'TU_CHOI',
    closed_reason: 'HET_XE',
    closed_at: nowISO,
  });

  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'no_vehicle',
      message: 'Rất tiếc hiện tại không có xe khả dụng trong khung thời gian bạn yêu cầu.',
      is_read: false,
      created_at: nowISO,
    });
  }

  await logEvent(requestId, 'M_RejectNoVehicle', 'REJECT_NO_VEHICLE', actor, {
    reason: 'HET_XE',
  });
}

/**
 * M_SendTerms (T02 • Báo giá/điều kiện thuê)
 */
export async function fn_send_quote(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Hồ sơ ${requestId} chưa được gắn xe`);

  const vehicle = await db.vehicles.get(req.vehicle_id);
  if (!vehicle) throw new Error(`Không tìm thấy xe ${req.vehicle_id}`);

  const startMs = new Date(req.start_at).getTime();
  const endMs = new Date(req.end_at).getTime();
  const rentalDays = Math.max(1, Math.ceil((endMs - startMs) / (24 * 3600 * 1000)));

  const totalPrice = rentalDays * vehicle.daily_price;
  const depositAmount = Math.round(totalPrice * BUSINESS_RULES.DEPOSIT_RATE);

  await db.rental_requests.update(requestId, {
    total_price: totalPrice,
    deposit_amount: depositAmount,
    status: 'CHO_HO_SO',
  });

  await db.notifications.add({
    id: crypto.randomUUID(),
    user_id: req.customer_id,
    request_id: requestId,
    template: 'quote_ready',
    message: `Báo giá thuê xe: ${totalPrice.toLocaleString()} đ (cọc ${depositAmount.toLocaleString()} đ). Vui lòng cập nhật hồ sơ để tiếp tục.`,
    is_read: false,
    created_at: clock.nowISO(),
  });

  const customer = await db.profiles.get(req.customer_id);
  if (customer) {
    await integrations.notifier.sendNotification({
      recipientEmail: customer.phone ? `${customer.phone}@motocare.vn` : 'khach@motocare.vn',
      recipientName: customer.full_name || 'Quý khách',
      template: 'QUOTE',
      subject: `[Moto Care] Báo giá thuê xe #${requestId.slice(0, 8)}`,
      content: `Báo giá thuê xe: ${totalPrice.toLocaleString()} đ (cọc ${depositAmount.toLocaleString()} đ). Vui lòng cập nhật hồ sơ để tiếp tục.`,
      requestId,
      bpmnNodeId: 'M_SendTerms',
    });
  }

  await logEvent(requestId, 'M_SendTerms', 'SEND_QUOTE', actor, {
    total_price: totalPrice,
    deposit_amount: depositAmount,
  });
}

/**
 * M_CheckDocs (T02b • Kiểm tra hồ sơ/điều kiện)
 */
export async function fn_check_documents(
  requestId: string,
  actor: Actor,
  scenarioPreset?: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'BLURRY_IMAGE' | 'NAME_MISMATCH' | 'NETWORK_ERROR'
): Promise<{ allValid: boolean; ocrResponse?: AiOcrResponse }> {
  const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
  const cccdDoc = docs.find((d) => d.doc_type.includes('CCCD'));
  const gplxDoc = docs.find((d) => d.doc_type.includes('BANG_LAI'));
  const req = await db.rental_requests.get(requestId);

  // 1. Kiểm tra tính đầy đủ giấy tờ bắt buộc
  let hasAllTypes = true;
  for (const reqType of BUSINESS_RULES.REQUIRED_DOCUMENT_TYPES) {
    const doc = docs.find((d) => d.doc_type === reqType);
    if (!doc) {
      hasAllTypes = false;
      break;
    }
  }

  if (!hasAllTypes || docs.length === 0) {
    await logEvent(requestId, 'M_CheckDocs', 'CHECK_DOCS', actor, {
      allValid: false,
      uploaded_count: docs.length,
      reason: 'Thiếu giấy tờ bắt buộc',
    });
    return { allValid: false };
  }

  // 2. Kích hoạt AI Agent OCR trích xuất thông tin & phân loại
  const ocrRes = await aiService.processOcr({
    requestId,
    cccdImageRef: cccdDoc?.file_url,
    gplxImageRef: gplxDoc?.file_url,
    selectedVehicleType: req?.vehicle_id,
    scenarioPreset,
  });

  // Ghi nhận sự kiện BPMN cho bước AI Agent
  await logEvent(requestId, 'M_CheckDocs', 'AI_OCR_PROCESSED', actor, {
    confidence: ocrRes.minimum_required_confidence,
    action: ocrRes.routing.action,
    routing: ocrRes.routing,
  });

  // 3. Xử lý phân nhánh dựa trên routing.action và Business Rules
  let allValid = false;

  if (ocrRes.routing.action === 'PREFILL_FOR_RULES') {
    // m >= X (0.95): Tự động điền dữ liệu cho Business Rules
    allValid = docs.every((d) => d.is_valid !== false);
  } else if (ocrRes.routing.action === 'MANUAL_REVIEW') {
    // Y <= m < X hoặc mâu thuẫn: Người xác minh thủ công
    allValid = docs.every((d) => d.is_valid === true);
  } else if (ocrRes.routing.action === 'REQUEST_REUPLOAD') {
    // m < Y (0.80) hoặc ảnh mờ: Yêu cầu tải lại ảnh
    allValid = false;
  } else {
    // FALLBACK_MANUAL: Lỗi kỹ thuật / Timeout, fallback sang xác minh thủ công
    allValid = docs.every((d) => d.is_valid === true);
  }

  await logEvent(requestId, 'M_CheckDocs', 'CHECK_DOCS', actor, {
    allValid,
    uploaded_count: docs.length,
    ai_action: ocrRes.routing.action,
    confidence: ocrRes.minimum_required_confidence,
  });

  return { allValid, ocrResponse: ocrRes };
}

/**
 * Cổng M_G02 (Hồ sơ hợp lệ?)
 */
export function eval_M_G02(allValid: boolean): 'Có' | 'Không' {
  return allValid ? 'Có' : 'Không';
}

/**
 * M_AskDocs (Yêu cầu bổ sung/điều chỉnh)
 */
export async function fn_request_more_docs(requestId: string, actor: Actor): Promise<number> {
  const req = await db.rental_requests.get(requestId);
  if (!req) throw new Error(`Không tìm thấy hồ sơ ${requestId}`);

  const nextCount = (req.doc_request_count || 0) + 1;
  await db.rental_requests.update(requestId, {
    doc_request_count: nextCount,
    status: 'CHO_HO_SO',
  });

  await db.notifications.add({
    id: crypto.randomUUID(),
    user_id: req.customer_id,
    request_id: requestId,
    template: 'request_more_docs',
    message: `Hồ sơ chưa đạt yêu cầu. Vui lòng bổ sung giấy tờ hợp lệ (Lần yêu cầu: ${nextCount}/3).`,
    is_read: false,
    created_at: clock.nowISO(),
  });

  const customer = await db.profiles.get(req.customer_id);
  if (customer) {
    await integrations.notifier.sendNotification({
      recipientEmail: customer.phone ? `${customer.phone}@motocare.vn` : 'khach@motocare.vn',
      recipientName: customer.full_name || 'Quý khách',
      template: 'DOCS_REQ',
      subject: `[Moto Care] Yêu cầu bổ sung hồ sơ #${requestId.slice(0, 8)} (Lần ${nextCount}/3)`,
      content: `Hồ sơ của bạn chưa đủ điều kiện. Vui lòng cập nhật bổ sung giấy tờ hợp lệ.`,
      requestId,
      bpmnNodeId: 'M_AskDocs',
    });
  }

  await logEvent(requestId, 'M_AskDocs', 'REQUEST_MORE_DOCS', actor, {
    doc_request_count: nextCount,
  });

  return nextCount;
}

/**
 * Cổng Gateway_0x0p273 (Yêu cầu > 3?)
 */
export function eval_Gateway_0x0p273(docRequestCount: number): 'Có' | 'Không' {
  return docRequestCount > BUSINESS_RULES.MAX_DOC_REQUEST_COUNT ? 'Có' : 'Không';
}

/**
 * M_EndCancel: Đóng hồ sơ do hủy
 */
export async function fn_end_cancel(
  requestId: string,
  actor: Actor,
  reason: 'HO_SO_KHONG_DAT' | 'QUA_HAN_KY' | string
): Promise<void> {
  await db.rental_requests.update(requestId, {
    status: 'DA_HUY',
    closed_reason: reason,
    closed_at: clock.nowISO(),
  });

  await logEvent(requestId, 'M_EndCancel', 'CANCEL_REQUEST', actor, {
    closed_reason: reason,
  });
}

// ==============================================================
// 2. ĐẶT CỌC & HỢP ĐỒNG
// ==============================================================

/**
 * M_CreateDeposit (T02c • Tạo yêu cầu cọc/QR)
 */
export async function fn_create_deposit_qr(requestId: string, actor: Actor): Promise<Payment> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.deposit_amount) throw new Error(`Hồ sơ ${requestId} chưa có thông tin tiền cọc`);

  const qrRef = `MC_DEP_${requestId.slice(0, 8)}_${Date.now().toString().slice(-4)}`;
  const expiresAt = new Date(clock.now().getTime() + BUSINESS_RULES.TIMERS.DEPOSIT_MINUTES * 60 * 1000).toISOString();

  const payment: Payment = {
    id: crypto.randomUUID(),
    request_id: requestId,
    kind: 'DEPOSIT',
    amount: req.deposit_amount,
    qr_ref: qrRef,
    status: 'PENDING',
    expires_at: expiresAt,
  };

  await db.payments.add(payment);
  dataAdapter.pushRecordToCloud('payments', payment as unknown as Record<string, unknown>);
  await db.rental_requests.update(requestId, { status: 'CHO_COC' });
  const freshReq = await db.rental_requests.get(requestId);
  if (freshReq) dataAdapter.pushRecordToCloud('rental_requests', freshReq as unknown as Record<string, unknown>);

  // Tích hợp sinh mã QR VietQR (Real hoặc Mock)
  const cfg = getIntegrationConfig();
  await integrations.paymentQr.generateQr({
    accountNo: cfg.accountNo,
    accountName: cfg.accountName,
    bankBin: cfg.bankBin,
    amount: payment.amount,
    description: qrRef,
    requestId,
    bpmnNodeId: 'M_CreateDeposit',
  });

  await logEvent(requestId, 'M_CreateDeposit', 'CREATE_DEPOSIT_QR', actor, {
    payment_id: payment.id,
    amount: payment.amount,
    qr_ref: qrRef,
    expires_at: expiresAt,
  });

  return payment;
}

/**
 * M_CheckDeposit (T02d • Đối soát tiền cọc)
 */
export async function fn_reconcile_deposit(
  requestId: string,
  actor: Actor
): Promise<{ match_result: 'DU' | 'THIEU' | 'SAI' }> {
  const req = await db.rental_requests.get(requestId);
  if (!req) throw new Error(`Không tìm thấy hồ sơ ${requestId}`);

  const payment = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'DEPOSIT' && p.status === 'PENDING')
    .first();

  if (!payment) throw new Error(`Không tìm thấy giao dịch cọc PENDING cho hồ sơ ${requestId}`);

  const paidAmount = payment.paid_amount || 0;
  let matchResult: 'DU' | 'THIEU' | 'SAI' = 'SAI';

  if (paidAmount >= payment.amount) {
    matchResult = 'DU';
  } else if (paidAmount > 0) {
    matchResult = 'THIEU';
  }

  const updateData: Partial<Payment> = { match_result: matchResult };
  if (matchResult === 'DU') {
    updateData.status = 'VERIFIED';
    updateData.verified_at = clock.nowISO();
  }

  await db.payments.update(payment.id, updateData);

  await logEvent(requestId, 'M_CheckDeposit', 'RECONCILE_DEPOSIT', actor, {
    payment_id: payment.id,
    paid_amount: paidAmount,
    expected_amount: payment.amount,
    match_result: matchResult,
  });

  return { match_result: matchResult };
}

/**
 * Cổng M_G03 (Đúng/đủ cọc?)
 */
export function eval_M_G03(matchResult: 'DU' | 'THIEU' | 'SAI'): 'Đủ' | 'Sai/thiếu' {
  return matchResult === 'DU' ? 'Đủ' : 'Sai/thiếu';
}

/**
 * Cổng M_G03b (Xác nhận cọc ngoại lệ do nhân viên nhập ở NV-02)
 * Nhánh 'Có' hoặc 'Chưa'
 */
export async function eval_and_apply_M_G03b(
  requestId: string,
  actor: Actor,
  decision: 'Có' | 'Chưa',
  note?: string
): Promise<'Có' | 'Chưa'> {
  const payment = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'DEPOSIT')
    .reverse()
    .first();

  if (!payment) throw new Error(`Không tìm thấy thanh toán cọc cho hồ sơ ${requestId}`);

  if (decision === 'Có') {
    await db.payments.update(payment.id, {
      status: 'VERIFIED',
      verified_at: clock.nowISO(),
      manual_verified_by: actor.id,
      manual_note: note || 'Nhân viên xác nhận hợp lệ thủ công',
    });
  } else {
    // Quy tắc thanh toán lại: bản cũ EXPIRED, tạo bản mới PENDING
    await db.payments.update(payment.id, {
      status: 'EXPIRED',
      manual_note: note || 'Nhân viên không chấp nhận giao dịch, yêu cầu chuyển lại',
    });
    await fn_create_deposit_qr(requestId, actor);
  }

  await logEvent(requestId, 'M_G03b', 'MANUAL_DEPOSIT_DECISION', actor, {
    decision,
    note,
    decision_maker_id: actor.id,
    decision_maker_role: actor.role,
  });

  return decision;
}

/**
 * M_Contract (T03 • Tạo hợp đồng điện tử)
 */
export async function fn_generate_contract(requestId: string, actor: Actor): Promise<Contract> {
  const now = clock.now();
  const expiresAt = new Date(now.getTime() + BUSINESS_RULES.TIMERS.SIGN_HOURS * 3600 * 1000).toISOString();

  // Kiểm tra nếu hợp đồng đã có thì cập nhật, nếu chưa thì tạo
  let contract = await db.contracts.where('request_id').equals(requestId).first();
  if (contract) {
    await db.contracts.update(contract.id, {
      status: 'SENT',
      sent_at: now.toISOString(),
      expires_at: expiresAt,
    });
  } else {
    contract = {
      id: crypto.randomUUID(),
      request_id: requestId,
      file_url: `blob://contract_${requestId.slice(0, 8)}.pdf`,
      status: 'SENT',
      sent_at: now.toISOString(),
      expires_at: expiresAt,
    };
    await db.contracts.add(contract);
  }

  dataAdapter.pushRecordToCloud('contracts', contract as unknown as Record<string, unknown>);
  await db.rental_requests.update(requestId, { status: 'CHO_KY' });
  const freshContractReq = await db.rental_requests.get(requestId);
  if (freshContractReq) dataAdapter.pushRecordToCloud('rental_requests', freshContractReq as unknown as Record<string, unknown>);

  await logEvent(requestId, 'M_Contract', 'GENERATE_CONTRACT', actor, {
    contract_id: contract.id,
    expires_at: expiresAt,
  });

  return contract;
}

/**
 * M_CancelRefund (Hoàn cọc hợp lệ, hủy yêu cầu)
 */
export async function fn_cancel_and_refund(requestId: string, actor: Actor): Promise<void> {
  const verifiedDeposit = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'DEPOSIT' && p.status === 'VERIFIED')
    .first();

  if (verifiedDeposit) {
    const refundPayment: Payment = {
      id: crypto.randomUUID(),
      request_id: requestId,
      kind: 'REFUND',
      amount: verifiedDeposit.paid_amount || verifiedDeposit.amount,
      qr_ref: `REFUND_${verifiedDeposit.qr_ref}`,
      status: 'VERIFIED',
      verified_at: clock.nowISO(),
    };
    await db.payments.add(refundPayment);
  }

  await fn_end_cancel(requestId, actor, 'QUA_HAN_KY');

  await logEvent(requestId, 'M_CancelRefund', 'CANCEL_AND_REFUND', actor, {
    refund_amount: verifiedDeposit?.paid_amount || verifiedDeposit?.amount || 0,
  });
}

/**
 * M_SaveBooking (T03b • Khóa lịch xe đặt thuê)
 */
export async function fn_lock_schedule(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Hồ sơ ${requestId} chưa gán xe`);

  const schedule = {
    id: crypto.randomUUID(),
    vehicle_id: req.vehicle_id,
    request_id: requestId,
    kind: 'RENTAL' as const,
    start_at: req.start_at,
    end_at: req.end_at,
  };

  await db.vehicle_schedule.add(schedule);
  dataAdapter.pushRecordToCloud('vehicle_schedule', schedule as unknown as Record<string, unknown>);
  await db.rental_requests.update(requestId, { status: 'CHO_BAN_GIAO' });
  const freshLockReq = await db.rental_requests.get(requestId);
  if (freshLockReq) dataAdapter.pushRecordToCloud('rental_requests', freshLockReq as unknown as Record<string, unknown>);

  await logEvent(requestId, 'M_SaveBooking', 'LOCK_SCHEDULE', actor, {
    schedule_id: schedule.id,
    vehicle_id: req.vehicle_id,
  });
}

// ==============================================================
// 3. KIỂM TRA & BÀN GIAO
// ==============================================================

/**
 * Cổng M_G04 (Xe đạt?)
 */
export function eval_M_G04(result: 'DAT' | 'CHUA_DAT' | 'CAN_BAO_TRI'): 'Đạt' | 'Chưa đạt' {
  return result === 'DAT' ? 'Đạt' : 'Chưa đạt';
}

/**
 * Activity_0w8x12e (Gửi khách checklist và ảnh tình trạng xe)
 */
export async function fn_send_vehicle_condition(requestId: string, actor: Actor): Promise<void> {
  await db.rental_requests.update(requestId, { status: 'CHO_KHACH_NHAN' });

  const req = await db.rental_requests.get(requestId);
  if (req) {
    await db.notifications.add({
      id: crypto.randomUUID(),
      user_id: req.customer_id,
      request_id: requestId,
      template: 'vehicle_condition_ready',
      message: 'Nhân viên đã kiểm tra xe hoàn tất. Vui lòng kiểm tra ảnh và xác nhận nhận xe.',
      is_read: false,
      created_at: clock.nowISO(),
    });
  }

  await logEvent(requestId, 'Activity_0w8x12e', 'SEND_CONDITION', actor);
}

/**
 * Cổng Gateway_0ixde68 (Đồng ý nhận xe?)
 */
export function eval_Gateway_0ixde68(customerAccepted: boolean): 'Có' | 'Không' {
  return customerAccepted ? 'Có' : 'Không';
}

/**
 * M_SetRented (T05b • Cập nhật Đang thuê)
 */
export async function fn_set_rented(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Hồ sơ ${requestId} chưa có xe`);

  await db.vehicles.update(req.vehicle_id, { status: 'DANG_THUE' });
  await db.rental_requests.update(requestId, { status: 'DANG_THUE' });

  await logEvent(requestId, 'M_SetRented', 'SET_RENTED', actor, {
    vehicle_id: req.vehicle_id,
  });
}

// ==============================================================
// 4. TRẢ XE, GIÁM ĐỊNH & BẢNG KÊ
// ==============================================================

/**
 * M_DigitalCompare (T07 • Đối chiếu ảnh/giao–nhận)
 */
export async function fn_compare_inspections(
  requestId: string,
  actor: Actor
): Promise<{ diff_items: Record<string, unknown> }> {
  // Lấy biên bản trả xe
  const returnInsp = await db.inspections
    .where('request_id')
    .equals(requestId)
    .and((i) => i.kind === 'RETURN')
    .reverse()
    .first();

  const diffItems = returnInsp?.diff_items || {};

  await logEvent(requestId, 'M_DigitalCompare', 'COMPARE_INSPECTIONS', actor, {
    diff_count: Object.keys(diffItems).length,
  });

  return { diff_items: diffItems };
}

/**
 * Cổng M_GDamage (Có sai lệch?)
 */
export function eval_M_GDamage(diffItems: Record<string, unknown>): 'Có' | 'Không' {
  return Object.keys(diffItems).length > 0 ? 'Có' : 'Không';
}

/**
 * M_CalcFees (T07b • Tự động tính phí)
 */
export async function fn_calculate_fees(requestId: string, actor: Actor): Promise<Statement> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Không tìm thấy hồ sơ ${requestId}`);

  const vehicle = await db.vehicles.get(req.vehicle_id);
  const dailyPrice = vehicle?.daily_price || 150000;

  const items = [];
  let totalFee = 0;

  // 1. Phí trễ hạn nếu có
  if (req.returned_at) {
    const returnedMs = new Date(req.returned_at).getTime();
    const plannedEndMs = new Date(req.end_at).getTime();
    // Chỉ tính trễ hạn nếu thời điểm trả xe sau hạn kết thúc ít nhất 1 phút (tránh sai số mili-giây)
    if (returnedMs > plannedEndMs + 60 * 1000) {
      const lateHours = Math.ceil((returnedMs - plannedEndMs) / (3600 * 1000));
      const lateFee = lateHours * (dailyPrice * BUSINESS_RULES.LATE_FEE_PER_HOUR_RATE);
      items.push({
        name: `Phí trễ hạn (${lateHours} giờ)`,
        amount: lateFee,
      });
      totalFee += lateFee;
    }
  }

  // 2. Chi phí hư hỏng từ damage_findings
  const damages = await db.damage_findings.where('request_id').equals(requestId).toArray();
  for (const d of damages) {
    items.push({
      name: `Bồi thường hư hại: ${d.description}`,
      amount: d.estimated_cost,
    });
    totalFee += d.estimated_cost;
  }

  const existingStatement = await db.statements.where('request_id').equals(requestId).first();
  const version = (existingStatement?.version || 0) + 1;

  const statement: Statement = {
    id: existingStatement?.id || crypto.randomUUID(),
    request_id: requestId,
    version,
    items,
    total_fee: totalFee,
    status: 'DRAFT',
  };

  if (existingStatement) {
    await db.statements.put(statement);
  } else {
    await db.statements.add(statement);
  }

  await logEvent(requestId, 'M_CalcFees', 'CALCULATE_FEES', actor, {
    total_fee: totalFee,
    items_count: items.length,
    version,
  });

  return statement;
}

/**
 * M_SendStatement (T07c • Gửi bảng kê chi tiết)
 */
export async function fn_send_statement(requestId: string, actor: Actor): Promise<void> {
  const statement = await db.statements.where('request_id').equals(requestId).first();
  if (!statement) throw new Error(`Không có bảng kê cho hồ sơ ${requestId}`);

  await db.statements.update(statement.id, {
    status: 'SENT',
    sent_at: clock.nowISO(),
  });

  await db.rental_requests.update(requestId, {
    status: 'CHO_KHACH_XAC_NHAN_BANG_KE',
  });

  const req = await db.rental_requests.get(requestId);
  const customer = req?.customer_id ? await db.profiles.get(req.customer_id) : undefined;
  if (customer) {
    await integrations.notifier.sendNotification({
      recipientEmail: customer.phone ? `${customer.phone}@motocare.vn` : 'khach@motocare.vn',
      recipientName: customer.full_name || 'Quý khách',
      template: 'STATEMENT',
      subject: `[Moto Care] Bảng kê thanh lý trả xe #${requestId.slice(0, 8)} (v${statement.version})`,
      content: `Bảng kê trả xe đã sẵn sàng với tổng phí phát sinh: ${statement.total_fee.toLocaleString()} đ. Vui lòng xem và xác nhận tại KH-09.`,
      requestId,
      bpmnNodeId: 'M_SendStatement',
    });
  }

  await logEvent(requestId, 'M_SendStatement', 'SEND_STATEMENT', actor, {
    statement_id: statement.id,
    total_fee: statement.total_fee,
  });
}

/**
 * Cổng M_GDispute (Khách đồng ý?)
 */
export function eval_M_GDispute(customerAnswer: 'CHAP_THUAN' | 'KHIEU_NAI'): 'Có' | 'Không' {
  return customerAnswer === 'CHAP_THUAN' ? 'Có' : 'Không';
}

/**
 * M_ApproveAdjustment (Cập nhật kết luận/biên bản phí)
 */
export async function fn_apply_adjustment(requestId: string, actor: Actor): Promise<void> {
  const statement = await db.statements.where('request_id').equals(requestId).first();
  if (!statement) throw new Error(`Không tìm thấy bảng kê ${requestId}`);

  await db.statements.update(statement.id, {
    version: statement.version + 1,
    status: 'DRAFT',
  });

  await logEvent(requestId, 'M_ApproveAdjustment', 'APPLY_ADJUSTMENT', actor, {
    version: statement.version + 1,
    resolution_note: statement.resolution_note,
  });
}

// ==============================================================
// 5. QUYẾT TOÁN
// ==============================================================

/**
 * M_NetDeposit (T08 • Đối trừ tiền cọc)
 */
export async function fn_net_deposit(requestId: string, actor: Actor): Promise<Settlement> {
  const statement = await db.statements.where('request_id').equals(requestId).first();
  const totalFee = statement?.total_fee || 0;

  // Lấy các khoản cọc VERIFIED
  const deposits = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'DEPOSIT' && p.status === 'VERIFIED')
    .toArray();

  const depositPaid = deposits.reduce((sum, p) => sum + (p.paid_amount || p.amount), 0);
  const balance = depositPaid - totalFee;

  let kind: 'HOAN_DU' | 'CAN_BANG' | 'THU_THEM' = 'CAN_BANG';
  if (balance > 0) kind = 'HOAN_DU';
  else if (balance < 0) kind = 'THU_THEM';

  const existing = await db.settlements.where('request_id').equals(requestId).first();
  const settlement: Settlement = {
    id: existing?.id || crypto.randomUUID(),
    request_id: requestId,
    deposit_paid: depositPaid,
    total_fee: totalFee,
    balance: balance,
    kind: kind,
    status: 'CHO',
  };

  if (existing) {
    await db.settlements.update(settlement.id, settlement);
  } else {
    await db.settlements.add(settlement);
  }

  await logEvent(requestId, 'M_NetDeposit', 'NET_DEPOSIT', actor, {
    deposit_paid: depositPaid,
    total_fee: totalFee,
    balance: balance,
    kind: kind,
  });

  return settlement;
}

/**
 * Cổng M_GBalance (Chênh lệch? 3 nhánh: Hoàn dư / Cân bằng / Thu thêm)
 */
export function eval_M_GBalance(balance: number): 'Hoàn dư' | 'Cân bằng' | 'Thu thêm' {
  if (balance > 0) return 'Hoàn dư';
  if (balance < 0) return 'Thu thêm';
  return 'Cân bằng';
}

/**
 * M_Refund (T08b • Khởi tạo hoàn cọc dư)
 */
export async function fn_create_refund(requestId: string, actor: Actor): Promise<Payment> {
  const settlement = await db.settlements.where('request_id').equals(requestId).first();
  if (!settlement || settlement.balance <= 0) {
    throw new Error(`Không đủ điều kiện hoàn cọc dư cho hồ sơ ${requestId}`);
  }

  const refund: Payment = {
    id: crypto.randomUUID(),
    request_id: requestId,
    kind: 'REFUND',
    amount: settlement.balance,
    qr_ref: `REF_${requestId.slice(0, 8)}_${Date.now().toString().slice(-4)}`,
    status: 'PENDING',
  };

  await db.payments.add(refund);

  const req = await db.rental_requests.get(requestId);
  const customer = req?.customer_id ? await db.profiles.get(req.customer_id) : undefined;
  if (customer) {
    await integrations.notifier.sendNotification({
      recipientEmail: customer.phone ? `${customer.phone}@motocare.vn` : 'khach@motocare.vn',
      recipientName: customer.full_name || 'Quý khách',
      template: 'REFUND',
      subject: `[Moto Care] Thông báo hoàn cọc #${requestId.slice(0, 8)}`,
      content: `Khoản tiền cọc dư ${settlement.balance.toLocaleString()} đ đã được xử lý hoàn lại cho quý khách.`,
      requestId,
      bpmnNodeId: 'M_Refund',
    });
  }

  await logEvent(requestId, 'M_Refund', 'CREATE_REFUND', actor, {
    amount: settlement.balance,
  });

  return refund;
}

/**
 * M_PayExtra (T08a • Tạo yêu cầu thu thêm)
 */
export async function fn_create_extra_qr(requestId: string, actor: Actor): Promise<Payment> {
  const settlement = await db.settlements.where('request_id').equals(requestId).first();
  if (!settlement || settlement.balance >= 0) {
    throw new Error(`Không có khoản phải thu thêm cho hồ sơ ${requestId}`);
  }

  const extraAmount = Math.abs(settlement.balance);
  const qrRef = `MC_EXTRA_${requestId.slice(0, 8)}_${Date.now().toString().slice(-4)}`;
  const expiresAt = new Date(
    clock.now().getTime() + BUSINESS_RULES.TIMERS.EXTRA_PAYMENT_MINUTES * 60 * 1000
  ).toISOString();

  const payment: Payment = {
    id: crypto.randomUUID(),
    request_id: requestId,
    kind: 'EXTRA',
    amount: extraAmount,
    qr_ref: qrRef,
    status: 'PENDING',
    expires_at: expiresAt,
  };

  await db.payments.add(payment);
  await db.rental_requests.update(requestId, { status: 'CHO_THU_THEM' });

  // Tích hợp sinh mã QR VietQR thu thêm
  const cfg = getIntegrationConfig();
  await integrations.paymentQr.generateQr({
    accountNo: cfg.accountNo,
    accountName: cfg.accountName,
    bankBin: cfg.bankBin,
    amount: extraAmount,
    description: qrRef,
    requestId,
    bpmnNodeId: 'M_PayExtra',
  });

  await logEvent(requestId, 'M_PayExtra', 'CREATE_EXTRA_QR', actor, {
    amount: extraAmount,
    qr_ref: qrRef,
    expires_at: expiresAt,
  });

  return payment;
}

/**
 * M_VerifyExtra (Đối soát khoản thu bổ sung)
 */
export async function fn_reconcile_extra_payment(
  requestId: string,
  actor: Actor
): Promise<{ match_result: 'DU' | 'THIEU' | 'SAI' }> {
  const payment = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'EXTRA' && p.status === 'PENDING')
    .first();

  if (!payment) throw new Error(`Không tìm thấy khoản thu thêm PENDING cho hồ sơ ${requestId}`);

  const paidAmount = payment.paid_amount || 0;
  let matchResult: 'DU' | 'THIEU' | 'SAI' = 'SAI';

  if (paidAmount >= payment.amount) {
    matchResult = 'DU';
  } else if (paidAmount > 0) {
    matchResult = 'THIEU';
  }

  const updateData: Partial<Payment> = { match_result: matchResult };
  if (matchResult === 'DU') {
    updateData.status = 'VERIFIED';
    updateData.verified_at = clock.nowISO();
  }

  await db.payments.update(payment.id, updateData);

  await logEvent(requestId, 'M_VerifyExtra', 'RECONCILE_EXTRA', actor, {
    payment_id: payment.id,
    match_result: matchResult,
  });

  return { match_result: matchResult };
}

/**
 * Cổng M_GExtra (Thu thành công?)
 */
export function eval_M_GExtra(matchResult: 'DU' | 'THIEU' | 'SAI'): 'Đúng' | 'Chưa' {
  return matchResult === 'DU' ? 'Đúng' : 'Chưa';
}

/**
 * Cổng M_GExtraDecision (Khách thanh toán tiếp? Do nhân viên quyết định ở NV-08)
 * Nhánh 'Tiếp tục thanh toán' hoặc 'Không / chưa thanh toán'
 */
export async function eval_and_apply_M_GExtraDecision(
  requestId: string,
  actor: Actor,
  decision: 'Tiếp tục thanh toán' | 'Không / chưa thanh toán',
  note?: string
): Promise<'Tiếp tục thanh toán' | 'Không / chưa thanh toán'> {
  const payment = await db.payments
    .where('request_id')
    .equals(requestId)
    .and((p) => p.kind === 'EXTRA')
    .reverse()
    .first();

  if (payment) {
    await db.payments.update(payment.id, {
      manual_note: note,
    });
  }

  if (decision === 'Tiếp tục thanh toán') {
    if (payment && payment.status === 'PENDING') {
      await db.payments.update(payment.id, { status: 'EXPIRED' });
    }
    await fn_create_extra_qr(requestId, actor);
  }

  await logEvent(requestId, 'M_GExtraDecision', 'EXTRA_PAYMENT_DECISION', actor, {
    decision,
    note,
    decision_maker_id: actor.id,
    decision_maker_role: actor.role,
  });

  return decision;
}

/**
 * M_RecordDebt (Ghi nhận công nợ chưa tất toán)
 */
export async function fn_record_debt(requestId: string, actor: Actor): Promise<void> {
  await db.settlements.where('request_id').equals(requestId).modify({
    status: 'CONG_NO',
  });

  await db.rental_requests.update(requestId, {
    status: 'CONG_NO',
  });

  await logEvent(requestId, 'M_RecordDebt', 'RECORD_DEBT', actor);
}

/**
 * M_Settle (T08c • Ghi hoàn tất quyết toán)
 */
export async function fn_settle(requestId: string, actor: Actor): Promise<void> {
  await db.settlements.where('request_id').equals(requestId).modify({
    status: 'HOAN_TAT',
    settled_at: clock.nowISO(),
  });

  await db.rental_requests.update(requestId, {
    status: 'CHO_DANH_GIA_XE',
  });

  await logEvent(requestId, 'M_Settle', 'SETTLE_COMPLETED', actor);
}

// ==============================================================
// 6. SAU TRẢ & LƯU HỒ SƠ
// ==============================================================

/**
 * Cổng M_GReady (Sẵn sàng?)
 */
export function eval_M_GReady(result: 'DAT' | 'CAN_BAO_TRI'): 'Đạt' | 'Cần bảo trì' {
  return result === 'DAT' ? 'Đạt' : 'Cần bảo trì';
}

/**
 * M_Maintenance (T11/T11b • Lập phiếu bảo trì, khóa lịch)
 */
export async function fn_create_maintenance(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Không tìm thấy hồ sơ hoặc xe của ${requestId}`);

  const nowISO = clock.nowISO();
  const maintenanceEndISO = new Date(clock.now().getTime() + 48 * 3600 * 1000).toISOString();

  await db.maintenance_orders.add({
    id: crypto.randomUUID(),
    vehicle_id: req.vehicle_id,
    request_id: requestId,
    reason: 'Đánh giá sau khi khách trả xe: cần bảo dưỡng/sửa chữa',
    status: 'MO',
    created_at: nowISO,
  });

  await db.vehicle_schedule.add({
    id: crypto.randomUUID(),
    vehicle_id: req.vehicle_id,
    request_id: requestId,
    kind: 'MAINTENANCE',
    start_at: nowISO,
    end_at: maintenanceEndISO,
  });

  await db.vehicles.update(req.vehicle_id, { status: 'BAO_TRI' });

  await logEvent(requestId, 'M_Maintenance', 'CREATE_MAINTENANCE', actor, {
    vehicle_id: req.vehicle_id,
  });
}

/**
 * M_MarkReady (T10 • Trạng thái Sẵn sàng)
 */
export async function fn_mark_ready(requestId: string, actor: Actor): Promise<void> {
  const req = await db.rental_requests.get(requestId);
  if (!req || !req.vehicle_id) throw new Error(`Không tìm thấy hồ sơ hoặc xe của ${requestId}`);

  await db.vehicles.update(req.vehicle_id, { status: 'SAN_SANG' });

  await logEvent(requestId, 'M_MarkReady', 'MARK_VEHICLE_READY', actor, {
    vehicle_id: req.vehicle_id,
  });
}

/**
 * M_Archive (T12 • Lưu hồ sơ tập trung)
 */
export async function fn_archive_case(requestId: string, actor: Actor): Promise<void> {
  const nowISO = clock.nowISO();
  await db.rental_requests.update(requestId, {
    status: 'HOAN_TAT',
    archived_at: nowISO,
    closed_at: nowISO,
  });

  await logEvent(requestId, 'M_Archive', 'ARCHIVE_CASE', actor);
}

