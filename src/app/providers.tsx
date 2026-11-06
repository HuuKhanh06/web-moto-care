// src/app/providers.tsx
import React, { useEffect } from 'react';
import { HashRouter } from 'react-router-dom';
import { ToastContainer } from '@/components/ui';
import { DevPanel } from '@/components/DevPanel';
import { useAuthStore } from '@/features/auth/authStore';
import { db } from '@/db';
import { seedDatabase } from '@/db/seed';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { toast } from '@/components/ui/toastStore';

interface AppProvidersProps {
  children: React.ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    // 1. Tự động kiểm tra và khởi tạo dữ liệu mẫu nếu IndexedDB trống hoặc chưa đủ 30 xe
    async function initApp() {
      try {
        const count = await db.auth_accounts.count();
        const vCount = await db.vehicles.count();
        if (count === 0 || vCount < 30) {
          console.log(`[AutoSync] Phát hiện dữ liệu xe (${vCount}/30 xe) hoặc DB mới -> Nạp lại 30 xe`);
          await seedDatabase();
        }
      } catch (err) {
        console.error('Auto seed check error:', err);
      }
      await restoreSession();
    }
    initApp();

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
