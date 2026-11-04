// src/components/layout/ManagerLayout.tsx
// Khung giao diện dành cho Quản lý (Đầy đủ menu thẩm quyền + Quản trị hệ thống)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { SyncStatus } from '@/components/common/SyncStatus';
import { Logo } from '@/components/common/Logo';
import { cn } from '@/lib/utils';
import {
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
    { to: '/manager/timeline', label: 'Sơ đồ điều độ Gantt', badge: 'Gantt', icon: LayoutGrid },
    { to: '/nv/01', label: 'Giám sát hộp việc', badge: 'NV-01', icon: Inbox },
    { to: '/ql/01', label: 'Hòa giải tranh chấp', badge: 'QL-01', icon: FileCheck2 },
    { to: '/ql/02', label: 'Xử lý vượt SLA cứu hộ', badge: 'QL-02', icon: AlertTriangle },
    { to: '/dt/01', label: 'Cổng đối tác cứu hộ', badge: 'DT-01', icon: Building2 },
    { to: '/ad/01', label: 'Quản trị đội xe & Dữ liệu', badge: 'AD-01', icon: Bike },
    { to: '/integration-log', label: 'Nhật ký tích hợp ngoài', icon: Activity },
    { to: '/ai-log', label: 'Nhật ký AI Agent OCR', icon: Sparkles },
    { to: '/style', label: 'Bộ Design System & Style', icon: Palette },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-slate-950/80 backdrop-blur-xl border-r border-slate-800/80 hidden md:flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="h-16 px-5 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-black text-white text-xs shadow-xs">
              MC
            </div>
            <div>
              <span className="font-extrabold text-sm text-white tracking-tight">MOTO CARE</span>
              <span className="block text-[10px] font-semibold text-emerald-400">Trung tâm Quản trị</span>
            </div>
          </div>
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
            Manager
          </span>
        </div>

        {/* Navigation */}
        <div className="p-3 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase text-slate-500 tracking-wider">
            Điều hành & Thẩm quyền
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
                      ? 'bg-brand-600 text-white font-bold shadow-md shadow-brand-900/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/80'
                  )
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800/80">
          <div className="flex items-center gap-2.5 mb-3 px-2">
            <div className="w-8 h-8 rounded-full bg-brand-900/40 text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0 border border-brand-700/50">
              {currentUser?.full_name?.slice(0, 1) || 'Q'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-white truncate">{currentUser?.full_name}</div>
              <div className="text-[11px] text-emerald-400 truncate font-mono">Quản lý cấp cao</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-xl transition-all border border-slate-800"
          >
            <LogOut className="w-3.5 h-3.5" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900">
        {/* Top Navbar */}
        <header className="h-16 bg-slate-950/70 backdrop-blur-xl border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 md:hidden">
            <Logo size="sm" />
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Hệ thống Giám sát & Quản trị Toàn diện</span>
          </div>

          <div className="flex items-center gap-3">
            <SyncStatus />
            <NotificationBell />
            <button
              type="button"
              onClick={handleLogout}
              className="md:hidden p-2 rounded-xl text-slate-400 hover:text-red-400 hover:bg-slate-800"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Mobile quick navigation */}
        <div className="md:hidden bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-4 py-2 flex gap-2 overflow-x-auto text-xs">
          <NavLink
            to="/manager/timeline"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-800 text-slate-300')
            }
          >
            Sơ đồ Gantt
          </NavLink>
          <NavLink
            to="/nv/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-800 text-slate-300')
            }
          >
            Hộp việc
          </NavLink>
          <NavLink
            to="/ql/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white font-bold' : 'bg-slate-800 text-slate-300')
            }
          >
            Hòa giải
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
