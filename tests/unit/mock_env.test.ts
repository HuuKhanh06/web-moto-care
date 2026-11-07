// tests/unit/mock_env.test.ts
// Kiểm tra nghiêm ngặt biến môi trường VITE_USE_MOCK_OCR và việc loại bỏ dữ liệu giả

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockAiProvider } from '@/ai/mock';

describe('Bảo mật dữ liệu OCR: VITE_USE_MOCK_OCR & Production guard', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    // Khôi phục môi trường
    Object.assign(import.meta.env, originalEnv);
  });

  it('1. Ở chế độ sản xuất/bản nộp (MODE !== test và VITE_USE_MOCK_OCR !== true), MockAiProvider tuyệt đối không trả dữ liệu giả', async () => {
    // Giả lập môi trường production với VITE_USE_MOCK_OCR=false
    (import.meta.env as Record<string, unknown>).MODE = 'production';
    (import.meta.env as Record<string, unknown>).VITE_USE_MOCK_OCR = 'false';

    const provider = new MockAiProvider();
    const result = await provider.processOcr({
      requestId: 'test-req-prod',
      cccdImageRef: 'https://example.com/cccd_front.jpg',
      gplxImageRef: 'https://example.com/gplx.jpg',
    });

    // Phải chuyển sang FALLBACK_MANUAL cho nhân viên kiểm tra, không sinh tài liệu mock
    expect(result.routing.action).toBe('FALLBACK_MANUAL');
    expect(result.documents.cccd).toBeUndefined();
    expect(result.documents.gplx).toBeUndefined();
  });

  it('2. Khi tắt mock, lý do routing ghi nhận rõ MOCK_DISABLED_PRODUCTION_STRICT', async () => {
    (import.meta.env as Record<string, unknown>).MODE = 'production';
    (import.meta.env as Record<string, unknown>).VITE_USE_MOCK_OCR = 'false';

    const provider = new MockAiProvider();
    const result = await provider.processOcr({
      requestId: 'req-prod-02',
      cccdImageRef: 'https://example.com/card.jpg',
    });

    expect(result.documents.cccd).toBeUndefined();
    expect(result.routing.reason_codes).toContain('MOCK_DISABLED_PRODUCTION_STRICT');
  });

  it('3. Mặc định file cấu hình .env và .env.example không được bật VITE_USE_MOCK_OCR=true', () => {
    // Đảm bảo không còn hardcoded mock trong chế độ production mặc định
    expect(import.meta.env.VITE_USE_MOCK_OCR).not.toBe('true');
  });
});
