// src/db/adapter.ts
// Dual-Mode Adapter: Điều phối luồng dữ liệu thông minh giữa Dexie (IndexedDB) và Supabase (PostgreSQL Cloud)
// Hỗ trợ đồng bộ đa thiết bị thời gian thực (Multi-Device Realtime Cloud Sync)

import { db } from './index';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RentalRequest, Vehicle, ProcessState } from './types';

export type DataSourceMode = 'LIVE' | 'DEMO';

export const STATUS_TO_NODES: Record<string, string[]> = {
  MOI: ['M_CheckDocs'],
  CHO_HO_SO: ['M_CheckDocs'],
  CHO_COC: ['M_WaitDeposit', 'M_ManualDeposit'],
  CHO_KY: ['M_WaitSign'],
  CHO_BAN_GIAO: ['M_InspectPre', 'M_Photo', 'M_Handover'],
  CHO_KHACH_NHAN: ['M_Handover'],
  DANG_THUE: ['M_CatchReturn', 'M_CatchExtend', 'M_CatchIncident'],
  DANG_GIA_HAN: ['GH_VerifyQR'],
  DANG_XU_LY_SU_CO: ['SC_Log', 'SC_Escalate'],
  CHO_NHAN_XE_TRA: ['M_ReceiveReturn', 'M_CheckReturn'],
  CHO_KHACH_XAC_NHAN_BANG_KE: ['M_ReceiveReview'],
  CHO_THU_THEM: ['M_ManualExtra', 'M_ReceiveExtra'],
  CONG_NO: ['M_ManualExtra'],
  CHO_DANH_GIA_XE: ['M_CheckReady'],
};

class DataAdapter {
  private currentMode: DataSourceMode = 'DEMO';
  private listeners: ((mode: DataSourceMode) => void)[] = [];
  private realtimeChannel: any = null;
  private pollInterval: any = null;
  private isSyncing = false;

