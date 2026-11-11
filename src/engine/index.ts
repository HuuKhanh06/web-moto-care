// src/engine/index.ts
// Bộ máy quy trình BPMN To-Be (Process Engine) chạy hoàn toàn trong trình duyệt

import { db } from '@/db';
import { clock } from '@/lib/clock';
import { logEvent } from '@/db/repo';
import { bpmnGraph } from './graph';
import { timerManager } from './timers';
import { BUSINESS_RULES } from '@/config/rules';
import { integrations } from '@/integrations';
import { isVehicleFree } from './fleet';
import { dataAdapter, STATUS_TO_NODES } from '@/db/adapter';
import { durableHandoverPhotos } from '@/lib/handoverPhotos';
import type { Actor, ProcessEvent, ProcessState } from '@/db/types';

import {
  fn_create_rental_request,
  fn_check_fleet,
  eval_M_G01,
  fn_reject_no_vehicle,
  fn_send_quote,
  fn_check_documents,
  eval_M_G02,
  fn_request_more_docs,
  eval_Gateway_0x0p273,
  fn_end_cancel,
  fn_create_deposit_qr,
  fn_reconcile_deposit,
  eval_M_G03,
  eval_and_apply_M_G03b,
  fn_generate_contract,
  fn_cancel_and_refund,
  fn_lock_schedule,
  eval_M_G04,
  fn_send_vehicle_condition,
  eval_Gateway_0ixde68,
  fn_set_rented,
  fn_compare_inspections,
  eval_M_GDamage,
  fn_calculate_fees,
  fn_send_statement,
  eval_M_GDispute,
  fn_apply_adjustment,
  fn_net_deposit,
  eval_M_GBalance,
  fn_create_refund,
  fn_create_extra_qr,
  fn_reconcile_extra_payment,
  eval_M_GExtra,
  eval_and_apply_M_GExtraDecision,
  fn_record_debt,
  fn_settle,
  eval_M_GReady,
  fn_create_maintenance,
  fn_mark_ready,
  fn_archive_case,
} from './fn';

import {
  fn_record_extension,
  fn_check_extension_rule,
  eval_GH_GEligible,
  fn_offer_extension,
  eval_GH_GAccept,
  eval_GH_NeedPayment,
  fn_create_extension_qr,
  fn_apply_extension,
  fn_notify_extension_ok,
  fn_notify_extension_old,
  fn_create_incident_ticket,
  fn_select_partner,
  fn_dispatch_partner,
  eval_SC_GAccept,
  fn_try_next_partner,
  eval_SC_GRetry,
  fn_track_incident,
  eval_SC_GResolve,
  eval_SC_SettleDecision,
  fn_send_continue_rental,
  fn_notify_early_return,
} from './fn/sp';

/**
 * Danh sách vai trò bắt buộc cho từng điểm chờ của người
 */
const TASK_ROLE_MAP: Record<string, Array<Actor['role']>> = {
  // Nhân viên
  M_ManualDeposit: ['nhan_vien', 'quan_ly'],
  M_InspectPre: ['nhan_vien', 'quan_ly'],
  M_Rework: ['nhan_vien', 'quan_ly'],
  M_Photo: ['nhan_vien', 'quan_ly'],
  M_Handover: ['nhan_vien', 'quan_ly'],
  M_ReceiveReturn: ['nhan_vien', 'quan_ly'],
  M_CheckReturn: ['nhan_vien', 'quan_ly'],
  M_VerifyDamage: ['nhan_vien', 'quan_ly'],
  M_ManualExtra: ['nhan_vien', 'quan_ly'],
  M_CheckReady: ['nhan_vien', 'quan_ly'],
  SC_Log: ['nhan_vien', 'quan_ly'],

  // Quản lý
  M_Resolve: ['quan_ly'],
  SC_ReceiveAck: ['quan_ly', 'system'],
  SC_ReceiveResult: ['quan_ly', 'system'],
  SC_Escalate: ['quan_ly'],

  // Khách hàng
  M_CheckDocs: ['khach_hang', 'nhan_vien', 'quan_ly', 'system'],
  M_WaitDeposit: ['khach_hang', 'nhan_vien', 'quan_ly', 'system'],
  M_WaitSign: ['khach_hang'],
  Activity_0d0qzp6: ['khach_hang'],
  M_EG: ['khach_hang'],
  M_CatchReturn: ['khach_hang'],
  M_CatchExtend: ['khach_hang'],
  M_CatchIncident: ['khach_hang'],
  M_ReceiveReview: ['khach_hang'],
  M_ConfirmRefund: ['khach_hang', 'system'],
  M_ReceiveExtra: ['khach_hang', 'nhan_vien', 'quan_ly', 'system'],
  GH_WaitAccept: ['khach_hang'],
  GH_VerifyQR: ['khach_hang', 'nhan_vien', 'quan_ly', 'system'],
};

export class ProcessEngine {
  constructor() {
    timerManager.start(async (requestId, timerNodeId) => {
      await this.triggerTimer(requestId, timerNodeId);
    });
  }

  /**
   * Khởi tạo quy trình mới từ M_START
   */
  public async start(
    actor: Actor,
    initialData: {
      customer_id: string;
      vehicle_type: string;
      start_at: string;
      end_at: string;
      documents?: Array<{ doc_type: 'CCCD_TRUOC' | 'CCCD_SAU' | 'BANG_LAI_TRUOC' | 'BANG_LAI_SAU' | 'OTHER'; file_url: string; is_valid?: boolean }>;
    }
  ): Promise<string> {
    const request = await fn_create_rental_request(actor, initialData);

    if (initialData.documents && initialData.documents.length > 0) {
      for (const doc of initialData.documents) {
        await db.customer_documents.add({
          id: crypto.randomUUID(),
          request_id: request.id,
          doc_type: doc.doc_type,
          file_url: doc.file_url,
          is_valid: doc.is_valid !== undefined ? doc.is_valid : true,
        });
      }
    }

    // Khởi tạo process_state
    const state: ProcessState = {
      request_id: request.id,
      waiting_node_ids: [],
      loop_counters: {},
      variables: {
        preferred_vehicle_type: initialData.vehicle_type,
        auto_test_mode: initialData.documents !== undefined,
      },
      updated_at: clock.nowISO(),
    };
    await db.process_state.put(state);
    void dataAdapter.pushToCloud('rental_requests', request);
    void dataAdapter.pushProcessStateToCloud(state, actor.id);

    // Chạy tiếp từ M_START
    await this.advance(request.id, 'M_START', undefined, actor);

    // Kích hoạt webhook No-Code khởi động hồ sơ
    await integrations.workflowHook.triggerWebhook({
      requestId: request.id,
      bpmnNodeId: 'M_START',
      event: 'START_PROCESS',
      timestamp: clock.nowISO(),
      data: { customer_id: actor.id, vehicle_type: initialData.vehicle_type },
    });

    return request.id;
  }

