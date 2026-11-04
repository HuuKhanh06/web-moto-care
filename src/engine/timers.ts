// src/engine/timers.ts
// Quản lý Timer biên (Boundary Timers) chạy nền và quét tự động

import { db } from '@/db';
import { clock } from '@/lib/clock';
import { logEvent } from '@/db/repo';
import type { ProcessTimer } from '@/db/types';

export class TimerManager {
  private intervalId: NodeJS.Timeout | null = null;
  private onTriggerCallback?: (requestId: string, timerNodeId: string) => Promise<void>;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.sweepTimers();
      });
    }
  }

  /**
   * Bắt đầu vòng lặp quét timer mỗi 5 giây
   */
  public start(onTrigger: (requestId: string, timerNodeId: string) => Promise<void>): void {
    this.onTriggerCallback = onTrigger;
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = setInterval(() => {
      this.sweepTimers();
    }, 5000);
  }

  /**
   * Dừng quét timer
   */
  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Đăng ký một timer boundary cho một điểm chờ
   */
  public async registerTimer(
    requestId: string,
    bpmnNodeId: string,
    durationMinutes: number
  ): Promise<ProcessTimer> {
    const dueAt = new Date(clock.now().getTime() + durationMinutes * 60 * 1000).toISOString();

    const timer: ProcessTimer = {
      id: crypto.randomUUID(),
      request_id: requestId,
      bpmn_node_id: bpmnNodeId,
      due_at: dueAt,
      status: 'PENDING',
      created_at: clock.nowISO(),
    };

    await db.timers.add(timer);
    return timer;
  }

  /**
   * Hủy bỏ timer khi điểm chờ tương ứng được hoàn tất trước thời hạn
   */
  public async cancelTimer(requestId: string, bpmnNodeId: string): Promise<void> {
    await db.timers
      .where('request_id')
      .equals(requestId)
      .and((t) => t.bpmn_node_id === bpmnNodeId && t.status === 'PENDING')
      .modify({ status: 'CANCELLED' });
  }

  /**
   * Quét và kích hoạt các timer đã quá hạn
   */
  public async sweepTimers(): Promise<number> {
    const nowISO = clock.nowISO();
    const expiredTimers = await db.timers
      .where('status')
      .equals('PENDING')
      .and((t) => t.due_at <= nowISO)
      .toArray();

    for (const timer of expiredTimers) {
      // Đánh dấu đã kích hoạt
      await db.timers.update(timer.id, { status: 'TRIGGERED' });

      await logEvent(timer.request_id, timer.bpmn_node_id, 'TIMER_TRIGGERED', {
        id: 'system',
        role: 'system',
      });

      if (this.onTriggerCallback) {
        await this.onTriggerCallback(timer.request_id, timer.bpmn_node_id);
      }
    }

    return expiredTimers.length;
  }
}

export const timerManager = new TimerManager();


