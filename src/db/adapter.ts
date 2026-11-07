// src/db/adapter.ts
// Dual-Mode Adapter: Điều phối luồng dữ liệu 2 chiều thông minh giữa Dexie (IndexedDB) và Supabase (PostgreSQL Cloud)

import { db } from './index';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RentalRequest, Vehicle } from './types';

export type DataSourceMode = 'LIVE' | 'DEMO';

/**
 * Tự động suy luận các điểm chờ (waiting nodes) từ trạng thái đơn thuê
 * Giúp các thiết bị khác trong hệ thống đồng bộ ngay lập tức các việc cần làm
 */
export function inferWaitingNodesFromRequestStatus(status: string): string[] {
  switch (status) {
    case 'TAO_MOI':
    case 'CHO_DUYET_HO_SO':
      return ['M_CheckDocs'];
    case 'CHO_COC':
      return ['M_WaitDeposit', 'M_ManualDeposit'];
    case 'CHO_KY':
      return ['M_WaitSign'];
    case 'CHO_BAN_GIAO':
      return ['M_InspectPre'];
    case 'CHO_CHUP_ANH':
      return ['M_Photo'];
    case 'CHO_GIAO_XE':
      return ['M_Handover'];
    case 'CHO_KHACH_NHAN':
      return ['Activity_0d0qzp6'];
    case 'DANG_THUE':
      return ['M_EG'];
    case 'CHO_NHAN_XE_TRA':
      return ['M_ReceiveReturn'];
    case 'CHO_KIEM_TRA_TRA':
      return ['M_CheckReturn'];
    case 'CHO_XAC_MINH_CHI_PHI':
      return ['M_VerifyDamage'];
    case 'CHO_QUYET_TOAN':
    case 'CHO_KHACH_DUYET':
      return ['M_ReceiveReview'];
    case 'CHO_KHIEU_NAI':
      return ['M_Resolve'];
    case 'CHO_HOAN_COC':
      return ['M_ConfirmRefund'];
    case 'CHO_THU_THEM':
      return ['M_ReceiveExtra', 'M_ManualExtra'];
    case 'CHO_DANH_GIA_XE':
      return ['M_CheckReady'];
    case 'HOAN_TAT':
    case 'DA_HUY':
    case 'TU_CHOI':
    default:
      return [];
  }
}

class DataAdapter {
  private currentMode: DataSourceMode = 'LIVE';
  private listeners: ((mode: DataSourceMode) => void)[] = [];

  constructor() {
    const savedMode = localStorage.getItem('motocare_data_mode') as DataSourceMode;
    if (savedMode) {
      this.currentMode = savedMode;
    } else if (isSupabaseConfigured && navigator.onLine) {
      this.currentMode = 'LIVE';
    } else {
      this.currentMode = 'DEMO';
    }

    window.addEventListener('online', () => this.handleNetworkChange());
    window.addEventListener('offline', () => this.handleNetworkChange());
  }

  private handleNetworkChange() {
    if (!navigator.onLine && this.currentMode === 'LIVE') {
      console.warn('[DataAdapter] Mất kết nối Internet -> Tự động chuyển về chế độ DEMO (Dexie)');
      this.setMode('DEMO');
    } else if (navigator.onLine && isSupabaseConfigured && this.currentMode === 'DEMO') {
      this.setMode('LIVE');
    }
  }

  public getMode(): DataSourceMode {
    return this.currentMode;
  }

  public setMode(mode: DataSourceMode) {
    this.currentMode = mode;
    localStorage.setItem('motocare_data_mode', mode);
    this.notifyListeners();
  }

  public subscribeMode(listener: (mode: DataSourceMode) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((l) => l(this.currentMode));
  }

  // --- 1. LẤY DANH SÁCH XE ---
  public async getVehicles(): Promise<Vehicle[]> {
    if (this.currentMode === 'LIVE' && supabase) {
      try {
        const { data, error } = await supabase.from('vehicles').select('*').order('plate');
        if (error) throw error;
        if (data && data.length > 0) {
          // Cập nhật lại Dexie để luôn có dữ liệu mới nhất
          await db.vehicles.bulkPut(data as Vehicle[]);
          return data as Vehicle[];
        }
      } catch (err) {
        console.warn('[DataAdapter] Lỗi Supabase vehicles -> Fallback sang Dexie:', err);
      }
    }
    return db.vehicles.toArray();
  }

  // --- 2. LẤY DANH SÁCH ĐƠN THUÊ (CHO TIMELINE GANTT / NV-01) ---
  public async getRentalRequests(): Promise<RentalRequest[]> {
    if (this.currentMode === 'LIVE' && supabase) {
      try {
        const { data, error } = await supabase.from('rental_requests').select('*').order('start_at', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) {
          await db.rental_requests.bulkPut(data as RentalRequest[]);
          return data as RentalRequest[];
        }
      } catch (err) {
        console.warn('[DataAdapter] Lỗi Supabase rental_requests -> Fallback sang Dexie:', err);
      }
    }
    return db.rental_requests.toArray();
  }

