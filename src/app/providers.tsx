// src/app/providers.tsx
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { ToastContainer } from '@/components/ui';
import { DevPanel } from '@/components/DevPanel';
import { useAuthStore } from '@/features/auth/authStore';
import { db } from '@/db';
import { dataAdapter } from '@/db/adapter';
import { seedDatabase } from '@/db/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from '@/components/ui/toastStore';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    // 1. Tự động kiểm tra và khởi tạo dữ liệu sạch (30 xe, 3 tài khoản vận hành, 0 tài khoản/đơn ảo)
    async function initApp() {
      try {
        const count = await db.auth_accounts.count();
        const vCount = await db.vehicles.count();
        // Kiểm tra nếu còn tài khoản khách mẫu cũ thì đồng bộ lại DB sạch sẽ
        const legacyCustomer = await db.auth_accounts.where('email').equalsIgnoreCase('khachhang1@gmail.com').first();
        if (count === 0 || vCount < 30 || legacyCustomer) {
          console.log(`[AutoSync] Khởi tạo dữ liệu sạch (30 xe, 3 tài khoản vận hành)`);
          // Dữ liệu mẫu chỉ nạp vào máy cục bộ, không ghi đè dữ liệu thật trên cloud
          await dataAdapter.withoutCloudSync(() => seedDatabase());
        }
      } catch (err) {
        console.error('Auto seed check error:', err);
      }
      await restoreSession();
      // Phạm vi đồng bộ theo phiên (cô lập dữ liệu khách hàng) trước khi kéo dữ liệu
      const actor = useAuthStore.getState().currentActor;
      dataAdapter.setSyncScope(actor ? { role: actor.role, id: actor.id } : null);
      // Kích hoạt đồng bộ đám mây Supabase Realtime đa thiết bị
      dataAdapter.startRealtimeSync();
    }
    initApp();

    // Cập nhật phạm vi đồng bộ mỗi khi đăng nhập / đăng xuất / đổi tài khoản
    const unsubscribeAuth = useAuthStore.subscribe((s) => {
      const a = s.currentActor;
      dataAdapter.setSyncScope(a ? { role: a.role, id: a.id } : null);
    });

    // 2. Đăng ký Service Worker cho PWA
    if ('serviceWorker' in navigator && import.meta.env.PROD) {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('PWA ServiceWorker registration failed:', err);
      });
    }

    // 3. Lắng nghe Realtime từ Supabase (nếu đã cấu hình)
    if (isSupabaseConfigured && supabase) {
      const activeClient = supabase;
      const channel = activeClient
        .channel('realtime_all_events')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'rental_requests' },
          (payload) => {
            console.log('[Supabase Realtime] rental_requests changed:', payload);
            if (payload.eventType === 'INSERT') {
              const newRecord = payload.new as { id?: string } | null;
              toast.info(`Có đơn đặt xe mới: #${newRecord?.id?.slice(-6)?.toUpperCase()}`);
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
        unsubscribeAuth();
        activeClient.removeChannel(channel);
      };
    }
    return unsubscribeAuth;
  }, [restoreSession]);

  return (
    <HashRouter>
      {children}
      <ToastContainer />
      <DevPanel />
    </HashRouter>
  );
}
