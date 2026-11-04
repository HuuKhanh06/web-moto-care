// src/components/layout/ManagerLayout.tsx
// Khung giao diện dành cho Quản lý (Đầy đủ menu thẩm quyền + Quản trị hệ thống)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { SyncStatus } from '@/components/common/SyncStatus';
import { cn } from '@/lib/utils';
import {
  SlidersHorizontal,
  FileCheck2,
  AlertTriangle,
  Building2,
  Bike,
  LogOut,
  Palette,
  Inbox,
  Activity,
  Sparkles,
  LayoutGrid,
} from 'lucide-react';

export function ManagerLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const { currentUser, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { to: '/manager/timeline', label: 'Sơ đồ xe Timeline (Gantt)', icon: LayoutGrid },
    { to: '/nv/01', label: 'Hộp việc NV-01 (Giám sát)', icon: Inbox },
    { to: '/ql/01', label: 'Xử lý bất đồng QL-01', icon: FileCheck2 },
    { to: '/ql/02', label: 'Sự cố vượt SLA QL-02', icon: AlertTriangle },
    { to: '/dt/01', label: 'Giả lập Đối tác DT-01', icon: Building2 },
    { to: '/ad/01', label: 'Quản trị xe & Data AD-01', icon: Bike },
    { to: '/integration-log', label: 'Nhật ký tích hợp ngoài', icon: Activity },
    { to: '/ai-log', label: 'Nhật ký AI Agent OCR', icon: Sparkles },
    { to: '/style', label: 'Bảng kiểu giao diện (/style)', icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 hidden md:flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black tracking-wider shadow-sm">
            MC
          </div>
          <div>
            <span className="font-extrabold text-base text-white tracking-tight">MOTO CARE</span>
            <span className="block text-[11px] font-semibold text-purple-400">Cổng Quản lý (Admin)</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-slate-500 tracking-wider">
            Thẩm quyền & Quản trị
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-purple-600 text-white font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-2.5 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-purple-900 text-purple-300 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-purple-700">
              {currentUser?.full_name?.slice(0, 1) || 'Q'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser?.full_name}</div>
              <div className="text-[11px] text-purple-400 truncate font-mono">Quản lý cấp cao</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition-colors border border-slate-700"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 md:hidden">
            <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
              MC
            </div>
            <span className="font-bold text-sm text-slate-900">Quản lý</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <SlidersHorizontal className="w-4 h-4 text-purple-600" />
            <span>Phân hệ Quản trị & Phê duyệt</span>
          </div>

          <div className="flex items-center gap-3">
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
        <div className="md:hidden bg-slate-900 text-white px-4 py-2 flex gap-2 overflow-x-auto text-xs">
          <NavLink
            to="/nv/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300')
            }
          >
            Hộp việc
          </NavLink>
          <NavLink
            to="/ad/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300')
            }
          >
            Quản trị AD-01
          </NavLink>
          <NavLink
            to="/dt/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-purple-600 text-white' : 'bg-slate-800 text-slate-300')
            }
          >
            Đối tác DT-01
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
