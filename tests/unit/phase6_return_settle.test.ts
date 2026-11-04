// tests/unit/phase6_return_settle.test.ts
// Bộ kiểm thử tự động Giai đoạn 6: Trả xe, Bảng kê, Quyết toán, Đánh giá sau trả và Lưu hồ sơ

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { engine, getTrace } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import { eval_M_GBalance } from '@/engine/fn';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 6: Trả xe, Bảng kê thanh lý, Quyết toán và Lưu hồ sơ', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
  const staffActor: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };
  const managerActor: Actor = { id: SEED_USERS[0].id, role: 'quan_ly' };

  // Helper đưa nhanh một đơn thuê xe từ KH-01 đến trạng thái DANG_THUE (tại cổng M_EG)
  const setupRentedMotorbike = async (): Promise<string> => {
    const requestId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'tay_ga',
      start_at: '2026-11-20T08:00:00.000Z',
      end_at: '2026-11-22T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'data:img', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'data:img', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'data:img', is_valid: true },
      ],
    });

    const payment = await db.payments.where('request_id').equals(requestId).first();
    await engine.complete(requestId, 'M_WaitDeposit', { paid_amount: payment!.amount }, customerActor);
    await engine.complete(requestId, 'M_WaitSign', { signature_url: 'data:sig' }, customerActor);
    await engine.complete(
      requestId,
      'M_InspectPre',
      {
        result: 'DAT',
        attempt_no: 1,
        checklist: {
          phanh: 'Hoạt động tốt, ăn đều',
          den: 'Sáng rõ',
          lop: 'Gai lốp dày',
          guong_coi: 'Đầy đủ',
          than_vo: 'Không trầy xước',
          nhien_lieu: '100%',
          mu_bao_hiem: 'Đủ 2 mũ',
          giay_to_phu_tung: 'Đầy đủ',
        },
      },
      staffActor
    );
    await engine.complete(
      requestId,
      'M_Photo',
      { photo_urls: ['data:img1', 'data:img2', 'data:img3', 'data:img4', 'data:img5'] },
      staffActor
    );
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
  // KỊCH BẢN 1: TRẢ XE HOÀN HẢO KHÔNG SAI LỆCH -> HOÀN DƯ CỌC -> LƯU HỒ SƠ
  // ==============================================================
  it('Kịch bản 1: Luồng hoàn hảo trả xe không sai lệch -> Hoàn dư cọc -> Khách xác nhận -> Đánh giá xe Đạt -> Lưu hồ sơ M_Archive', async () => {
    const requestId = await setupRentedMotorbike();

    // 1. Khách trả xe tại cổng M_EG (KH-06)
    await engine.complete(requestId, 'M_EG', { event_type: 'RETURN' }, customerActor);

    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveReturn');

    // 2. Nhân viên tiếp nhận xe ở NV-06 (M_ReceiveReturn)
    await engine.complete(requestId, 'M_ReceiveReturn', {}, staffActor);

    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_CheckReturn');

    // 3. Nhân viên kiểm tra checklist trả xe: không có hư hỏng, diff_items rỗng
    await engine.complete(
      requestId,
      'M_CheckReturn',
      {
        vehicle_id: (await db.rental_requests.get(requestId))?.vehicle_id,
        checklist: {
          phanh: { status: 'BINH_THUONG' },
          den: { status: 'BINH_THUONG' },
          lop: { status: 'BINH_THUONG' },
          than_vo: { status: 'BINH_THUONG' },
        },
        diff_items: {},
        photo_urls: ['data:return_photo_1'],
      },
      staffActor
    );

    // Hệ thống tự động: M_DigitalCompare -> M_GDamage ('Không') -> M_CalcFees -> M_SendStatement -> Dừng ở M_ReceiveReview (KH-09)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveReview');

    const statement = await db.statements.where('request_id').equals(requestId).first();
    expect(statement?.total_fee).toBe(0); // Không phát sinh phí

    // 4. Khách chấp thuận bảng kê ở KH-09 (M_ReceiveReview: CHAP_THUAN)
    await engine.complete(requestId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // Hệ thống tự động: M_GDispute ('Có') -> M_NetDeposit (balance > 0) -> M_GBalance ('Hoàn dư') -> M_Refund -> Dừng ở M_ConfirmRefund (KH-10)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ConfirmRefund');

    const settlement = await db.settlements.where('request_id').equals(requestId).first();
    expect(settlement?.kind).toBe('HOAN_DU');
    expect(settlement?.balance).toBeGreaterThan(0);

    const refundPayment = await db.payments
      .where('request_id')
      .equals(requestId)
      .and((p) => p.kind === 'REFUND')
      .first();
    expect(refundPayment).toBeDefined();
    expect(refundPayment?.amount).toBe(settlement?.balance);

    // 5. Khách xác nhận đã nhận hoàn cọc ở KH-10 (M_ConfirmRefund)
    await engine.complete(requestId, 'M_ConfirmRefund', {}, customerActor);

    // Hệ thống: M_GJoinBalance -> M_Settle (settlements: HOAN_TAT, request: CHO_DANH_GIA_XE) -> Dừng ở M_CheckReady (NV-09)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_CheckReady');

    // 6. Nhân viên đánh giá xe ở NV-09: Đạt (DAT)
    await engine.complete(
      requestId,
      'M_CheckReady',
      { result: 'DAT', note: 'Xe nguyên vẹn, sẵn sàng cho thuê tiếp' },
      staffActor
    );

    // Hệ thống: M_GReady ('Đạt') -> M_MarkReady (xe SAN_SANG) -> M_GStatus -> M_Archive -> M_END
    const finalReq = await db.rental_requests.get(requestId);
    expect(finalReq?.status).toBe('HOAN_TAT');
    expect(finalReq?.archived_at).toBeDefined();
    expect(finalReq?.closed_at).toBeDefined();

    const vehicle = await db.vehicles.get(finalReq!.vehicle_id!);
    expect(vehicle?.status).toBe('SAN_SANG');

    // Kiểm tra trace có nút M_Archive và M_END
    const trace = await getTrace(requestId);
    const nodesInTrace = trace.map((t) => t.bpmn_node_id);
    expect(nodesInTrace).toContain('M_ReceiveReturn');
    expect(nodesInTrace).toContain('M_CheckReturn');
    expect(nodesInTrace).toContain('M_DigitalCompare');
    expect(nodesInTrace).toContain('M_NetDeposit');
    expect(nodesInTrace).toContain('M_Refund');
    expect(nodesInTrace).toContain('M_ConfirmRefund');
    expect(nodesInTrace).toContain('M_Settle');
    expect(nodesInTrace).toContain('M_CheckReady');
    expect(nodesInTrace).toContain('M_MarkReady');
    expect(nodesInTrace).toContain('M_Archive');
    expect(nodesInTrace).toContain('M_END');
  });

  // ==============================================================
  // KỊCH BẢN 2: TRẢ XE CÓ HƯ HỎNG -> NV-07 XÁC MINH -> THU THÊM -> BẢO TRÌ
  // ==============================================================
  it('Kịch bản 2: Trả xe có hư hỏng -> NV-07 xác minh chi phí -> Khách KH-09 chấp thuận -> Thu thêm KH-10 -> NV-09 Cần bảo trì -> M_Maintenance', async () => {
    const requestId = await setupRentedMotorbike();

    // 1. Trả xe và tiếp nhận xe ở NV-06
    await engine.complete(requestId, 'M_EG', { event_type: 'RETURN' }, customerActor);
    await engine.complete(requestId, 'M_ReceiveReturn', {}, staffActor);

    // 2. NV-06 kiểm tra xe: phát hiện vỡ gương và trầy xước cánh yếm
    const diffItems = {
      guong: { label: 'Gương chiếu hậu', issue: 'Gương bên phải bị vỡ mặt kính' },
      than_vo: { label: 'Thân vỏ', issue: 'Trầy xước sâu 15cm cánh yếm bên phải' },
    };
    await engine.complete(
      requestId,
      'M_CheckReturn',
      {
        vehicle_id: (await db.rental_requests.get(requestId))?.vehicle_id,
        checklist: {
          guong: { status: 'SAI_LECH', note: 'Vỡ gương' },
          than_vo: { status: 'SAI_LECH', note: 'Xước yếm' },
        },
        diff_items: diffItems,
        photo_urls: ['data:broken_mirror'],
      },
      staffActor
    );

    // Cổng M_GDamage ('Có') -> Dừng ở M_VerifyDamage (NV-07)
    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_VerifyDamage');

    // 3. Nhân viên xác minh hư hỏng ở NV-07: Tổng chi phí 1.000.000 VNĐ (lớn hơn tiền cọc ~100k-300k)
    await engine.complete(
      requestId,
      'M_VerifyDamage',
      {
        damages: [
          { description: 'Thay gương chiếu hậu phải', estimated_cost: 250000 },
          { description: 'Sơn lại cánh yếm xe', estimated_cost: 750000 },
        ],
      },
      staffActor
    );

    // Hệ thống: M_CalcFees -> M_SendStatement -> Dừng ở M_ReceiveReview (KH-09)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveReview');

    const statement = await db.statements.where('request_id').equals(requestId).first();
    expect(statement?.total_fee).toBe(1000000);

    // 4. Khách chấp thuận bảng kê ở KH-09
    await engine.complete(requestId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // M_NetDeposit: cọc (~72.000 - 150.000) - 1.000.000 = balance < 0 -> M_GBalance ('Thu thêm') -> M_PayExtra -> Dừng ở M_ReceiveExtra (KH-10)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveExtra');

    const settlement = await db.settlements.where('request_id').equals(requestId).first();
    expect(settlement?.kind).toBe('THU_THEM');
    expect(settlement?.balance).toBeLessThan(0);

    const extraPayment = await db.payments
      .where('request_id')
      .equals(requestId)
      .and((p) => p.kind === 'EXTRA')
      .first();
    expect(extraPayment).toBeDefined();
    expect(extraPayment?.amount).toBe(Math.abs(settlement!.balance));

    // 5. Khách chuyển khoản bổ sung ĐỦ tiền tại KH-10
    await engine.complete(
      requestId,
      'M_ReceiveExtra',
      { paid_amount: extraPayment!.amount, provider_txn_id: 'TXN_EXTRA_FULL' },
      customerActor
    );

    // M_VerifyExtra đối soát ĐỦ -> M_GExtra ('Đúng') -> M_GJoinBalance -> M_Settle -> Dừng ở M_CheckReady (NV-09)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_CheckReady');

    // 6. NV-09 đánh giá: Cần bảo trì (CAN_BAO_TRI) do xe vỡ gương và xước yếm
    await engine.complete(
      requestId,
      'M_CheckReady',
      { result: 'CAN_BAO_TRI', note: 'Chuyển xưởng thay gương và sơn lại cánh yếm' },
      staffActor
    );

    // Hệ thống: M_GReady ('Cần bảo trì') -> M_Maintenance -> M_GStatus -> M_Archive -> M_END
    const req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('HOAN_TAT');

    const vehicle = await db.vehicles.get(req!.vehicle_id!);
    expect(vehicle?.status).toBe('BAO_TRI');

    const maintenanceOrder = await db.maintenance_orders.where('request_id').equals(requestId).first();
    expect(maintenanceOrder).toBeDefined();
    expect(maintenanceOrder?.status).toBe('MO');

    const schedule = await db.vehicle_schedule
      .where('request_id')
      .equals(requestId)
      .and((s) => s.kind === 'MAINTENANCE')
      .first();
    expect(schedule).toBeDefined();
  });

  // ==============================================================
  // KỊCH BẢN 3: KHÁCH KHIẾU NẠI BẢNG KÊ -> QUẢN LÝ ĐIỀU CHỈNH -> GỬI LẠI
  // ==============================================================
  it('Kịch bản 3: Khách khiếu nại ở KH-09 -> QL-01 điều chỉnh giảm phí -> Bảng kê v2 -> Khách chấp thuận v2', async () => {
    const requestId = await setupRentedMotorbike();
    await engine.complete(requestId, 'M_EG', { event_type: 'RETURN' }, customerActor);
    await engine.complete(requestId, 'M_ReceiveReturn', {}, staffActor);

    await engine.complete(
      requestId,
      'M_CheckReturn',
      {
        diff_items: { xước: { label: 'Vết xước', issue: 'Xước nhẹ' } },
      },
      staffActor
    );
    await engine.complete(
      requestId,
      'M_VerifyDamage',
      { damages: [{ description: 'Đánh bóng vết xước', estimated_cost: 200000 }] },
      staffActor
    );

    // Khách ở KH-09: Khiếu nại (KHIEU_NAI) vì vết xước có từ trước
    await engine.complete(
      requestId,
      'M_ReceiveReview',
      {
        customer_answer: 'KHIEU_NAI',
        dispute_reason: 'Vết xước này đã có trong ảnh bàn giao ban đầu, đề nghị miễn trừ',
      },
      customerActor
    );

    // Cổng M_GDispute ('Không') -> Chuyển sang M_Resolve (QL-01)
    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_Resolve');

    // Quản lý QL-01 xem xét khiếu nại: đồng ý miễn trừ 100% phí đánh bóng vết xước
    await engine.complete(
      requestId,
      'M_Resolve',
      {
        resolution_note: 'Đã đối chiếu ảnh ban đầu, xác nhận vết xước cũ. Đồng ý miễn phí 200.000 VNĐ.',
        items: [{ name: 'Miễn trừ phí trầy xước', amount: 0 }],
        total_fee: 0,
      },
      managerActor
    );

    // Hệ thống: M_ApproveAdjustment (tăng version lên 2, tăng dispute_count) -> M_SendStatement -> Về lại M_ReceiveReview (KH-09)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveReview');
    expect(pState?.loop_counters.dispute_count).toBe(1);

    const statementV2 = await db.statements.where('request_id').equals(requestId).first();
    expect(statementV2?.version).toBe(2);
    expect(statementV2?.total_fee).toBe(0);

    // Khách chấp thuận phiên bản v2 ở KH-09
    await engine.complete(requestId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // Hoàn cọc trọn vẹn và dừng ở M_ConfirmRefund
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ConfirmRefund');
  });

  // ==============================================================
  // KỊCH BẢN 4: THU THÊM QUÁ HẠN 30 PHÚT -> NV-08 TIẾP TỤC THANH TOÁN
  // ==============================================================
  it('Kịch bản 4: Thu thêm quá hạn 30 phút -> Kích hoạt M_BoundExtra -> NV-08 chọn Tiếp tục thanh toán -> Tạo QR mới', async () => {
    const requestId = await setupRentedMotorbike();
    await engine.complete(requestId, 'M_EG', { event_type: 'RETURN' }, customerActor);
    await engine.complete(requestId, 'M_ReceiveReturn', {}, staffActor);

    await engine.complete(requestId, 'M_CheckReturn', { diff_items: { hỏng: { issue: 'Hỏng' } } }, staffActor);
    await engine.complete(requestId, 'M_VerifyDamage', { damages: [{ estimated_cost: 500000 }] }, staffActor);
    await engine.complete(requestId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // Đang ở wait point M_ReceiveExtra (KH-10)
    let pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveExtra');

    const oldExtra = await db.payments
      .where('request_id')
      .equals(requestId)
      .and((p) => p.kind === 'EXTRA')
      .first();
    expect(oldExtra?.status).toBe('PENDING');

    // Kích hoạt boundary timer M_BoundExtra (quá hạn 30 phút)
    await engine.triggerTimer(requestId, 'M_BoundExtra');

    // Chuyển sang điểm chờ M_ManualExtra (NV-08)
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ManualExtra');

    const expiredExtra = await db.payments.get(oldExtra!.id);
    expect(expiredExtra?.status).toBe('EXPIRED');

    // Nhân viên NV-08 liên hệ khách và chọn 'Tiếp tục thanh toán'
    await engine.complete(
      requestId,
      'M_ManualExtra',
      {
        decision: 'Tiếp tục thanh toán',
        note: 'Khách hẹn chuyển khoản lại qua mã QR mới',
      },
      staffActor
    );

    // Cổng M_GExtraDecision ('Tiếp tục thanh toán') -> Tạo bản ghi EXTRA mới PENDING -> Quay lại M_ReceiveExtra
    pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toContain('M_ReceiveExtra');

    const newExtra = await db.payments
      .where('request_id')
      .equals(requestId)
      .and((p) => p.kind === 'EXTRA' && p.status === 'PENDING')
      .first();
    expect(newExtra).toBeDefined();
    expect(newExtra?.id).not.toBe(oldExtra?.id);
  });

  // ==============================================================
  // KỊCH BẢN 5: NHÁNH CÔNG NỢ -> M_RecordDebt -> M_END_DEBT
  // ==============================================================
  it('Kịch bản 5: Thu thêm không thành công -> NV-08 chọn Không / chưa thanh toán -> M_RecordDebt -> Dừng tại M_END_DEBT', async () => {
    const requestId = await setupRentedMotorbike();
    await engine.complete(requestId, 'M_EG', { event_type: 'RETURN' }, customerActor);
    await engine.complete(requestId, 'M_ReceiveReturn', {}, staffActor);

    await engine.complete(requestId, 'M_CheckReturn', { diff_items: { hỏng: { issue: 'Hỏng' } } }, staffActor);
    await engine.complete(requestId, 'M_VerifyDamage', { damages: [{ estimated_cost: 600000 }] }, staffActor);
    await engine.complete(requestId, 'M_ReceiveReview', { customer_answer: 'CHAP_THUAN' }, customerActor);

    // Kích hoạt quá hạn sang NV-08
    await engine.triggerTimer(requestId, 'M_BoundExtra');

    // Nhân viên NV-08 liên hệ thất bại: Khách từ chối nộp phí -> Chọn 'Không / chưa thanh toán'
    await engine.complete(
      requestId,
      'M_ManualExtra',
      {
        decision: 'Không / chưa thanh toán',
        note: 'Khách từ chối bồi thường và tắt máy, ghi nhận hồ sơ công nợ.',
      },
      staffActor
    );

    // Hệ thống: M_GExtraDecision ('Không / chưa thanh toán') -> M_RecordDebt -> Dừng ở M_END_DEBT
    const req = await db.rental_requests.get(requestId);
    expect(req?.status).toBe('CONG_NO');

    const settlement = await db.settlements.where('request_id').equals(requestId).first();
    expect(settlement?.status).toBe('CONG_NO');

    const pState = await db.process_state.get(requestId);
    expect(pState?.waiting_node_ids).toHaveLength(0);

    const trace = await getTrace(requestId);
    const nodes = trace.map((t) => t.bpmn_node_id);
    expect(nodes).toContain('M_RecordDebt');
    expect(nodes).toContain('M_END_DEBT');
  });

  // ==============================================================
  // KỊCH BẢN 6: KIỂM TRA ĐỦ 3 NHÁNH CỦA CỔNG M_GBalance
  // ==============================================================
  it('Kịch bản 6: Kiểm tra cổng M_GBalance đủ 3 nhánh: Hoàn dư (>0), Cân bằng (=0), Thu thêm (<0)', () => {
    // 1. Hoàn dư khi balance > 0
    expect(eval_M_GBalance(150000)).toBe('Hoàn dư');
    expect(eval_M_GBalance(1)).toBe('Hoàn dư');

    // 2. Cân bằng khi balance == 0
    expect(eval_M_GBalance(0)).toBe('Cân bằng');

    // 3. Thu thêm khi balance < 0
    expect(eval_M_GBalance(-50000)).toBe('Thu thêm');
    expect(eval_M_GBalance(-1000000)).toBe('Thu thêm');
  });
});
