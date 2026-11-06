// src/components/layout/CustomerLayout.tsx
// Khung giao diện chuẩn mực thương mại dành cho Khách hàng thuê xe MotoCare Đà Nẵng

import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/common/Logo';
import { BottomNav } from '@/components/ui/BottomNav';
import { cn } from '@/lib/utils';
import {
  Bike,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

export function CustomerLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout } = useAuthStore();

  const [fleetMenuOpen, setFleetMenuOpen] = useState(false);
  const [policyMenuOpen, setPolicyMenuOpen] = useState(false);

  const fleetMenuRef = useRef<HTMLDivElement>(null);
  const policyMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fleetMenuRef.current && !fleetMenuRef.current.contains(event.target as Node)) {
        setFleetMenuOpen(false);
      }
      if (policyMenuRef.current && !policyMenuRef.current.contains(event.target as Node)) {
        setPolicyMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 md:pb-0">
      {/* Header thương mại sang trọng & thoáng đãng */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          {/* Logo MotoCare */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <Logo size="md" />
          </Link>

          {/* Menu chính cho Desktop */}
          <nav className="hidden md:flex items-center gap-8 text-base font-semibold text-slate-700 whitespace-nowrap">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  'transition-colors py-2 text-base font-semibold',
                  isActive && location.pathname === '/' ? 'text-teal-700 font-bold' : 'text-slate-700 hover:text-teal-600'
                )
              }
            >
              Trang chủ
            </NavLink>

            {/* Dòng xe Dropdown */}
            <div className="relative shrink-0" ref={fleetMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setFleetMenuOpen(!fleetMenuOpen);
                  setPolicyMenuOpen(false);
                }}
                className={cn(
                  'flex items-center gap-1.5 py-2 text-base font-semibold transition-colors cursor-pointer',
                  location.pathname.startsWith('/kh/01') || fleetMenuOpen ? 'text-teal-700 font-bold' : 'text-slate-700 hover:text-teal-600'
                )}
              >
                <span>Dòng xe</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', fleetMenuOpen && 'rotate-180 text-teal-600')} />
              </button>

              {fleetMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-xl bg-white shadow-lg border border-slate-200 p-2 z-50">
                  <Link
                    to="/kh/01?vehicleType=tay_ga"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-teal-50/70 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center shrink-0">
                      <Bike className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Xe tay ga</div>
                      <div className="text-[13px] text-slate-500">Vision, Air Blade, Lead...</div>
                    </div>
                  </Link>

                  <Link
                    to="/kh/01?vehicleType=xe_so"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-teal-50/70 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                      <Zap className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Xe số</div>
                      <div className="text-[13px] text-slate-500">Wave Alpha, Future 125...</div>
                    </div>
                  </Link>

                  <Link
                    to="/kh/01?vehicleType=xe_con"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-teal-50/70 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">Xe côn tay</div>
                      <div className="text-[13px] text-slate-500">Winner X, Exciter 155...</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            <NavLink
              to="/kh/06"
              className={({ isActive }) =>
                cn(
                  'transition-colors py-2 text-base font-semibold',
                  isActive ? 'text-teal-700 font-bold' : 'text-slate-700 hover:text-teal-600'
                )
              }
            >
              Chuyến đi
            </NavLink>

            {/* Chính sách */}
            <div className="relative shrink-0" ref={policyMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setPolicyMenuOpen(!policyMenuOpen);
                  setFleetMenuOpen(false);
                }}
                className={cn(
                  'flex items-center gap-1.5 py-2 text-base font-semibold transition-colors cursor-pointer',
                  policyMenuOpen ? 'text-teal-700 font-bold' : 'text-slate-700 hover:text-teal-600'
                )}
              >
                <span>Chính sách</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', policyMenuOpen && 'rotate-180 text-teal-600')} />
              </button>

              {policyMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 rounded-xl bg-white shadow-lg border border-slate-200 p-2 z-50">
                  <Link
                    to="/#benefits"
                    onClick={() => setPolicyMenuOpen(false)}
                    className="block p-3 rounded-lg hover:bg-teal-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0" />
                      <span>Không giữ giấy tờ tùy thân gốc</span>
                    </div>
                    <div className="text-[13px] text-slate-500 mt-1">Xác thực số hóa &mdash; Bảo mật danh tính</div>
                  </Link>

                  <Link
                    to="/#stations"
                    onClick={() => setPolicyMenuOpen(false)}
                    className="block p-3 rounded-lg hover:bg-teal-50/70 transition-colors"
                  >
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Zap className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Giao nhận xe tận nơi</span>
                    </div>
                    <div className="text-[13px] text-slate-500 mt-1">Sân bay, ga tàu &amp; khách sạn 24/7</div>
                  </Link>
                </div>
              )}
            </div>

            <NavLink
              to="/kh/08"
              className={({ isActive }) =>
                cn(
                  'transition-colors py-2 text-base font-semibold',
                  isActive ? 'text-rose-700 font-bold' : 'text-slate-700 hover:text-rose-600'
                )
              }
            >
              Cứu hộ 24/7
            </NavLink>
          </nav>

          {/* Cụm Nút Đặt xe & Tài khoản */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/kh/01"
              className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl text-sm shadow-xs transition-colors"
            >
              Đặt xe ngay
            </Link>

            <NotificationBell />

            <div className="flex items-center gap-2 pl-3 border-l border-slate-200 shrink-0">
              <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-semibold text-sm">
                {currentUser?.full_name?.slice(0, 1) || 'K'}
              </div>
              <span className="hidden sm:inline-block text-sm font-semibold text-slate-800 max-w-[130px] truncate">
                {currentUser?.full_name}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-1 cursor-pointer"
                title="Đăng xuất"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1200px] w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children || <Outlet />}
      </main>

      {/* Mobile Bottom Navigation Bar (4 mục chuẩn thương mại) */}
      <BottomNav />
    </div>
  );
}
