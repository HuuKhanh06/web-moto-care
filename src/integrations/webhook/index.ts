// src/integrations/webhook/index.ts
// Hiện thực hóa Workflow Hook (Webhook n8n / Make / Zapier / Mock Hook)

import { safeExecuteWithRetry } from '../client';
import type { IWorkflowHook, WorkflowHookPayload, WorkflowHookResult } from '../types';
import { getIntegrationConfig } from '@/config/integrations';

/**
 * Hiện thực Webhook thật gọi tới No-Code platform (n8n / Make / Zapier)
 */
export class RealWorkflowHook implements IWorkflowHook {
  async triggerWebhook(payload: WorkflowHookPayload): Promise<WorkflowHookResult> {
    const config = getIntegrationConfig();
    const endpoint = config.webhookUrl;

    if (!endpoint) {
      console.info(
        '[RealWorkflowHook] Chưa nhập URL Webhook trong Cài đặt. Tự động chuyển sang Mock Workflow Hook.'
      );
      return new MockWorkflowHook().triggerWebhook(payload);
    }

    const callRes = await safeExecuteWithRetry<{ statusCode: number; body?: unknown }>({
      type: 'WEBHOOK',
      endpoint,
      requestId: payload.requestId,
      bpmnNodeId: payload.bpmnNodeId,
      payload: { ...payload } as Record<string, unknown>,
      timeoutMs: 5000,
      maxRetries: 2,
      action: async (signal) => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-MotoCare-Event': payload.event,
          },
          body: JSON.stringify(payload),
          signal,
        });

        let body: unknown;
        try {
          body = await res.json();
        } catch {
          body = await res.text();
        }

        if (!res.ok) {
          throw new Error(`Webhook phản hồi mã lỗi HTTP: ${res.status}`);
        }

        return { statusCode: res.status, body };
      },
    });

    return {
      success: callRes.success,
      statusCode: callRes.data?.statusCode || (callRes.success ? 200 : 500),
      responseBody: callRes.data?.body,
      error: callRes.error,
      targetUrl: endpoint,
    };
  }
}

/**
 * Hiện thực Mock Webhook: Chạy offline không cần kết nối ngoài
 */
export class MockWorkflowHook implements IWorkflowHook {
  async triggerWebhook(payload: WorkflowHookPayload): Promise<WorkflowHookResult> {
    const endpoint = 'mock://webhook.n8n.cloud/webhook/motocare-process';

    const callRes = await safeExecuteWithRetry<{ statusCode: number; body: unknown }>({
      type: 'WEBHOOK',
      endpoint,
      requestId: payload.requestId,
      bpmnNodeId: payload.bpmnNodeId,
      payload: { ...payload } as Record<string, unknown>,
      timeoutMs: 1500,
      maxRetries: 1,
      action: async () => {
        await new Promise((r) => setTimeout(r, 100));
        return {
          statusCode: 200,
          body: { message: 'Mock Webhook Ack OK', event: payload.event, receivedAt: new Date().toISOString() },
        };
      },
    });

    return {
      success: callRes.success,
      statusCode: callRes.data?.statusCode || 200,
      responseBody: callRes.data?.body,
      error: callRes.error,
      targetUrl: endpoint,
    };
  }
}
