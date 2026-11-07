// Kiểm thử chống trùng xe: một xe không được gán cho hai hồ sơ có khoảng thuê giao nhau
// khi cả hai đang hoạt động (đang chờ xử lý hoặc đã cho thuê).

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { engine } from '@/engine';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { timerManager } from '@/engine/timers';
import { fn_end_cancel, fn_lock_schedule } from '@/engine/fn';
import type { Actor } from '@/db/types';

const customer: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };
const system: Actor = { id: 'system', role: 'system' };
const staff: Actor = { id: SEED_USERS[1].id, role: 'nhan_vien' };
const DOCS = [
  { doc_type: 'CCCD_TRUOC', file_url: 'data:image/png;base64,mock_cccd_front', is_valid: true },
  { doc_type: 'CCCD_SAU', file_url: 'data:image/png;base64,mock_cccd_back', is_valid: true },
  { doc_type: 'BANG_LAI_TRUOC', file_url: 'data:image/png;base64,mock_gplx_front', is_valid: true },
] as const;

/** Chỉ để lại `count` xe côn tay sẵn sàng để dễ quan sát việc gán trùng. */
async function keepOnlyConTay(count: number) {
  const all = await db.vehicles.toArray();
  const conTay = all.filter(v => v.vehicle_type === 'xe_con');
  for (const v of all) if (v.vehicle_type !== 'xe_con') await db.vehicles.update(v.id, { status: 'BAO_TRI' });
  for (const [i, v] of conTay.entries()) await db.vehicles.update(v.id, { status: i < count ? 'SAN_SANG' : 'BAO_TRI' });
  return conTay.slice(0, count).map(v => v.id);
}

const book = (start: string, end: string, documents = true) => engine.start(customer, {
  customer_id: customer.id, vehicle_type: 'xe_con', start_at: start, end_at: end, ...(documents ? { documents: [...DOCS] } : {}),
});