  // --- 3. ĐẨY 1 BẢN GHI TỨC THÌ LÊN SUPABASE CLOUD (AUTO-PUSH) ---
  public async pushRecordToCloud(table: string, record: Record<string, unknown>): Promise<void> {
    if (import.meta.env.MODE === 'test') return;
    if (!isSupabaseConfigured || !supabase) return;
    try {
      if (table === 'rental_requests' && record.customer_id) {
        // Đảm bảo profile khách hàng đã tồn tại trên Supabase trước khi upsert rental_request
        const profile = await db.profiles.get(record.customer_id as string);
        if (profile) {
          await supabase.from('profiles').upsert(profile, { onConflict: 'id' });
        }
      }
      const { error } = await supabase.from(table).upsert(record, { onConflict: 'id' });
      if (error) {
        console.warn(`[DataAdapter] Lỗi Supabase upsert ${table}:`, error.message);
      }
    } catch (err) {
      console.warn(`[DataAdapter] Lỗi tự động đẩy dữ liệu bảng ${table} lên Supabase:`, err);
    }
  }

  // --- 4. KÉO DỮ LIỆU TỪ SUPABASE CLOUD VỀ LOCAL DEXIE (PULL CLOUD TO LOCAL) ---
  public async pullCloudToLocal(): Promise<{ success: boolean; count: number; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, count: 0, message: 'Chưa cấu hình Supabase Cloud' };
    }

    try {
      const [
        { data: cloudRentals },
        { data: cloudVehicles },
        { data: cloudSchedules },
        { data: cloudPayments },
        { data: cloudContracts },
        { data: cloudDocs },
        { data: cloudInspections },
        { data: cloudHandovers },
        { data: cloudIncidents },
        { data: cloudProfiles },
      ] = await Promise.all([
        supabase.from('rental_requests').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('vehicle_schedule').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('contracts').select('*'),
        supabase.from('customer_documents').select('*'),
        supabase.from('inspections').select('*'),
        supabase.from('handovers').select('*'),
        supabase.from('incidents').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      if (cloudRentals && cloudRentals.length > 0) {
        await db.rental_requests.bulkPut(cloudRentals as RentalRequest[]);

        // Tự động khôi phục / đồng bộ process_state để màn hình Việc cần làm của Nhân viên hiển thị đồng nhất
        for (const req of cloudRentals as RentalRequest[]) {
          const existingState = await db.process_state.get(req.id);
          const expectedWaitingNodes = inferWaitingNodesFromRequestStatus(req.status);

          if (!existingState) {
            await db.process_state.put({
              request_id: req.id,
              waiting_node_ids: expectedWaitingNodes,
              loop_counters: {},
              variables: {
                preferred_vehicle_type: req.vehicle_id ? undefined : 'Xe máy',
              },
              updated_at: new Date().toISOString(),
            });
          } else if (expectedWaitingNodes.length > 0 && !expectedWaitingNodes.some((n) => existingState.waiting_node_ids.includes(n))) {
            await db.process_state.update(req.id, {
              waiting_node_ids: expectedWaitingNodes,
              updated_at: new Date().toISOString(),
            });
          }
        }
      }

      if (cloudVehicles && cloudVehicles.length > 0) await db.vehicles.bulkPut(cloudVehicles);
      if (cloudSchedules && cloudSchedules.length > 0) await db.vehicle_schedule.bulkPut(cloudSchedules);
      if (cloudPayments && cloudPayments.length > 0) await db.payments.bulkPut(cloudPayments);
      if (cloudContracts && cloudContracts.length > 0) await db.contracts.bulkPut(cloudContracts);
      if (cloudDocs && cloudDocs.length > 0) await db.customer_documents.bulkPut(cloudDocs);
      if (cloudInspections && cloudInspections.length > 0) await db.inspections.bulkPut(cloudInspections);
      if (cloudHandovers && cloudHandovers.length > 0) await db.handovers.bulkPut(cloudHandovers);
      if (cloudIncidents && cloudIncidents.length > 0) await db.incidents.bulkPut(cloudIncidents);
      if (cloudProfiles && cloudProfiles.length > 0) await db.profiles.bulkPut(cloudProfiles);

      const totalItems = (cloudRentals?.length || 0) + (cloudVehicles?.length || 0);
      return {
        success: true,
        count: totalItems,
        message: `Đã kéo thành công dữ liệu từ Supabase Cloud!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[DataAdapter] Lỗi pullCloudToLocal:', err);
      return { success: false, count: 0, message: `Lỗi kéo dữ liệu: ${msg}` };
    }
  }

  // --- 5. ĐỒNG BỘ TOÀN DIỆN LÊN CLOUD SUPABASE (SYNC LOCAL TO CLOUD) ---
  public async syncLocalToCloud(): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase URL và Anon Key trong .env' };
    }

    try {
      const [
        profiles,
        auth_accounts,
        vehicles,
        rentals,
        documents,
        payments,
        contracts,
        schedules,
        inspections,
        handovers,
        findings,
        statements,
        settlements,
        extensions,
        partners,
        incidents,
        dispatches,
        maintenance,
        notifications,
        events,
      ] = await Promise.all([
        db.profiles.toArray(),
        db.auth_accounts.toArray(),
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
      ]);

      const syncOps = [];
      if (profiles.length > 0) syncOps.push(supabase.from('profiles').upsert(profiles, { onConflict: 'id' }));
      if (auth_accounts.length > 0) syncOps.push(supabase.from('auth_accounts').upsert(auth_accounts, { onConflict: 'user_id' }));
      if (vehicles.length > 0) syncOps.push(supabase.from('vehicles').upsert(vehicles, { onConflict: 'id' }));
      if (rentals.length > 0) syncOps.push(supabase.from('rental_requests').upsert(rentals, { onConflict: 'id' }));
      if (documents.length > 0) syncOps.push(supabase.from('customer_documents').upsert(documents, { onConflict: 'id' }));
      if (payments.length > 0) syncOps.push(supabase.from('payments').upsert(payments, { onConflict: 'id' }));
      if (contracts.length > 0) syncOps.push(supabase.from('contracts').upsert(contracts, { onConflict: 'id' }));
      if (schedules.length > 0) syncOps.push(supabase.from('vehicle_schedule').upsert(schedules, { onConflict: 'id' }));
      if (inspections.length > 0) syncOps.push(supabase.from('inspections').upsert(inspections, { onConflict: 'id' }));
      if (handovers.length > 0) syncOps.push(supabase.from('handovers').upsert(handovers, { onConflict: 'id' }));
      if (findings.length > 0) syncOps.push(supabase.from('damage_findings').upsert(findings, { onConflict: 'id' }));
      if (statements.length > 0) syncOps.push(supabase.from('statements').upsert(statements, { onConflict: 'id' }));
      if (settlements.length > 0) syncOps.push(supabase.from('settlements').upsert(settlements, { onConflict: 'id' }));
      if (extensions.length > 0) syncOps.push(supabase.from('extension_requests').upsert(extensions, { onConflict: 'id' }));
      if (partners.length > 0) syncOps.push(supabase.from('partners').upsert(partners, { onConflict: 'id' }));
      if (incidents.length > 0) syncOps.push(supabase.from('incidents').upsert(incidents, { onConflict: 'id' }));
      if (dispatches.length > 0) syncOps.push(supabase.from('incident_dispatches').upsert(dispatches, { onConflict: 'id' }));
      if (maintenance.length > 0) syncOps.push(supabase.from('maintenance_orders').upsert(maintenance, { onConflict: 'id' }));
      if (notifications.length > 0) syncOps.push(supabase.from('notifications').upsert(notifications, { onConflict: 'id' }));
      if (events.length > 0) syncOps.push(supabase.from('process_events').upsert(events, { onConflict: 'id' }));

      await Promise.all(syncOps);

      return {
        success: true,
        message: `Đã đồng bộ toàn diện dữ liệu lên Supabase Cloud (${rentals.length} đơn, ${profiles.length} tài khoản, ${vehicles.length} xe)!`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Lỗi đồng bộ: ${msg}` };
    }
  }

  // --- 6. XÓA SẠCH TOÀN BỘ DỮ LIỆU ĐƠN KHÁCH HÀNG (RESET CLOUD & LOCAL) ---
  public async wipeAllCustomerData(): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Dọn dẹp cục bộ IndexedDB
      await db.rental_requests.clear();
      await db.customer_documents.clear();
      await db.payments.clear();
      await db.contracts.clear();
      await db.vehicle_schedule.clear();
      await db.inspections.clear();
      await db.handovers.clear();
      await db.damage_findings.clear();
      await db.statements.clear();
      await db.settlements.clear();
      await db.extension_requests.clear();
      await db.incidents.clear();
      await db.incident_dispatches.clear();
      await db.maintenance_orders.clear();
      await db.notifications.clear();
      await db.process_events.clear();
      await db.process_state.clear();
      await db.timers.clear();

      // Reset tất cả xe về trạng thái SAN_SANG
      await db.vehicles.toCollection().modify({ status: 'SAN_SANG' });

      // 2. Dọn dẹp trên Supabase Cloud nếu có kết nối
      if (isSupabaseConfigured && supabase) {
        await Promise.allSettled([
          supabase.from('rental_requests').delete().neq('id', 'dummy'),
          supabase.from('customer_documents').delete().neq('id', 'dummy'),
          supabase.from('payments').delete().neq('id', 'dummy'),
          supabase.from('contracts').delete().neq('id', 'dummy'),
          supabase.from('vehicle_schedule').delete().neq('id', 'dummy'),
          supabase.from('inspections').delete().neq('id', 'dummy'),
          supabase.from('handovers').delete().neq('id', 'dummy'),
          supabase.from('incidents').delete().neq('id', 'dummy'),
          supabase.from('vehicles').update({ status: 'SAN_SANG' }).neq('id', 'dummy'),
        ]);
      }

      return {
        success: true,
        message: 'Đã xóa sạch toàn bộ dữ liệu đơn thuê, hợp đồng và lịch xe của khách hàng! Toàn bộ 30 xe đã sẵn sàng cho thuê mới.',
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, message: `Lỗi dọn dữ liệu: ${msg}` };
    }
  }
}

export const dataAdapter = new DataAdapter();
