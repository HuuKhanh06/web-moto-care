// src/integrations/index.ts
// Lớp cổng giao tiếp chung (Integration Facade) cho toàn bộ ứng dụng MOTO CARE

import {
  getIntegrationConfig,
  saveIntegrationConfig,
  type IntegrationConfig,
} from '@/config/integrations';
import type { INotifier, IPaymentQrGenerator, IWorkflowHook } from './types';
import { RealEmailNotifier, MockNotifier } from './notifier';
import { RealVietQrGenerator, MockPaymentQrGenerator } from './qr';
import { RealWorkflowHook, MockWorkflowHook } from './webhook';

class IntegrationService {
  private realNotifier: INotifier = new RealEmailNotifier();
  private mockNotifier: INotifier = new MockNotifier();

  private realPaymentQr: IPaymentQrGenerator = new RealVietQrGenerator();
  private mockPaymentQr: IPaymentQrGenerator = new MockPaymentQrGenerator();

  private realWorkflowHook: IWorkflowHook = new RealWorkflowHook();
  private mockWorkflowHook: IWorkflowHook = new MockWorkflowHook();

  /**
   * Bộ gửi thông báo (Notifier) tự động chọn kênh theo cấu hình hiện tại
   */
  get notifier(): INotifier {
    const config = getIntegrationConfig();
    return config.mode === 'LIVE' ? this.realNotifier : this.mockNotifier;
  }

  /**
   * Bộ sinh mã VietQR tự động chọn kênh theo cấu hình hiện tại
   */
  get paymentQr(): IPaymentQrGenerator {
    const config = getIntegrationConfig();
    return config.mode === 'LIVE' ? this.realPaymentQr : this.mockPaymentQr;
  }

  /**
   * Bộ Webhook gọi No-Code workflow TP2 tự động chọn kênh theo cấu hình hiện tại
   */
  get workflowHook(): IWorkflowHook {
    const config = getIntegrationConfig();
    return config.mode === 'LIVE' ? this.realWorkflowHook : this.mockWorkflowHook;
  }

  /**
   * Lấy cấu hình tích hợp hiện hành
   */
  getConfig(): IntegrationConfig {
    return getIntegrationConfig();
  }

  /**
   * Cập nhật cấu hình tích hợp
   */
  updateConfig(updates: Partial<IntegrationConfig>): IntegrationConfig {
    return saveIntegrationConfig(updates);
  }

  /**
   * Đổi chế độ hoạt động LIVE hoặc MOCK
   */
  setMode(mode: 'LIVE' | 'MOCK'): void {
    saveIntegrationConfig({ mode });
  }

  /**
   * Lấy chế độ hoạt động hiện hành
   */
  getMode(): 'LIVE' | 'MOCK' {
    return getIntegrationConfig().mode;
  }
}

export const integrations = new IntegrationService();
export * from './types';

