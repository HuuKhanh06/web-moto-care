// src/integrations/client.ts
// Bộ thực thi lệnh tích hợp an toàn: Hỗ trợ Timeout, Tự động thử lại (Retry),
// Ghi nhận nhật ký IndexedDB và Không làm gián đoạn quy trình (Graceful Degradation).

import { db } from '@/db';
import { clock } from '@/lib/clock';
import type { IntegrationType, IntegrationStatus } from './types';

export interface ExecuteCallOptions<T> {
  type: IntegrationType;
  endpoint: string;
  requestId?: string;
  bpmnNodeId?: string;
  payload: Record<string, unknown> | string;
  timeoutMs?: number;
  maxRetries?: number;
  action: (signal: AbortSignal, attempt: number) => Promise<T>;
}

export interface ExecuteCallResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  durationMs: number;
}

/**
 * Thực thi một tác vụ gọi ra ngoài an toàn có timeout, retry và ghi log
 */
export async function safeExecuteWithRetry<T>(
  options: ExecuteCallOptions<T>
): Promise<ExecuteCallResult<T>> {
  const {
    type,
    endpoint,
    requestId,
    bpmnNodeId,
    payload,
    timeoutMs = 5000,
    maxRetries = 2,
    action,
  } = options;

  let lastError: Error | null = null;
  const startTime = Date.now();
  const totalAttempts = maxRetries + 1;
  let executedAttempts = 0;

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    executedAttempts = attempt;
    const isLastAttempt = attempt === totalAttempts;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const attemptStart = Date.now();

    try {
      // Thực thi hành động tích hợp
      const result = await action(controller.signal, attempt);
      clearTimeout(timer);

      const durationMs = Date.now() - attemptStart;

      // Ghi log thành công vào db.integration_logs
      await logIntegrationEvent({
        type,
        endpoint,
        status: 'SUCCESS',
        attempt,
        duration_ms: durationMs,
        request_id: requestId,
        bpmn_node_id: bpmnNodeId,
        payload,
        response: result as Record<string, unknown>,
      });

      return {
        success: true,
        data: result,
        attempts: attempt,
        durationMs: Date.now() - startTime,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      const isAbort = controller.signal.aborted;
      const errMsg = isAbort
        ? `Quá thời gian chờ phản hồi (Timeout ${timeoutMs}ms)`
        : err instanceof Error
        ? err.message
        : 'Lỗi không xác định khi gọi tích hợp ngoài';

      lastError = new Error(errMsg);
      const durationMs = Date.now() - attemptStart;
      const status: IntegrationStatus = isLastAttempt ? 'ERROR' : 'RETRYING';

      // Ghi log lỗi vào db.integration_logs
      await logIntegrationEvent({
        type,
        endpoint,
        status,
        attempt,
        duration_ms: durationMs,
        request_id: requestId,
        bpmn_node_id: bpmnNodeId,
        payload,
        error_message: errMsg,
      });

      // Nếu còn lượt thử lại, nghỉ ngắn một khoảng trước khi retry
      if (!isLastAttempt) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }

  // Graceful degradation: Không throw lỗi ra ngoài để bảo vệ động cơ BPMN
  return {
    success: false,
    error: lastError?.message || 'Gọi tích hợp bên ngoài thất bại sau tất cả các lần thử',
    attempts: executedAttempts,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Ghi bản ghi vào bảng db.integration_logs
 */
async function logIntegrationEvent(entry: {
  type: IntegrationType;
  endpoint: string;
  status: IntegrationStatus;
  attempt: number;
  duration_ms: number;
  request_id?: string;
  bpmn_node_id?: string;
  payload: Record<string, unknown> | string;
  response?: Record<string, unknown> | string;
  error_message?: string;
}): Promise<void> {
  try {
    await db.integration_logs.add({
      id: crypto.randomUUID(),
      type: entry.type,
      endpoint: entry.endpoint,
      status: entry.status,
      attempt: entry.attempt,
      duration_ms: entry.duration_ms,
      request_id: entry.request_id,
      bpmn_node_id: entry.bpmn_node_id,
      payload: entry.payload,
      response: entry.response,
      error_message: entry.error_message,
      created_at: clock.nowISO(),
    });
  } catch (err) {
    console.warn('Không thể ghi log tích hợp vào IndexedDB:', err);
  }
}
