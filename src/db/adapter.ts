/* eslint-disable @typescript-eslint/no-explicit-any */
// src/db/adapter.ts
// KIẾN TRÚC ĐỒNG BỘ ĐÁM MÂY 2 LỚP (HYBRID CLOUD STATE ARCHITECTURE)
//
//  Lớp 1 - LOCAL (Dexie/IndexedDB): nguồn dữ liệu tức thời cho UI (useLiveQuery), hoạt động cả khi offline.
//  Lớp 2 - CLOUD (Supabase/PostgreSQL): nguồn chân lý dùng chung giữa các thiết bị.
//
//  • ĐẨY LÊN (Local → Cloud): Dexie hooks bắt MỌI thao tác add/put/update/delete trên các bảng nghiệp vụ,
//    gom vào Outbox (lưu localStorage, chống mất khi offline/F5) rồi đẩy theo lô sau ~40ms.
//  • KÉO VỀ (Cloud → Local): Realtime postgres_changes (INSERT/UPDATE/DELETE trên mọi bảng) + Broadcast,
//    kèm đối soát toàn phần định kỳ 30s / khi có mạng lại. Ghi từ cloud được đánh dấu "remote" để không đẩy ngược.
//  • CÔ LẬP DỮ LIỆU: Khi phiên là khách hàng, chỉ kéo hồ sơ của chính khách đó (đơn khác chỉ lấy cột
//    phục vụ kiểm tra xe trống, không có thông tin cá nhân) và dọn dữ liệu nhạy cảm không thuộc về họ.

import Dexie, { type Table } from 'dexie';
import type { RealtimeChannel } from '@supabase/supabase-js';
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

/** Các bảng nghiệp vụ được đồng bộ 2 chiều tự động (khóa chính đều là `id`). */
export const SYNCED_TABLES = [
  'profiles',
  'vehicles',
  'rental_requests',
  'customer_documents',
  'payments',
  'contracts',
  'vehicle_schedule',
  'inspections',
  'handovers',
  'damage_findings',
  'statements',
  'settlements',
  'extension_requests',
  'partners',
  'incidents',
  'incident_dispatches',
  'maintenance_orders',
  'notifications',
  'process_events',
] as const;
type SyncedTable = (typeof SYNCED_TABLES)[number];
const SYNCED_SET = new Set<string>(SYNCED_TABLES);

/** Bảng con gắn với hồ sơ thuê qua cột `request_id` (dùng để cô lập dữ liệu khách hàng). */
const REQUEST_SCOPED: SyncedTable[] = [
  'customer_documents',
  'payments',
  'contracts',
  'inspections',
  'handovers',
  'damage_findings',
  'statements',
  'settlements',
  'extension_requests',
  'incidents',
  'maintenance_orders',
  'process_events',
];
/** Bảng dùng chung, không chứa thông tin cá nhân → mọi vai trò đều được kéo đầy đủ. */
const PUBLIC_TABLES: SyncedTable[] = ['vehicles', 'partners', 'vehicle_schedule'];
/** Cột tối thiểu của đơn thuê người khác, đủ cho kiểm tra xe trống (engine/fleet.ts). */
const RENTAL_PUBLIC_COLUMNS = 'id,customer_id,vehicle_id,status,start_at,end_at,created_at';

const PROCESS_STATE = 'process_state';
const OUTBOX_KEY = 'motocare_sync_outbox';
const MODE_KEY = 'motocare_data_mode_v2';
const FULL_SYNC_INTERVAL_MS = 30_000;
const FLUSH_DELAY_MS = 40;
const REMOTE_FLAG = '__motocareRemote';

export interface SyncScope {
  role: 'khach_hang' | 'nhan_vien' | 'quan_ly' | 'system';
  id: string;
}

type OutboxOp = { table: string; key: string; op: 'upsert' | 'delete' };
type Row = Record<string, any>;

class DataAdapter {
  private currentMode: DataSourceMode = 'DEMO';
  private listeners: ((mode: DataSourceMode) => void)[] = [];
  private realtimeChannel: RealtimeChannel | null = null;
  private pollInterval: ReturnType<typeof setInterval> | null = null;
  private isSyncing = false;
  private resyncRequested = false;