describe('Chống trùng xe giữa các hồ sơ', () => {
  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    timerManager.stop();
    await seedDatabase();
  });

  it('hai hồ sơ đang chờ xử lý cùng khung giờ không được gán cùng một xe', async () => {
    await keepOnlyConTay(2);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-02T08:00:00.000Z', '2026-12-04T08:00:00.000Z');
    const [ra, rb] = await Promise.all([db.rental_requests.get(a), db.rental_requests.get(b)]);
    expect(ra?.vehicle_id).toBeTruthy();
    expect(rb?.vehicle_id).toBeTruthy();
    expect(rb?.vehicle_id).not.toBe(ra?.vehicle_id);
  });

  it('hết xe trống thì hồ sơ sau bị từ chối HET_XE thay vì gán trùng', async () => {
    await keepOnlyConTay(1);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-02T08:00:00.000Z', '2026-12-04T08:00:00.000Z');
    expect((await db.rental_requests.get(a))?.vehicle_id).toBeTruthy();
    const rb = await db.rental_requests.get(b);
    expect(rb?.status).toBe('TU_CHOI');
    expect(rb?.closed_reason).toBe('HET_XE');
  });

  it('khung giờ không giao nhau vẫn dùng chung được một xe', async () => {
    const [only] = await keepOnlyConTay(1);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-03T08:00:00.000Z', '2026-12-05T08:00:00.000Z');
    expect((await db.rental_requests.get(a))?.vehicle_id).toBe(only);
    expect((await db.rental_requests.get(b))?.vehicle_id).toBe(only);
  });

  it('hồ sơ đã hủy trả xe lại cho hồ sơ khác', async () => {
    const [only] = await keepOnlyConTay(1);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    await fn_end_cancel(a, system, 'KHACH_HUY');
    const b = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    expect((await db.rental_requests.get(b))?.vehicle_id).toBe(only);
  });

  it('lịch đã khóa của hồ sơ bị hủy không còn chặn xe', async () => {
    const [only] = await keepOnlyConTay(1);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    await db.vehicle_schedule.add({ id: 'ghost', vehicle_id: only, request_id: a, kind: 'RENTAL', start_at: '2026-12-01T08:00:00.000Z', end_at: '2026-12-03T08:00:00.000Z' });
    await fn_end_cancel(a, system, 'KHACH_HUY');
    const b = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    expect((await db.rental_requests.get(b))?.vehicle_id).toBe(only);
  });

  it('hồ sơ bỏ dở ở bước nộp giấy tờ chỉ giữ xe trong thời hạn giữ chỗ', async () => {
    const [only] = await keepOnlyConTay(1);
    // Không nộp giấy tờ: hồ sơ dừng ở CHO_HO_SO (chưa có hẹn giờ nào tự hủy).
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z', false);
    expect((await db.rental_requests.get(a))?.status).toBe('CHO_HO_SO');
    const blocked = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z', false);
    expect((await db.rental_requests.get(blocked))?.closed_reason).toBe('HET_XE');
    clock.advance(31);
    const later = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z', false);
    expect((await db.rental_requests.get(later))?.vehicle_id).toBe(only);
  });

  it('khóa lịch phát hiện xe đã bị giữ cho hồ sơ khác và tự chuyển sang xe trống cùng dòng', async () => {
    const [first, second] = await keepOnlyConTay(2);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-05T08:00:00.000Z', '2026-12-07T08:00:00.000Z');
    expect((await db.rental_requests.get(a))?.vehicle_id).toBe(first);
    // Giả lập xung đột (vd. đồng bộ từ thiết bị khác): B bị gán trùng xe của A với khoảng giao nhau.
    await db.rental_requests.update(b, { vehicle_id: first, start_at: '2026-12-02T08:00:00.000Z', end_at: '2026-12-04T08:00:00.000Z' });
    await fn_lock_schedule(b, system);
    expect((await db.rental_requests.get(b))?.vehicle_id).toBe(second);
    expect((await db.vehicle_schedule.where('request_id').equals(b).first())?.vehicle_id).toBe(second);
  });

  it('khóa lịch báo lỗi rõ ràng khi không còn xe để thay thế', async () => {
    const [only] = await keepOnlyConTay(1);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-05T08:00:00.000Z', '2026-12-07T08:00:00.000Z');
    await db.rental_requests.update(b, { vehicle_id: only, start_at: '2026-12-02T08:00:00.000Z', end_at: '2026-12-04T08:00:00.000Z' });
    expect((await db.rental_requests.get(a))?.vehicle_id).toBe(only);
    await expect(fn_lock_schedule(b, system)).rejects.toThrow('không còn xe cùng dòng');
    expect(await db.vehicle_schedule.where('request_id').equals(b).count()).toBe(0);
  });

  it('NV-03 không cho đổi sang xe đang giữ cho hồ sơ khác trong cùng khung giờ', async () => {
    const [first, second] = await keepOnlyConTay(2);
    const a = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    const b = await book('2026-12-01T08:00:00.000Z', '2026-12-03T08:00:00.000Z');
    expect((await db.rental_requests.get(a))?.vehicle_id).toBe(first);
    expect((await db.rental_requests.get(b))?.vehicle_id).toBe(second);
    const payment = await db.payments.where('request_id').equals(a).first();
    await engine.complete(a, 'M_WaitDeposit', { paid_amount: payment!.amount }, customer);
    await engine.complete(a, 'M_WaitSign', { signature_url: 'data:sig' }, customer);
    await engine.complete(a, 'M_InspectPre', { result: 'CHUA_DAT', checklist: { brakes: false }, attempt_no: 1 }, staff);
    await expect(engine.complete(a, 'M_Rework', { rework_note: 'Đổi xe', new_vehicle_id: second }, staff)).rejects.toThrow('Xe thay thế');
    expect((await db.rental_requests.get(a))?.vehicle_id).toBe(first);
  });
});

