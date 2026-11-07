// src/app/providers.tsx
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { ToastContainer } from '@/components/ui';
import { DevPanel } from '@/components/DevPanel';
import { useAuthStore } from '@/features/auth/authStore';
import { db } from '@/db';
import { dataAdapter, inferWaitingNodesFromRequestStatus } from '@/db/adapter';
import { seedDatabase } from '@/db/seed';
import { cleanupLegacyMockData } from '@/db/cleanupLegacyMockData';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from '@/components/ui/toastStore';
import type { RentalRequest, VehicleSchedule, Payment, Contract } from '@/db/types';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    // 1. Tự động kiểm tra và khởi tạo dữ liệu sạch (30 xe, 3 tài khoản vận hành, 0 tài khoản/đơn ảo)
    async function initApp() {
      try {
        const WIPE_KEY = 'motocare_wiped_customer_v20261107';
        if (!localStorage.getItem(WIPE_KEY)) {
          console.log('[AutoSync] Thực hiện xóa sạch dữ liệu khách hàng cũ để đồng bộ hóa máy chủ...');
          await dataAdapter.wipeAllCustomerData();
          localStorage.setItem(WIPE_KEY, 'true');
        }

        const count = await db.auth_accounts.count();
        const vCount = await db.vehicles.count();
        // Kiểm tra nếu còn tài khoản khách mẫu cũ thì đồng bộ lại DB sạch sẽ
        const legacyCustomer = await db.auth_accounts.where('email').equalsIgnoreCase('khachhang1@gmail.com').first();
        if (count === 0 || vCount < 30 || legacyCustomer) {
          console.log(`[AutoSync] Khởi tạo dữ liệu sạch (30 xe, 3 tài khoản vận hành)`);
          await seedDatabase();
        }

        // Kéo dữ liệu mới nhất từ Supabase Cloud về Dexie
        await dataAdapter.pullCloudToLocal();
      } catch (err) {
        console.error('Auto seed check error:', err);
      }
      // Dọn sạch tàn dư mock NGUYEN VAN A nếu có
      await cleanupLegacyMockData(false);
      await restoreSession();
    }
    initApp();

    // 2. Quản lý Service Worker: Tự động hủy đăng ký và xóa cache khi ở chế độ dev
    if ('serviceWorker' in navigator) {
      if (!import.meta.env.PROD) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
        if ('caches' in window) {
          caches.keys().then((keys) => {
            for (const key of keys) {
              caches.delete(key);
            }
          });
        }
      } else {
        navigator.serviceWorker.register('./sw.js').catch((err) => {
          console.warn('PWA ServiceWorker registration failed:', err);
        });
      }
    }

    // 3. Lắng nghe Realtime từ Supabase (Đồng bộ tức thời giữa 2 hay nhiều thiết bị)
    if (isSupabaseConfigured && supabase) {
      const activeClient = supabase;
      const channel = activeClient
        .channel('realtime_all_events')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rental_requests' },
          async (payload) => {
            console.log('[Supabase Realtime] rental_requests changed:', payload);
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const newReq = payload.new as RentalRequest;
              await db.rental_requests.put(newReq);
              const nodes = inferWaitingNodesFromRequestStatus(newReq.status);
              await db.process_state.put({
                request_id: newReq.id,
                waiting_node_ids: nodes,
                loop_counters: {},
                variables: {},
                updated_at: new Date().toISOString(),
              });
              if (payload.eventType === 'INSERT') {
                toast.info(`Có đơn đặt xe mới: #${newReq.id.slice(-6).toUpperCase()}`);
              }
            } else if (payload.eventType === 'DELETE') {
              const oldReq = payload.old as { id: string };
              if (oldReq?.id) {
                await db.rental_requests.delete(oldReq.id);
                await db.process_state.delete(oldReq.id);
              }
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'vehicle_schedule' },
          async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await db.vehicle_schedule.put(payload.new as VehicleSchedule);
            } else if (payload.eventType === 'DELETE') {
              const oldItem = payload.old as { id: string };
              if (oldItem?.id) await db.vehicle_schedule.delete(oldItem.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'payments' },
          async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await db.payments.put(payload.new as Payment);
            } else if (payload.eventType === 'DELETE') {
              const oldItem = payload.old as { id: string };
              if (oldItem?.id) await db.payments.delete(oldItem.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'contracts' },
          async (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              await db.contracts.put(payload.new as Contract);
            } else if (payload.eventType === 'DELETE') {
              const oldItem = payload.old as { id: string };
              if (oldItem?.id) await db.contracts.delete(oldItem.id);
            }
          }
        )
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'incidents' },
          (payload) => {
            console.log('[Supabase Realtime] incidents changed:', payload);
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as { incident_code?: string } | null;
              toast.warning(`SOS Khẩn cấp! Sự cố mới được báo: ${newRecord?.incident_code}`);
            }
          }
        )
        .subscribe();

      return () => {
        activeClient.removeChannel(channel);
      };
    }
  }, [restoreSession]);

  return (
    <HashRouter>
      {children}
      <ToastContainer />
      <DevPanel />
    </HashRouter>
  );
}