  /**
   * Bước chạy tự động: Đi từ nút hiện tại cho đến khi gặp ĐIỂM CHỜ hoặc KẾT THÚC
   */
  public async advance(
    requestId: string,
    fromNodeId: string,
    outcome?: string,
    actor: Actor = { id: 'system', role: 'system' }
  ): Promise<void> {
    let currentNodeId = fromNodeId;
    let currentOutcome = outcome;

    // Nếu tiếp tục từ M_CheckDocs, chạy kiểm tra hồ sơ thực tế để cập nhật docs_all_valid trước khi đánh giá M_G02
    if (fromNodeId === 'M_CheckDocs' && outcome === undefined) {
      await this.executeAutomaticNode(requestId, 'M_CheckDocs', actor);
    }

    // Vòng lặp chuyển bước cho đến khi gặp điểm chờ hoặc kết thúc
    while (true) {
      // 1. Xác định nút kế tiếp
      const nextNodeId = this.resolveNextNode(currentNodeId, currentOutcome);
      bpmnGraph.assertEdge(currentNodeId, nextNodeId);

      currentNodeId = nextNodeId;
      currentOutcome = undefined;

      // 2. Kiểm tra nếu là nút KẾT THÚC CỦA SUB-PROCESS HOẶC MAIN
      if (
        currentNodeId === 'M_END' ||
        currentNodeId === 'M_END_REJECT' ||
        currentNodeId === 'M_EndCancel' ||
        currentNodeId === 'M_END_DEBT'
      ) {
        await this.handleEndEvent(requestId, currentNodeId, actor);
        break;
      }

      if (currentNodeId === 'GH_END') {
        // Kết thúc SP1: quay lại M_EG với trạng thái DANG_THUE
        await db.rental_requests.update(requestId, { status: 'DANG_THUE' });
        await logEvent(requestId, 'GH_END', 'END_SUBPROCESS_SP1', actor);
        currentNodeId = 'M_EG';
        await this.enterWaitPoint(requestId, currentNodeId, actor);
        break;
      }

      if (currentNodeId === 'SC_END_OK') {
        // Kết thúc SP2 thành công: quay lại M_EG với trạng thái DANG_THUE
        await db.rental_requests.update(requestId, { status: 'DANG_THUE' });
        await logEvent(requestId, 'SC_END_OK', 'END_SUBPROCESS_SP2_OK', actor);
        currentNodeId = 'M_EG';
        await this.enterWaitPoint(requestId, currentNodeId, actor);
        break;
      }

      if (currentNodeId === 'SC_END_EARLY') {
        // Kết thúc SP2 với lỗi: kích hoạt error boundary M_EarlyBoundary và chuyển tới M_ReturnMerge
        await db.rental_requests.update(requestId, { status: 'CHO_NHAN_XE_TRA' });
        await logEvent(requestId, 'SC_END_EARLY', 'END_SUBPROCESS_SP2_EARLY', actor);
        await logEvent(requestId, 'M_EarlyBoundary', 'TRIGGER_EARLY_BOUNDARY', actor);
        currentNodeId = 'M_ReturnMerge';
      }

      // Xử lý khi bước vào sub-process SP1 hoặc SP2
      if (currentNodeId === 'SP1') {
        await logEvent(requestId, 'SP1', 'START_SUBPROCESS_SP1', actor);
        await logEvent(requestId, 'GH_START', 'START_SP1', actor);
        currentNodeId = 'GH_START';
        continue;
      }

      if (currentNodeId === 'SP2') {
        await logEvent(requestId, 'SP2', 'START_SUBPROCESS_SP2', actor);
        await logEvent(requestId, 'SC_START', 'START_SP2', actor);
        currentNodeId = 'SC_START';
        continue;
      }

      // Tạm dừng tại M_CheckDocs nếu là luồng tương tác thực tế của người dùng (chưa nộp giấy tờ ở KH-01)
      if (currentNodeId === 'M_CheckDocs') {
        const pState = await db.process_state.get(requestId);
        const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
        if (pState?.variables?.auto_test_mode !== true && docs.length === 0) {
          await this.enterWaitPoint(requestId, 'M_CheckDocs', actor);
          break;
        }
      }

      // 3. Kiểm tra nếu là ĐIỂM CHỜ (User Task, Receive Task, Event Gateway...)
      if (this.isWaitPoint(currentNodeId)) {
        await this.enterWaitPoint(requestId, currentNodeId, actor);
        break;
      }

      // 4. Xử lý nút TỰ ĐỘNG (Service Task, Business Rule Task, XOR Gateway, Merge Gateway)
      currentOutcome = await this.executeAutomaticNode(requestId, currentNodeId, actor);
    }
  }

  /**
   * Xác định nút tiếp theo từ đồ thị BPMN dựa vào nhánh rẽ hoặc cạnh duy nhất
   */
  private resolveNextNode(fromNodeId: string, outcome?: string): string {
    const node = bpmnGraph.requireNode(fromNodeId);

    // Cổng XOR rẽ nhánh hoặc Event-based Gateway: bắt buộc phải có outcome
    if (
      (node.type === 'exclusiveGateway' && node.gatewayRole === 'split') ||
      node.type === 'eventBasedGateway'
    ) {
      if (!outcome) {
        throw new Error(`[ProcessEngine] Cổng '${fromNodeId}' thiếu nhãn rẽ nhánh.`);
      }
      return bpmnGraph.getNextByLabel(fromNodeId, outcome);
    }

    // Các nút có 1 nhánh ra thông thường
    return bpmnGraph.getSingleNext(fromNodeId);
  }

