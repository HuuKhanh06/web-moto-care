// tests/unit/phase5_rental_events.test.ts
// Bộ kiểm thử tự động Giai đoạn 5: Đang thuê (Gia hạn hợp đồng SP1 và Báo sự cố/Cứu hộ SP2)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { engine, getTrace } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 5: Các sự kiện trong thời gian thuê (SP1 Gia hạn & SP2 Sự cố)', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
  const staffActor: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };
  const managerActor: Actor = { id: SEED_USERS[0].id, role: 'quan_ly' };

  // Helper đưa nhanh một đơn thuê xe đến trạng thái DANG_THUE (tại cổng M_EG)
  const setupRentedMotorbike = async (): Promise<string> => {
    const requestId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'tay_ga',
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-17T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'data:img', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'data:img', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'data:img', is_valid: true },
      ],
    });

    const payment = await db.payments.where('request_id').equals(requestId).first();
    await engine.complete(requestId, 'M_WaitDeposit', { paid_amount: payment!.amount }, customerActor);
    await engine.complete(requestId, 'M_WaitSign', { signature_url: 'data:sig' }, customerActor);
    await engine.complete(requestId, 'M_InspectPre', { result: 'DAT', attempt_no: 1 }, staffActor);
    await engine.complete(requestId, 'M_Photo', { photo_urls: ['data:img1', 'data:img2', 'data:img3', 'data:img4', 'data:img5'] }, staffActor);
    await engine.complete(requestId, 'Activity_0d0qzp6', { customer_accepted: true, attempt_no: 1 }, customerActor);
    await engine.complete(requestId, 'M_Handover', { accessories: { helmets: 2, raincoats: 2 } }, staffActor);

    return requestId;
  };

  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    timerManager.stop();
    await seedDatabase();
  });

  // ==============================================================
  // KỊCH BẢN 1: GIA HẠN THÀNH CÔNG CÓ THU PHÍ (SP1 HAPPY PATH)
  // ==============================================================
  it('Kịch bản 1: SP1 Gia hạn thành công có thu phí bổ sung -> Hợp đồng cập nhật ngày trả và về lại DANG_THUE', async () => {
    const requestId = await setupRentedMotorbike();
    let req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_THUE');

    // 1. Khách gửi yêu cầu gia hạn thêm 2 ngày tại cổng M_EG (KH-06 -> KH-07)
    const newEndAt = '2026-11-19T08:00:00.000Z';
    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: newEndAt,
      },
      customerActor
    );

    // Hồ sơ chuyển sang DANG_GIA_HAN và dừng ở điểm chờ GH_WaitAccept
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_GIA_HAN');

    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('GH_WaitAccept');

    // Kiểm tra đề xuất gia hạn đã được tạo
    const ext = await db.extension_requests.where('request_id').equals(requestId).reverse().first();
    expect(ext).toBeDefined();
    expect(ext?.status).toBe('DA_DE_XUAT');
    expect(ext?.extra_fee).toBeGreaterThan(0);

    // 2. Khách đồng ý đề xuất gia hạn (GH_WaitAccept)
    await engine.complete(
      requestId,
      'GH_WaitAccept',
      { answer: 'DONG_Y' },
      customerActor
    );

    // Do có phụ phí (GH_NeedPayment = Có) -> tạo mã QR và dừng ở điểm chờ GH_VerifyQR
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('GH_VerifyQR');

    const extPayment = await db.payments
      .where('request_id')
      .equals(requestId)
      .and((p) => p.kind === 'EXTENSION')
      .first();
    expect(extPayment).toBeDefined();

    // 3. Khách thanh toán phụ phí gia hạn VietQR (GH_VerifyQR)
    await engine.complete(
      requestId,
      'GH_VerifyQR',
      {
        paid_amount: extPayment!.amount,
        provider_txn_id: 'EXT_TEST_TXN_888',
      },
      customerActor
    );

    // 4. Kiểm tra kết quả sau gia hạn:
    // - Hợp đồng cập nhật ngày trả mới
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_THUE');
    expect(req?.end_at).toBe(newEndAt);

    // - Lịch xe cập nhật ngày mới
    const sched = await db.vehicle_schedule.where('request_id').equals(requestId).first();
    expect(sched?.end_at).toBe(newEndAt);

    // - Tiến trình quay về cổng sự kiện M_EG
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_EG');

    // - Nhật ký BPMN ghi nhận đầy đủ các phần tử SP1
    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('M_CatchExtend');
    expect(traceNodes).toContain('SP1');
    expect(traceNodes).toContain('GH_GetRequest');
    expect(traceNodes).toContain('GH_Check');
    expect(traceNodes).toContain('GH_Offer');
    expect(traceNodes).toContain('GH_WaitAccept');
    expect(traceNodes).toContain('GH_CreateQR');
    expect(traceNodes).toContain('GH_VerifyQR');
    expect(traceNodes).toContain('GH_Update');
    expect(traceNodes).toContain('GH_NotifyOK');
    expect(traceNodes).toContain('GH_END');
  });

  // ==============================================================
  // KỊCH BẢN 2: GIA HẠN BỊ TỪ CHỐI DO TRÙNG LỊCH XE KẾ TIẾP
  // ==============================================================
  it('Kịch bản 2: SP1 Gia hạn bị từ chối do trùng lịch xe -> GH_NotifyOld -> Giữ nguyên hạn cũ & về DANG_THUE', async () => {
    const requestId = await setupRentedMotorbike();
    const reqBefore = await db.rental_requests.get(requestId);
    const oldEndAt = reqBefore!.end_at;

    // Giả lập xe bị người khác đặt trước từ 2026-11-17T10:00:00.000Z
    await db.vehicle_schedule.add({
      id: crypto.randomUUID(),
      vehicle_id: reqBefore!.vehicle_id!,
      request_id: 'another-user-req-id',
      kind: 'RENTAL',
      start_at: '2026-11-17T10:00:00.000Z',
      end_at: '2026-11-20T10:00:00.000Z',
    });

    // Khách yêu cầu gia hạn tới 2026-11-19 (bị trùng lịch)
    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-19T08:00:00.000Z',
      },
      customerActor
    );

    // GH_Check phát hiện trùng lịch -> GH_GEligible (Không) -> GH_NotifyOld -> GH_END
    const reqAfter = await db.rental_requests.get(requestId);
    expect(reqAfter?.status).toBe('DANG_THUE');
    expect(reqAfter?.end_at).toBe(oldEndAt); // Ngày trả cũ không đổi

    const ext = await db.extension_requests.where('request_id').equals(requestId).reverse().first();
    expect(ext?.eligible).toBe(false);
    expect(ext?.status).toBe('TU_CHOI');

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('GH_NotifyOld');
    expect(traceNodes).toContain('GH_END');
  });

  // ==============================================================
  // KỊCH BẢN 3: GIA HẠN QUÁ HẠN PHẢN HỒI 2 GIỜ (GH_Timer)
  // ==============================================================
  it('Kịch bản 3: Đề xuất gia hạn sau 2 giờ không trả lời -> GH_Timer kích hoạt -> Hết hạn và quay về DANG_THUE', async () => {
    const requestId = await setupRentedMotorbike();

    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'EXTEND',
        new_end_at: '2026-11-19T08:00:00.000Z',
      },
      customerActor
    );

    // Kiểm tra timer 2 giờ GH_Timer đang PENDING
    const timer = await db.timers
      .where('request_id')
      .equals(requestId)
      .and((tm) => tm.bpmn_node_id === 'GH_Timer' && tm.status === 'PENDING')
      .first();
    expect(timer).toBeDefined();

    // Tua đồng hồ thêm 125 phút (> 2 giờ)
    clock.advance(125);
    await timerManager.sweepTimers();

    // Yêu cầu chuyển về DANG_THUE, đề xuất hết hạn
    const req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_THUE');

    const ext = await db.extension_requests.where('request_id').equals(requestId).reverse().first();
    expect(ext?.status).toBe('HET_HAN');

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('GH_Timer');
    expect(traceNodes).toContain('GH_NotifyOld');
  });

  // ==============================================================
  // KỊCH BẢN 4: BÁO SỰ CỐ VÀ CỨU HỘ THÀNH CÔNG (SP2 HAPPY PATH)
  // ==============================================================
  it('Kịch bản 4: SP2 Báo sự cố -> Đối tác tiếp nhận -> Hỗ trợ xong -> NV-10 chốt phí và tiếp tục thuê -> SC_SendContinue -> DANG_THUE', async () => {
    const requestId = await setupRentedMotorbike();

    // 1. Khách báo sự cố tại M_EG (KH-06 -> KH-08)
    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Xe bị cán đinh thủng lốp sau',
        lat: 10.76,
        lng: 106.68,
      },
      customerActor
    );

    // Hồ sơ chuyển sang DANG_XU_LY_SU_CO
    let req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_XU_LY_SU_CO');

    // Tiến trình tự động chọn đối tác (SC_Select) và gửi điều phối (SC_Dispatch) -> dừng ở SC_ReceiveAck
    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('SC_ReceiveAck');

    // 2. Đối tác xác nhận tiếp nhận cứu hộ tại DT-01 (SC_ReceiveAck) - Quản lý thao tác thay
    await engine.complete(
      requestId,
      'SC_ReceiveAck',
      { status: 'ACCEPTED' },
      managerActor
    );

    // Tiến trình kích hoạt SC_Track (DANG_HO_TRO) và chuyển sang chờ kết quả SC_ReceiveResult
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('SC_ReceiveResult');

    const incident = await db.incidents.where('request_id').equals(requestId).reverse().first();
    expect(incident?.status).toBe('DANG_HO_TRO');

    // 3. Đối tác báo cáo kết quả cứu hộ hoàn tất tại DT-01 (SC_ReceiveResult) - Quản lý thao tác thay
    await engine.complete(
      requestId,
      'SC_ReceiveResult',
      { result_note: 'Đã vá lốp và bơm đủ áp suất 2.2kg' },
      managerActor
    );

    // Chuyển sang điểm chờ nhân viên nghiệm thu chi phí (NV-10: SC_Log)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('SC_Log');

    // 4. Nhân viên xác nhận chi phí 120.000đ và quyết định TIẾP TỤC CHO THUÊ (SC_Log & SC_SettleDecision)
    await engine.complete(
      requestId,
      'SC_Log',
      {
        actual_cost: 120000,
        continue_rental: true,
      },
      staffActor
    );

    // 5. Kết quả: xe và hợp đồng trở về DANG_THUE, dừng tại M_EG
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_THUE');

    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_EG');

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('M_CatchIncident');
    expect(traceNodes).toContain('SP2');
    expect(traceNodes).toContain('SC_Create');
    expect(traceNodes).toContain('SC_Select');
    expect(traceNodes).toContain('SC_Dispatch');
    expect(traceNodes).toContain('SC_ReceiveAck');
    expect(traceNodes).toContain('SC_Track');
    expect(traceNodes).toContain('SC_ReceiveResult');
    expect(traceNodes).toContain('SC_Log');
    expect(traceNodes).toContain('SC_SendContinue');
    expect(traceNodes).toContain('SC_END_OK');
  });

  // ==============================================================
  // KỊCH BẢN 5: SỰ CỐ VƯỢT SLA 2 GIỜ -> QUẢN LÝ QL-02 XỬ LÝ
  // ==============================================================
  it('Kịch bản 5: Sự cố xử lý quá 2 giờ -> SC_ResultTimer kích hoạt -> Leo thang lên Quản lý (QL-02) giải quyết', async () => {
    const requestId = await setupRentedMotorbike();

    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Hỏng bugi xe không đề nổ được',
      },
      customerActor
    );

    await engine.complete(requestId, 'SC_ReceiveAck', { status: 'ACCEPTED' }, managerActor);

    // Kiểm tra timer SLA 2 giờ đang chạy
    const timer = await db.timers
      .where('request_id')
      .equals(requestId)
      .and((tm) => tm.bpmn_node_id === 'SC_ResultTimer' && tm.status === 'PENDING')
      .first();
    expect(timer).toBeDefined();

    // Tua đồng hồ vượt 2 giờ (+130 phút)
    clock.advance(130);
    await timerManager.sweepTimers();

    // Tiến trình leo thang tới SC_Escalate (QL-02)
    const pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('SC_Escalate');

    const incident = await db.incidents.where('request_id').equals(requestId).reverse().first();
    expect(incident?.status).toBe('VUOT_SLA');

    // Quản lý vào QL-02 duyệt phương án xử lý
    await engine.complete(
      requestId,
      'SC_Escalate',
      {
        decision: 'Có phương án',
        escalation_note: 'Bố trí thợ cơ động của chi nhánh mang bugi mới tới thay',
      },
      managerActor
    );

    // Chuyển sang SC_Log (NV-10) để nhân viên chốt chi phí
    const pStateAfter = await db.process_state.get(requestId);
    expect(pStateAfter?.waiting_node_ids).toContain('SC_Log');
  });

  // ==============================================================
  // KỊCH BẢN 6: TRẢ XE SỚM DO SỰ CỐ NẶNG (M_EarlyBoundary)
  // ==============================================================
  it('Kịch bản 6: Sự cố hỏng nặng -> Quyết định trả xe sớm -> SC_END_EARLY kích hoạt M_EarlyBoundary -> Chuyển sang CHO_NHAN_XE_TRA', async () => {
    const requestId = await setupRentedMotorbike();

    await engine.complete(
      requestId,
      'M_EG',
      {
        event_type: 'INCIDENT',
        description: 'Xe bị va chạm vỡ lốc máy không thể tiếp tục di chuyển',
      },
      customerActor
    );

    await engine.complete(requestId, 'SC_ReceiveAck', { status: 'ACCEPTED' }, managerActor);
    await engine.complete(requestId, 'SC_ReceiveResult', { result_note: 'Lốc máy vỡ hoàn toàn, cần xe cẩu kéo về' }, managerActor);

    // Tại NV-10, nhân viên chốt chi phí và chọn KHÔNG TIẾP TỤC THUÊ (continue_rental = false)
    await engine.complete(
      requestId,
      'SC_Log',
      {
        actual_cost: 500000,
        continue_rental: false,
      },
      staffActor
    );

    // Kích hoạt SC_NotifyEarly -> SC_END_EARLY -> Error boundary M_EarlyBoundary
    const req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CHO_NHAN_XE_TRA');

    const pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveReturn');

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('SC_NotifyEarly');
    expect(traceNodes).toContain('SC_END_EARLY');
    expect(traceNodes).toContain('M_EarlyBoundary');
    expect(traceNodes).toContain('M_ReturnMerge');
  });
});
