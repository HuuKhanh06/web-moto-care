// src/components/layout/CustomerLayout.tsx
// Khung giao diện dành cho Khách hàng (Mobile-first Bottom Nav + Desktop Header)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { SyncStatus } from '@/components/common/SyncStatus';
import { Logo } from '@/components/common/Logo';
import { BpmnToggleSwitch } from '@/components/common/BpmnToggleSwitch';
import { cn } from '@/lib/utils';
import {
  Bike,
  ClipboardList,
  AlertTriangle,
  LogOut,
  PlusCircle,
} from 'lucide-react';

export function CustomerLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col pb-16 md:pb-0">
      {/* Top Header cho Desktop & Tablet */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <Logo size="md" />
            <span className="hidden sm:inline-block px-2.5 py-0.5 text-[10px] font-bold bg-brand-50 text-brand-700 border border-brand-200/60 rounded-full">
              Khách hàng
            </span>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-1.5 text-sm font-medium">
            <NavLink
              to="/kh/06"
              className={({ isActive }) =>
                cn(
                  'px-3.5 py-2 rounded-xl transition-all duration-200',
                  isActive ? 'bg-brand-50/80 text-brand-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                )
              }
            >
              Chuyến đi của tôi
            </NavLink>
            <NavLink
              to="/kh/01"
              className={({ isActive }) =>
                cn(
                  'px-3.5 py-2 rounded-xl transition-all duration-200 flex items-center gap-1.5',
                  isActive ? 'bg-brand-50/80 text-brand-700 font-bold shadow-xs' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                )
              }
            >
              <PlusCircle className="w-4 h-4 text-brand-600" />
              Đặt xe ngay
            </NavLink>
          </nav>

          {/* User profile & Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <BpmnToggleSwitch />
            <SyncStatus />
            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
                {currentUser?.full_name?.slice(0, 1) || 'K'}
              </div>
              <span className="text-xs font-semibold text-slate-700 max-w-[120px] truncate">
                {currentUser?.full_name}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Đăng xuất"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children || <Outlet />}
      </main>

      {/* Mobile Bottom Navigation Bar (Quy chuẩn mobile-first cho Khách) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-40 px-2 py-1 flex items-center justify-around shadow-lg">
        <NavLink
          to="/kh/06"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center py-1 px-3 text-[10px] font-medium transition-colors',
              isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
            )
          }
        >
          <ClipboardList className="w-5 h-5 mb-0.5" />
          <span>Hồ sơ</span>
        </NavLink>

        <NavLink
          to="/kh/01"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center py-1 px-3 text-[10px] font-medium transition-colors',
              isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
            )
          }
        >
          <Bike className="w-5 h-5 mb-0.5" />
          <span>Thuê xe</span>
        </NavLink>

        <NavLink
          to="/kh/08"
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center py-1 px-3 text-[10px] font-medium transition-colors',
              isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
            )
          }
        >
          <AlertTriangle className="w-5 h-5 mb-0.5" />
          <span>Báo sự cố</span>
        </NavLink>

        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center py-1 px-3 text-[10px] font-medium text-slate-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-5 h-5 mb-0.5" />
          <span>Thoát</span>
        </button>
      </nav>
    </div>
  );
}
