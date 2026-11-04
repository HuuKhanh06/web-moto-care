// src/components/layout/StaffLayout.tsx
// Khung giao diện dành cho Nhân viên (Sidebar máy tính + Header chuông thông báo)

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
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
    { to: '/nv/01', label: 'Hộp việc NV-01', icon: Inbox },
    { to: '/nv/03', label: 'Kiểm tra xe NV-03', icon: Wrench },
    { to: '/nv/04', label: 'Chụp ảnh xe NV-04', icon: Camera },
    { to: '/nv/05', label: 'Bàn giao xe NV-05', icon: KeyRound },
    { to: '/nv/06', label: 'Nhận xe trả NV-06', icon: CheckCircle },
    { to: '/nv/07', label: 'Xác minh hư hại NV-07', icon: AlertOctagon },
    { to: '/ad/01', label: 'Danh mục xe AD-01', icon: Bike },
    { to: '/integration-log', label: 'Nhật ký tích hợp', icon: Layers },
    { to: '/ai-log', label: 'Nhật ký AI Agent OCR', icon: Sparkles },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar Desktop */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col flex-shrink-0">
        {/* Brand */}
        <div className="h-16 px-6 border-b border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center font-black tracking-wider shadow-sm">
            MC
          </div>
          <div>
            <span className="font-extrabold text-base text-slate-900 tracking-tight">MOTO CARE</span>
            <span className="block text-[11px] font-semibold text-blue-600">Nhân viên kỹ thuật</span>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 flex-1 overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-bold uppercase text-slate-400 tracking-wider">
            Nghiệp vụ thực thi
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
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
        <div className="p-4 border-t border-slate-200">
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
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-slate-200"
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
            <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-xs">
              MC
            </div>
            <span className="font-bold text-sm text-slate-800">MOTO CARE</span>
          </div>

          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
            <Layers className="w-4 h-4 text-brand-600" />
            <span>Phân hệ Nhân viên</span>
          </div>

          <div className="flex items-center gap-3">
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
        <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex gap-2 overflow-x-auto text-xs">
          <NavLink
            to="/nv/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')
            }
          >
            Hộp việc NV-01
          </NavLink>
          <NavLink
            to="/ad/01"
            className={({ isActive }) =>
              cn('px-3 py-1.5 rounded-lg whitespace-nowrap', isActive ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-700')
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