  private scope: SyncScope | null = null;
  private outbox = new Map<string, OutboxOp>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private hooksInstalled = false;
  private suppressDepth = 0;
  private processStateTableAvailable = true;
  private updateEventTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (import.meta.env.MODE === 'test') {
      this.currentMode = 'DEMO';
      return;
    }

    // Mặc định LIVE khi đã cấu hình Supabase (bỏ qua lựa chọn DEMO cũ do mất mạng ở phiên bản trước).
    // Chỉ dùng DEMO khi VITE_APP_MODE=demo hoặc người dùng tự chọn DEMO ở phiên bản này.
    if (typeof localStorage !== 'undefined') localStorage.removeItem('motocare_data_mode');
    const forcedDemo = String(import.meta.env.VITE_APP_MODE || '').toLowerCase() === 'demo';
    const savedMode = typeof localStorage !== 'undefined' ? (localStorage.getItem(MODE_KEY) as DataSourceMode | null) : null;
    if (forcedDemo || !isSupabaseConfigured) {
      this.currentMode = 'DEMO';
    } else {
      this.currentMode = savedMode === 'DEMO' ? 'DEMO' : 'LIVE';
    }

    this.loadOutbox();
    this.installSyncHooks();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  private get cloudEnabled(): boolean {
    return import.meta.env.MODE !== 'test' && isSupabaseConfigured && !!supabase && this.currentMode === 'LIVE';
  }

  private handleNetworkChange() {
    if (!navigator.onLine && this.currentMode === 'LIVE') {
      // Giữ nguyên chế độ LIVE: thao tác offline được ghi vào Outbox và đẩy lên khi có mạng lại.
      console.warn('[DataAdapter] Mất kết nối Internet -> Ghi cục bộ, chờ đồng bộ (Outbox).');
    } else if (navigator.onLine && isSupabaseConfigured) {
      console.log('[DataAdapter] Đã có mạng -> Đẩy Outbox và đối soát dữ liệu đám mây');
      if (this.currentMode !== 'LIVE') this.setMode('LIVE');
      this.scheduleFlush();
      void this.syncCloudToLocal();
    }
  }

  public getMode(): DataSourceMode {
    return this.currentMode;
  }

  public setMode(mode: DataSourceMode) {
    this.currentMode = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODE_KEY, mode);
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

  /** Số thao tác cục bộ đang chờ đẩy lên cloud (hiển thị trạng thái đồng bộ). */
  public getPendingCount(): number {
    return this.outbox.size;
  }

  // ===========================================================================
  // PHÂN QUYỀN & CÔ LẬP DỮ LIỆU: phạm vi đồng bộ theo phiên đăng nhập
  // ===========================================================================
  public setSyncScope(scope: SyncScope | null) {
    const changed = this.scope?.id !== scope?.id || this.scope?.role !== scope?.role;
    this.scope = scope;
    if (!changed) return;
    if (scope?.role === 'khach_hang') {
      void this.purgeForeignCustomerData(scope.id);
    }
    void this.syncCloudToLocal();
  }

  private isCustomerScope(): boolean {
    return this.scope?.role === 'khach_hang';
  }

  /** Dọn dữ liệu nhạy cảm (hồ sơ, giấy tờ, thanh toán...) không thuộc khách đang đăng nhập khỏi máy. */
  private async purgeForeignCustomerData(customerId: string) {
    try {
      const own = await db.rental_requests.where('customer_id').equals(customerId).primaryKeys();
      const ownIds = new Set(own);
      await this.applyRemote(async () => {
        for (const t of REQUEST_SCOPED) {
          await (db.table(t) as Table<Row, string>).filter((r) => !!r.request_id && !ownIds.has(r.request_id)).delete();
        }
        await db.process_state.filter((s) => !ownIds.has(s.request_id)).delete();
        await db.notifications.filter((n) => !!n.user_id && n.user_id !== customerId).delete();
        await db.profiles.filter((p) => p.id !== customerId && p.role === 'khach_hang').delete();
        await db.incident_dispatches.clear();
      }, [...REQUEST_SCOPED, 'process_state', 'notifications', 'profiles', 'incident_dispatches']);
    } catch (err) {
      console.warn('[DataAdapter] Lỗi dọn dữ liệu ngoài phạm vi khách hàng:', err);
    }
  }

