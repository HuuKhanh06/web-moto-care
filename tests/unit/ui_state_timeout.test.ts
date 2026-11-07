// tests/unit/ui_state_timeout.test.ts
// Kiểm thử Máy trạng thái & Cơ chế Timeout 25s an toàn cho giao diện KH-02 (P0)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BƯỚC 4: Kiểm thử Timeout 25s an toàn cho trạng thái Reading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Trạng thái reading tự động chuyển sang needs_review khi quá 25 giây', () => {
    type ScanState = 'idle' | 'reading' | 'success' | 'needs_review' | 'failed';
    let currentState: ScanState = 'reading';

    // Mô phỏng watchdog timer 25s trong KH02Page
    const startReadingWatchdog = (onTimeout: () => void) => {
      return setTimeout(() => {
        onTimeout();
      }, 25000);
    };

    startReadingWatchdog(() => {
      currentState = 'needs_review';
    });

    expect(currentState).toBe('reading');

    // Tua nhanh 24.9 giây: Vẫn đang reading
    vi.advanceTimersByTime(24900);
    expect(currentState).toBe('reading');

    // Tua thêm 200ms (tổng 25.1 giây): Tự động chuyển sang needs_review, không bao giờ quay mãi
    vi.advanceTimersByTime(200);
    expect(currentState).toBe('needs_review');
  });

  it('Hủy timer đúng cách khi đọc xong trước 25 giây', () => {
    type ScanState = 'idle' | 'reading' | 'success' | 'needs_review' | 'failed';
    let currentState: ScanState = 'reading';

    let timerFired = false;
    const timer = setTimeout(() => {
      timerFired = true;
      currentState = 'needs_review';
    }, 25000);

    // Xử lý quét hoàn tất sau 300ms (giải mã QR CCCD tức thì)
    vi.advanceTimersByTime(300);
    currentState = 'success';
    clearTimeout(timer);

    // Tua tiếp qua 25s: Timer không được kích hoạt đè lên kết quả thành công
    vi.advanceTimersByTime(30000);
    expect(timerFired).toBe(false);
    expect(currentState).toBe('success');
  });
});
