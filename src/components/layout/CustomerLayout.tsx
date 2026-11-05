// src/components/layout/CustomerLayout.tsx
// Khung giao diện dành cho Khách hàng chuẩn phong cách VinFast / Green SM Platform

import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/common/Logo';
import { cn } from '@/lib/utils';
import {
  Bike,
  ClipboardList,
  AlertTriangle,
  LogOut,
  PlusCircle,
  ChevronDown,
  ShieldCheck,
  PhoneCall,
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

  // Đóng dropdown khi click bên ngoài
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
    <div className="min-h-screen bg-slate-50/70 flex flex-col pb-16 md:pb-0">
      {/* Top Header chuẩn phong cách VinFast / Green SM Platform */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          {/* Cụm Logo bên trái */}
          <div className="flex items-center gap-3 shrink-0">
            <Link to="/" className="flex items-center gap-2 group">
              <Logo size="md" />
            </Link>
          </div>

          {/* Thanh Menu điều hướng trung tâm (Phong cách VinFast / Green SM: 1 hàng ngang, không xuống dòng) */}
          <nav className="hidden lg:flex items-center gap-7 xl:gap-9 text-[15px] xl:text-base font-semibold text-slate-700 whitespace-nowrap shrink-0">
            {/* 1. Giới thiệu / Trang chủ */}
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors py-2 px-1 text-[15px] xl:text-base font-semibold tracking-tight',
                  isActive && location.pathname === '/' ? 'text-brand-600 font-bold' : 'text-slate-700 hover:text-brand-600'
                )
              }
            >
              Giới thiệu
            </NavLink>

            {/* 2. Dòng xe & Bảng giá (Dropdown VinFast Style) */}
            <div className="relative shrink-0" ref={fleetMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setFleetMenuOpen(!fleetMenuOpen);
                  setPolicyMenuOpen(false);
                }}
                className={cn(
                  'whitespace-nowrap shrink-0 flex items-center gap-1.5 py-2 px-1 text-[15px] xl:text-base font-semibold tracking-tight transition-colors cursor-pointer',
                  location.pathname.startsWith('/kh/01') || fleetMenuOpen ? 'text-brand-600 font-bold' : 'text-slate-700 hover:text-brand-600'
                )}
              >
                <span>Dòng xe</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', fleetMenuOpen && 'rotate-180 text-brand-600')} />
              </button>

              {fleetMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <Link
                    to="/kh/01?vehicleType=tay_ga"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50/60 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-brand-100/70 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Bike className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-brand-600">Xe tay ga (Đô thị &amp; Du lịch)</div>
                      <div className="text-[10px] text-slate-500">Vision Smartkey, Air Blade, Lead...</div>
                    </div>
                  </Link>

                  <Link
                    to="/kh/01?vehicleType=xe_so"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50/60 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-brand-600">Xe số (Tiết kiệm xăng)</div>
                      <div className="text-[10px] text-slate-500">Wave Alpha 110, Future 125...</div>
                    </div>
                  </Link>

                  <Link
                    to="/kh/01?vehicleType=xe_con"
                    onClick={() => setFleetMenuOpen(false)}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-50/60 transition-colors group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 group-hover:text-brand-600">Xe côn tay (Phượt &amp; Đèo dốc)</div>
                      <div className="text-[10px] text-slate-500">Winner X 150 ABS, Exciter 155...</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* 3. Chuyến đi của tôi */}
            <NavLink
              to="/kh/06"
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors py-2 px-1 text-[15px] xl:text-base font-semibold tracking-tight',
                  isActive ? 'text-brand-600 font-bold' : 'text-slate-700 hover:text-brand-600'
                )
              }
            >
              Chuyến đi của tôi
            </NavLink>

            {/* 4. Chính sách & Tiện ích (Dropdown VinFast Style) */}
            <div className="relative shrink-0" ref={policyMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setPolicyMenuOpen(!policyMenuOpen);
                  setFleetMenuOpen(false);
                }}
                className={cn(
                  'whitespace-nowrap shrink-0 flex items-center gap-1.5 py-2 px-1 text-[15px] xl:text-base font-semibold tracking-tight transition-colors cursor-pointer',
                  policyMenuOpen ? 'text-brand-600 font-bold' : 'text-slate-700 hover:text-brand-600'
                )}
              >
                <span>Chính sách</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform duration-200', policyMenuOpen && 'rotate-180 text-brand-600')} />
              </button>

              {policyMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 rounded-2xl bg-white shadow-xl border border-slate-100 p-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                      <span>Không giữ giấy tờ tùy thân gốc</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Xác thực số hóa &mdash; Bảo mật danh tính</div>
                  </div>

                  <div className="p-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Giao nhận xe tận nơi</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Sân bay, ga tàu &amp; khách sạn 24/7</div>
                  </div>

                  <Link
                    to="/kh/08"
                    onClick={() => setPolicyMenuOpen(false)}
                    className="flex items-center gap-2 p-2.5 rounded-xl hover:bg-amber-50/70 transition-colors text-amber-900"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Cứu hộ khẩn cấp 1900 6868</div>
                      <div className="text-[10px] text-slate-500">Báo sự cố trên đường đi</div>
                    </div>
                  </Link>
                </div>
              )}
            </div>

            {/* 5. Cứu hộ SOS */}
            <NavLink
              to="/kh/08"
              className={({ isActive }) =>
                cn(
                  'whitespace-nowrap shrink-0 transition-colors py-2 px-1 text-[15px] xl:text-base font-semibold tracking-tight flex items-center gap-1.5',
                  isActive ? 'text-amber-600 font-bold' : 'text-slate-700 hover:text-amber-600'
                )
              }
            >
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <span>Cứu hộ 24/7</span>
            </NavLink>
          </nav>

          {/* Cụm Hành động & Tài khoản người dùng bên phải */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {/* Nút Đặt xe ngay chuẩn VinFast */}
            <NavLink
              to="/kh/01"
              className="whitespace-nowrap shrink-0 bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm shadow-sm shadow-brand-500/25 flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95"
            >
              <PlusCircle className="w-4 h-4 shrink-0" />
              <span>Đặt xe ngay</span>
            </NavLink>

            {/* Chuông thông báo */}
            <NotificationBell />

            {/* Thông tin tài khoản người dùng */}
            <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200 shrink-0">
              <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs ring-2 ring-brand-500/20 shadow-xs shrink-0">
                {currentUser?.full_name?.slice(0, 1) || 'K'}
              </div>
              <span className="hidden sm:inline-block text-xs font-bold text-slate-800 max-w-[130px] truncate whitespace-nowrap">
                {currentUser?.full_name}
              </span>

              <button
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors ml-1 cursor-pointer shrink-0"
                title="Đăng xuất tài khoản"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
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
