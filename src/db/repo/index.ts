// src/db/repo/index.ts
// Tầng Repository: Thực thi kiểm tra quyền (Actor RLS) và các ràng buộc dữ liệu nghiệp vụ

import { db } from '../index';
import { dataAdapter } from '../adapter';
import { clock } from '@/lib/clock';
import type {
  Actor,
  ProcessEvent,
  VehicleSchedule,
  Inspection,
  Handover,
  Payment,
  RentalRequest,
  Vehicle,
} from '../types';

/**
 * Lỗi phân quyền trong tầng repository
 */
export class PermissionDeniedError extends Error {
  constructor(message = 'Không có quyền thực hiện thao tác này') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

/**
 * Lỗi vi phạm ràng buộc toàn vẹn dữ liệu
 */
export class ConstraintViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintViolationError';
  }
}

/**
 * Kiểm tra xem Actor có thuộc danh sách quyền cho phép không
 */
export function assertRole(actor: Actor, allowedRoles: Array<Actor['role']>): void {
  if (actor.role === 'system') return;
  if (!allowedRoles.includes(actor.role)) {
    throw new PermissionDeniedError(
      `Vai trò '${actor.role}' không được phép thực hiện thao tác. Yêu cầu: ${allowedRoles.join(', ')}`
    );
  }
}

/**
 * HÀM DUY NHẤT để ghi nhật ký tiến trình BPMN vào bảng process_events
 */
export async function logEvent(
  requestId: string,
  bpmnNodeId: string,
  eventType: string,
  actor: Actor,
  payload?: Record<string, unknown>
): Promise<ProcessEvent> {
  const event: ProcessEvent = {
    id: crypto.randomUUID(),
    request_id: requestId,
    bpmn_node_id: bpmnNodeId,
    event_type: eventType,
    actor_id: actor.id,
    payload,
    created_at: clock.nowISO(),
  };

  await db.process_events.add(event);
  void dataAdapter.pushToCloud('process_events', event);
  return event;
}

/**
 * REPOSITORY: QUẢN LÝ LỊCH XE (vehicle_schedule)
 * Ràng buộc: Không cho phép hai khoảng thời gian [start_at, end_at] chồng chéo trên cùng vehicle_id
 */
export const scheduleRepo = {
  async add(actor: Actor, scheduleData: Omit<VehicleSchedule, 'id'>): Promise<VehicleSchedule> {
    assertRole(actor, ['nhan_vien', 'quan_ly', 'system']);

    const newStart = new Date(scheduleData.start_at).getTime();
    const newEnd = new Date(scheduleData.end_at).getTime();

    if (newEnd <= newStart) {
      throw new ConstraintViolationError('Thời gian kết thúc phải lớn hơn thời gian bắt đầu.');
    }

    // Kiểm tra lịch hiện có của xe
    const existing = await db.vehicle_schedule
      .where('vehicle_id')
      .equals(scheduleData.vehicle_id)
      .toArray();

    for (const item of existing) {
      const itemStart = new Date(item.start_at).getTime();
      const itemEnd = new Date(item.end_at).getTime();

      // Kiểm tra giao nhau: newStart < itemEnd && newEnd > itemStart
      if (newStart < itemEnd && newEnd > itemStart) {
        throw new ConstraintViolationError(
          `Trùng lịch xe ${scheduleData.vehicle_id}: Đã có lịch từ ${item.start_at} đến ${item.end_at}`
        );
      }
    }

    const schedule: VehicleSchedule = {
      id: crypto.randomUUID(),
      ...scheduleData,
    };

    await db.vehicle_schedule.add(schedule);
    void dataAdapter.pushToCloud('vehicle_schedule', schedule);
    return schedule;
  },

  async getByVehicle(vehicleId: string): Promise<VehicleSchedule[]> {
    return db.vehicle_schedule.where('vehicle_id').equals(vehicleId).toArray();
  },
};

/**
 * REPOSITORY: BIÊN BẢN KIỂM TRA (inspections)
 * Ràng buộc: Duy nhất theo (request_id, kind, attempt_no)
 */
export const inspectionRepo = {
  async add(actor: Actor, inspectionData: Omit<Inspection, 'id'>): Promise<Inspection> {
    assertRole(actor, ['nhan_vien', 'quan_ly', 'system']);

    const existing = await db.inspections
      .where('[request_id+kind+attempt_no]')
      .equals([inspectionData.request_id, inspectionData.kind, inspectionData.attempt_no])
      .first();

    if (existing) {
      throw new ConstraintViolationError(
        `Biên bản kiểm tra đã tồn tại cho hồ sơ ${inspectionData.request_id}, loại ${inspectionData.kind}, lần ${inspectionData.attempt_no}`
      );
    }

    const inspection: Inspection = {
      id: crypto.randomUUID(),
      ...inspectionData,
    };

    await db.inspections.add(inspection);
    void dataAdapter.pushToCloud('inspections', inspection);
    return inspection;
  },
};

/**
 * REPOSITORY: BIÊN BẢN BÀN GIAO (handovers)
 * Ràng buộc: Duy nhất theo (request_id, attempt_no)
 */
