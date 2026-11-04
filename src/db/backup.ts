// src/db/backup.ts
// Chức năng sao lưu (Export JSON) và khôi phục (Import JSON) toàn vẹn cơ sở dữ liệu

import { db } from './index';
import { DatabaseBackupSchema, type DatabaseBackup } from './schema';
import { clock } from '@/lib/clock';

/**
 * Xuất toàn bộ dữ liệu 22 bảng thành một đối tượng JSON
 */
export async function exportDatabase(): Promise<DatabaseBackup> {
  const [
    profiles,
    vehicles,
    rental_requests,
    customer_documents,
    payments,
    contracts,
    vehicle_schedule,
    inspections,
    handovers,
    damage_findings,
    statements,
    settlements,
    extension_requests,
    partners,
    incidents,
    incident_dispatches,
    maintenance_orders,
    notifications,
    process_events,
    process_state,
    timers,
    auth_accounts,
  ] = await Promise.all([
    db.profiles.toArray(),
    db.vehicles.toArray(),
    db.rental_requests.toArray(),
    db.customer_documents.toArray(),
    db.payments.toArray(),
    db.contracts.toArray(),
    db.vehicle_schedule.toArray(),
    db.inspections.toArray(),
    db.handovers.toArray(),
    db.damage_findings.toArray(),
    db.statements.toArray(),
    db.settlements.toArray(),
    db.extension_requests.toArray(),
    db.partners.toArray(),
    db.incidents.toArray(),
    db.incident_dispatches.toArray(),
    db.maintenance_orders.toArray(),
    db.notifications.toArray(),
    db.process_events.toArray(),
    db.process_state.toArray(),
    db.timers.toArray(),
    db.auth_accounts.toArray(),
  ]);

  const backupData: DatabaseBackup = {
    version: 1,
    exported_at: clock.nowISO(),
    data: {
      profiles,
      vehicles,
      rental_requests,
      customer_documents,
      payments,
      contracts,
      vehicle_schedule,
      inspections,
      handovers,
      damage_findings,
      statements,
      settlements,
      extension_requests,
      partners,
      incidents,
      incident_dispatches,
      maintenance_orders,
      notifications,
      process_events,
      process_state,
      timers,
      auth_accounts,
    },
  };

  return backupData;
}

/**
 * Tải file JSON sao lưu về máy người dùng
 */
export async function downloadDatabaseBackup(): Promise<void> {
  const data = await exportDatabase();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `motocare_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

/**
 * Nạp lại cơ sở dữ liệu từ chuỗi hoặc đối tượng JSON
 * Kiểm tra chặt chẽ tính hợp lệ qua Zod Schema trước khi xóa và ghi đè
 */
export async function importDatabase(rawContent: unknown): Promise<{ success: boolean; message: string }> {
  try {
    let parsedJson = rawContent;
    if (typeof rawContent === 'string') {
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        return { success: false, message: 'Dữ liệu không phải chuỗi JSON hợp lệ.' };
      }
    }

    // Xác thực cấu trúc bằng Zod Schema
    const parseResult = DatabaseBackupSchema.safeParse(parsedJson);
    if (!parseResult.success) {
      const errorDetail = parseResult.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; ');
      return {
        success: false,
        message: `Định dạng dữ liệu sao lưu không hợp lệ: ${errorDetail}`,
      };
    }

    const { data } = parseResult.data;

    // Ghi dữ liệu vào database trong 1 Transaction an toàn
    await db.transaction('rw', db.tables, async () => {
      // Xóa dữ liệu cũ
      for (const table of db.tables) {
        await table.clear();
      }

      // Nạp dữ liệu mới
      await Promise.all([
        data.profiles.length > 0 && db.profiles.bulkAdd(data.profiles),
        data.vehicles.length > 0 && db.vehicles.bulkAdd(data.vehicles),
        data.rental_requests.length > 0 && db.rental_requests.bulkAdd(data.rental_requests),
        data.customer_documents.length > 0 && db.customer_documents.bulkAdd(data.customer_documents),
        data.payments.length > 0 && db.payments.bulkAdd(data.payments),
        data.contracts.length > 0 && db.contracts.bulkAdd(data.contracts),
        data.vehicle_schedule.length > 0 && db.vehicle_schedule.bulkAdd(data.vehicle_schedule),
        data.inspections.length > 0 && db.inspections.bulkAdd(data.inspections),
        data.handovers.length > 0 && db.handovers.bulkAdd(data.handovers),
        data.damage_findings.length > 0 && db.damage_findings.bulkAdd(data.damage_findings),
        data.statements.length > 0 && db.statements.bulkAdd(data.statements),
        data.settlements.length > 0 && db.settlements.bulkAdd(data.settlements),
        data.extension_requests.length > 0 && db.extension_requests.bulkAdd(data.extension_requests),
        data.partners.length > 0 && db.partners.bulkAdd(data.partners),
        data.incidents.length > 0 && db.incidents.bulkAdd(data.incidents),
        data.incident_dispatches.length > 0 && db.incident_dispatches.bulkAdd(data.incident_dispatches),
        data.maintenance_orders.length > 0 && db.maintenance_orders.bulkAdd(data.maintenance_orders),
        data.notifications.length > 0 && db.notifications.bulkAdd(data.notifications),
        data.process_events.length > 0 && db.process_events.bulkAdd(data.process_events),
        data.process_state.length > 0 && db.process_state.bulkAdd(data.process_state),
        data.timers.length > 0 && db.timers.bulkAdd(data.timers),
        data.auth_accounts.length > 0 && db.auth_accounts.bulkAdd(data.auth_accounts),
      ]);
    });

    return {
      success: true,
      message: 'Khôi phục cơ sở dữ liệu thành công!',
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      message: `Lỗi trong quá trình khôi phục: ${errorMsg}`,
    };
  }
}
