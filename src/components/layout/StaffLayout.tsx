// src/components/layout/StaffLayout.tsx
// Khung giao diện dành cho Nhân viên (Sidebar máy tính + Header chuông thông báo)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { SyncStatus } from '@/components/common/SyncStatus';
import { Logo } from '@/components/common/Logo';
import { BpmnToggleSwitch } from '@/components/common/BpmnToggleSwitch';
import { cn } from '@/lib/utils';
import {
  Inbox,
  Wrench,
  Camera,
  KeyRound,
  CheckCircle,
  AlertOctagon,
  Bike,
  LogOut,
  Layers,
  Sparkles,
} from 'lucide-react';

export function StaffLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/nv/01', label: 'Hộp việc điều hành', badge: 'NV-01', icon: Inbox },
    { to: '/nv/03', label: 'Kiểm tra kỹ thuật', badge: 'NV-03', icon: Wrench },
    { to: '/nv/04', label: 'Chụp ảnh bàn giao', badge: 'NV-04', icon: Camera },
    { to: '/nv/05', label: 'Bàn giao xe & khóa', badge: 'NV-05', icon: KeyRound },
    { to: '/nv/06', label: 'Tiếp nhận xe trả', badge: 'NV-06', icon: CheckCircle },
    { to: '/nv/07', label: 'Biên bản hư hại', badge: 'NV-07', icon: AlertOctagon },
    { to: '/ad/01', label: 'Đội xe & Trạng thái', badge: 'AD-01', icon: Bike },
    { to: '/integration-log', label: 'Nhật ký tích hợp', icon: Layers },
    { to: '/ai-log', label: 'Nhật ký AI OCR', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-slate-50/60 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white/90 backdrop-blur-xl border-r border-slate-200/80 hidden md:flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="h-16 px-5 border-b border-slate-200/80 flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Kỹ thuật
          </span>
        </div>

        {/* Navigation */}
        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
            Tác vụ vận hành
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200',
                    isActive
                      ? 'bg-brand-50/90 text-brand-800 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  )
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-brand-600 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-semibold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-200/80">
          <div className="flex items-center gap-2.5 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
              {currentUser?.full_name?.slice(0, 1) || 'N'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-800 truncate">{currentUser?.full_name}</div>
              <div className="text-[11px] text-slate-400 truncate">{currentUser?.phone}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all border border-slate-200/80"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size="sm" />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Layers className="w-4 h-4 text-brand-600" />
            <span>Phân hệ Nhân viên Kỹ thuật & Vận hành</span>
          </div>

          <div className="flex items-center gap-3">
            <BpmnToggleSwitch />
            <SyncStatus />
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile quick navigation */}
        <div className="md:hidden bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 py-2 flex gap-2 overflow-x-auto text-xs">
          <NavLink
            to="/nv/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-100 text-slate-700')
            }
          >
            Hộp việc
          </NavLink>
          <NavLink
            to="/ad/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-100 text-slate-700')
            }
          >
            Danh mục xe
          </NavLink>
        </div>

        {/* Page Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children || <Outlet />}
        </main>
      </div>
    </div>
  );
}
