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

  // --- 3. ĐỒNG BỘ HAI CHIỀU (SYNC) KHI CẦN ---
  public async syncLocalToCloud(): Promise<{ success: boolean; message: string }> {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, message: 'Chưa cấu hình Supabase URL và Anon Key trong .env' };
    }

    try {
      const [vehicles, rentals, profiles] = await Promise.all([
        db.vehicles.toArray(),
        db.rental_requests.toArray(),
        db.profiles.toArray(),
      ]);

      if (profiles.length > 0) {
        await supabase.from('profiles').upsert(profiles, { onConflict: 'id' });
      }
      if (vehicles.length > 0) {
        await supabase.from('vehicles').upsert(vehicles, { onConflict: 'id' });
      }
      if (rentals.length > 0) {
        await supabase.from('rental_requests').upsert(rentals, { onConflict: 'id' });
      }

      return { success: true, message: `Đã đồng bộ thành công ${rentals.length} đơn và ${vehicles.length} xe lên Supabase Cloud!` };
    } catch (err: any) {
      return { success: false, message: `Lỗi đồng bộ: ${err.message || err}` };
    }
  }
}

export const dataAdapter = new DataAdapter();
