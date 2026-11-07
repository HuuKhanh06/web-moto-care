// src/components/layout/StaffLayout.tsx
// Khung giao diện chuẩn hóa dành cho Nhân viên (100% Nền sáng, phân quyền rõ ràng)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/common/Logo';
import { cn } from '@/lib/utils';
import {
  Inbox,
  KeyRound,
  Bike,
  Wrench,
  LogOut,
} from 'lucide-react';
import { COPY } from '@/copy';

export function StaffLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUser, logout, currentActor } = useAuthStore();
  const isManager = currentActor?.role === 'quan_ly';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/nv/01', label: COPY.TITLES.STAFF_TASKS, icon: Inbox },
    { to: '/nv/05', label: 'Bàn giao & Nhận xe', icon: KeyRound },
    { to: '/fleet', label: 'Đội xe vận hành', icon: Bike },
    { to: '/nv/10', label: 'Hỗ trợ sự cố', icon: Wrench },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop (Cố định toàn màn hình, không bị trôi/mất khi trang dài) */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col shrink-0 sticky top-0 h-screen z-20">
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-200 flex items-center justify-between shrink-0">
          <Logo size="sm" />
          {isManager ? (
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
              Quản lý
            </span>
          ) : (
            <span className="text-[13px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
              Nhân viên
            </span>
          )}
        </div>

        {/* Menu điều hướng */}
        <nav className="p-3 flex-1 overflow-y-auto space-y-1 min-h-0">
          <span className="px-3 py-2 text-[13px] font-semibold uppercase text-slate-400 tracking-wider block">
            {isManager ? 'Giám sát vận hành' : 'Công việc'}
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

        {/* Thông tin nhân viên / Quản lý & Đăng xuất (Ghim cố định ở đáy, kích thước tinh tế nhỏ gọn) */}
        <div className="p-3 border-t border-slate-200 bg-white shrink-0">
          <div className="flex items-center gap-2.5 mb-2 px-1">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
              isManager ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {currentUser?.full_name?.slice(0, 1) || (isManager ? 'Q' : 'N')}
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-900 truncate block">
                {currentUser?.full_name || (isManager ? 'Quản lý' : 'Nhân viên')}
              </span>
              <span className={`text-[11px] truncate block ${isManager ? 'text-purple-700 font-medium' : 'text-slate-500'}`}>
                {isManager ? 'Quản lý điều hành' : currentUser?.phone || 'Kỹ thuật'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-2.5 text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-slate-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Đăng xuất</span>
          </button>
        </div>
      </aside>

      {/* Khung nội dung chính */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header trên mobile & tablet */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size="sm" />
            {isManager ? (
              <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                Quản lý
              </span>
            ) : (
              <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200">
                Nhân viên
              </span>
            )}
          </div>

          <div className="hidden md:flex items-center gap-2 text-sm text-slate-600 font-semibold">
            <span>{isManager ? 'Hộp việc điều hành & Giám sát vận hành' : 'Phân hệ Nhân viên Kỹ thuật & Vận hành'}</span>
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

        {/* Thanh điều hướng nhanh cho mobile */}
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
