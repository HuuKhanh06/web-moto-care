// src/integrations/types.ts
// Các định nghĩa giao diện (interfaces) và kiểu dữ liệu chung cho hệ thống tích hợp

export type IntegrationType = 'EMAIL' | 'VIETQR' | 'WEBHOOK';
export type IntegrationStatus = 'SUCCESS' | 'ERROR' | 'RETRYING';

// ==============================================================
// 1. TÍCH HỢP A: GỬI THÔNG BÁO (NOTIFIER)
// ==============================================================
export interface NotificationPayload {
  recipientEmail: string;
  recipientName: string;
  template:
    | 'QUOTE'
    | 'DOCS_REQ'
    | 'DEPOSIT_EXP'
    | 'STATEMENT'
    | 'REFUND'
    | 'INCIDENT';
  subject: string;
  content: string;
  data?: Record<string, unknown>;
  requestId?: string;
  bpmnNodeId?: string;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: 'EMAIL' | 'MOCK_EMAIL';
}

export interface INotifier {
  sendNotification(payload: NotificationPayload): Promise<NotificationResult>;
}

// ==============================================================
// 2. TÍCH HỢP B: TẠO MÃ QR THANH TOÁN (PAYMENT QR / VIETQR)
// ==============================================================
export interface QrGenerationParams {
  accountNo: string;
  accountName: string;
  bankBin: string;
  amount: number;
  description: string;
  template?: 'compact' | 'compact2' | 'qr_only' | 'print';
  requestId?: string;
  bpmnNodeId?: string;
}

export interface QrGenerationResult {
  success: boolean;
  qrDataUrl: string; // Data URL ảnh QR base64 hoặc URL trực tiếp
  qrText: string;    // Chuỗi text mã hóa chuẩn VietQR
  provider: 'VIETQR_API' | 'LOCAL_MOCK_QR';
  error?: string;
}

export interface IPaymentQrGenerator {
  generateQr(params: QrGenerationParams): Promise<QrGenerationResult>;
}

// ==============================================================
// 3. TÍCH HỢP C: GỌI WORKFLOW NO-CODE (WORKFLOW HOOK)
// ==============================================================
export interface WorkflowHookPayload {
  requestId: string;
  bpmnNodeId: string;
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface WorkflowHookResult {
  success: boolean;
  statusCode?: number;
  responseBody?: unknown;
  error?: string;
  targetUrl: string;
}

export interface IWorkflowHook {
  triggerWebhook(payload: WorkflowHookPayload): Promise<WorkflowHookResult>;
}

