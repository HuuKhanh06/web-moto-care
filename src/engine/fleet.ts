// src/engine/fleet.ts
// Quy tắc phân bổ xe dùng chung cho M_CheckFleet (engine), khóa lịch (M_SaveBooking), đổi xe (NV-03)
// và màn hình KH-01 (dự kiến giá). Một nơi duy nhất để không gán trùng xe và giá ước tính khớp xe thực gán.

import { db } from '@/db';
import { clock } from '@/lib/clock';
import { BUSINESS_RULES } from '@/config/rules';
import type { RentalRequest, RentalRequestStatus, Vehicle } from '@/db/types';

/** Hồ sơ đã kết thúc: không còn giữ xe. */
const CLOSED_STATUSES: ReadonlySet<RentalRequestStatus> = new Set(['HOAN_TAT', 'DA_HUY', 'TU_CHOI']);
/**
 * Giai đoạn trước khi đặt cọc không có hẹn giờ tự hủy (CHO_COC có hẹn 30 phút, CHO_KY có hẹn 24 giờ).
 * Hồ sơ ở giai đoạn này chỉ giữ xe trong PRE_DEPOSIT_HOLD_MINUTES kể từ lần hoạt động gần nhất,
 * để khách bỏ dở ở bước nộp giấy tờ không khóa xe vĩnh viễn.
 */
const PRE_DEPOSIT_STATUSES: ReadonlySet<RentalRequestStatus> = new Set(['MOI', 'CHO_HO_SO']);

const overlaps = (startMs: number, endMs: number, start: string, end: string) =>
  startMs < new Date(end).getTime() && endMs > new Date(start).getTime();

async function lastActivityMs(requestId: string): Promise<number | null> {
  const events = await db.process_events.where('request_id').equals(requestId).toArray();
  if (!events.length) return null;
  return Math.max(...events.map((e) => new Date(e.created_at).getTime()));
}

/** Hồ sơ này hiện có đang giữ xe của nó không. */
async function isHolding(request: RentalRequest): Promise<boolean> {
  if (CLOSED_STATUSES.has(request.status)) return false;
  if (!PRE_DEPOSIT_STATUSES.has(request.status)) return true;
  const last = await lastActivityMs(request.id);
  // Không rõ thời điểm (dữ liệu cũ): giữ xe cho an toàn, tránh gán trùng.
  if (last === null) return true;
  return clock.now().getTime() - last < BUSINESS_RULES.TIMERS.PRE_DEPOSIT_HOLD_MINUTES * 60 * 1000;
}

/**
 * Xe có trống trong [startMs, endMs) không. Bận khi:
 *  - có lịch bảo trì giao nhau, hoặc lịch thuê đã khóa của hồ sơ còn hiệu lực;
 *  - có hồ sơ khác đang hoạt động (chờ cọc, chờ ký, đang thuê...) đã gán xe này với khoảng thuê giao nhau,
 *    kể cả khi hồ sơ đó chưa tới bước khóa lịch (M_SaveBooking).
 * `excludeRequestId`: bỏ qua chính hồ sơ đang xét (khi khóa lịch hoặc đổi xe).
 */
export async function isVehicleFree(vehicleId: string, startMs: number, endMs: number, excludeRequestId?: string): Promise<boolean> {
  const [schedules, requests] = await Promise.all([
    db.vehicle_schedule.where('vehicle_id').equals(vehicleId).toArray(),
    db.rental_requests.where('vehicle_id').equals(vehicleId).toArray(),
  ]);
  const requestById = new Map(requests.map((r) => [r.id, r]));

  for (const s of schedules) {
    if (!overlaps(startMs, endMs, s.start_at, s.end_at)) continue;
    if (s.kind === 'RENTAL' && s.request_id) {
      if (s.request_id === excludeRequestId) continue;
      // Lịch thuê của hồ sơ đã hủy/từ chối/hoàn tất không còn chặn xe (trả xe sớm, hủy sau khi ký...).
      const owner = requestById.get(s.request_id) ?? (await db.rental_requests.get(s.request_id));
      if (owner && CLOSED_STATUSES.has(owner.status)) continue;
    }
    return false;
  }

  for (const r of requests) {
    if (r.id === excludeRequestId) continue;
    if (!overlaps(startMs, endMs, r.start_at, r.end_at)) continue;
    if (await isHolding(r)) return false;
  }
  return true;
}

/**
 * Xe đầu tiên đúng loại, đang SAN_SANG và trống trong khoảng [startMs, endMs).
 * Thứ tự duyệt theo index `status` của Dexie (giữ nguyên thứ tự phân bổ cũ của M_CheckFleet).
 */
export async function findAvailableVehicle(
  startMs: number,
  endMs: number,
  vehicleType?: string,
  excludeRequestId?: string,
): Promise<Vehicle | null> {
  let vehicles = await db.vehicles.where('status').equals('SAN_SANG').toArray();
  if (vehicleType) vehicles = vehicles.filter((v) => v.vehicle_type === vehicleType);
  for (const v of vehicles) {
    if (await isVehicleFree(v.id, startMs, endMs, excludeRequestId)) return v;
  }
  return null;
}

/** Số ngày tính tiền: làm tròn lên, tối thiểu 1 ngày (giống M_SendTerms). */
export function rentalDays(startMs: number, endMs: number): number {
  return Math.max(1, Math.ceil((endMs - startMs) / (24 * 3600 * 1000)));
}