  /** Kiểm tra một bản ghi từ cloud có thuộc phạm vi phiên hiện tại không. */
  private async inScope(table: string, row: Row): Promise<boolean> {
    if (!this.isCustomerScope() || !this.scope) return true;
    const me = this.scope.id;
    if ((PUBLIC_TABLES as string[]).includes(table)) return true;
    if (table === 'rental_requests') return row.customer_id === me;
    if (table === 'profiles') return row.id === me || row.role !== 'khach_hang';
    if (table === 'notifications') return row.user_id === me;
    if (table === 'incident_dispatches') return !!(row.incident_id && (await db.incidents.get(row.incident_id)));
    if (row.request_id) {
      const req = await db.rental_requests.get(row.request_id);
      return req?.customer_id === me;
    }
    return false;
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
    if (this.currentMode === 'LIVE' && supabase && !this.isCustomerScope()) {
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

  /** Customer trips must use the same cloud status as the staff timeline, not a stale browser snapshot. */
  public async getCustomerRentalRequests(customerId: string): Promise<RentalRequest[]> {
    if (this.currentMode === 'LIVE' && supabase && (typeof navigator === 'undefined' || navigator.onLine)) {
      const { data, error } = await supabase.from('rental_requests').select('*')
        .eq('customer_id', customerId).order('created_at', { ascending: false });
      if (error) throw error;
      // An empty cloud result is authoritative too. Do not bring deleted local trips back into the list.
      return (data ?? []) as RentalRequest[];
    }
    return db.rental_requests.where('customer_id').equals(customerId).reverse().sortBy('created_at');
  }

  // ===========================================================================
  // LỚP ĐẨY LÊN: Dexie hooks → Outbox → Supabase
  // ===========================================================================
  private installSyncHooks() {
    if (this.hooksInstalled) return;
    this.hooksInstalled = true;
    const skip = (trans: unknown) =>
      this.suppressDepth > 0 || Boolean((trans as Record<string, unknown>)[REMOTE_FLAG]);

    for (const name of [...SYNCED_TABLES, PROCESS_STATE]) {
      const table = db.table(name);
      const keyPath = (table.schema.primKey.keyPath as string) || 'id';

      table.hook('creating', (primKey, obj, trans) => {
        if (skip(trans)) return;
        const key = (primKey ?? (obj as Row)[keyPath]) as string;
        if (key) trans.on('complete', () => this.enqueue(name, key, 'upsert'));
      });
      table.hook('updating', (_mods, primKey, _obj, trans) => {
        if (skip(trans)) return;
        trans.on('complete', () => this.enqueue(name, primKey as string, 'upsert'));
      });
      table.hook('deleting', (primKey, _obj, trans) => {
        if (skip(trans)) return;
        // process_state không xóa trên cloud (lịch sử nằm trong audit_logs)
        if (name === PROCESS_STATE) return;
        trans.on('complete', () => this.enqueue(name, primKey as string, 'delete'));
      });
    }
  }

  /** Chạy thao tác chỉ ghi cục bộ, KHÔNG đẩy lên cloud (VD: nạp dữ liệu mẫu khi khởi tạo máy mới). */
  public async withoutCloudSync<T>(fn: () => Promise<T>): Promise<T> {
    this.suppressDepth++;
    try {
      return await fn();
    } finally {
      this.suppressDepth--;
    }
  }

  private enqueue(table: string, key: string, op: 'upsert' | 'delete') {
    if (!key) return;
    this.outbox.set(`${table}::${key}`, { table, key, op });
    this.saveOutbox();
    this.scheduleFlush();
  }

  private loadOutbox() {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(OUTBOX_KEY) : null;
      if (raw) for (const op of JSON.parse(raw) as OutboxOp[]) this.outbox.set(`${op.table}::${op.key}`, op);
    } catch {
      // Outbox hỏng -> bỏ qua
    }
  }

  private saveOutbox() {
    try {
      localStorage.setItem(OUTBOX_KEY, JSON.stringify([...this.outbox.values()]));
    } catch {
      // bỏ qua (quota / private mode)
    }
  }

  private scheduleFlush() {
    if (this.flushTimer || !this.cloudEnabled) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flushOutbox();
    }, FLUSH_DELAY_MS);
  }

  /** Đẩy toàn bộ Outbox lên cloud theo lô; thao tác lỗi được giữ lại để thử lại. */
  public async flushOutbox(): Promise<void> {
    if (!this.cloudEnabled || this.isFlushing || this.outbox.size === 0) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;
    this.isFlushing = true;

    const batch = [...this.outbox.entries()];
    const done: string[] = [];
    const changed: { table: string; id: string }[] = [];

    try {
      // Gom theo bảng
      const groups = new Map<string, { upserts: string[]; deletes: string[]; entries: string[] }>();
      for (const [k, op] of batch) {
        const g = groups.get(op.table) ?? { upserts: [], deletes: [], entries: [] };
        (op.op === 'upsert' ? g.upserts : g.deletes).push(op.key);
        g.entries.push(k);
        groups.set(op.table, g);
      }

      for (const [table, g] of groups) {
        if (table === PROCESS_STATE) {
          const states = (await db.process_state.bulkGet(g.upserts)).filter(Boolean) as ProcessState[];
          let ok = true;
          for (const st of states) ok = (await this.writeProcessState(st)) && ok;
          if (ok) {
            done.push(...g.entries);
            states.forEach((s) => changed.push({ table, id: s.request_id }));
          }
          continue;
        }

        let ok = true;
        if (g.upserts.length > 0) {
          const rows = ((await db.table(table).bulkGet(g.upserts)) as (Row | undefined)[]).filter(Boolean) as Row[];
          if (rows.length > 0) {
            const { error } = await supabase!.from(table).upsert(rows, { onConflict: 'id' });
            if (error) {
              ok = false;
              console.warn(`[DataAdapter] Lỗi đẩy ${table} lên cloud:`, error.message);
            } else rows.forEach((r) => changed.push({ table, id: r.id }));
          }
        }
        if (g.deletes.length > 0) {
          const { error } = await supabase!.from(table).delete().in('id', g.deletes);
          if (error) {
            ok = false;
            console.warn(`[DataAdapter] Lỗi xóa ${table} trên cloud:`, error.message);
          } else g.deletes.forEach((id) => changed.push({ table, id }));
        }
        if (ok) done.push(...g.entries);
      }
    } catch (err) {
      console.warn('[DataAdapter] Ngoại lệ khi đẩy Outbox:', err);
    } finally {
      // Chỉ xóa entry nếu không bị ghi đè bởi thao tác mới hơn trong lúc đang đẩy
      for (const k of done) {
        const original = batch.find(([bk]) => bk === k)?.[1];
        if (this.outbox.get(k) === original) this.outbox.delete(k);
      }
      this.saveOutbox();
      this.isFlushing = false;
      if (changed.length > 0) this.broadcastChange(changed);
      // Còn thao tác mới phát sinh trong lúc đẩy -> đẩy tiếp; lỗi -> thử lại sau 5s
      if (this.outbox.size > 0) {
        const allFailed = done.length === 0;
        setTimeout(() => this.scheduleFlush(), allFailed ? 5000 : 0);
      }
    }
  }

  /** Ghi trạng thái BPMN lên cloud: audit_logs (lịch sử) + bảng process_state (nếu có). */
  private async writeProcessState(state: ProcessState, actorId?: string): Promise<boolean> {
    const { error } = await supabase!.from('audit_logs').insert({
      table_name: PROCESS_STATE,
      record_id: state.request_id,
      action: 'UPSERT',
      new_data: state,
      actor_id: actorId ?? null,
    });
    if (error) {
      console.warn('[DataAdapter] Lỗi ghi process_state vào audit_logs:', error.message);
      return false;
    }
    if (this.processStateTableAvailable) {
      const res = await supabase!.from(PROCESS_STATE).upsert(state, { onConflict: 'request_id' });
      if (res.error && (res.error.code === '42P01' || res.error.code === 'PGRST205')) {
        this.processStateTableAvailable = false; // chưa tạo bảng riêng -> chỉ dùng audit_logs
      }
    }
    return true;
  }

  // --- API tương thích ngược: các lời gọi tường minh chỉ cần xếp vào Outbox (gộp trùng tự động) ---
  public async pushToCloud(table: string, record: any): Promise<void> {
    if (!this.cloudEnabled) return;
    const key = record?.id ?? record?.request_id ?? record?.user_id;
    if (SYNCED_SET.has(table) && key) this.enqueue(table, key, 'upsert');
  }

  public async pushProcessStateToCloud(state: ProcessState, actorId?: string): Promise<void> {
    void actorId;
    if (!this.cloudEnabled || !state?.request_id) return;
    this.enqueue(PROCESS_STATE, state.request_id, 'upsert');
  }

  // --- PHÁT THÔNG ĐIỆP REALTIME ĐẾN CÁC THIẾT BỊ KHÁC ---
  public broadcastChange(changes: { table: string; id?: string }[] | string, id?: string) {
    if (!this.realtimeChannel) return;
    const list = typeof changes === 'string' ? [{ table: changes, id }] : changes;
    try {
      void this.realtimeChannel.send({
        type: 'broadcast',
        event: 'STATE_CHANGED',
        payload: { changes: list, time: Date.now() },
      });
    } catch {
      // bỏ qua
    }
  }

  // ===========================================================================
  // LỚP KÉO VỀ: Cloud → Dexie (đánh dấu remote để không đẩy ngược)
  // ===========================================================================
  private async applyRemote(fn: () => Promise<void>, tables: string[]) {
    await db.transaction('rw', tables.map((t) => db.table(t)), async () => {
      (Dexie.currentTransaction as unknown as Record<string, unknown>)[REMOTE_FLAG] = true;
      await fn();
    });
  }

  private emitDataUpdated(detail: unknown) {
    if (typeof window === 'undefined') return;
    // Gộp nhiều sự kiện liên tiếp thành 1 lần re-render
    if (this.updateEventTimer) clearTimeout(this.updateEventTimer);
    this.updateEventTimer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent('motocare_data_updated', { detail }));
    }, 30);
  }

  /** Nạp các bản ghi cloud vào Dexie, bỏ qua bản ghi đang có thay đổi cục bộ chưa đẩy. */
  private async putRemoteRows(table: string, rows: Row[]) {
    const fresh = rows.filter((r) => r?.id && !this.outbox.has(`${table}::${r.id}`));
    if (fresh.length === 0) return;
    await this.applyRemote(async () => {
      await db.table(table).bulkPut(fresh);
    }, [table]);
  }

  /** Khôi phục process_state từ audit_logs (bản mới nhất mỗi hồ sơ, không đè bản cục bộ mới hơn). */
  private async putRemoteStates(states: ProcessState[]) {
    const valid = states.filter((s) => s?.request_id && !this.outbox.has(`${PROCESS_STATE}::${s.request_id}`));
    if (valid.length === 0) return;
    await this.applyRemote(async () => {
      for (const st of valid) {
        const local = await db.process_state.get(st.request_id);
        if (!local || !local.updated_at || !st.updated_at || st.updated_at >= local.updated_at) {
          await db.process_state.put(st);
        }
      }
    }, [PROCESS_STATE]);
  }

  /** Bổ sung process_state cho đơn chưa có (suy ra từ trạng thái đơn). */
  private async ensureStatesForRequests(reqs: RentalRequest[]) {
    const missing: ProcessState[] = [];
    for (const req of reqs) {
      const nodes = STATUS_TO_NODES[req.status] || [];
      if (nodes.length === 0) continue;
      if (!(await db.process_state.get(req.id))) {
        missing.push({
          request_id: req.id,
          waiting_node_ids: nodes,
          loop_counters: {},
          variables: { preferred_vehicle_type: 'xe_so' },
          updated_at: (req as any).updated_at || new Date().toISOString(),
        });
      }
    }
    if (missing.length > 0) {
      await this.applyRemote(async () => {
        await db.process_state.bulkPut(missing);
      }, [PROCESS_STATE]);
    }
  }

  // --- ĐỐI SOÁT TOÀN PHẦN CLOUD → LOCAL (theo phạm vi phân quyền) ---
  public async syncCloudToLocal(): Promise<void> {
    if (!this.cloudEnabled) return;
    if (this.isSyncing) {
      this.resyncRequested = true;
      return;
    }
    this.isSyncing = true;
    const client = supabase!;

    try {
      // Đẩy thay đổi cục bộ trước để không bị dữ liệu cũ trên cloud ghi đè
      await this.flushOutbox();

      const customer = this.isCustomerScope() ? this.scope!.id : null;

      // 1. Đơn thuê (xác định phạm vi hồ sơ)
      let ownRequests: RentalRequest[] = [];
      if (customer) {
        const [own, others] = await Promise.all([
          client.from('rental_requests').select('*').eq('customer_id', customer),
          client.from('rental_requests').select(RENTAL_PUBLIC_COLUMNS).neq('customer_id', customer),
        ]);
        if (own.error) throw own.error;
        ownRequests = (own.data ?? []) as RentalRequest[];
        await this.putRemoteRows('rental_requests', ownRequests);
        if (!others.error) await this.putRemoteRows('rental_requests', (others.data ?? []) as unknown as Row[]);
      } else {
        const all = await client.from('rental_requests').select('*');
        if (all.error) throw all.error;
        ownRequests = (all.data ?? []) as RentalRequest[];
        await this.putRemoteRows('rental_requests', ownRequests);
      }
      const ownIds = ownRequests.map((r) => r.id);

      // 2. Các bảng còn lại
      const tasks = SYNCED_TABLES.filter((t) => t !== 'rental_requests' && t !== 'incident_dispatches').map(async (t) => {
        let q = client.from(t).select('*');
        if (customer && !(PUBLIC_TABLES as string[]).includes(t)) {
          if (t === 'profiles') q = q.or(`id.eq.${customer},role.neq.khach_hang`);
          else if (t === 'notifications') q = q.eq('user_id', customer);
          else if (ownIds.length === 0) return;
          else q = q.in('request_id', ownIds);
        }
        const { data, error } = await q;
        if (error) {
          console.warn(`[DataAdapter] Lỗi kéo ${t}:`, error.message);
          return;
        }
        await this.putRemoteRows(t, (data ?? []) as Row[]);
      });
      await Promise.all(tasks);

      // 3. Điều phối cứu hộ (phụ thuộc sự cố)
      let dq = null;
      if (customer) {
        const incIds = (await db.incidents.where('request_id').anyOf(ownIds).primaryKeys()) as string[];
        if (incIds.length > 0) {
          dq = client.from('incident_dispatches').select('*').in('incident_id', incIds);
        }
      } else {
        dq = client.from('incident_dispatches').select('*');
      }
      if (dq) {
        const { data, error } = await dq;
        if (!error) await this.putRemoteRows('incident_dispatches', (data ?? []) as Row[]);
      }

      // 4. Trạng thái BPMN từ audit_logs (mới nhất trước)
      let sq = null;
      if (customer) {
        if (ownIds.length > 0) {
          sq = client
            .from('audit_logs')
            .select('record_id,new_data,created_at')
            .eq('table_name', PROCESS_STATE)
            .in('record_id', ownIds)
            .order('created_at', { ascending: false })
            .limit(2000);
        }
      } else {
        sq = client
          .from('audit_logs')
          .select('record_id,new_data,created_at')
          .eq('table_name', PROCESS_STATE)
          .order('created_at', { ascending: false })
          .limit(2000);
      }
      if (sq) {
        const { data, error } = await sq;
        if (!error && data) {
          const seen = new Set<string>();
          const latest: ProcessState[] = [];
          for (const log of data as Row[]) {
            const rowLog = log as { record_id: string; new_data?: ProcessState };
            if (!seen.has(rowLog.record_id) && rowLog.new_data?.request_id) {
              seen.add(rowLog.record_id);
              latest.push(rowLog.new_data);
            }
          }
          await this.putRemoteStates(latest);
        }
      }
      await this.ensureStatesForRequests(ownRequests);

      this.emitDataUpdated({ source: 'cloud_sync' });
    } catch (err) {
      console.warn('[DataAdapter] Lỗi đồng bộ đám mây về máy:', err);
    } finally {
      this.isSyncing = false;
      if (this.resyncRequested) {
        this.resyncRequested = false;
        void this.syncCloudToLocal();
      }
    }
  }

  /** Xử lý một sự kiện postgres_changes (INSERT/UPDATE/DELETE) từ Supabase Realtime. */
  private async handleRealtimeChange(payload: { table: string; eventType: string; new?: Row; old?: Row }) {
    const table: string = payload.table;
    try {
      if (table === 'audit_logs') {
        const row = payload.new as Row;
        if (row?.table_name !== PROCESS_STATE || !row.new_data?.request_id) return;
        if (!(await this.inScope('rental_requests', (await db.rental_requests.get(row.record_id)) ?? {}))) return;
        await this.putRemoteStates([row.new_data as ProcessState]);
        this.emitDataUpdated(payload);
        return;
      }
      if (!SYNCED_SET.has(table)) return;

      if (payload.eventType === 'DELETE') {
        const id = (payload.old as Row)?.id;
        if (!id || this.outbox.has(`${table}::${id}`)) return;
        await this.applyRemote(async () => {
          await db.table(table).delete(id);
        }, [table]);
        this.emitDataUpdated(payload);
        return;
      }

      const row = payload.new as Row;
      if (!row?.id) return;
      if (!(await this.inScope(table, row))) {
        // Đơn của khách khác: chỉ giữ cột phục vụ kiểm tra xe trống
        if (table === 'rental_requests') {
          const pick: Row = {};
          for (const c of RENTAL_PUBLIC_COLUMNS.split(',')) pick[c] = row[c];
          await this.putRemoteRows(table, [pick]);
        }
        return;
      }
      await this.putRemoteRows(table, [row]);
      if (table === 'rental_requests') await this.ensureStatesForRequests([row as RentalRequest]);
      this.emitDataUpdated(payload);
    } catch (err) {
      console.warn('[DataAdapter] Lỗi xử lý sự kiện realtime:', err);
    }
  }

  // --- BẮT ĐẦU ĐỒNG BỘ THỜI GIAN THỰC (REALTIME CHANNEL + ĐỐI SOÁT ĐỊNH KỲ) ---
  public startRealtimeSync() {
    if (import.meta.env.MODE === 'test' || typeof window === 'undefined') return;
    if (!this.cloudEnabled) return;
    if (this.realtimeChannel) return;

    console.log('[DataAdapter] Bắt đầu đồng bộ thời gian thực Supabase Cloud...');

    // Lần đối soát ban đầu + đẩy Outbox còn tồn từ phiên trước
    this.scheduleFlush();
    void this.syncCloudToLocal();

    // Đối soát toàn phần dự phòng (bắt các thay đổi lỡ khi WebSocket rớt)
    this.pollInterval = setInterval(() => {
      if (navigator.onLine && this.currentMode === 'LIVE') void this.syncCloudToLocal();
    }, FULL_SYNC_INTERVAL_MS);

    try {
      this.realtimeChannel = supabase!
        .channel('motocare-live-sync', { config: { broadcast: { self: false } } })
        .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
          void this.handleRealtimeChange(payload);
        })
        .on('broadcast', { event: 'STATE_CHANGED' }, () => {
          // Thiết bị khác vừa ghi xong -> đối soát ngay (phòng khi postgres_changes chưa bật cho bảng)
          void this.syncCloudToLocal();
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') void this.syncCloudToLocal();
        });
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
