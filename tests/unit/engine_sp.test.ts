// tests/unit/engine_sp.test.ts
// Bộ kiểm thử toàn diện cho Sub-processes SP1 (Gia hạn) và SP2 (Sự cố) trong Process Engine (Giai đoạn 2B)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { engine, getTrace } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 2B: Sub-process SP1 (Gia Hạn) & SP2 (Sự Cố)', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
  const staffActor: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };
  const managerActor: Actor = { id: SEED_USERS[0].id, role: 'quan_ly' };

  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    timerManager.stop();
  });

  /**
   * Helper function: Đưa hồ sơ thuê xe vượt qua toàn bộ giai đoạn nhận xe và đang dừng ở M_EG (Đang thuê)
   */
  async function setupActiveRental(vehicleType = 'xe_so') {
    await seedDatabase();

    const startAt = '2026-11-10T08:00:00.000Z';
    const endAt = '2026-11-12T08:00:00.000Z'; // 2 ngày

    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: vehicleType,
      start_at: startAt,
      end_at: endAt,
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'https://example.com/cccd1.jpg', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'https://example.com/cccd2.jpg', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'https://example.com/gplx.jpg', is_valid: true },
      ],
    });

    // 1. M_WaitDeposit
    const payment = await db.payments.where('request_id').equals(reqId).first();
    await engine.complete(reqId, 'M_WaitDeposit', { paid_amount: payment?.amount || 90000 }, customerActor);

    // 2. M_WaitSign
    await engine.complete(reqId, 'M_WaitSign', {}, customerActor);

    // 3. M_InspectPre
    const req = await db.rental_requests.get(reqId);
    await engine.complete(
      reqId,
      'M_InspectPre',
      {
        vehicle_id: req?.vehicle_id,
        attempt_no: 1,
        result: 'DAT',
        checklist: { brakes: 'OK', lights: 'OK', tires: 'OK' },
      },
      staffActor
    );

    // 4. M_Photo
    await engine.complete(
      reqId,
      'M_Photo',
      { photo_urls: ['https://example.com/xe1.jpg', 'https://example.com/xe2.jpg'] },
      staffActor
    );

    // 5. Activity_0d0qzp6
    await engine.complete(reqId, 'Activity_0d0qzp6', { customer_accepted: true, attempt_no: 1 }, customerActor);

    // 6. M_Handover
    await engine.complete(
      reqId,
      'M_Handover',
      { accessories: { helmets: 2, raincoats: 2 } },
      staffActor
    );

    // Trạng thái hiện tại: DANG_THUE, dừng tại M_EG
    const state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);
    const updatedReq = await db.rental_requests.get(reqId);
    expect(updatedReq?.status).toBe('DANG_THUE');

    return reqId;
  }

  // =========================================================================
  // PHẦN 1: SUB-PROCESS SP1 (GIA HẠN)
  // =========================================================================

  it('SP1: GH_GEligible - Nhánh Không (trùng lịch xe) -> GH_NotifyOld -> GH_GMerge -> GH_END -> M_EG', async () => {
    const reqId = await setupActiveRental();
    const req = await db.rental_requests.get(reqId);
    if (!req || !req.vehicle_id) throw new Error('Setup failed');

    // Tạo một lịch đặt xe khác ngay sau ngày 2026-11-12
    await db.vehicle_schedule.add({
      id: crypto.randomUUID(),
      vehicle_id: req.vehicle_id,
      request_id: crypto.randomUUID(),
      start_at: '2026-11-12T10:00:00.000Z',
      end_at: '2026-11-14T10:00:00.000Z',
      kind: 'RENTAL',
    });

    // Khách xin gia hạn đến 2026-11-13 (bị trùng khoảng trên)
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-13T08:00:00.000Z',
      },
      customerActor
    );

    // Tự động chạy GH_Check -> GH_GEligible ("Không") -> GH_NotifyOld -> GH_GMerge -> GH_END -> M_EG
    const state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const ext = await db.extension_requests.where('request_id').equals(reqId).first();
    expect(ext?.eligible).toBe(false);
    expect(ext?.status).toBe('TU_CHOI');

    const trace = await getTrace(reqId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('GH_Check');
    expect(traceNodes).toContain('GH_NotifyOld');
    expect(traceNodes).toContain('GH_END');
    expect(traceNodes[traceNodes.length - 1]).toBe('M_EG');
  });

  it('SP1: GH_GAccept - Nhánh Không (Khách từ chối đề xuất) -> GH_NotifyOld -> GH_GMerge -> GH_END -> M_EG', async () => {
    const reqId = await setupActiveRental();

    // Khách xin gia hạn không bị trùng lịch -> tới GH_WaitAccept
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-14T08:00:00.000Z',
      },
      customerActor
    );

    const trace1 = await getTrace(reqId);
    console.log('Trace after EXTEND:', trace1.map(t => ({ node: t.bpmn_node_id, event: t.event_type, payload: t.payload })));

    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['GH_WaitAccept']);

    // Khách từ chối đề xuất
    await engine.complete(reqId, 'GH_WaitAccept', { answer: 'TU_CHOI' }, customerActor);

    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const ext = await db.extension_requests.where('request_id').equals(reqId).first();
    expect(ext?.status).toBe('TU_CHOI');

    const trace = await getTrace(reqId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('GH_WaitAccept');
    expect(traceNodes).toContain('GH_NotifyOld');
    expect(traceNodes).toContain('GH_END');
  });

  it('SP1: Happy path - Gia hạn thành công (có phí bổ sung) -> Trả xe -> M_END', async () => {
    const reqId = await setupActiveRental();
    const reqBefore = await db.rental_requests.get(reqId);
    const oldTotalPrice = reqBefore?.total_price || 0;

    // 1. Kích hoạt EXTEND tại M_EG
    const newEndAt = '2026-11-14T08:00:00.000Z'; // Thêm 2 ngày
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: newEndAt,
      },
      customerActor
    );

    // Dừng tại GH_WaitAccept
    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['GH_WaitAccept']);

    // 2. Khách đồng ý gia hạn
    await engine.complete(reqId, 'GH_WaitAccept', { answer: 'DONG_Y' }, customerActor);

    // GH_NeedPayment đánh giá phụ phí > 0 -> tạo QR -> dừng tại GH_VerifyQR
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['GH_VerifyQR']);

    // Kiểm tra bản ghi thanh toán EXTENSION được tạo
    const extPayment = await db.payments
      .where('request_id')
      .equals(reqId)
      .and((p) => p.kind === 'EXTENSION')
      .first();
    expect(extPayment).toBeDefined();
    expect(extPayment?.status).toBe('PENDING');

    // 3. Khách thanh toán QR gia hạn
    await engine.complete(
      reqId,
      'GH_VerifyQR',
      { paid_amount: extPayment?.amount, provider_txn_id: 'EXT_TXN_SUCCESS' },
      customerActor
    );

    // Tự động: GH_Update -> GH_NotifyOK -> GH_GMerge -> GH_END -> M_EG
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const reqAfterExt = await db.rental_requests.get(reqId);
    expect(reqAfterExt?.end_at).toBe(newEndAt);
    expect(reqAfterExt?.total_price).toBeGreaterThan(oldTotalPrice);

    const schedule = await db.vehicle_schedule.where('request_id').equals(reqId).first();
    expect(schedule?.end_at).toBe(newEndAt);

    // 4. Khách hoàn thành chuyến đi và Trả xe tại M_EG
    await engine.complete(reqId, 'M_EG', { event_type: 'RETURN' }, customerActor);

    // Tiếp tục luồng trả xe bình thường của MAIN:
    // M_ReceiveReturn
    await engine.complete(reqId, 'M_ReceiveReturn', {}, staffActor);

    // M_CheckReturn (không có hư hại)
    await engine.complete(
      reqId,
      'M_CheckReturn',
      { vehicle_id: reqAfterExt?.vehicle_id, checklist: { all_good: true }, diff_items: {} },
      staffActor
    );

    // M_ReceiveReview (chấp thuận bảng kê)
    await engine.complete(reqId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // M_ConfirmRefund
    await engine.complete(reqId, 'M_ConfirmRefund', {}, customerActor);

    // M_CheckReady (xe đạt chuẩn)
    await engine.complete(reqId, 'M_CheckReady', { result: 'DAT' }, staffActor);

    // Kết thúc tại M_END
    const finalReq = await db.rental_requests.get(reqId);
    expect(finalReq?.status).toBe('HOAN_TAT');

    const trace = await getTrace(reqId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('GH_START');
    expect(traceNodes).toContain('GH_Update');
    expect(traceNodes).toContain('GH_END');
    expect(traceNodes).toContain('M_END');
  });

  it('SP1 Timers: GH_Timer (2h) & GH_TimerPay (30m) quá hạn dẫn đến GH_NotifyOld', async () => {
    const reqId = await setupActiveRental();

    // 1. Test GH_Timer
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-14T08:00:00.000Z',
      },
      customerActor
    );

    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['GH_WaitAccept']);

    // Tiến đồng hồ vượt 2 giờ (121 phút)
    clock.advance(121);
    const triggeredCount = await timerManager.sweepTimers();
    expect(triggeredCount).toBe(1);

    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const ext1 = await db.extension_requests.where('request_id').equals(reqId).first();
    expect(ext1?.status).toBe('HET_HAN');

    // 2. Test GH_TimerPay
    // Xin gia hạn lần nữa
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-15T08:00:00.000Z',
      },
      customerActor
    );
    await engine.complete(reqId, 'GH_WaitAccept', { answer: 'DONG_Y' }, customerActor);

    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['GH_VerifyQR']);

    // Tiến đồng hồ quá 30 phút (35 phút)
    clock.advance(35);
    const triggeredCountPay = await timerManager.sweepTimers();
    expect(triggeredCountPay).toBe(1);

    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const pay = await db.payments
      .where('request_id')
      .equals(reqId)
      .and((p) => p.kind === 'EXTENSION')
      .reverse()
      .first();
    expect(pay?.status).toBe('EXPIRED');
  });

  // =========================================================================
  // PHẦN 2: SUB-PROCESS SP2 (SỰ CỐ)
  // =========================================================================

  it('SP2: SC_GAccept & SC_GRetry - Đối tác từ chối -> SC_TryNext -> Hết đối tác -> SC_Escalate', async () => {
    const reqId = await setupActiveRental();

    // Đánh dấu chỉ có 1 đối tác khả dụng
    await db.partners.toCollection().modify({ available: false });
    const p = await db.partners.toCollection().first();
    if (p) await db.partners.update(p.id, { available: true });

    // Báo sự cố
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Thủng lốp giữa đường',
        lat: 10.7769,
        lng: 106.7009,
      },
      customerActor
    );

    // Tự động: SC_Create -> SC_Select -> SC_Dispatch -> dừng tại SC_ReceiveAck
    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_ReceiveAck']);

    // Quản lý ghi nhận đối tác từ chối tiếp nhận (DECLINED)
    await engine.complete(reqId, 'SC_ReceiveAck', { status: 'DECLINED' }, managerActor);

    // Do chỉ có 1 đối tác và đã thử -> SC_GRetry chọn nhánh "Hết" -> dừng tại SC_Escalate (QL xử lý)
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_Escalate']);
  });

  it('SP2: SC_GResolve - Quản lý không có phương án thay thế -> SC_NotifyEarly -> SC_END_EARLY -> M_EarlyBoundary -> M_ReturnMerge', async () => {
    const reqId = await setupActiveRental();

    // Đánh dấu chỉ 1 đối tác khả dụng và đối tác này từ chối
    await db.partners.toCollection().modify({ available: false });
    const p = await db.partners.toCollection().first();
    if (p) await db.partners.update(p.id, { available: true });

    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Hỏng hóc động cơ nghiêm trọng không thể khắc phục',
      },
      customerActor
    );

    // Đối tác từ chối -> Hết đối tác -> dừng tại SC_Escalate
    await engine.complete(reqId, 'SC_ReceiveAck', { status: 'DECLINED' }, managerActor);

    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_Escalate']);

    // Quản lý quyết định "Không" có phương án hỗ trợ cứu hộ
    await engine.complete(
      reqId,
      'SC_Escalate',
      { decision: 'Không', escalation_note: 'Không có xe đổi, yêu cầu thu hồi xe' },
      managerActor
    );

    // SC_GResolve ("Không") -> SC_NotifyEarly -> SC_END_EARLY -> M_EarlyBoundary -> M_ReturnMerge -> dừng tại M_ReceiveReturn
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_ReceiveReturn']);

    const req = await db.rental_requests.get(reqId);
    expect(req?.status).toBe('CHO_NHAN_XE_TRA');

    const trace = await getTrace(reqId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('SC_Escalate');
    expect(traceNodes).toContain('SC_NotifyEarly');
    expect(traceNodes).toContain('SC_END_EARLY');
    expect(traceNodes).toContain('M_EarlyBoundary');
    expect(traceNodes).toContain('M_ReturnMerge');
  });

  it('SP2: Happy path - Xử lý sự cố thành công -> Tiếp tục thuê -> Trả xe -> M_END', async () => {
    const reqId = await setupActiveRental();

    // 1. Khách báo sự cố tại M_EG
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Đứt dây côn tại Quận 1',
        photo_urls: ['https://example.com/suco.jpg'],
      },
      customerActor
    );

    // Dừng tại SC_ReceiveAck
    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_ReceiveAck']);

    // 2. Đối tác đồng ý tiếp nhận
    await engine.complete(reqId, 'SC_ReceiveAck', { status: 'ACCEPTED' }, managerActor);

    // Tự động chuyển qua SC_Track -> dừng tại SC_ReceiveResult
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_ReceiveResult']);

    // 3. Quản lý xác nhận đối tác đã cứu hộ xong
    await engine.complete(
      reqId,
      'SC_ReceiveResult',
      { result_note: 'Đã thay dây côn mới tại chỗ' },
      managerActor
    );

    // Dừng tại SC_Log (Nhân viên xác nhận thực tế)
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_Log']);

    // 4. Nhân viên chốt phí và quyết định CHO TIẾP TỤC THUÊ
    await engine.complete(
      reqId,
      'SC_Log',
      {
        actual_cost: 150000,
        covered_by: 'SHOP',
        continue_rental: true,
      },
      staffActor
    );

    // Tự động: SC_SettleDecision ("Có") -> SC_SendContinue -> SC_END_OK -> quay lại M_EG
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['M_EG']);

    const req = await db.rental_requests.get(reqId);
    expect(req?.status).toBe('DANG_THUE');

    // 5. Sau đó khách tiếp tục hành trình và thực hiện Trả xe
    await engine.complete(reqId, 'M_EG', { event_type: 'RETURN' }, customerActor);

    // Chạy hoàn tất các bước trả xe
    await engine.complete(reqId, 'M_ReceiveReturn', {}, staffActor);
    await engine.complete(
      reqId,
      'M_CheckReturn',
      { vehicle_id: req?.vehicle_id, checklist: { all_good: true }, diff_items: {} },
      staffActor
    );
    await engine.complete(reqId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);
    await engine.complete(reqId, 'M_ConfirmRefund', {}, customerActor);
    await engine.complete(reqId, 'M_CheckReady', { result: 'DAT' }, staffActor);

    // Hoàn tất tại M_END
    const finalReq = await db.rental_requests.get(reqId);
    expect(finalReq?.status).toBe('HOAN_TAT');

    const trace = await getTrace(reqId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('SC_START');
    expect(traceNodes).toContain('SC_SendContinue');
    expect(traceNodes).toContain('SC_END_OK');
    expect(traceNodes).toContain('M_END');
  });

  it('SP2 Timers: SC_AckTimer (15m) & SC_ResultTimer (2h) kích hoạt chuyển nhánh đúng', async () => {
    const reqId = await setupActiveRental();

    // 1. Báo sự cố -> SC_ReceiveAck
    await engine.complete(
      reqId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Hỏng bugi',
      },
      customerActor
    );

    let state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toEqual(['SC_ReceiveAck']);

    // Quá hạn 15 phút (16 phút) -> SC_AckTimer kích hoạt -> TIMEOUT -> SC_TryNext
    clock.advance(16);
    const countAck = await timerManager.sweepTimers();
    expect(countAck).toBe(1);

    // Đối tác kế tiếp được thử hoặc tới SC_Escalate
    state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids.length).toBeGreaterThan(0);

    // Nếu đang ở SC_ReceiveAck của đối tác thứ 2 thì cho ACCEPT
    if (state?.waiting_node_ids.includes('SC_ReceiveAck')) {
      await engine.complete(reqId, 'SC_ReceiveAck', { status: 'ACCEPTED' }, managerActor);
    } else if (state?.waiting_node_ids.includes('SC_Escalate')) {
      await engine.complete(reqId, 'SC_Escalate', { decision: 'Có phương án' }, managerActor);
    }

    // Tiến tới SC_ReceiveResult
    state = await db.process_state.get(reqId);
    if (state?.waiting_node_ids.includes('SC_ReceiveResult')) {
      // Quá hạn 2 giờ (121 phút) -> SC_ResultTimer kích hoạt -> SC_Escalate
      clock.advance(121);
      const countResult = await timerManager.sweepTimers();
      expect(countResult).toBe(1);

      state = await db.process_state.get(reqId);
      expect(state?.waiting_node_ids).toEqual(['SC_Escalate']);
      const incident = await db.incidents.where('request_id').equals(reqId).first();
      expect(incident?.status).toBe('VUOT_SLA');
    }
  });
});
