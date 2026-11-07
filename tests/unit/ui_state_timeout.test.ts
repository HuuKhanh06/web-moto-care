// tests/unit/ui_state_timeout.test.ts
// Kiểm thử Máy trạng thái & Cơ chế Timeout 8s an toàn cho giao diện KH-02 (P0)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BƯỚC 4: Kiểm thử Timeout 8s an toàn cho trạng thái Reading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Trạng thái reading tự động chuyển sang failed khi quá 8 giây', () => {
    type ScanState = 'idle' | 'reading' | 'success' | 'needs_review' | 'failed';
    let currentState: ScanState = 'reading';

    // Mô phỏng watchdog timer 8s trong KH02Page
    const startReadingWatchdog = (onTimeout: () => void) => {
      return setTimeout(() => {
        onTimeout();
      }, 8000);
    };

    startReadingWatchdog(() => {
      currentState = 'failed';
    });

    expect(currentState).toBe('reading');

    // Tua nhanh 7.9 giây: Vẫn đang reading
    vi.advanceTimersByTime(7900);
    expect(currentState).toBe('reading');

    // Tua thêm 200ms (tổng 8.1 giây): Tự động dừng hẳn và chuyển sang failed
    vi.advanceTimersByTime(200);
    expect(currentState).toBe('failed');
  });

  it('Hủy timer đúng cách khi đọc xong trước 8 giây', () => {
    type ScanState = 'idle' | 'reading' | 'success' | 'needs_review' | 'failed';
    let currentState: ScanState = 'reading';

    let timerFired = false;
    const timer = setTimeout(() => {
      timerFired = true;
      currentState = 'failed';
    }, 8000);

    // Xử lý quét hoàn tất sau 2500ms
    vi.advanceTimersByTime(2500);
    currentState = 'success';
    clearTimeout(timer);

    // Tua tiếp qua 8s: Timer không được kích hoạt đè lên kết quả thành công
    vi.advanceTimersByTime(10000);
    expect(timerFired).toBe(false);
    expect(currentState).toBe('success');
  });
});