  /**
   * Kiểm tra xem một nút có phải là Điểm chờ (cần con người hoặc sự kiện kích hoạt)
   */
  public isWaitPoint(nodeId: string): boolean {
    const waitPointIds = [
      // User Tasks / Manual Tasks
      'M_ManualDeposit',
      'M_InspectPre',
      'M_Rework',
      'M_Photo',
      'M_Handover',
      'M_ReceiveReturn',
      'M_CheckReturn',
      'M_VerifyDamage',
      'M_Resolve',
      'M_ManualExtra',
      'M_CheckReady',

      // Receive Tasks
      'M_WaitDeposit',
      'M_WaitSign',
      'M_ReceiveReview',
      'M_ReceiveExtra',
      'M_ConfirmRefund',

      // Hành động khách hàng đặc thù
      'Activity_0d0qzp6',

      // Cổng theo sự kiện
      'M_EG',

      // SP1: Receive Tasks
      'GH_WaitAccept',
      'GH_VerifyQR',

      // SP2: Receive Tasks & User Tasks
      'SC_ReceiveAck',
      'SC_ReceiveResult',
      'SC_Escalate',
      'SC_Log',
    ];

    return waitPointIds.includes(nodeId);
  }

  /**
   * Bước vào một điểm chờ: Lưu trạng thái vào process_state và đăng ký Timer nếu có
   */
  private async enterWaitPoint(requestId: string, nodeId: string, actor: Actor): Promise<void> {
    const state = await db.process_state.get(requestId);
    const waitingNodeIds = [nodeId];

    if (state) {
      await db.process_state.update(requestId, {
        waiting_node_ids: waitingNodeIds,
        updated_at: clock.nowISO(),
      });
      const updatedState = await db.process_state.get(requestId);
      if (updatedState) {
        void dataAdapter.pushProcessStateToCloud(updatedState, actor.id);
      }
    }

    await logEvent(requestId, nodeId, 'ENTER_WAIT_POINT', actor);

    const req = await db.rental_requests.get(requestId);
    if (req) {
      void dataAdapter.pushToCloud('rental_requests', req);
    }

    // Đăng ký timer boundary nếu có
    if (nodeId === 'M_WaitDeposit') {
      await timerManager.registerTimer(requestId, 'M_BoundDeposit', BUSINESS_RULES.TIMERS.DEPOSIT_MINUTES);
    } else if (nodeId === 'M_WaitSign') {
      await timerManager.registerTimer(requestId, 'M_BoundSign', BUSINESS_RULES.TIMERS.SIGN_HOURS * 60);
    } else if (nodeId === 'M_ReceiveExtra') {
      await timerManager.registerTimer(requestId, 'M_BoundExtra', BUSINESS_RULES.TIMERS.EXTRA_PAYMENT_MINUTES);
    } else if (nodeId === 'GH_WaitAccept') {
      await timerManager.registerTimer(requestId, 'GH_Timer', BUSINESS_RULES.TIMERS.EXTENSION_OFFER_HOURS * 60);
    } else if (nodeId === 'GH_VerifyQR') {
      await timerManager.registerTimer(requestId, 'GH_TimerPay', BUSINESS_RULES.TIMERS.EXTENSION_PAY_MINUTES);
    } else if (nodeId === 'SC_ReceiveAck') {
      await timerManager.registerTimer(requestId, 'SC_AckTimer', BUSINESS_RULES.TIMERS.DISPATCH_ACK_MINUTES);
    } else if (nodeId === 'SC_ReceiveResult') {
      await timerManager.registerTimer(requestId, 'SC_ResultTimer', BUSINESS_RULES.TIMERS.INCIDENT_SLA_HOURS * 60);
    }
  }

