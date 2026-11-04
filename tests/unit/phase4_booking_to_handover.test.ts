// tests/unit/phase4_booking_to_handover.test.ts
// Bộ kiểm thử tự động Giai đoạn 4: Đặt thuê đến bàn giao xe (M_START -> M_SetRented -> DANG_THUE)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { engine, getTrace } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 4: Đặt thuê đến bàn giao xe (M_START -> M_SetRented)', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
  const staffActor: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };

  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    timerManager.stop();
    await seedDatabase();
  });

  // ==============================================================
  // KỊCH BẢN 1: HAPPY PATH TRỌN VẸN TỪ KH-01 ĐẾN NV-05
  // ==============================================================
  it('Kịch bản 1 (Happy Path trọn vẹn): KH-01 -> KH-02 -> KH-03 (cọc DU) -> KH-04 (ký) -> NV-03 (đạt) -> NV-04 (ảnh) -> KH-05 (đồng ý) -> NV-05 (giao xe) -> DANG_THUE', async () => {
    // 1. KH-01: Gửi yêu cầu thuê xe
    const requestId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'tay_ga',
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-17T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'data:image/png;base64,mock_cccd_front', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'data:image/png;base64,mock_cccd_back', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'data:image/png;base64,mock_gplx_front', is_valid: true },
      ],
    });

    let req = await db.rental_requests.get(requestId);
    expect(req).toBeDefined();
    expect(req?.status).toBe('CHO_COC');

    // 2. KH-03: Giả lập thanh toán cọc khớp 100% (match_result = 'DU')
    const payment = await db.payments.where('request_id').equals(requestId).first();
    expect(payment).toBeDefined();

    await engine.complete(
      requestId,
      'M_WaitDeposit',
      {
        paid_amount: payment!.amount,
        provider_txn_id: 'VNPAY_TEST_TXN_001',
      },
      customerActor
    );

    // Hồ sơ chuyển sang chờ ký hợp đồng
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CHO_KY');

    // 3. KH-04: Khách hàng ký hợp đồng điện tử
    const contract = await db.contracts.where('request_id').equals(requestId).first();
    expect(contract).toBeDefined();

    await engine.complete(
      requestId,
      'M_WaitSign',
      {
        signature_url: 'data:image/svg+xml;utf8,<svg>Signature</svg>',
      },
      customerActor
    );

    // Hồ sơ chuyển sang chờ bàn giao xe (NV-03)
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CHO_BAN_GIAO');

    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_InspectPre');

    // 4. NV-03: Nhân viên kiểm tra kỹ thuật đạt chuẩn (result = 'DAT')
    await engine.complete(
      requestId,
      'M_InspectPre',
      {
        result: 'DAT',
        checklist: {
          brakes: true,
          lights: true,
          tires: true,
          mirrors: true,
          horn: true,
          fuel_level: '100%',
        },
        attempt_no: 1,
        vehicle_id: req!.vehicle_id,
      },
      staffActor
    );

    // M_G04 đánh giá ĐẠT -> chuyển sang M_Photo (NV-04)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_Photo');

    // 5. NV-04: Nhân viên chụp đủ 5 ảnh xe và gửi khách xác nhận
    await engine.complete(
      requestId,
      'M_Photo',
      {
        photo_urls: [
          'data:image/svg;utf8,front',
          'data:image/svg;utf8,rear',
          'data:image/svg;utf8,left',
          'data:image/svg;utf8,right',
          'data:image/svg;utf8,odo',
        ],
        checklist: {
          odometer: '15200',
          fuel_level: '100%',
        },
      },
      staffActor
    );

    // Engine tự động chạy Activity_0w8x12e (thông báo khách) và dừng ở Activity_0d0qzp6 (KH-05)
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CHO_KHACH_NHAN');

    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('Activity_0d0qzp6');

    // 6. KH-05: Khách hàng duyệt nhận xe (customer_accepted = true)
    await engine.complete(
      requestId,
      'Activity_0d0qzp6',
      {
        customer_accepted: true,
        customer_note: 'Xe mới và sạch sẽ, tôi đồng ý nhận.',
        attempt_no: 1,
      },
      customerActor
    );

    // Gateway_0ixde68 đánh giá CÓ -> chuyển sang M_Handover (NV-05)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_Handover');

    // 7. NV-05: Nhân viên bàn giao chìa khóa & phụ kiện
    await engine.complete(
      requestId,
      'M_Handover',
      {
        accessories: {
          helmets: 2,
          raincoats: 2,
          registration_paper: true,
          insurance_paper: true,
          smart_key: true,
        },
      },
      staffActor
    );

    // 8. KIỂM TRA KẾT QUẢ CUỐI CÙNG
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('DANG_THUE');

    const vehicle = await db.vehicles.get(req!.vehicle_id!);
    expect(vehicle?.status).toBe('DANG_THUE');

    // Kiểm tra đã vào cổng sự kiện M_EG
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_EG');

    // Kiểm tra chuỗi vết sự kiện (Process Trace)
    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);

    expect(traceNodes).toContain('M_START');
    expect(traceNodes).toContain('M_CheckFleet');
    expect(traceNodes).toContain('M_SendTerms');
    expect(traceNodes).toContain('M_CreateDeposit');
    expect(traceNodes).toContain('M_WaitDeposit');
    expect(traceNodes).toContain('M_CheckDeposit');
    expect(traceNodes).toContain('M_Contract');
    expect(traceNodes).toContain('M_WaitSign');
    expect(traceNodes).toContain('M_SaveBooking');
    expect(traceNodes).toContain('M_InspectPre');
    expect(traceNodes).toContain('M_Photo');
    expect(traceNodes).toContain('Activity_0w8x12e');
    expect(traceNodes).toContain('Activity_0d0qzp6');
    expect(traceNodes).toContain('M_Handover');
    expect(traceNodes).toContain('M_SetRented');
    expect(traceNodes).toContain('M_EG');
  });

  // ==============================================================
  // KỊCH BẢN 2: NGOẠI LỆ ĐẶT CỌC QUÁ HẠN 30 PHÚT
  // ==============================================================
  it('Kịch bản 2 (Ngoại lệ cọc): KH-03 hết hạn 30 phút -> M_BoundDeposit kích hoạt -> Từ chối yêu cầu (QUA_HAN_COC)', async () => {
    // Khách đặt xe
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

    let req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CHO_COC');

    // Kiểm tra timer M_BoundDeposit đang pending
    const timer = await db.timers
      .where('request_id')
      .equals(requestId)
      .and((tm) => tm.bpmn_node_id === 'M_BoundDeposit' && tm.status === 'PENDING')
      .first();
    expect(timer).toBeDefined();

    // Tua đồng hồ giả lập tới 35 phút sau
    clock.advance(35);

    // Kích hoạt quét timers
    await timerManager.sweepTimers();

    // Hồ sơ bị từ chối do quá hạn cọc
    req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('TU_CHOI');
    expect(req?.closed_reason).toBe('QUA_HAN_COC');

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('M_BoundDeposit');
  });

  // ==============================================================
  // KỊCH BẢN 3: BỔ SUNG HỒ SƠ QUÁ 3 LẦN THÌ HỦY TỰ ĐỘNG
  // ==============================================================
  it('Kịch bản 3 (Quá hạn bổ sung giấy tờ): Yêu cầu bổ sung 4 lần -> Gateway_0x0p273 kích hoạt -> M_EndCancel', async () => {
    // Khách đặt xe nhưng không đính kèm giấy tờ hợp lệ
    const requestId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-20T08:00:00.000Z',
      end_at: '2026-11-22T08:00:00.000Z',
      documents: [], // Giấy tờ rỗng
    });

    const req = await db.rental_requests.get(requestId);
    // Tự động lặp qua M_AskDocs -> Gateway_0x0p273 cho đến khi > 3 lần -> M_EndCancel
    expect(req?.status).toBe('DA_HUY');
    expect(req?.closed_reason).toBe('HO_SO_KHONG_DAT');
    expect(req?.doc_request_count).toBeGreaterThan(3);

    const trace = await getTrace(requestId);
    const traceNodes = trace.map((t) => t.bpmn_node_id);
    expect(traceNodes).toContain('M_CheckDocs');
    expect(traceNodes).toContain('M_AskDocs');
    expect(traceNodes).toContain('M_EndCancel');
  });

  // ==============================================================
  // KỊCH BẢN 4: NV-03 KIỂM TRA CHƯA ĐẠT -> KHẮC PHỤC M_Rework -> KIỂM TRA LẠI ĐẠT
  // ==============================================================
  it('Kịch bản 4: NV-03 kiểm tra chưa đạt -> chuyển M_Rework khắc phục -> kiểm tra lại Đạt', async () => {
    // Đi nhanh tới điểm M_InspectPre
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

    // Lần 1: Kiểm tra CHƯA ĐẠT (result = 'CHUA_DAT')
    await engine.complete(
      requestId,
      'M_InspectPre',
      {
        result: 'CHUA_DAT',
        checklist: { brakes: false, lights: true },
        attempt_no: 1,
      },
      staffActor
    );

    // M_G04 đánh giá CHƯA ĐẠT -> vào M_Rework
    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_Rework');

    // Nhân viên thực hiện khắc phục ở M_Rework
    await engine.complete(
      requestId,
      'M_Rework',
      {
        rework_note: 'Đã bảo dưỡng và siết lại ốc phanh trước.',
      },
      staffActor
    );

    // Quay lại điểm M_InspectPre để kiểm tra lại
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_InspectPre');

    // Lần 2: Kiểm tra ĐẠT (result = 'DAT')
    await engine.complete(
      requestId,
      'M_InspectPre',
      {
        result: 'DAT',
        checklist: { brakes: true, lights: true, tires: true },
        attempt_no: 2,
      },
      staffActor
    );

    // Tiến tới M_Photo
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_Photo');
  });

  // ==============================================================
  // KỊCH BẢN 5: KH-05 KHÁCH TỪ CHỐI NHẬN XE -> QUAY LẠI M_InspectPre
  // ==============================================================
  it('Kịch bản 5: KH-05 khách từ chối nhận xe (customer_accepted = false) -> Gateway_0ixde68 lặp lại M_InspectPre', async () => {
    // Thiết lập đơn thuê đến bước KH-05
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
    await engine.complete(requestId, 'M_Photo', { photo_urls: ['data:img1', 'data:img2'] }, staffActor);

    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('Activity_0d0qzp6');

    // Khách từ chối nhận xe vì gương bị lệch
    await engine.complete(
      requestId,
      'Activity_0d0qzp6',
      {
        customer_accepted: false,
        customer_note: 'Gương bên phải bị lỏng, nhờ kỹ thuật siết lại.',
        attempt_no: 1,
      },
      customerActor
    );

    // Gateway_0ixde68 chuyển nhánh "Không" -> quay lại M_InspectPre!
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_InspectPre');
  });
});
