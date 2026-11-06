// src/components/layout/NotificationBell.tsx
// Chuông thông báo hiển thị thời gian thực từ bảng notifications của Dexie

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useAuthStore } from '@/features/auth/authStore';
import { formatDateTime } from '@/lib/format';
import { Bell, CheckCheck, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Đọc danh sách thông báo theo actor ID
  const notifications = useLiveQuery(
    async () => {
      if (!currentActor) return [];
      return db.notifications
        .where('user_id')
        .equals(currentActor.id)
        .reverse()
        .sortBy('created_at');
    },
    [currentActor?.id],
    []
  );

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const markAllAsRead = async () => {
    if (!currentActor) return;
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    for (const id of unreadIds) {
      await db.notifications.update(id, { is_read: true });
    }
  };

  const handleNotificationClick = async (n: { id: string; request_id?: string }) => {
    await db.notifications.update(n.id, { is_read: true });
    setOpen(false);

    if (n.request_id) {
      const req = await db.rental_requests.get(n.request_id);
      if (req) {
        if (req.status === 'CHO_HO_SO') {
          navigate(`/kh/02?requestId=${req.id}`);
          return;
        }
        if (req.status === 'CHO_COC') {
          navigate(`/kh/03?requestId=${req.id}`);
          return;
        }
        if (req.status === 'CHO_KY') {
          navigate(`/kh/04?requestId=${req.id}`);
          return;
        }
        if (req.status === 'CHO_BAN_GIAO' || req.status === 'CHO_KHACH_NHAN') {
          navigate(`/kh/05?requestId=${req.id}`);
          return;
        }
      }
      navigate('/kh/06');
    } else {
      navigate('/kh/06');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-xl text-slate-600 hover:text-brand-700 hover:bg-slate-100 transition-colors"
        title="Thông báo"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popup */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-slate-800">Thông báo</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-brand-100 text-brand-800">
                  {unreadCount} mới
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Đánh dấu đã đọc
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Bạn chưa có thông báo nào.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={cn(
                    'p-3.5 transition-colors cursor-pointer text-left group',
                    n.is_read ? 'bg-white hover:bg-slate-50' : 'bg-brand-50/40 hover:bg-brand-50/70'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn('text-xs leading-relaxed', n.is_read ? 'text-slate-600' : 'text-slate-900 font-medium')}>
                      {n.message}
                    </p>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      {!n.is_read && (
                        <span className="w-2 h-2 rounded-full bg-brand-600" />
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {formatDateTime(n.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
