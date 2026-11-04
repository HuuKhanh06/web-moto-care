// tests/unit/database.test.ts
// Kiểm thử nghiệp vụ Dexie, Ràng buộc Repository, Quyền Actor, Đồng hồ Demo & Backup

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import {
  scheduleRepo,
  inspectionRepo,
  handoverRepo,
  paymentRepo,
  rentalRepo,
  logEvent,
  ConstraintViolationError,
  PermissionDeniedError,
} from '@/db/repo';
import { seedDatabase } from '@/db/seed';
import { exportDatabase, importDatabase } from '@/db/backup';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 1: Kiểm thử Tầng Dữ liệu, Ràng buộc Repository & Đồng hồ Demo', () => {
  const staffActor: Actor = { id: 'staff-uuid-1', role: 'nhan_vien' };
  const customerActor: Actor = { id: 'cust-uuid-1', role: 'khach_hang' };
  const otherCustomerActor: Actor = { id: 'cust-uuid-2', role: 'khach_hang' };

  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
  });

  // 1. Đồng hồ demo
  it('Đồng hồ Demo: clock.now() hoạt động chính xác và hàm advance() cộng đúng phút', () => {
    const initial = clock.now().getTime();
    clock.advance(60); // +1 giờ
    const advanced = clock.now().getTime();

    expect(advanced - initial).toBeGreaterThanOrEqual(60 * 60 * 1000 - 100);
    expect(advanced - initial).toBeLessThanOrEqual(60 * 60 * 1000 + 100);

    clock.reset();
    expect(clock.getOffsetMs()).toBe(0);
  });

  // 2. Chống trùng lịch xe (vehicle_schedule)
  it('Ràng buộc vehicle_schedule: chặn hai khoảng thời gian chồng lấn trên cùng vehicle_id', async () => {
    const vehicleId = 'veh-123';

    // Tạo lịch thứ nhất: từ 10:00 đến 14:00
    await scheduleRepo.add(staffActor, {
      vehicle_id: vehicleId,
      kind: 'RENTAL',
      start_at: '2026-11-05T10:00:00.000Z',
      end_at: '2026-11-05T14:00:00.000Z',
    });

    // Cố tình tạo lịch thứ hai bị chồng lấn: từ 12:00 đến 16:00 -> PHẢI BỊ LỖI
    await expect(
      scheduleRepo.add(staffActor, {
        vehicle_id: vehicleId,
        kind: 'RENTAL',
        start_at: '2026-11-05T12:00:00.000Z',
        end_at: '2026-11-05T16:00:00.000Z',
      })
    ).rejects.toThrow(ConstraintViolationError);

    // Tạo lịch không chồng lấn: từ 15:00 đến 18:00 -> Thành công
    const validSchedule = await scheduleRepo.add(staffActor, {
      vehicle_id: vehicleId,
      kind: 'MAINTENANCE',
      start_at: '2026-11-05T15:00:00.000Z',
      end_at: '2026-11-05T18:00:00.000Z',
    });

    expect(validSchedule.id).toBeDefined();
  });

  // 3. Ràng buộc duy nhất inspections (request_id, kind, attempt_no)
  it('Ràng buộc inspections: duy nhất theo (request_id, kind, attempt_no)', async () => {
    const reqId = 'req-inspect-1';

    await inspectionRepo.add(staffActor, {
      request_id: reqId,
      vehicle_id: 'veh-1',
      kind: 'PRE_HANDOVER',
      attempt_no: 1,
      result: 'DAT',
    });

    // Cố tình thêm lại cùng request_id, kind, attempt_no -> PHẢI LỖI
    await expect(
      inspectionRepo.add(staffActor, {
        request_id: reqId,
        vehicle_id: 'veh-1',
        kind: 'PRE_HANDOVER',
        attempt_no: 1,
        result: 'CHUA_DAT',
      })
    ).rejects.toThrow(ConstraintViolationError);
  });

  // 4. Ràng buộc duy nhất handovers (request_id, attempt_no)
  it('Ràng buộc handovers: duy nhất theo (request_id, attempt_no)', async () => {
    const reqId = 'req-handover-1';

    await handoverRepo.add(staffActor, {
      request_id: reqId,
      attempt_no: 1,
      customer_accepted: true,
    });

    // Thêm lần 1 nữa -> PHẢI LỖI
    await expect(
      handoverRepo.add(staffActor, {
        request_id: reqId,
        attempt_no: 1,
        customer_accepted: false,
      })
    ).rejects.toThrow(ConstraintViolationError);
  });

  // 5. Ràng buộc duy nhất qr_ref & provider_txn_id trong payments
  it('Ràng buộc payments: qr_ref và provider_txn_id là duy nhất', async () => {
    await paymentRepo.add(customerActor, {
      request_id: 'req-pay-1',
      kind: 'DEPOSIT',
      amount: 500000,
      qr_ref: 'QR_UNIQUE_001',
      status: 'PENDING',
      provider_txn_id: 'TXN_001',
    });

    // Trùng qr_ref -> Lỗi
    await expect(
      paymentRepo.add(customerActor, {
        request_id: 'req-pay-2',
        kind: 'DEPOSIT',
        amount: 200000,
        qr_ref: 'QR_UNIQUE_001',
        status: 'PENDING',
      })
    ).rejects.toThrow(ConstraintViolationError);

    // Trùng provider_txn_id -> Lỗi
    await expect(
      paymentRepo.add(customerActor, {
        request_id: 'req-pay-3',
        kind: 'DEPOSIT',
        amount: 300000,
        qr_ref: 'QR_UNIQUE_002',
        status: 'PENDING',
        provider_txn_id: 'TXN_001',
      })
    ).rejects.toThrow(ConstraintViolationError);
  });

  // 6. Kiểm tra phân quyền (Actor RLS)
  it('Kiểm tra quyền Actor: Khách hàng không được xem hồ sơ người khác hoặc thực hiện quyền nhân viên', async () => {
    const reqId = 'req-secret-1';

    await db.rental_requests.add({
      id: reqId,
      customer_id: customerActor.id,
      start_at: '2026-11-05T08:00:00.000Z',
      end_at: '2026-11-06T08:00:00.000Z',
      status: 'CHO_KY',
      doc_request_count: 0,
    });

    // Khách hàng chính chủ xem được
    const myReq = await rentalRepo.getById(customerActor, reqId);
    expect(myReq).toBeDefined();

    // Khách hàng khác xem -> Bị chặn
    await expect(rentalRepo.getById(otherCustomerActor, reqId)).rejects.toThrow(
      PermissionDeniedError
    );

    // Khách hàng tự ý thêm lịch xe -> Bị chặn
    await expect(
      scheduleRepo.add(customerActor, {
        vehicle_id: 'veh-1',
        kind: 'RENTAL',
        start_at: '2026-11-05T10:00:00.000Z',
        end_at: '2026-11-05T12:00:00.000Z',
      })
    ).rejects.toThrow(PermissionDeniedError);
  });

  // 7. Ghi nhật ký process_events (logEvent)
  it('logEvent: ghi nhật ký BPMN thành công vào bảng process_events với bpmn_node_id chuẩn', async () => {
    const event = await logEvent('req-test-1', 'M_G03b', 'STATE_CHANGE', staffActor, {
      from: 'CHO_COC',
      to: 'CHO_KY',
    });

    expect(event.id).toBeDefined();
    expect(event.bpmn_node_id).toBe('M_G03b');

    const inDb = await db.process_events.get(event.id);
    expect(inDb?.event_type).toBe('STATE_CHANGE');
  });

  // 8. Sao lưu và Khôi phục (exportDatabase & importDatabase)
  it('Sao lưu & Khôi phục: exportDatabase rồi importDatabase giữ nguyên tính toàn vẹn', async () => {
    // Nạp dữ liệu mẫu
    await seedDatabase();

    const vehicleCountBefore = await db.vehicles.count();
    const userCountBefore = await db.profiles.count();
    expect(vehicleCountBefore).toBe(12);
    expect(userCountBefore).toBe(6);

    // Xuất ra JSON
    const exported = await exportDatabase();
    expect(exported.version).toBe(1);
    expect(exported.data.vehicles.length).toBe(12);

    // Xóa sạch cơ sở dữ liệu
    await db.clearAllTables();
    expect(await db.vehicles.count()).toBe(0);

    // Nạp lại từ file JSON đã xuất
    const result = await importDatabase(exported);
    if (!result.success) {
      console.error('Lỗi import:', result.message);
    }
    expect(result.success).toBe(true);

    // Kiểm tra dữ liệu sau khi khôi phục
    expect(await db.vehicles.count()).toBe(vehicleCountBefore);
    expect(await db.profiles.count()).toBe(userCountBefore);
  });
});