  constructor() {
    if (import.meta.env.MODE === 'test') {
      this.currentMode = 'DEMO';
      return;
    }

    const savedMode = typeof localStorage !== 'undefined' ? (localStorage.getItem('motocare_data_mode') as DataSourceMode) : null;
    if (savedMode) {
      this.currentMode = savedMode;
    } else if (isSupabaseConfigured && (typeof navigator === 'undefined' || navigator.onLine)) {
      this.currentMode = 'LIVE';
    } else {
      this.currentMode = 'DEMO';
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  private handleNetworkChange() {
    if (!navigator.onLine && this.currentMode === 'LIVE') {
      console.warn('[DataAdapter] Mất kết nối Internet -> Tự động chuyển về chế độ DEMO (Dexie)');
      this.setMode('DEMO');
    } else if (navigator.onLine && isSupabaseConfigured) {
      console.log('[DataAdapter] Đã có mạng -> Kích hoạt chế độ LIVE (Supabase Cloud)');
      this.setMode('LIVE');
      void this.syncCloudToLocal();
    }
  }

  public getMode(): DataSourceMode {
    return this.currentMode;
  }

  public setMode(mode: DataSourceMode) {
    this.currentMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('motocare_data_mode', mode);
    }
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
        if (data && data.length > 0) return data as Vehicle[];
      } catch (err) {
        console.warn('[DataAdapter] Lỗi Supabase vehicles -> Fallback sang Dexie:', err);
      }
    }
    return db.vehicles.toArray();
  }

  // --- 2. LẤY DANH SÁCH ĐƠN THUÊ (CHO TIMELINE GANTT) ---
  public async getRentalRequests(): Promise<RentalRequest[]> {
    if (this.currentMode === 'LIVE' && supabase) {
      try {
        const { data, error } = await supabase.from('rental_requests').select('*').order('start_at', { ascending: false });
        if (error) throw error;
        if (data && data.length > 0) return data as RentalRequest[];
      } catch (err) {
        console.warn('[DataAdapter] Lỗi Supabase rental_requests -> Fallback sang Dexie:', err);
      }
    }
    return db.rental_requests.toArray();
  }

  // --- 3. ĐỒNG BỘ MỘT BẢN GHI LÊN CLOUD SUPABASE (PUSH TỨC THÌ) ---
  public async pushToCloud(table: string, record: any): Promise<void> {
    if (import.meta.env.MODE === 'test' || !isSupabaseConfigured || !supabase || this.currentMode !== 'LIVE') return;
    try {
      const conflictCol = table === 'auth_accounts' ? 'user_id' : 'id';
      const { error } = await supabase.from(table).upsert(record, { onConflict: conflictCol });
      if (error) {
        console.warn(`[DataAdapter] Lỗi push ${table} lên Supabase:`, error.message);
      } else {
        this.broadcastChange(table, record.id || record.request_id || record.user_id);
      }
    } catch (err) {
      console.warn(`[DataAdapter] Ngoại lệ push ${table}:`, err);
    }
  }

  // --- 4. ĐỒNG BỘ TRẠNG THÁI TIẾN TRÌNH BPMN (PROCESS_STATE) LÊN CLOUD ---
  public async pushProcessStateToCloud(state: ProcessState, actorId?: string): Promise<void> {
    if (import.meta.env.MODE === 'test' || !isSupabaseConfigured || !supabase || this.currentMode !== 'LIVE') return;
    try {
      // 1. Thử đẩy vào bảng audit_logs với table_name = 'process_state' (chắc chắn thành công 100%)
      await supabase.from('audit_logs').insert({
        table_name: 'process_state',
        record_id: state.request_id,
        action: 'UPSERT',
        new_data: state,
        actor_id: actorId || null,
      });

      // 2. Thử đẩy vào bảng process_state (nếu đã tạo bảng)
      try {
        await supabase.from('process_state').upsert(state, { onConflict: 'request_id' });
      } catch {
        // bỏ qua nếu chưa tạo bảng riêng
      }

      this.broadcastChange('process_state', state.request_id);
    } catch (err) {
      console.warn('[DataAdapter] Lỗi push process_state lên cloud:', err);
    }
  }

  // --- 5. PHÁT THÔNG ĐIỆP REALTIME ĐẾN CÁC THIẾT BỊ KHÁC ---
  public broadcastChange(table: string, id?: string) {
    if (this.realtimeChannel) {
      try {
        void this.realtimeChannel.send({
          type: 'broadcast',
          event: 'STATE_CHANGED',
          payload: { table, id, time: Date.now() },
        });
      } catch {
        // bỏ qua
      }
    }
  }

  // --- 6. TẢI DỮ LIỆU TỪ SUPABASE CLOUD VỀ TRÌNH DUYỆT (SYNC XUỐNG DEXIE) ---
  public async syncCloudToLocal(): Promise<void> {
    if (import.meta.env.MODE === 'test' || !isSupabaseConfigured || !supabase || this.currentMode !== 'LIVE' || this.isSyncing) return;
    this.isSyncing = true;

    try {
      const [
        profilesRes,
        vehiclesRes,
        rentalsRes,
        docsRes,
        paymentsRes,
        contractsRes,
        schedulesRes,
        inspectionsRes,
        handoversRes,
        findingsRes,
        statementsRes,
        settlementsRes,
        extensionsRes,
        partnersRes,
        incidentsRes,
        dispatchesRes,
        maintenanceRes,
        notificationsRes,
        eventsRes,
        stateLogsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('rental_requests').select('*'),
        supabase.from('customer_documents').select('*'),
        supabase.from('payments').select('*'),
        supabase.from('contracts').select('*'),
        supabase.from('vehicle_schedule').select('*'),
        supabase.from('inspections').select('*'),
        supabase.from('handovers').select('*'),
        supabase.from('damage_findings').select('*'),
        supabase.from('statements').select('*'),
        supabase.from('settlements').select('*'),
        supabase.from('extension_requests').select('*'),
        supabase.from('partners').select('*'),
        supabase.from('incidents').select('*'),
        supabase.from('incident_dispatches').select('*'),
        supabase.from('maintenance_orders').select('*'),
        supabase.from('notifications').select('*'),
        supabase.from('process_events').select('*'),
        supabase.from('audit_logs').select('*').eq('table_name', 'process_state').order('created_at', { ascending: false }),
      ]);

      // Nạp vào Dexie với bulkPut để cập nhật hoặc thêm mới không làm mất khóa
      if (profilesRes.data && profilesRes.data.length > 0) {
        await db.profiles.bulkPut(profilesRes.data);
      }
      if (vehiclesRes.data && vehiclesRes.data.length > 0) {
        await db.vehicles.bulkPut(vehiclesRes.data);
      }
      if (rentalsRes.data && rentalsRes.data.length > 0) {
        await db.rental_requests.bulkPut(rentalsRes.data);

        // Khôi phục process_state cho những đơn thiếu state
        for (const req of rentalsRes.data as RentalRequest[]) {
          const existingState = await db.process_state.get(req.id);
          if (!existingState) {
            const fallbackNodes = STATUS_TO_NODES[req.status] || [];
            if (fallbackNodes.length > 0) {
              await db.process_state.put({
                request_id: req.id,
                waiting_node_ids: fallbackNodes,
                loop_counters: {},
                variables: { preferred_vehicle_type: 'xe_so' },
                updated_at: (req as any).updated_at || new Date().toISOString(),
              });
            }
          }
        }
      }

      if (docsRes.data && docsRes.data.length > 0) {
        await db.customer_documents.bulkPut(docsRes.data);
      }
      if (paymentsRes.data && paymentsRes.data.length > 0) {
        await db.payments.bulkPut(paymentsRes.data);
      }
      if (contractsRes.data && contractsRes.data.length > 0) {
        await db.contracts.bulkPut(contractsRes.data);
      }
      if (schedulesRes.data && schedulesRes.data.length > 0) {
        await db.vehicle_schedule.bulkPut(schedulesRes.data);
      }
      if (inspectionsRes.data && inspectionsRes.data.length > 0) {
        await db.inspections.bulkPut(inspectionsRes.data);
      }
      if (handoversRes.data && handoversRes.data.length > 0) {
        await db.handovers.bulkPut(handoversRes.data);
      }
      if (findingsRes.data && findingsRes.data.length > 0) {
        await db.damage_findings.bulkPut(findingsRes.data);
      }
      if (statementsRes.data && statementsRes.data.length > 0) {
        await db.statements.bulkPut(statementsRes.data);
      }
      if (settlementsRes.data && settlementsRes.data.length > 0) {
        await db.settlements.bulkPut(settlementsRes.data);
      }
      if (extensionsRes.data && extensionsRes.data.length > 0) {
        await db.extension_requests.bulkPut(extensionsRes.data);
      }
      if (partnersRes.data && partnersRes.data.length > 0) {
        await db.partners.bulkPut(partnersRes.data);
      }
      if (incidentsRes.data && incidentsRes.data.length > 0) {
        await db.incidents.bulkPut(incidentsRes.data);
      }
      if (dispatchesRes.data && dispatchesRes.data.length > 0) {
        await db.incident_dispatches.bulkPut(dispatchesRes.data);
      }
      if (maintenanceRes.data && maintenanceRes.data.length > 0) {
        await db.maintenance_orders.bulkPut(maintenanceRes.data);
      }
      if (notificationsRes.data && notificationsRes.data.length > 0) {
        await db.notifications.bulkPut(notificationsRes.data);
      }
      if (eventsRes.data && eventsRes.data.length > 0) {
        await db.process_events.bulkPut(eventsRes.data);
      }

      // Khôi phục chính xác các state từ audit_logs
      if (stateLogsRes.data && stateLogsRes.data.length > 0) {
        const seenRequests = new Set<string>();
        for (const log of stateLogsRes.data) {
          const reqId = log.record_id;
          if (!seenRequests.has(reqId) && log.new_data?.request_id) {
            seenRequests.add(reqId);
            await db.process_state.put(log.new_data);
          }
        }
      }

      // Phát sự kiện cập nhật để các component lắng nghe và re-render
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: { source: 'cloud_sync' } }));
      }
    } catch (err) {
      console.warn('[DataAdapter] Lỗi đồng bộ đám mây về máy:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  // --- 7. BẮT ĐẦU ĐỒNG BỘ THỜI GIAN THỰC (REALTIME CHANNEL & POLLING) ---
  public startRealtimeSync() {
    if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return;
    if (!isSupabaseConfigured || !supabase || this.currentMode !== 'LIVE') return;
    if (this.realtimeChannel) return;

    console.log('[DataAdapter] Bắt đầu đồng bộ thời gian thực Supabase Cloud...');

    // Lần tải ban đầu
    void this.syncCloudToLocal();

    // 1. Polling dự phòng mỗi 3.5 giây đảm bảo dữ liệu luôn tươi mới
    this.pollInterval = setInterval(() => {
      if (navigator.onLine && this.currentMode === 'LIVE') {
        void this.syncCloudToLocal();
      }
    }, 3500);

    // 2. Kênh Realtime WebSocket độ trễ cực thấp
    try {
      this.realtimeChannel = supabase
        .channel('motocare-live-sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rental_requests' }, async (payload) => {
          if (payload.new && (payload.new as any).id) {
            await db.rental_requests.put(payload.new as any);
            const req = payload.new as RentalRequest;
            const nodes = STATUS_TO_NODES[req.status] || [];
            if (nodes.length > 0) {
              const existingState = await db.process_state.get(req.id);
              if (!existingState) {
                await db.process_state.put({
                  request_id: req.id,
                  waiting_node_ids: nodes,
                  loop_counters: {},
                  variables: {},
                  updated_at: (req as any).updated_at || new Date().toISOString(),
                });
              }
            }
            window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, async (payload) => {
          if (payload.new && (payload.new as any).table_name === 'process_state') {
            const stateData = (payload.new as any).new_data;
            if (stateData?.request_id) {
              await db.process_state.put(stateData);
              window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customer_documents' }, async (payload) => {
          if (payload.new && (payload.new as any).id) {
            await db.customer_documents.put(payload.new as any);
            window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, async (payload) => {
          if (payload.new && (payload.new as any).id) {
            await db.payments.put(payload.new as any);
            window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'contracts' }, async (payload) => {
          if (payload.new && (payload.new as any).id) {
            await db.contracts.put(payload.new as any);
            window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents' }, async (payload) => {
          if (payload.new && (payload.new as any).id) {
            await db.incidents.put(payload.new as any);
            window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail: payload }));
          }
        })
        .on('broadcast', { event: 'STATE_CHANGED' }, () => {
          void this.syncCloudToLocal();
        })
        .subscribe();
    } catch (err) {
      console.warn('[DataAdapter] Đăng ký Realtime channel gặp sự cố:', err);
    }
  }

  public stopRealtimeSync() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.realtimeChannel && supabase) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  // --- 8. ĐỒNG BỘ TOÀN BỘ TỪ LOCAL LÊN CLOUD SUPABASE (SYNC TOÀN DIỆN THỦ CÔNG) ---
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
        states,
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
        db.process_state.toArray(),
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

      // Đồng bộ states qua audit_logs
      for (const st of states) {
        syncOps.push(
          supabase.from('audit_logs').insert({
            table_name: 'process_state',
            record_id: st.request_id,
            action: 'UPSERT',
            new_data: st,
          })
        );
      }

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
}

export const dataAdapter = new DataAdapter();
