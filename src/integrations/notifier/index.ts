// src/integrations/notifier/index.ts
// Hiện thực hóa Notifier (Gửi thông báo Email / Mock Notifier)

import { safeExecuteWithRetry } from '../client';
import type { INotifier, NotificationPayload, NotificationResult } from '../types';
import { getIntegrationConfig } from '@/config/integrations';

/**
 * Hiện thực gửi Email thật qua REST API (EmailJS hoặc Webhook email)
 */
export class RealEmailNotifier implements INotifier {
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const config = getIntegrationConfig();
    const endpoint = 'https://api.emailjs.com/api/v1.0/email/send';

    // Nếu người dùng chưa cấu hình public key, tự động chuyển về chế độ giả lập thông báo
    if (!config.emailPublicKey || !config.emailServiceId) {
      console.info(
        '[RealEmailNotifier] Chưa cấu hình EmailJS Public Key / Service ID trong Cài đặt. Tự động chuyển sang Mock Notifier an toàn.'
      );
      return new MockNotifier().sendNotification(payload);
    }

    const emailJsBody = {
      service_id: config.emailServiceId,
      template_id: config.emailTemplateId || 'template_motocare',
      user_id: config.emailPublicKey,
      template_params: {
        to_email: payload.recipientEmail,
        to_name: payload.recipientName,
        subject: payload.subject,
        message: payload.content,
        template_type: payload.template,
        request_id: payload.requestId || '',
        ...payload.data,
      },
    };

    const callRes = await safeExecuteWithRetry<{ messageId: string }>({
      type: 'EMAIL',
      endpoint,
      requestId: payload.requestId,
      bpmnNodeId: payload.bpmnNodeId,
      payload: emailJsBody,
      timeoutMs: 6000,
      maxRetries: 2,
      action: async (signal) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(emailJsBody),
          signal,
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`EmailJS trả lỗi ${res.status}: ${errText}`);
        }

        return { messageId: `EMAILJS_${Date.now()}` };
      },
    });

    if (callRes.success) {
      return {
        success: true,
        messageId: callRes.data?.messageId,
        channel: 'EMAIL',
      };
    }

    return {
      success: false,
      error: callRes.error,
      channel: 'EMAIL',
    };
  }
}

/**
 * Hiện thực Mock Notifier: Chạy 100% offline không cần internet hay khóa
 */
export class MockNotifier implements INotifier {
  async sendNotification(payload: NotificationPayload): Promise<NotificationResult> {
    const endpoint = 'mock://email.motocare.vn/dispatch';

    const callRes = await safeExecuteWithRetry<{ messageId: string }>({
      type: 'EMAIL',
      endpoint,
      requestId: payload.requestId,
      bpmnNodeId: payload.bpmnNodeId,
      payload: {
        to: payload.recipientEmail,
        name: payload.recipientName,
        template: payload.template,
        subject: payload.subject,
        content: payload.content,
      },
      timeoutMs: 2000,
      maxRetries: 1,
      action: async () => {
        // Giả lập độ trễ mạng tự nhiên 120ms
        await new Promise((r) => setTimeout(r, 120));
        return { messageId: `MOCK_MAIL_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` };
      },
    });

    return {
      success: callRes.success,
      messageId: callRes.data?.messageId,
      error: callRes.error,
      channel: 'MOCK_EMAIL',
    };
  }
}
