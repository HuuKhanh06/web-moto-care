// tests/unit/engine.test.ts
// Bộ kiểm thử toàn diện cho Process Engine (Giai đoạn 2A: Quy trình chính BPMN To-Be)

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { bpmnGraph } from '@/engine/graph';
import { engine, getTrace } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 2A: Bộ Máy Quy Trình Lõi & Quy Trình Chính (Process Engine)', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
  const staffActor: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };
  const managerActor: Actor = { id: SEED_USERS[0].id, role: 'quan_ly' };

  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    timerManager.stop();
  });

  // 1. Kiểm tra assertEdge trong graph.ts
  it('graph.ts: assertEdge ném lỗi nếu code đi cạnh không tồn tại trong BPMN', () => {
    // Cạnh hợp lệ: M_START -> M_CheckFleet
    expect(() => bpmnGraph.assertEdge('M_START', 'M_CheckFleet')).not.toThrow();

    // Cạnh bất hợp lệ: M_START -> M_END
    expect(() => bpmnGraph.assertEdge('M_START', 'M_END')).toThrow(/Vi phạm cấu trúc BPMN/);
  });

  // 2. Kiểm tra Cổng M_G01 (Có xe / Hết xe)
  it('Cổng M_G01: Nhánh "Không" (hết xe) chuyển sang M_RejectNoVehicle -> M_END_REJECT', async () => {
    // Không nạp dữ liệu xe nào vào db
    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_dien_khong_ton_tai',
      start_at: '2026-11-10T08:00:00.000Z',
      end_at: '2026-11-12T08:00:00.000Z',
    });

    const req = await db.rental_requests.get(reqId);
    expect(req?.status).toBe('TU_CHOI');
    expect(req?.closed_reason).toBe('HET_XE');

    const trace = await getTrace(reqId);
    const traceNodeIds = trace.map((t) => t.bpmn_node_id);
    expect(traceNodeIds).toContain('M_START');
    expect(traceNodeIds).toContain('M_CheckFleet');
    expect(traceNodeIds).toContain('M_RejectNoVehicle');
    expect(traceNodeIds).toContain('M_END_REJECT');
  });

  // 3. Kiểm tra Cổng M_G02 & Gateway_0x0p273 (Hồ sơ thiếu -> yêu cầu bổ sung -> quá 3 lần thì hủy)
  it('Cổng M_G02 & Gateway_0x0p273: Lần yêu cầu thứ 4 thì chuyển sang hủy (M_EndCancel)', async () => {
    await seedDatabase();

    // Khách gửi yêu cầu nhưng không nộp đủ giấy tờ
    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'tay_ga',
      start_at: '2026-11-20T08:00:00.000Z',
      end_at: '2026-11-22T08:00:00.000Z',
      documents: [], // Thiếu giấy tờ
    });

    // Sau khi start, chuỗi tự động M_START -> M_CheckFleet -> M_G01 (Có) -> M_SendTerms -> M_CheckDocs -> M_G02 (Không) -> M_AskDocs -> Gateway_0x0p273 (Không) -> M_CheckDocs...
    // Vòng lặp cho tới khi doc_request_count > 3 -> Gateway_0x0p273 (Có) -> M_EndCancel
    const req = await db.rental_requests.get(reqId);
    expect(req?.status).toBe('DA_HUY');
    expect(req?.closed_reason).toBe('HO_SO_KHONG_DAT');
  });

  // 4. Kiểm tra Timer Ngoại lệ: M_BoundDeposit (Hết hạn cọc sau 30 phút)
  it('Timer M_BoundDeposit: Quá 30 phút mà chưa cọc thì tự động Từ chối (QUA_HAN_COC)', async () => {
    await seedDatabase();

    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-17T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'f1', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'f2', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'f3', is_valid: true },
      ],
    });

    // Hồ sơ lúc này tự động qua M_CheckDocs, M_CreateDeposit và dừng tại điểm chờ M_WaitDeposit
    const state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toContain('M_WaitDeposit');

    // Tua đồng hồ quá 30 phút
    clock.advance(35);
    await timerManager.sweepTimers();

    const updatedReq = await db.rental_requests.get(reqId);
    expect(updatedReq?.status).toBe('TU_CHOI');
    expect(updatedReq?.closed_reason).toBe('QUA_HAN_COC');
  });

  // 5. Kiểm tra Timer Ngoại lệ: M_BoundSign (Hết hạn ký hợp đồng 24h)
  it('Timer M_BoundSign: Quá 24 giờ chưa ký hợp đồng thì kích hoạt hoàn cọc và hủy (QUA_HAN_KY)', async () => {
    await seedDatabase();

    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-17T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'f1', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'f2', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'f3', is_valid: true },
      ],
    });

    // Thanh toán cọc đủ
    const req = await db.rental_requests.get(reqId);
    await engine.complete(
      reqId,
      'M_WaitDeposit',
      { paid_amount: req?.deposit_amount, provider_txn_id: 'TXN_TEST_1' },
      customerActor
    );

    // Đến điểm chờ M_WaitSign
    const stateAfterDeposit = await db.process_state.get(reqId);
    expect(stateAfterDeposit?.waiting_node_ids).toContain('M_WaitSign');

    // Tua nhanh 25 giờ
    clock.advance(25 * 60);
    await timerManager.sweepTimers();

    const finalReq = await db.rental_requests.get(reqId);
    expect(finalReq?.status).toBe('DA_HUY');
    expect(finalReq?.closed_reason).toBe('QUA_HAN_KY');

    // Kiểm tra có phát sinh giao dịch hoàn cọc và qua nút M_CancelRefund
    const refund = await db.payments.where('request_id').equals(reqId).and((p) => p.kind === 'REFUND').first();
    expect(refund).toBeDefined();

    const trace = await getTrace(reqId);
    expect(trace.map((t) => t.bpmn_node_id)).toContain('M_CancelRefund');
  });

  // 6. Kiểm tra các Quyết định Phê duyệt của Người (M_G03b, M_G04, Gateway_0ixde68, M_GDispute, M_GExtraDecision, M_GReady)
  it('Quyết định người M_G03b: Nhân viên từ chối cọc ngoại lệ ("Chưa") thì tạo thanh toán mới', async () => {
    await seedDatabase();

    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-15T08:00:00.000Z',
      end_at: '2026-11-17T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'f1', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'f2', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'f3', is_valid: true },
      ],
    });

    // Khách nộp thiếu tiền -> M_G03 rẽ sang M_ManualDeposit
    await engine.complete(reqId, 'M_WaitDeposit', { paid_amount: 10000 }, customerActor);

    const state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toContain('M_ManualDeposit');

    // Khách hàng cố tình duyệt cọc -> BỊ TỪ CHỐI DO SAI VAI TRÒ
    await expect(
      engine.complete(reqId, 'M_ManualDeposit', { decision: 'Có' }, customerActor)
    ).rejects.toThrow(/không có quyền/);

    // Nhân viên chọn "Chưa"
    await engine.complete(
      reqId,
      'M_ManualDeposit',
      { decision: 'Chưa', note: 'Thiếu quá nhiều tiền' },
      staffActor
    );

    // Quay lại chờ tại M_WaitDeposit
    const stateAfter = await db.process_state.get(reqId);
    expect(stateAfter?.waiting_node_ids).toContain('M_WaitDeposit');
  });

  // 7. Chạy suốt luồng chính (Happy Path từ M_START đến M_END)
  it('Chạy suốt luồng chính (Happy Path): Từ M_START đến M_END in ra đúng chuỗi ID BPMN', async () => {
    await seedDatabase();

    // 1. M_START với hồ sơ chuẩn
    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-01T08:00:00.000Z',
      end_at: '2026-11-03T08:00:00.000Z',
      documents: [
        { doc_type: 'CCCD_TRUOC', file_url: 'f1', is_valid: true },
        { doc_type: 'CCCD_SAU', file_url: 'f2', is_valid: true },
        { doc_type: 'BANG_LAI_TRUOC', file_url: 'f3', is_valid: true },
      ],
    });

    // 2. Khách thanh toán cọc đủ (M_WaitDeposit)
    const req = await db.rental_requests.get(reqId);
    await engine.complete(
      reqId,
      'M_WaitDeposit',
      { paid_amount: req?.deposit_amount, provider_txn_id: 'TXN_HAPPY' },
      customerActor
    );

    // 4. Khách ký hợp đồng (M_WaitSign)
    await engine.complete(reqId, 'M_WaitSign', {}, customerActor);

    // 5. Nhân viên kiểm tra kỹ thuật đạt (M_InspectPre)
    await engine.complete(
      reqId,
      'M_InspectPre',
      { vehicle_id: req?.vehicle_id, result: 'DAT', attempt_no: 1 },
      staffActor
    );

    // 6. Nhân viên chụp ảnh bàn giao (M_Photo)
    await engine.complete(reqId, 'M_Photo', { photo_urls: ['photo1.jpg'] }, staffActor);

    // 7. Khách xác nhận nhận xe (Activity_0d0qzp6)
    await engine.complete(
      reqId,
      'Activity_0d0qzp6',
      { customer_accepted: true, attempt_no: 1 },
      customerActor
    );

    // 8. Nhân viên giao xe & phụ kiện (M_Handover)
    await engine.complete(
      reqId,
      'M_Handover',
      { accessories: { helmet: 2, raincoat: 1 } },
      staffActor
    );

    // Lúc này xe đã ở trạng thái DANG_THUE và hồ sơ dừng ở cổng sự kiện M_EG
    const reqRented = await db.rental_requests.get(reqId);
    expect(reqRented?.status).toBe('DANG_THUE');

    // 9. Khách báo trả xe (M_EG -> M_CatchReturn)
    await engine.complete(reqId, 'M_EG', { event_type: 'RETURN' }, customerActor);

    // 10. Nhân viên nhận xe trả đúng giờ (M_ReceiveReturn)
    // Gán returned_at đúng bằng end_at để không phát sinh phí trễ hạn
    await db.rental_requests.update(reqId, { returned_at: '2026-11-03T08:00:00.000Z' });
    await engine.complete(reqId, 'M_ReceiveReturn', {}, staffActor);

    // 11. Nhân viên kiểm tra xe trả không sai lệch (M_CheckReturn)
    await engine.complete(
      reqId,
      'M_CheckReturn',
      { vehicle_id: req?.vehicle_id, diff_items: {} },
      staffActor
    );

    // 12. Khách chấp thuận bảng kê (M_ReceiveReview)
    await engine.complete(
      reqId,
      'M_ReceiveReview',
      { customer_answer: 'CHAP_THUAN' },
      customerActor
    );

    const stateAfterReview = await db.process_state.get(reqId);
    console.log('waiting_node_ids after M_ReceiveReview:', stateAfterReview?.waiting_node_ids);
    console.log('variables after M_ReceiveReview:', stateAfterReview?.variables);

    // 13. Khách xác nhận hoàn cọc dư (M_ConfirmRefund)
    await engine.complete(reqId, 'M_ConfirmRefund', {}, customerActor);

    // 14. Nhân viên đánh giá xe sau trả: ĐẠT (M_CheckReady)
    await engine.complete(reqId, 'M_CheckReady', { result: 'DAT' }, staffActor);

    // Kiểm tra kết quả cuối cùng: Hồ sơ HOAN_TAT
    const finishedReq = await db.rental_requests.get(reqId);
    expect(finishedReq?.status).toBe('HOAN_TAT');

    const vehicle = await db.vehicles.get(req?.vehicle_id || '');
    expect(vehicle?.status).toBe('SAN_SANG');

    // Kiểm tra getTrace in ra đúng các ID BPMN To-Be
    const trace = await getTrace(reqId);
    const nodeIds = trace.map((t) => t.bpmn_node_id);

    expect(nodeIds).toContain('M_START');
    expect(nodeIds).toContain('M_CheckFleet');
    expect(nodeIds).toContain('M_SendTerms');
    expect(nodeIds).toContain('M_Contract');
    expect(nodeIds).toContain('M_SaveBooking');
    expect(nodeIds).toContain('M_Handover');
    expect(nodeIds).toContain('M_SetRented');
    expect(nodeIds).toContain('M_DigitalCompare');
    expect(nodeIds).toContain('M_CalcFees');
    expect(nodeIds).toContain('M_NetDeposit');
    expect(nodeIds).toContain('M_Settle');
    expect(nodeIds).toContain('M_MarkReady');
    expect(nodeIds).toContain('M_Archive');
    expect(nodeIds).toContain('M_END');
  });

  // 8. Quyết định khiếu nại bảng kê và điều chỉnh (M_GDispute -> M_Resolve -> M_ApproveAdjustment)
  it('Khiếu nại bảng kê: Khách chọn "Khiếu nại" -> Quản lý xử lý ở M_Resolve -> Tăng version bảng kê', async () => {
    await seedDatabase();

    const reqId = await engine.start(customerActor, {
      customer_id: customerActor.id,
      vehicle_type: 'xe_so',
      start_at: '2026-11-01T08:00:00.000Z',
      end_at: '2026-11-03T08:00:00.000Z',
    });

    // Tạo sẵn bảng kê và đặt vào điểm chờ M_ReceiveReview
    await db.statements.add({
      id: crypto.randomUUID(),
      request_id: reqId,
      version: 1,
      items: [{ name: 'Hư gương', amount: 200000 }],
      total_fee: 200000,
      status: 'SENT',
    });

    await db.process_state.put({
      request_id: reqId,
      waiting_node_ids: ['M_ReceiveReview'],
      loop_counters: {},
      variables: {},
      updated_at: clock.nowISO(),
    });

    // Khách khiếu nại
    await engine.complete(
      reqId,
      'M_ReceiveReview',
      { customer_answer: 'KHIEU_NAI', dispute_reason: 'Gương đã vỡ từ trước khi nhận' },
      customerActor
    );

    // Chuyển sang điểm chờ M_Resolve (User Task Quản lý)
    const state = await db.process_state.get(reqId);
    expect(state?.waiting_node_ids).toContain('M_Resolve');

    // Nhân viên không được duyệt -> Lỗi
    await expect(
      engine.complete(reqId, 'M_Resolve', { resolution_note: 'Duyệt miễn phí' }, staffActor)
    ).rejects.toThrow(/không có quyền/);

    // Quản lý duyệt điều chỉnh
    await engine.complete(
      reqId,
      'M_Resolve',
      { resolution_note: 'Đồng ý miễn khoản phí gương' },
      managerActor
    );

    // Đã chạy qua M_ApproveAdjustment và quay lại M_ReceiveReview với version 2
    const updatedStatement = await db.statements.where('request_id').equals(reqId).first();
    expect(updatedStatement?.version).toBe(2);

    const stateLoop = await db.process_state.get(reqId);
    expect(stateLoop?.waiting_node_ids).toContain('M_ReceiveReview');
    expect(stateLoop?.loop_counters.dispute_count).toBe(1);
  });
});
