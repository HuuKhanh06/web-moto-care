// src/db/adapter.ts
// Dual-Mode Adapter: Điều phối luồng dữ liệu thông minh giữa Dexie (IndexedDB) và Supabase (PostgreSQL Cloud)

import { db } from './index';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import type { RentalRequest, Vehicle } from './types';

export type DataSourceMode = 'LIVE' | 'DEMO';

class DataAdapter {
  private currentMode: DataSourceMode = 'DEMO';
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

  // --- 3. ĐỒNG BỘ TOÀN DIỆN LÊN CLOUD SUPABASE (SYNC) ---
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
}

export const dataAdapter = new DataAdapter();
