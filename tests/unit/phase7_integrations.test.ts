// tests/unit/phase7_integrations.test.ts
// Kiểm thử tự động Giai đoạn 7: Tích hợp bên ngoài (Notifier, VietQR, WorkflowHook)
// Bao gồm: Cơ chế thử lại (Retry), Xử lý quá thời gian (Timeout), Giảm cấp nhẹ nhàng (Graceful Degradation)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { db } from '@/db';
import { integrations } from '@/integrations';
import { safeExecuteWithRetry } from '@/integrations/client';
import { engine } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 7: Tích Hợp Bên Ngoài (External Integrations)', () => {
  beforeEach(async () => {
    await db.integration_logs.clear();
    // Đặt lại cấu hình về MOCK mặc định
    integrations.updateConfig({
      mode: 'MOCK',
      bankBin: '970436',
      accountNo: '0123456789',
      accountName: 'CTY TNHH MOTO CARE',
    });
  });

  describe('1. Cơ chế an toàn safeExecuteWithRetry (Retry & Timeout & Logging)', () => {
    it('Lệnh gọi thành công ngay lần đầu: Ghi nhận SUCCESS và 1 lần thử vào db.integration_logs', async () => {
      const res = await safeExecuteWithRetry({
        type: 'WEBHOOK',
        endpoint: 'https://test-webhook.org/ping',
        payload: { action: 'test_success' },
        timeoutMs: 1000,
        maxRetries: 2,
        action: async () => ({ status: 'ok', time: Date.now() }),
      });

      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.status).toBe('ok');

      // Kiểm tra bản ghi trong IndexedDB
      const logs = await db.integration_logs.toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].type).toBe('WEBHOOK');
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].attempt).toBe(1);
      expect(logs[0].endpoint).toBe('https://test-webhook.org/ping');
      expect(logs[0].payload).toEqual({ action: 'test_success' });
    });

    it('Lần đầu thất bại, lần 2 thành công: Thử lại thành công (attempt = 2) và ghi nhận cả RETRYING lẫn SUCCESS', async () => {
      let callCount = 0;
      const res = await safeExecuteWithRetry({
        type: 'EMAIL',
        endpoint: 'https://api.emailjs.com/v1.0/email/send',
        payload: { to: 'test@motocare.vn' },
        timeoutMs: 1000,
        maxRetries: 2,
        action: async () => {
          callCount++;
          if (callCount === 1) {
            throw new Error('Mạng chập chờn 503 Service Unavailable');
          }
          return { sent: true };
        },
      });

      expect(res.success).toBe(true);
      expect(callCount).toBe(2);

      const logs = (await db.integration_logs.toArray()).sort((a, b) => a.attempt - b.attempt);
      // Lần 1: RETRYING, Lần 2: SUCCESS
      expect(logs.length).toBe(2);
      expect(logs[0].status).toBe('RETRYING');
      expect(logs[1].status).toBe('SUCCESS');
      expect(logs[1].attempt).toBe(2);
    });

    it('Thất bại toàn bộ các lần thử: Không ném lỗi ra ngoài, trả về success=false và ghi nhận ERROR ở lần cuối', async () => {
      let callCount = 0;
      const res = await safeExecuteWithRetry({
        type: 'VIETQR',
        endpoint: 'https://api.vietqr.io/v2/generate',
        payload: { amount: 100000 },
        timeoutMs: 500,
        maxRetries: 2,
        action: async () => {
          callCount++;
          throw new Error('Connection Refused');
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Connection Refused');
      expect(callCount).toBe(3); // 1 lần đầu + 2 lần thử lại

      const logs = (await db.integration_logs.toArray()).sort((a, b) => a.attempt - b.attempt);
      // 2 lần RETRYING + 1 lần ERROR
      expect(logs.length).toBe(3);
      expect(logs[2].status).toBe('ERROR');
      expect(logs[2].attempt).toBe(3);
      expect(logs[2].error_message).toContain('Connection Refused');
    });

    it('Quá thời gian thực thi (Timeout): AbortController kích hoạt và trả về lỗi quá thời gian', async () => {
      const res = await safeExecuteWithRetry({
        type: 'WEBHOOK',
        endpoint: 'https://timeout.org/delay',
        payload: { slow: true },
        timeoutMs: 100, // 100ms timeout
        maxRetries: 0,
        action: async (signal) => {
          await new Promise((resolve, reject) => {
            const timer = setTimeout(resolve, 500);
            signal.addEventListener('abort', () => {
              clearTimeout(timer);
              reject(new Error('Yêu cầu đã bị hủy (Timeout quá hạn 100ms)'));
            });
          });
          return { slow: 'done' };
        },
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      const logs = await db.integration_logs.toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('ERROR');
    });
  });

  describe('2. Dịch vụ Thông Báo (Notifier)', () => {
    it('Chế độ MOCK: Gửi thông báo thành công, trả về messageId giả lập và ghi log', async () => {
      integrations.updateConfig({ mode: 'MOCK' });
      const res = await integrations.notifier.sendNotification({
        recipientEmail: 'khachhang@example.com',
        recipientName: 'Nguyễn Văn A',
        template: 'QUOTE',
        subject: '[Moto Care] Báo giá thuê xe #REQ-1234',
        content: 'Tổng chi phí dự kiến: 240,000 VND. Tiền cọc: 72,000 VND.',
        requestId: 'REQ-1234',
        bpmnNodeId: 'M_SendTerms',
      });

      expect(res.success).toBe(true);
      expect(res.channel).toBe('MOCK_EMAIL');
      expect(res.messageId).toContain('MOCK_MAIL_');

      const logs = await db.integration_logs.where({ type: 'EMAIL' }).toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].request_id).toBe('REQ-1234');
      expect(logs[0].bpmn_node_id).toBe('M_SendTerms');
    });
  });

  describe('3. Dịch vụ Chuẩn VietQR (Payment API)', () => {
    it('Chế độ MOCK: Sinh mã QR thanh toán nhanh với qr_data chuẩn và ghi log', async () => {
      integrations.updateConfig({ mode: 'MOCK' });
      const res = await integrations.paymentQr.generateQr({
        accountNo: '0123456789',
        accountName: 'CTY TNHH MOTO CARE',
        bankBin: '970436',
        amount: 500000,
        description: 'MC_DEP_123456_9999',
        requestId: 'REQ-5555',
        bpmnNodeId: 'M_CreateDeposit',
      });

      expect(res.success).toBe(true);
      expect(res.qrDataUrl).toBeDefined();
      expect(res.provider).toBe('LOCAL_MOCK_QR');

      const logs = await db.integration_logs.where({ type: 'VIETQR' }).toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('SUCCESS');
      expect(logs[0].request_id).toBe('REQ-5555');
      expect(logs[0].bpmn_node_id).toBe('M_CreateDeposit');
    });

    it('Chế độ LIVE: Tạo đường dẫn ảnh VietQR theo đúng format QuickLink chuẩn Napas 24/7', async () => {
      integrations.updateConfig({
        mode: 'LIVE',
        bankBin: '970436',
        accountNo: '0123456789',
        accountName: 'CTY TNHH MOTO CARE',
      });

      const res = await integrations.paymentQr.generateQr({
        accountNo: '0123456789',
        accountName: 'CTY TNHH MOTO CARE',
        bankBin: '970436',
        amount: 72000,
        description: 'MC_DEP_TEST_01',
        requestId: 'REQ-LIVE-01',
        bpmnNodeId: 'M_CreateDeposit',
      });

      expect(res.success).toBe(true);
      expect(res.provider).toBe('VIETQR_API');
      expect(res.qrDataUrl).toContain('https://img.vietqr.io/image/970436-0123456789-compact2.png');
      expect(res.qrDataUrl).toContain('amount=72000');
    });
  });

  describe('4. Dịch vụ Luồng No-Code Webhook (WorkflowHook)', () => {
    it('Chế độ MOCK: Kích hoạt webhook mô phỏng thành công với status 200', async () => {
      integrations.updateConfig({ mode: 'MOCK' });
      const res = await integrations.workflowHook.triggerWebhook({
        requestId: 'REQ-WH-01',
        bpmnNodeId: 'M_START',
        event: 'START_RENTAL_REQUEST',
        timestamp: new Date().toISOString(),
        data: { vehicleType: 'xe_so' },
      });

      expect(res.success).toBe(true);
      expect(res.statusCode).toBe(200);

      const logs = await db.integration_logs.where({ type: 'WEBHOOK' }).toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].status).toBe('SUCCESS');
    });
  });

  describe('5. Ràng buộc Giảm cấp nhẹ nhàng (Graceful Degradation) với BPMN Engine', () => {
    it('Khi dịch vụ tích hợp ngoài gặp lỗi hoặc sập mạng: Engine BPMN vẫn chạy trơn tru, không bị crash luồng', async () => {
      await seedDatabase();
      const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };

      // Giả lập notifier ném lỗi hỏng mạng
      const spyNotifier = vi.spyOn(integrations.notifier, 'sendNotification').mockResolvedValue({
        success: false,
        error: 'Network unreachable: 502 Bad Gateway',
        channel: 'EMAIL',
      });

      // Bắt đầu một quy trình thuê xe mới qua BPMN Engine kèm giấy tờ hợp lệ
      const reqId = await engine.start(customerActor, {
        customer_id: customerActor.id,
        vehicle_type: 'xe_so',
        start_at: '2026-12-01T08:00:00.000Z',
        end_at: '2026-12-03T08:00:00.000Z',
        documents: [
          { doc_type: 'CCCD_TRUOC', file_url: 'f1', is_valid: true },
          { doc_type: 'CCCD_SAU', file_url: 'f2', is_valid: true },
          { doc_type: 'BANG_LAI_TRUOC', file_url: 'f3', is_valid: true },
        ],
      });
      expect(reqId).toBeDefined();

      const req = await db.rental_requests.get(reqId);
      const state = await db.process_state.get(reqId);
      // Quy trình phải tiến đến CHO_COC và dừng ở điểm chờ M_WaitDeposit
      expect(req?.status).toBe('CHO_COC');
      expect(state?.waiting_node_ids).toContain('M_WaitDeposit');

      // Phục hồi spy
      spyNotifier.mockRestore();
    });
  });
});
