// src/integrations/qr/index.ts
// Hiện thực hóa Payment QR (VietQR chuẩn Napas / Mock QR Generator)

import QRCode from 'qrcode';
import { safeExecuteWithRetry } from '../client';
import type { IPaymentQrGenerator, QrGenerationParams, QrGenerationResult } from '../types';

/**
 * Tạo chuỗi text chuẩn định dạng VietQR EMVCo cơ bản
 */
export function buildVietQrPayloadText(params: QrGenerationParams): string {
  const { accountNo, bankBin, amount, description } = params;
  return `00020101021238540010A00000072701240006${bankBin}01${accountNo.length.toString().padStart(2, '0')}${accountNo}530370454${amount.toString().length.toString().padStart(2, '0')}${amount}5802VN62${description.length.toString().padStart(2, '0')}${description}6304`;
}

/**
 * Hiện thực gọi API VietQR thật từ dịch vụ ảnh công khai (https://img.vietqr.io)
 */
export class RealVietQrGenerator implements IPaymentQrGenerator {
  async generateQr(params: QrGenerationParams): Promise<QrGenerationResult> {
    const {
      accountNo,
      accountName,
      bankBin,
      amount,
      description,
      template = 'compact2',
      requestId,
      bpmnNodeId,
    } = params;

    // VietQR Quick Link URL công khai được Napas và các ngân hàng Việt Nam hỗ trợ
    const endpoint = `https://img.vietqr.io/image/${bankBin}-${accountNo}-${template}.png?amount=${amount}&addInfo=${encodeURIComponent(
      description
    )}&accountName=${encodeURIComponent(accountName)}`;

    const callRes = await safeExecuteWithRetry<{ qrDataUrl: string; qrText: string }>({
      type: 'VIETQR',
      endpoint,
      requestId,
      bpmnNodeId,
      payload: {
        accountNo,
        accountName,
        bankBin,
        amount,
        description,
        template,
      },
      timeoutMs: 5000,
      maxRetries: 2,
      action: async () => {
        const qrText = buildVietQrPayloadText(params);
        return {
          qrDataUrl: endpoint,
          qrText,
        };
      },
    });

    if (callRes.success && callRes.data) {
      return {
        success: true,
        qrDataUrl: callRes.data.qrDataUrl,
        qrText: callRes.data.qrText,
        provider: 'VIETQR_API',
      };
    }

    // Fallback sang Mock QR nội bộ nếu mạng ngoài trục trặc
    console.warn('[RealVietQrGenerator] Lỗi gọi VietQR API ngoài, tự động fallback sang Local QR:', callRes.error);
    const mockRes = await new MockPaymentQrGenerator().generateQr(params);
    return {
      ...mockRes,
      error: `Fallback do API ngoài lỗi: ${callRes.error}`,
    };
  }
}

/**
 * Hiện thực Mock QR Generator: Tạo mã QR hoàn toàn tại trình duyệt (Offline)
 */
export class MockPaymentQrGenerator implements IPaymentQrGenerator {
  async generateQr(params: QrGenerationParams): Promise<QrGenerationResult> {
    const endpoint = 'local://qrcode.generator';
    const qrText = buildVietQrPayloadText(params);

    const callRes = await safeExecuteWithRetry<{ qrDataUrl: string }>({
      type: 'VIETQR',
      endpoint,
      requestId: params.requestId,
      bpmnNodeId: params.bpmnNodeId,
      payload: {
        accountNo: params.accountNo,
        amount: params.amount,
        description: params.description,
      },
      timeoutMs: 2000,
      maxRetries: 1,
      action: async () => {
        // Sinh ảnh Base64 bằng thư viện qrcode
        const dataUrl = await QRCode.toDataURL(qrText, {
          width: 250,
          margin: 1,
          color: {
            dark: '#0B3D26', // Tông xanh lá đậm Moto Care
            light: '#FFFFFF',
          },
        });
        return { qrDataUrl: dataUrl };
      },
    });

    return {
      success: callRes.success,
      qrDataUrl: callRes.data?.qrDataUrl || '',
      qrText,
      provider: 'LOCAL_MOCK_QR',
      error: callRes.error,
    };
  }
}
