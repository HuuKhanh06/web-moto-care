// src/components/common/SyncStatus.tsx
// Đèn báo đồng bộ trực tuyến (Live / Syncing / Offline/Demo) - Lấy cảm hứng từ nút syncdot của GOODBIKE

import { useState, useEffect } from 'react';
import { dataAdapter, DataSourceMode } from '@/db/adapter';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Cloud, Database } from 'lucide-react';

export function SyncStatus() {
  const [mode, setMode] = useState<DataSourceMode>(dataAdapter.getMode());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const unsub = dataAdapter.subscribeMode((newMode) => setMode(newMode));
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsub();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleMode = async () => {
    if (!isSupabaseConfigured) {
      alert('Chưa cấu hình Supabase URL và Key trong .env. Vui lòng xem hướng dẫn file supabase/schema.sql');
      return;
    }
    const nextMode = mode === 'LIVE' ? 'DEMO' : 'LIVE';
    dataAdapter.setMode(nextMode);
  };

  const isLive = mode === 'LIVE' && isOnline && isSupabaseConfigured;

  return (
    <button
      type="button"
      onClick={toggleMode}
      title={
        isLive
          ? 'Đang kết nối Realtime với Supabase Cloud. Bấm để đổi sang Demo Dexie.'
          : 'Đang chạy cơ sở dữ liệu Dexie cục bộ (Ngoại tuyến). Bấm để kết nối Supabase Cloud.'
      }
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all border ${
        isLive
          ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
          : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
      }`}
    >
      <span className="relative flex h-2 w-2">
        {isLive && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        )}
        <span
          className={`relative inline-flex rounded-full h-2 w-2 ${
            isLive ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        ></span>
      </span>

      {isLive ? (
        <span className="flex items-center gap-1">
          <Cloud className="w-3.5 h-3.5 text-emerald-600" />
          <span>Cloud Live</span>
        </span>
      ) : (
        <span className="flex items-center gap-1">
          <Database className="w-3.5 h-3.5 text-slate-500" />
          <span>Local Dexie</span>
        </span>
      )}
    </button>
  );
}