export const handoverRepo = {
  async add(actor: Actor, handoverData: Omit<Handover, 'id'>): Promise<Handover> {
    assertRole(actor, ['nhan_vien', 'khach_hang', 'system']);

    const existing = await db.handovers
      .where('[request_id+attempt_no]')
      .equals([handoverData.request_id, handoverData.attempt_no])
      .first();

    if (existing) {
      throw new ConstraintViolationError(
        `Biên bản bàn giao lần ${handoverData.attempt_no} đã tồn tại cho hồ sơ ${handoverData.request_id}`
      );
    }

    const handover: Handover = {
      id: crypto.randomUUID(),
      ...handoverData,
    };

    await db.handovers.add(handover);
    void dataAdapter.pushToCloud('handovers', handover);
    return handover;
  },
};

/**
 * REPOSITORY: THANH TOÁN (payments)
 * Ràng buộc: qr_ref và provider_txn_id phải là duy nhất
 */
export const paymentRepo = {
  async add(actor: Actor, paymentData: Omit<Payment, 'id'>): Promise<Payment> {
    assertRole(actor, ['khach_hang', 'nhan_vien', 'quan_ly', 'system']);

    // Kiểm tra qr_ref duy nhất
    const qrExist = await db.payments.where('qr_ref').equals(paymentData.qr_ref).first();
    if (qrExist) {
      throw new ConstraintViolationError(`Mã qr_ref '${paymentData.qr_ref}' đã tồn tại trong hệ thống.`);
    }

    // Kiểm tra provider_txn_id duy nhất nếu có
    if (paymentData.provider_txn_id) {
      const txnExist = await db.payments
        .where('provider_txn_id')
        .equals(paymentData.provider_txn_id)
        .first();
      if (txnExist) {
        throw new ConstraintViolationError(
          `Mã giao dịch đối tác '${paymentData.provider_txn_id}' đã được xử lý trước đó.`
        );
      }
    }

    const payment: Payment = {
      id: crypto.randomUUID(),
      ...paymentData,
    };

    await db.payments.add(payment);
    void dataAdapter.pushToCloud('payments', payment);
    return payment;
  },

  async updateStatus(
    actor: Actor,
    paymentId: string,
    status: Payment['status'],
    providerTxnId?: string,
    paidAmount?: number
  ): Promise<void> {
    assertRole(actor, ['nhan_vien', 'quan_ly', 'system']);

    if (providerTxnId) {
      const txnExist = await db.payments
        .where('provider_txn_id')
        .equals(providerTxnId)
        .and((p) => p.id !== paymentId)
        .first();
      if (txnExist) {
        throw new ConstraintViolationError(`Mã giao dịch đối tác '${providerTxnId}' đã tồn tại.`);
      }
    }

    await db.payments.update(paymentId, {
      status,
      provider_txn_id: providerTxnId,
      paid_amount: paidAmount,
      paid_at: clock.nowISO(),
    });

    const updated = await db.payments.get(paymentId);
    if (updated) {
      void dataAdapter.pushToCloud('payments', updated);
    }
  },
};

/**
 * REPOSITORY: HỒ SƠ THUÊ (rental_requests)
 */
export const rentalRepo = {
  async getById(actor: Actor, id: string): Promise<RentalRequest | undefined> {
    const item = await db.rental_requests.get(id);
    if (!item) return undefined;

    // RLS: Khách hàng chỉ xem được hồ sơ của mình
    if (actor.role === 'khach_hang' && item.customer_id !== actor.id) {
      throw new PermissionDeniedError('Bạn không có quyền xem hồ sơ của người khác.');
    }

    return item;
  },

  async updateStatus(actor: Actor, id: string, status: RentalRequest['status']): Promise<void> {
    assertRole(actor, ['nhan_vien', 'quan_ly', 'khach_hang', 'system']);
    await db.rental_requests.update(id, { status });
    const updated = await db.rental_requests.get(id);
    if (updated) {
      void dataAdapter.pushToCloud('rental_requests', updated);
    }
  },

  async getAll(actor: Actor): Promise<RentalRequest[]> {
    if (actor.role === 'khach_hang') {
      return db.rental_requests.where('customer_id').equals(actor.id).toArray();
    }
    return db.rental_requests.toArray();
  },
};

/**
 * REPOSITORY: DANH SÁCH XE (vehicles)
 */
export const vehicleRepo = {
  async getAll(): Promise<Vehicle[]> {
    return db.vehicles.toArray();
  },

  async getAvailable(): Promise<Vehicle[]> {
    return db.vehicles.where('status').equals('SAN_SANG').toArray();
  },

  async updateStatus(actor: Actor, id: string, status: Vehicle['status']): Promise<void> {
    assertRole(actor, ['nhan_vien', 'quan_ly', 'system']);
    await db.vehicles.update(id, { status });
    const updated = await db.vehicles.get(id);
    if (updated) {
      void dataAdapter.pushToCloud('vehicles', updated);
    }
  },
};
