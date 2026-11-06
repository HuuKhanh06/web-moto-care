// src/components/layout/ManagerLayout.tsx
// Khung giao diện chuẩn hóa dành cho Quản lý (100% Nền sáng, nhất quán toàn hệ thống)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/common/Logo';
import { cn } from '@/lib/utils';
import {
  LayoutGrid,
  Calendar,
  FileCheck2,
  AlertTriangle,
  Bike,
  LogOut,
} from 'lucide-react';
import { COPY } from '@/copy';

export function ManagerLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/ql/dashboard', label: COPY.TITLES.MANAGER_DASHBOARD, icon: LayoutGrid },
    { to: '/manager/timeline', label: COPY.TITLES.MANAGER_TIMELINE, icon: Calendar },
    { to: '/ql/01', label: COPY.TITLES.MANAGER_RESOLVE, icon: FileCheck2 },
    { to: '/ql/02', label: COPY.TITLES.MANAGER_ESCALATE, icon: AlertTriangle },
    { to: '/ad/01', label: COPY.TITLES.MANAGER_FLEET, icon: Bike },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
            Quản lý
          </span>
        </div>

        {/* Menu điều hành */}
        <nav className="p-3 flex-1 overflow-y-auto space-y-1">
          <span className="px-3 py-2 text-[13px] font-semibold uppercase text-slate-400 tracking-wider block">
            Điều hành & Thẩm quyền
          </span>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    isActive
                      ? 'bg-teal-50 text-teal-800'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )
                }
              >
                <Icon className="w-5 h-5 text-teal-700 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Thông tin tài khoản & Đăng xuất */}
        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-2.5 mb-3 px-1">
            <div className="w-9 h-9 rounded-full bg-purple-100 text-purple-800 flex items-center justify-center font-semibold text-sm shrink-0">
              {currentUser?.full_name?.slice(0, 1) || 'Q'}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-sm font-semibold text-slate-900 truncate block">
                {currentUser?.full_name || 'Quản lý'}
              </span>
              <span className="text-[13px] text-purple-700 font-semibold truncate block">
                Giám sát vận hành
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-slate-700 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-slate-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Khung nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header trên Mobile & Desktop */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size="sm" />
            <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Quản lý
            </span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 font-semibold">
            <span>Hệ thống Giám sát & Quản lý Toàn diện</span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50"
              title="Đăng xuất"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Thanh điều hướng nhanh trên mobile */}
        <div className="md:hidden bg-white border-b border-slate-200 px-3 py-2 flex gap-2 overflow-x-auto text-sm">
          {menuItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'px-3 py-1.5 rounded-lg whitespace-nowrap text-[13px] font-semibold transition-colors shrink-0',
                  isActive ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        {/* Nội dung trang */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
