// src/lib/clock.ts
// Đồng hồ giả lập phục vụ quy trình BPMN & Demo tua nhanh thời gian

const STORAGE_KEY_OFFSET = 'motocare_clock_offset_ms';

class DemoClock {
  private offsetMs = 0;
  private listeners: Set<(now: Date) => void> = new Set();

  constructor() {
    this.loadOffset();
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY_OFFSET) {
          this.loadOffset();
          this.notify();
        }
      });
    }
  }

  private loadOffset(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY_OFFSET);
      if (saved) {
        const parsed = parseInt(saved, 10);
        this.offsetMs = isNaN(parsed) ? 0 : parsed;
      } else {
        this.offsetMs = 0;
      }
    }
  }

  private saveOffset(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY_OFFSET, this.offsetMs.toString());
    }
  }

  private notify(): void {
    const current = this.now();
    this.listeners.forEach((listener) => listener(current));
  }

  /**
   * Lấy thời điểm hiện tại của hệ thống (thời gian thật + offset)
   * TUYỆT ĐỐI KHÔNG dùng new Date() hay Date.now() trực tiếp trong engine/repo.
   */
  public now(): Date {
    return new Date(Date.now() + this.offsetMs);
  }

  /**
   * Lấy chuỗi ISO 8601 của thời gian hiện tại
   */
  public nowISO(): string {
    return this.now().toISOString();
  }

  /**
   * Lấy timestamp mili-giây
   */
  public timestamp(): number {
    return Date.now() + this.offsetMs;
  }

  /**
   * Tua nhanh thời gian thêm một số phút nhất định
   * @param minutes Số phút muốn tua nhanh
   */
  public advance(minutes: number): Date {
    this.offsetMs += minutes * 60 * 1000;
    this.saveOffset();
    this.notify();
    return this.now();
  }

  /**
   * Tua nhanh thời gian thêm số giờ
   */
  public advanceHours(hours: number): Date {
    return this.advance(hours * 60);
  }

  /**
   * Tua nhanh thời gian thêm số ngày
   */
  public advanceDays(days: number): Date {
    return this.advance(days * 24 * 60);
  }

  /**
   * Đặt thời gian mô phỏng về một mốc cụ thể
   */
  public set(targetDate: Date): Date {
    this.offsetMs = targetDate.getTime() - Date.now();
    this.saveOffset();
    this.notify();
    return this.now();
  }

  /**
   * Reset đồng hồ về thời gian thực tế
   */
  public reset(): Date {
    this.offsetMs = 0;
    this.saveOffset();
    this.notify();
    return this.now();
  }

  /**
   * Lấy độ lệch hiện tại (mili-giây)
   */
  public getOffsetMs(): number {
    return this.offsetMs;
  }

  /**
   * Đăng ký lắng nghe khi đồng hồ thay đổi offset
   */
  public subscribe(listener: (now: Date) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export const clock = new DemoClock();