  /**
   * Hoàn tất một điểm chờ (User/Manual/Receive Task) bởi con người
   */
  public async complete(
    requestId: string,
    nodeId: string,
    payload: Record<string, unknown> = {},
    actor: Actor
  ): Promise<void> {
    let state = await db.process_state.get(requestId);
    const req = await db.rental_requests.get(requestId);

    if (!state || !state.waiting_node_ids.includes(nodeId)) {
      if (req && STATUS_TO_NODES[req.status]?.includes(nodeId)) {
        if (!state) {
          state = {
            request_id: requestId,
            waiting_node_ids: [nodeId],
            loop_counters: {},
            variables: { preferred_vehicle_type: 'xe_so' },
            updated_at: clock.nowISO(),
          };
          await db.process_state.put(state);
        } else if (!state.waiting_node_ids.includes(nodeId)) {
          state.waiting_node_ids.push(nodeId);
          await db.process_state.put(state);
        }
      } else {
        throw new Error(`[ProcessEngine] Nút '${nodeId}' hiện không nằm trong danh sách đang chờ của hồ sơ ${requestId}`);
      }
    }

    // Kiểm tra phân quyền Actor
    const allowedRoles = TASK_ROLE_MAP[nodeId];
    if (allowedRoles && actor.role !== 'system' && !allowedRoles.includes(actor.role)) {
      throw new Error(`[ProcessEngine] Vai trò '${actor.role}' không có quyền thực hiện tác vụ '${nodeId}'.`);
    }

    // Cô lập dữ liệu: Khách hàng chỉ được thao tác trên hồ sơ của chính mình
    if (actor.role === 'khach_hang' && req && req.customer_id !== actor.id) {
      throw new Error(`[ProcessEngine] Khách hàng không sở hữu hồ sơ ${requestId}.`);
    }

    // Hủy timer biên nếu có
    if (nodeId === 'M_WaitDeposit') {
      await timerManager.cancelTimer(requestId, 'M_BoundDeposit');
    } else if (nodeId === 'M_WaitSign') {
      await timerManager.cancelTimer(requestId, 'M_BoundSign');
    } else if (nodeId === 'M_ReceiveExtra') {
      await timerManager.cancelTimer(requestId, 'M_BoundExtra');
    } else if (nodeId === 'GH_WaitAccept') {
      await timerManager.cancelTimer(requestId, 'GH_Timer');
    } else if (nodeId === 'GH_VerifyQR') {
      await timerManager.cancelTimer(requestId, 'GH_TimerPay');
    } else if (nodeId === 'SC_ReceiveAck') {
      await timerManager.cancelTimer(requestId, 'SC_AckTimer');
    } else if (nodeId === 'SC_ReceiveResult') {
      await timerManager.cancelTimer(requestId, 'SC_ResultTimer');
    }

    // Cập nhật biến và lưu trữ payload tương ứng với từng điểm chờ
    let outcome: string | undefined;

    if (nodeId === 'M_WaitDeposit') {
      // Giả lập nhận chuyển khoản cọc
      const paidAmount = Number(payload.paid_amount || 0);
      const payment = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'DEPOSIT')
        .reverse()
        .first();
      if (payment) {
        await db.payments.update(payment.id, {
          paid_amount: paidAmount,
          provider_txn_id: (payload.provider_txn_id as string) || `SIM_TXN_${Date.now()}`,
          paid_at: clock.nowISO(),
        });
      }
    } else if (nodeId === 'M_ManualDeposit') {
      // Quyết định cọc ngoại lệ (NV-02) -> đưa vào M_G03b
      const decision = (payload.decision as 'Có' | 'Chưa') || 'Có';
      outcome = await eval_and_apply_M_G03b(requestId, actor, decision, payload.note as string);
      state.variables.last_manual_deposit_decision = outcome;
    } else if (nodeId === 'M_WaitSign') {
      // Khách ký hợp đồng
      const contract = await db.contracts.where('request_id').equals(requestId).first();
      if (contract) {
        await db.contracts.update(contract.id, {
          status: 'SIGNED',
          signed_at: clock.nowISO(),
        });
      }
    } else if (nodeId === 'M_InspectPre') {
      // Nhân viên kiểm tra kỹ thuật xe (NV-03)
      const attemptNo = Number(payload.attempt_no || 1);
      const result = (payload.result as 'DAT' | 'CHUA_DAT') || 'DAT';
      await db.inspections.add({
        id: crypto.randomUUID(),
        request_id: requestId,
        vehicle_id: (payload.vehicle_id as string) || '',
        kind: 'PRE_HANDOVER',
        attempt_no: attemptNo,
        result: result,
        checklist: (payload.checklist as Record<string, unknown>) || {},
      });
      state.variables.last_pre_inspect_result = result;
    } else if (nodeId === 'M_Rework') {
      // Khắc phục/đổi xe -> quay lại M_InspectPre
      const reworkNote = (payload.rework_note as string) || '';
      const newVehicleId = payload.new_vehicle_id as string | undefined;
      const lastInsp = await db.inspections
        .where('request_id')
        .equals(requestId)
        .and((i) => i.kind === 'PRE_HANDOVER')
        .reverse()
        .first();
      if (lastInsp && reworkNote) {
        await db.inspections.update(lastInsp.id, { rework_note: reworkNote });
      }
      if (newVehicleId) {
        // Chặn đổi sang xe đã khóa lịch hoặc đang giữ cho hồ sơ khác trong cùng khung giờ.
        const current = await db.rental_requests.get(requestId);
        if (current && !(await isVehicleFree(newVehicleId, new Date(current.start_at).getTime(), new Date(current.end_at).getTime(), requestId))) {
          throw new Error('Xe thay thế đã có lịch hoặc đang được giữ cho hồ sơ khác trong khung giờ này. Vui lòng chọn xe khác.');
        }
        await db.rental_requests.update(requestId, { vehicle_id: newVehicleId });
        const oldSched = await db.vehicle_schedule.where('request_id').equals(requestId).first();
        if (oldSched) {
          await db.vehicle_schedule.update(oldSched.id, { vehicle_id: newVehicleId });
        }
      }
      outcome = 'Kiểm tra lại';
    } else if (nodeId === 'M_Photo') {
      // Chụp ảnh bàn giao (NV-04)
      const photoUrls = await durableHandoverPhotos((payload.photo_urls as string[]) || []);
      const inspections = await db.inspections
        .where('request_id')
        .equals(requestId)
        .and((i) => i.kind === 'PRE_HANDOVER' && i.result === 'DAT')
        .toArray();
      const lastInsp = inspections.sort((a, b) => b.attempt_no - a.attempt_no)[0];
      if (lastInsp) {
        await db.inspections.update(lastInsp.id, { photo_urls: photoUrls });
      }
    } else if (nodeId === 'Activity_0d0qzp6') {
      // Khách phản hồi checklist/ảnh (KH-05)
      const customerAccepted = payload.customer_accepted === true;
      const attemptNo = Number(payload.attempt_no || 1);
      await db.handovers.add({
        id: crypto.randomUUID(),
        request_id: requestId,
        attempt_no: attemptNo,
        customer_accepted: customerAccepted,
        customer_note: (payload.customer_note as string) || '',
      });
      state.variables.last_customer_accepted = customerAccepted;
    } else if (nodeId === 'M_Handover') {
      // Nhân viên giao xe & phụ kiện (NV-05)
      const lastHandover = await db.handovers
        .where('request_id')
        .equals(requestId)
        .reverse()
        .first();
      if (lastHandover) {
        await db.handovers.update(lastHandover.id, {
          staff_id: actor.id,
          accessories: (payload.accessories as Record<string, unknown>) || {},
          handed_over_at: clock.nowISO(),
        });
      }
    } else if (nodeId === 'M_EG') {
      // Cổng theo sự kiện: nhận 1 trong 3 sự kiện
      const eventType = payload.event_type as 'RETURN' | 'EXTEND' | 'INCIDENT';
      if (eventType === 'EXTEND') {
        const newEndAt = (payload.new_end_at as string) || '';
        if (!newEndAt) throw new Error('Cần cung cấp new_end_at khi yêu cầu gia hạn');
        state.variables.extension_new_end_at = newEndAt;
        outcome = 'Gia hạn';
      } else if (eventType === 'INCIDENT') {
        const desc = (payload.description as string) || 'Báo cáo sự cố xe';
        state.variables.incident_description = desc;
        state.variables.incident_lat = payload.lat as number | undefined;
        state.variables.incident_lng = payload.lng as number | undefined;
        state.variables.incident_photo_urls = payload.photo_urls as string[] | undefined;
        outcome = 'Sự cố';
      } else {
        // Trả xe
        outcome = 'Trả xe';
      }
    } else if (nodeId === 'M_ReceiveReturn') {
      // Xác nhận nhận xe trả (NV-06)
      // Nếu chưa có returned_at thì lấy thời gian kết thúc hoặc thời gian hiện tại
      const req = await db.rental_requests.get(requestId);
      if (req && !req.returned_at) {
        await db.rental_requests.update(requestId, { returned_at: req.end_at });
      }
    } else if (nodeId === 'M_CheckReturn') {
      // Kiểm tra xe trả theo checklist
      await db.inspections.add({
        id: crypto.randomUUID(),
        request_id: requestId,
        vehicle_id: (payload.vehicle_id as string) || '',
        kind: 'RETURN',
        attempt_no: 1,
        inspector_id: actor.id,
        checklist: (payload.checklist as Record<string, unknown>) || {},
        diff_items: (payload.diff_items as Record<string, unknown>) || {},
        photo_urls: (payload.photo_urls as string[]) || [],
      });
    } else if (nodeId === 'M_VerifyDamage') {
      // Xác minh hư hỏng và ước tính phí (NV-07)
      if (payload.damages && Array.isArray(payload.damages)) {
        for (const d of payload.damages) {
          await db.damage_findings.add({
            id: crypto.randomUUID(),
            request_id: requestId,
            inspection_id: (payload.inspection_id as string) || crypto.randomUUID(),
            description: d.description || 'Hư hại linh kiện',
            evidence_urls: d.evidence_urls || [],
            estimated_cost: Number(d.estimated_cost || 0),
            verified_by: actor.id,
            verified_at: clock.nowISO(),
          });
        }
      }
    } else if (nodeId === 'M_ReceiveReview') {
      // Khách xác nhận bảng kê (KH-09)
      const answer = (payload.customer_answer as 'CHAP_THUAN' | 'KHIEU_NAI') || 'CHAP_THUAN';
      const statement = await db.statements.where('request_id').equals(requestId).first();
      if (statement) {
        await db.statements.update(statement.id, {
          customer_answer: answer,
          dispute_reason: (payload.dispute_reason as string) || '',
          answered_at: clock.nowISO(),
        });
      }
      state.variables.last_statement_answer = answer;
    } else if (nodeId === 'M_Resolve') {
      // Quản lý xử lý khiếu nại (QL-01)
      const statement = await db.statements.where('request_id').equals(requestId).first();
      if (statement) {
        const updateData: Partial<typeof statement> = {
          resolution_note: (payload.resolution_note as string) || 'Quản lý duyệt điều chỉnh',
          resolved_by: actor.id,
        };
        if (payload.items && Array.isArray(payload.items)) {
          updateData.items = payload.items as typeof statement.items;
        }
        if (payload.total_fee !== undefined) {
          updateData.total_fee = Number(payload.total_fee);
        }
        await db.statements.update(statement.id, updateData);
      }
    } else if (nodeId === 'M_ConfirmRefund') {
      // Khách xác nhận đã nhận cọc hoàn
      const refund = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'REFUND')
        .first();
      if (refund) {
        await db.payments.update(refund.id, {
          status: 'VERIFIED',
          verified_at: clock.nowISO(),
        });
      }
    } else if (nodeId === 'M_ReceiveExtra') {
      // Khách nộp tiền thu thêm
      const extraPay = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'EXTRA')
        .reverse()
        .first();
      if (extraPay) {
        await db.payments.update(extraPay.id, {
          paid_amount: Number(payload.paid_amount || extraPay.amount),
          paid_at: clock.nowISO(),
          provider_txn_id: (payload.provider_txn_id as string) || `EXTRA_TXN_${Date.now()}`,
        });
      }
    } else if (nodeId === 'M_ManualExtra') {
      // Quyết định thu thêm (NV-08) -> đưa vào M_GExtraDecision
      const decision =
        (payload.decision as 'Tiếp tục thanh toán' | 'Không / chưa thanh toán') || 'Tiếp tục thanh toán';
      outcome = await eval_and_apply_M_GExtraDecision(requestId, actor, decision, payload.note as string);
      state.variables.last_extra_decision = outcome;
    } else if (nodeId === 'M_CheckReady') {
      // Đánh giá xe sau trả (NV-09)
      const result = (payload.result as 'DAT' | 'CAN_BAO_TRI') || 'DAT';
      state.variables.last_ready_result = result;
      const req = await db.rental_requests.get(requestId);
      await db.inspections.add({
        id: crypto.randomUUID(),
        request_id: requestId,
        vehicle_id: req?.vehicle_id || '',
        kind: 'POST_RETURN',
        attempt_no: 1,
        inspector_id: actor.id,
        result: result,
        rework_note:
          (payload.note as string) ||
          (result === 'CAN_BAO_TRI' ? 'Cần chuyển bảo dưỡng/sửa chữa' : 'Xe đạt chuẩn sẵn sàng'),
      });
    } else if (nodeId === 'GH_WaitAccept') {
      // Khách phản hồi đề xuất gia hạn
      const answer = (payload.answer as 'DONG_Y' | 'TU_CHOI') || 'DONG_Y';
      state.variables.last_gh_accept = answer;
    } else if (nodeId === 'GH_VerifyQR') {
      // Xác thực thanh toán QR gia hạn
      const extPayment = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'EXTENSION' && p.status === 'PENDING')
        .reverse()
        .first();
      if (extPayment) {
        await db.payments.update(extPayment.id, {
          status: 'VERIFIED',
          paid_amount: Number(payload.paid_amount || extPayment.amount),
          paid_at: clock.nowISO(),
          provider_txn_id: (payload.provider_txn_id as string) || `EXT_TXN_${Date.now()}`,
        });
      }
    } else if (nodeId === 'SC_ReceiveAck') {
      // Quản lý xác nhận phản hồi từ đối tác hỗ trợ sự cố
      const ackStatus = (payload.status as 'ACCEPTED' | 'DECLINED' | 'TIMEOUT') || 'ACCEPTED';
      const lastDispatch = await db.incident_dispatches
        .where('incident_id')
        .equals((state.variables.current_incident_id as string) || '')
        .reverse()
        .first();
      if (lastDispatch) {
        await db.incident_dispatches.update(lastDispatch.id, {
          status: ackStatus,
          ack_at: clock.nowISO(),
        });
      }
      state.variables.last_sc_accept = ackStatus;
    } else if (nodeId === 'SC_ReceiveResult') {
      // Quản lý ghi nhận kết quả hỗ trợ từ đối tác
      const resultNote = (payload.result_note as string) || 'Hỗ trợ hoàn tất';
      const lastDispatch = await db.incident_dispatches
        .where('incident_id')
        .equals((state.variables.current_incident_id as string) || '')
        .reverse()
        .first();
      if (lastDispatch) {
        await db.incident_dispatches.update(lastDispatch.id, {
          result: resultNote,
          result_at: clock.nowISO(),
        });
      }
    } else if (nodeId === 'SC_Escalate') {
      // Quản lý xử lý vượt SLA hoặc tìm phương án thay thế
      const resolveDecision = (payload.decision as 'Có phương án' | 'Không') || 'Có phương án';
      const note = (payload.escalation_note as string) || '';
      const incident = await db.incidents
        .where('request_id')
        .equals(requestId)
        .reverse()
        .first();
      if (incident) {
        await db.incidents.update(incident.id, {
          escalation_note: note,
        });
      }
      state.variables.last_sc_resolve = resolveDecision;
    } else if (nodeId === 'SC_Log') {
      // Nhân viên xác nhận chi phí thực tế và quyết định tiếp tục thuê
      const continueRental = payload.continue_rental !== false;
      const incidentCost = Number(payload.actual_cost || 0);
      const incident = await db.incidents
        .where('request_id')
        .equals(requestId)
        .reverse()
        .first();
      if (incident) {
        await db.incidents.update(incident.id, {
          actual_cost: incidentCost,
          continue_rental: continueRental,
          confirmed_by: actor.id,
        });
      }
      state.variables.last_sc_continue_rental = continueRental;
    }

    await logEvent(requestId, nodeId, 'COMPLETE_TASK', actor, payload);
    await db.process_state.put(state);
    void dataAdapter.pushProcessStateToCloud(state, actor.id);
    const updatedReq = await db.rental_requests.get(requestId);
    if (updatedReq) {
      void dataAdapter.pushToCloud('rental_requests', updatedReq);
    }

    // Tiếp tục chạy quy trình
    await this.advance(requestId, nodeId, outcome, actor);
  }

  /**
   * Kích hoạt nhánh quá hạn của Timer boundary
   */
  public async triggerTimer(requestId: string, timerNodeId: string): Promise<void> {
    const actor: Actor = { id: 'system', role: 'system' };

    if (timerNodeId === 'M_BoundDeposit') {
      // Quá hạn cọc: payments EXPIRED, rental_requests TU_CHOI
      await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'DEPOSIT' && p.status === 'PENDING')
        .modify({ status: 'EXPIRED' });

      await db.rental_requests.update(requestId, {
        status: 'TU_CHOI',
        closed_reason: 'QUA_HAN_COC',
        closed_at: clock.nowISO(),
      });

      await this.handleEndEvent(requestId, 'M_END_REJECT', actor);
    } else if (timerNodeId === 'M_BoundSign') {
      // Quá hạn ký: contracts EXPIRED -> M_CancelRefund -> M_EndCancel
      await db.contracts
        .where('request_id')
        .equals(requestId)
        .modify({ status: 'EXPIRED' });

      await fn_cancel_and_refund(requestId, actor);
      await this.handleEndEvent(requestId, 'M_EndCancel', actor);
    } else if (timerNodeId === 'M_BoundExtra' || timerNodeId === 'M_TimerExtra') {
      // Quá hạn thu thêm: payments EXPIRED -> chuyển sang M_ManualExtra
      await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'EXTRA' && p.status === 'PENDING')
        .modify({ status: 'EXPIRED' });

      await this.enterWaitPoint(requestId, 'M_ManualExtra', actor);
    } else if (timerNodeId === 'GH_Timer') {
      // Quá hạn khách phản hồi đề xuất gia hạn: chuyển sang GH_NotifyOld
      await fn_notify_extension_old(requestId, actor, 'HET_HAN');
      await this.advance(requestId, 'GH_NotifyOld', undefined, actor);
    } else if (timerNodeId === 'GH_TimerPay') {
      // Quá hạn thanh toán QR gia hạn: hết hạn thanh toán, chuyển sang GH_NotifyOld
      await db.payments
        .where('request_id')
        .equals(requestId)
        .and((p) => p.kind === 'EXTENSION' && p.status === 'PENDING')
        .modify({ status: 'EXPIRED' });

      await fn_notify_extension_old(requestId, actor, 'HET_HAN');
      await this.advance(requestId, 'GH_NotifyOld', undefined, actor);
    } else if (timerNodeId === 'SC_AckTimer') {
      // Quá hạn đối tác nhận: đánh dấu dispatch TIMEOUT -> SC_TryNext
      const incident = await db.incidents
        .where('request_id')
        .equals(requestId)
        .reverse()
        .first();
      if (incident) {
        await db.incident_dispatches
          .where('incident_id')
          .equals(incident.id)
          .and((d) => d.status === 'SENT')
          .modify({ status: 'TIMEOUT' });
      }
      await logEvent(requestId, 'SC_AckTimer', 'TRIGGER_TIMER', actor);
      await this.advance(requestId, 'SC_AckTimer', 'Quá hạn', actor);
    } else if (timerNodeId === 'SC_ResultTimer') {
      // Quá hạn SLA hỗ trợ: cập nhật VUOT_SLA -> SC_Escalate
      const incident = await db.incidents
        .where('request_id')
        .equals(requestId)
        .reverse()
        .first();
      if (incident) {
        await db.incidents.update(incident.id, { status: 'VUOT_SLA' });
      }
      await logEvent(requestId, 'SC_ResultTimer', 'TRIGGER_TIMER', actor);
      await this.enterWaitPoint(requestId, 'SC_Escalate', actor);
    }
  }

  /**
   * Thực thi các nút tự động (Service Task, Business Rule Task, Exclusive Gateway)
   */
  private async executeAutomaticNode(requestId: string, nodeId: string, actor: Actor): Promise<string | undefined> {
    const state = await db.process_state.get(requestId);
    if (!state) throw new Error(`Không tìm thấy state của hồ sơ ${requestId}`);

    switch (nodeId) {
      // 1. TIẾP NHẬN & HỒ SƠ
      case 'M_CheckFleet': {
        const preferredType = state.variables.preferred_vehicle_type as string | undefined;
        const res = await fn_check_fleet(requestId, actor, preferredType);
        state.variables.found_vehicle_id = res.vehicle_id;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_G01': {
        return eval_M_G01(state.variables.found_vehicle_id as string | null);
      }

      case 'M_RejectNoVehicle': {
        await fn_reject_no_vehicle(requestId, actor);
        return undefined;
      }

      case 'M_SendTerms': {
        await fn_send_quote(requestId, actor);
        return undefined;
      }

      case 'M_CheckDocs': {
        const res = await fn_check_documents(requestId, actor);
        state.variables.docs_all_valid = res.allValid;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_G02': {
        return eval_M_G02(Boolean(state.variables.docs_all_valid));
      }

      case 'M_AskDocs': {
        const count = await fn_request_more_docs(requestId, actor);
        state.variables.doc_request_count = count;
        await db.process_state.put(state);
        return undefined;
      }

      case 'Gateway_0x0p273': {
        const count = Number(state.variables.doc_request_count || 0);
        const outcome = eval_Gateway_0x0p273(count);
        if (outcome === 'Có') {
          await fn_end_cancel(requestId, actor, 'HO_SO_KHONG_DAT');
        }
        return outcome;
      }

      // 2. ĐẶT CỌC & HỢP ĐỒNG
      case 'M_CreateDeposit': {
        await fn_create_deposit_qr(requestId, actor);
        return undefined;
      }

      case 'M_CheckDeposit': {
        const res = await fn_reconcile_deposit(requestId, actor);
        state.variables.deposit_match_result = res.match_result;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_G03': {
        return eval_M_G03(state.variables.deposit_match_result as 'DU' | 'THIEU' | 'SAI');
      }

      case 'M_G03b': {
        return (state.variables.last_manual_deposit_decision as 'Có' | 'Chưa') || 'Có';
      }

      case 'M_Contract': {
        await fn_generate_contract(requestId, actor);
        return undefined;
      }

      case 'M_CancelRefund': {
        await fn_cancel_and_refund(requestId, actor);
        return undefined;
      }

      case 'M_SaveBooking': {
        await fn_lock_schedule(requestId, actor);
        return undefined;
      }

      // 3. KIỂM TRA & BÀN GIAO
      case 'M_G04': {
        return eval_M_G04((state.variables.last_pre_inspect_result as 'DAT' | 'CHUA_DAT') || 'DAT');
      }

      case 'Activity_0w8x12e': {
        await fn_send_vehicle_condition(requestId, actor);
        return undefined;
      }

      case 'Gateway_0ixde68': {
        return eval_Gateway_0ixde68(Boolean(state.variables.last_customer_accepted));
      }

      case 'M_SetRented': {
        await fn_set_rented(requestId, actor);
        return undefined;
      }

      case 'M_CatchExtend': {
        await logEvent(requestId, 'M_CatchExtend', 'TRIGGER_EXTEND', actor);
        return undefined;
      }

      case 'M_CatchIncident': {
        await logEvent(requestId, 'M_CatchIncident', 'TRIGGER_INCIDENT', actor);
        return undefined;
      }

      case 'M_CatchReturn': {
        await db.rental_requests.update(requestId, { status: 'CHO_NHAN_XE_TRA' });
        await logEvent(requestId, 'M_CatchReturn', 'TRIGGER_RETURN', actor);
        return undefined;
      }

      case 'M_ReturnMerge': {
        await logEvent(requestId, 'M_ReturnMerge', 'MERGE_GATEWAY', actor);
        return undefined;
      }

      // 4. TRẢ XE, GIÁM ĐỊNH & BẢNG KÊ
      case 'M_DigitalCompare': {
        const res = await fn_compare_inspections(requestId, actor);
        state.variables.diff_items = res.diff_items;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_GDamage': {
        return eval_M_GDamage((state.variables.diff_items as Record<string, unknown>) || {});
      }

      case 'M_CalcFees': {
        await fn_calculate_fees(requestId, actor);
        return undefined;
      }

      case 'M_SendStatement': {
        await fn_send_statement(requestId, actor);
        return undefined;
      }

      case 'M_GDispute': {
        return eval_M_GDispute(
          (state.variables.last_statement_answer as 'CHAP_THUAN' | 'KHIEU_NAI') || 'CHAP_THUAN'
        );
      }

      case 'M_ApproveAdjustment': {
        state.loop_counters.dispute_count = (state.loop_counters.dispute_count || 0) + 1;
        await fn_apply_adjustment(requestId, actor);
        await db.process_state.put(state);
        return 'Gửi lại';
      }

      // 5. QUYẾT TOÁN
      case 'M_NetDeposit': {
        const settlement = await fn_net_deposit(requestId, actor);
        state.variables.settlement_balance = settlement.balance;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_GBalance': {
        return eval_M_GBalance(Number(state.variables.settlement_balance || 0));
      }

      case 'M_Refund': {
        await fn_create_refund(requestId, actor);
        return undefined;
      }

      case 'M_PayExtra': {
        await fn_create_extra_qr(requestId, actor);
        return undefined;
      }

      case 'M_VerifyExtra': {
        const res = await fn_reconcile_extra_payment(requestId, actor);
        state.variables.extra_match_result = res.match_result;
        await db.process_state.put(state);
        return undefined;
      }

      case 'M_GExtra': {
        return eval_M_GExtra(state.variables.extra_match_result as 'DU' | 'THIEU' | 'SAI');
      }

      case 'M_GExtraDecision': {
        return (
          (state.variables.last_extra_decision as 'Tiếp tục thanh toán' | 'Không / chưa thanh toán') ||
          'Tiếp tục thanh toán'
        );
      }

      case 'M_RecordDebt': {
        await fn_record_debt(requestId, actor);
        return undefined;
      }

      case 'M_GJoinBalance': {
        return undefined;
      }

      case 'M_Settle': {
        await fn_settle(requestId, actor);
        return undefined;
      }

      // 6. SAU TRẢ & LƯU HỒ SƠ
      case 'M_GReady': {
        return eval_M_GReady((state.variables.last_ready_result as 'DAT' | 'CAN_BAO_TRI') || 'DAT');
      }

      case 'M_Maintenance': {
        await fn_create_maintenance(requestId, actor);
        return undefined;
      }

      case 'M_MarkReady': {
        await fn_mark_ready(requestId, actor);
        return undefined;
      }

      case 'M_GStatus': {
        return undefined;
      }

      case 'M_Archive': {
        await fn_archive_case(requestId, actor);
        return undefined;
      }

      // 7. SUB-PROCESS SP1: GIA HẠN
      case 'GH_START': {
        return undefined;
      }

      case 'GH_GetRequest': {
        const newEndAt = (state.variables.extension_new_end_at as string) || clock.nowISO();
        await fn_record_extension(requestId, newEndAt, actor);
        return undefined;
      }

      case 'GH_Check': {
        const checkRes = await fn_check_extension_rule(requestId, actor);
        state.variables.is_extension_eligible = checkRes.eligible;
        await db.process_state.put(state);
        return undefined;
      }

      case 'GH_GEligible': {
        return eval_GH_GEligible(Boolean(state.variables.is_extension_eligible));
      }

      case 'GH_Offer': {
        const offerRes = await fn_offer_extension(requestId, actor);
        state.variables.extension_extra_fee = offerRes.extra_fee;
        await db.process_state.put(state);
        return undefined;
      }

      case 'GH_GAccept': {
        return eval_GH_GAccept(
          (state.variables.last_gh_accept as 'DONG_Y' | 'TU_CHOI') || 'DONG_Y'
        );
      }

      case 'GH_NeedPayment': {
        return eval_GH_NeedPayment(Number(state.variables.extension_extra_fee || 0));
      }

      case 'GH_CreateQR': {
        await fn_create_extension_qr(requestId, actor);
        return undefined;
      }

      case 'GH_Update': {
        await fn_apply_extension(requestId, actor);
        return undefined;
      }

      case 'GH_NotifyOK': {
        await fn_notify_extension_ok(requestId, actor);
        return undefined;
      }

      case 'GH_NotifyOld': {
        await fn_notify_extension_old(requestId, actor);
        return undefined;
      }

      case 'GH_GMerge': {
        return undefined;
      }

      // 8. SUB-PROCESS SP2: SỰ CỐ
      case 'SC_START': {
        return undefined;
      }

      case 'SC_Create': {
        const desc = (state.variables.incident_description as string) || 'Báo cáo sự cố xe';
        const incident = await fn_create_incident_ticket(requestId, actor, {
          description: desc,
          lat: state.variables.incident_lat as number | undefined,
          lng: state.variables.incident_lng as number | undefined,
          photo_urls: state.variables.incident_photo_urls as string[] | undefined,
        });
        state.variables.current_incident_id = incident.id;
        await db.process_state.put(state);
        return undefined;
      }

      case 'SC_Select': {
        const selRes = await fn_select_partner(requestId, actor);
        state.variables.selected_partner_id = selRes.partner_id;
        state.variables.sc_has_more_partners = Boolean(selRes.partner_id);
        await db.process_state.put(state);
        return undefined;
      }

      case 'SC_Dispatch': {
        await fn_dispatch_partner(requestId, actor);
        return undefined;
      }

      case 'SC_GAccept': {
        return eval_SC_GAccept(
          (state.variables.last_sc_accept as 'ACCEPTED' | 'DECLINED' | 'TIMEOUT') || 'ACCEPTED'
        );
      }

      case 'SC_TryNext': {
        const tryRes = await fn_try_next_partner(requestId, actor);
        state.variables.sc_has_more_partners = tryRes.hasMorePartners;
        await db.process_state.put(state);
        return undefined;
      }

      case 'SC_GRetry': {
        return eval_SC_GRetry(Boolean(state.variables.sc_has_more_partners));
      }

      case 'SC_Track': {
        await fn_track_incident(requestId, actor);
        return undefined;
      }

      case 'SC_GResolve': {
        return eval_SC_GResolve(
          (state.variables.last_sc_resolve as 'Có phương án' | 'Không') || 'Có phương án'
        );
      }

      case 'SC_SettleDecision': {
        return eval_SC_SettleDecision(state.variables.last_sc_continue_rental !== false);
      }

      case 'SC_SendContinue': {
        await fn_send_continue_rental(requestId, actor);
        return undefined;
      }

      case 'SC_NotifyEarly': {
        await fn_notify_early_return(requestId, actor);
        return undefined;
      }

      default:
        throw new Error(`[ProcessEngine] Nút tự động '${nodeId}' chưa được cấu hình hàm xử lý.`);
    }
  }

  /**
   * Xử lý khi quy trình chạm nút kết thúc
   */
  private async handleEndEvent(requestId: string, endNodeId: string, actor: Actor): Promise<void> {
    await db.process_state.update(requestId, {
      waiting_node_ids: [],
      updated_at: clock.nowISO(),
    });
    const endState = await db.process_state.get(requestId);
    if (endState) {
      void dataAdapter.pushProcessStateToCloud(endState, actor.id);
    }
    const endReq = await db.rental_requests.get(requestId);
    if (endReq) {
      void dataAdapter.pushToCloud('rental_requests', endReq);
    }

    await logEvent(requestId, endNodeId, 'END_PROCESS', actor);

    // Kích hoạt webhook No-Code khi hồ sơ chạm nút kết thúc
    await integrations.workflowHook.triggerWebhook({
      requestId,
      bpmnNodeId: endNodeId,
      event: 'END_PROCESS',
      timestamp: clock.nowISO(),
      data: { end_node: endNodeId, actor_role: actor.role },
    });
  }

  /**
   * Lấy danh sách việc đang chờ theo vai trò (dùng cho NV-01 và màn hình khách)
   */
  public async getPendingTasks(
    role: Actor['role'],
    customerId?: string
  ): Promise<Array<{ request_id: string; node_id: string; node_name: string }>> {
    const states = await db.process_state.toArray();
    const tasks: Array<{ request_id: string; node_id: string; node_name: string }> = [];

    for (const s of states) {
      if (role === 'khach_hang') {
        const req = await db.rental_requests.get(s.request_id);
        if (req && customerId && req.customer_id !== customerId) continue;
      }

      for (const nodeId of s.waiting_node_ids) {
        const allowedRoles = TASK_ROLE_MAP[nodeId] || [];
        if (allowedRoles.includes(role)) {
          const node = bpmnGraph.getNode(nodeId);
          tasks.push({
            request_id: s.request_id,
            node_id: nodeId,
            node_name: node?.name || nodeId,
          });
        }
      }
    }

    return tasks;
  }
}

/**
 * Lấy toàn bộ nhật ký sự kiện của một hồ sơ theo thứ tự thời gian
 */
export async function getTrace(requestId: string): Promise<ProcessEvent[]> {
  return db.process_events
    .where('request_id')
    .equals(requestId)
    .sortBy('created_at');
}

export const engine = new ProcessEngine();
