// src/config/integrations.ts
// Cấu hình tài khoản ngân hàng thụ hưởng, khóa API và các tham số tích hợp bên ngoài

export interface IntegrationConfig {
  mode: 'MOCK' | 'LIVE';
  // Ngân hàng VietQR
  bankName: string;
  bankBin: string;
  accountNo: string;
  accountName: string;
  vietQrApiUrl: string;
  vietQrClientId?: string;
  vietQrApiKey?: string;
  // Email (EmailJS / Webhook)
  emailServiceId?: string;
  emailTemplateId?: string;
  emailPublicKey?: string;
  notificationEmail?: string;
  // Webhook workflow No-Code (n8n / Make / Zapier)
  webhookUrl?: string;
}

const STORAGE_KEY = 'motocare_integration_config';

export const DEFAULT_INTEGRATION_CONFIG: IntegrationConfig = {
  mode: (import.meta.env.VITE_INTEGRATION_MODE as 'MOCK' | 'LIVE') || 'MOCK',
  bankName: 'Vietcombank (Napas 247)',
  bankBin: '970436', // Mã BIN Vietcombank chuẩn Napas
  accountNo: '9911120060',
  accountName: 'NGUYEN HUU KHANH',
  vietQrApiUrl: 'https://api.vietqr.io/v2/generate',
  vietQrClientId: import.meta.env.VITE_VIETQR_CLIENT_ID || '',
  vietQrApiKey: import.meta.env.VITE_VIETQR_API_KEY || '',
  emailServiceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  emailTemplateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  emailPublicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
  notificationEmail: import.meta.env.VITE_NOTIFICATION_EMAIL || 'motocare.demo@gmail.com',
  webhookUrl: import.meta.env.VITE_WORKFLOW_WEBHOOK_URL || '',
};

/**
 * Lấy cấu hình tích hợp hiện hành (kết hợp biến môi trường và thiết lập tạm thời trong sessionStorage)
 */
export function getIntegrationConfig(): IntegrationConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_INTEGRATION_CONFIG, ...parsed };
    }
  } catch (err) {
    console.warn('Lỗi đọc cấu hình tích hợp từ storage, dùng cấu hình mặc định:', err);
  }
  return { ...DEFAULT_INTEGRATION_CONFIG };
}

/**
 * Lưu cấu hình tích hợp (lưu tạm thời vào sessionStorage và localStorage phía client)
 */
export function saveIntegrationConfig(config: Partial<IntegrationConfig>): IntegrationConfig {
  const current = getIntegrationConfig();
  const updated: IntegrationConfig = { ...current, ...config };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Không thể lưu cấu hình tích hợp vào storage:', err);
  }
  return updated;
}

