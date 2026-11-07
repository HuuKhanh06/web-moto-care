// src/components/layout/CustomerLayout.tsx
// Khung giao diện chuẩn mực thương mại dành cho Khách hàng thuê xe MotoCare Đà Nẵng

import { useState, useRef, useEffect } from 'react';
import { Outlet, NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { NotificationBell } from './NotificationBell';
import { Logo } from '@/components/common/Logo';
import { BottomNav } from '@/components/ui/BottomNav';
import { toast } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  Bike,
  LogOut,
  ChevronDown,
  ShieldCheck,
  Sparkles,
  Zap,
  Edit3,
  Check,
} from 'lucide-react';

export function CustomerLayout({ children }: { children?: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentUser, logout, updateProfileName } = useAuthStore();

  const [fleetMenuOpen, setFleetMenuOpen] = useState(false);
  const [policyMenuOpen, setPolicyMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.full_name || '');
  const [savingName, setSavingName] = useState(false);

  const fleetMenuRef = useRef<HTMLDivElement>(null);
  const policyMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (fleetMenuRef.current && !fleetMenuRef.current.contains(event.target as Node)) {
        setFleetMenuOpen(false);
      }
      if (policyMenuRef.current && !policyMenuRef.current.contains(event.target as Node)) {
        setPolicyMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
        setIsEditingName(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveName = async () => {
    if (!newName.trim()) {
      toast.warning('Vui lòng nhập họ và tên');
      return;
    }
    setSavingName(true);
    const res = await updateProfileName(newName.trim());
    setSavingName(false);
    if (res.success) {
      toast.success('Đã cập nhật họ và tên thành công!');
      setIsEditingName(false);
    } else {
      toast.error(res.error || 'Không thể cập nhật tên');
    }
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

            {/* Menu Hồ sơ người dùng */}
            <div className="relative shrink-0" ref={userMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(!userMenuOpen);
                  setIsEditingName(false);
                  setNewName(currentUser?.full_name || '');
                }}
                className="flex items-center gap-2 pl-3 border-l border-slate-200 hover:opacity-90 transition-opacity cursor-pointer group"
                title="Hồ sơ tài khoản"
              >
                <div className="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-sm group-hover:bg-teal-200 transition-colors">
                  {currentUser?.full_name?.slice(0, 1) || 'K'}
                </div>
                <span className="hidden sm:inline-block text-sm font-semibold text-slate-800 max-w-[130px] truncate">
                  {currentUser?.full_name || 'Khách hàng'}
                </span>
                <ChevronDown className={cn('w-3.5 h-3.5 text-slate-400 transition-transform duration-200', userMenuOpen && 'rotate-180')} />
              </button>

              {userMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl border border-slate-200 p-4 z-50 space-y-3.5">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="w-11 h-11 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-base shrink-0">
                      {currentUser?.full_name?.slice(0, 1) || 'K'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-900 truncate">
                        {currentUser?.full_name || 'Khách hàng'}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {currentUser?.phone ? `SĐT: ${currentUser.phone}` : 'Tài khoản khách hàng'}
                      </div>
                    </div>
                  </div>

                  {/* Khu vực xem / đổi họ tên người dùng */}
                  {!isEditingName ? (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-2">
                      <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                        Họ và tên hiển thị
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-800 truncate">
                          {currentUser?.full_name || 'Chưa đặt tên'}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setNewName(currentUser?.full_name || '');
                            setIsEditingName(true);
                          }}
                          className="text-xs font-semibold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Đổi tên</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-teal-50/60 p-3 rounded-xl border border-teal-200 space-y-2.5">
                      <label className="text-[11px] font-bold text-teal-900 uppercase tracking-wider block">
                        Nhập họ và tên của bạn:
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="vd: Nguyễn Văn An"
                        className="w-full px-3 py-1.5 text-sm bg-white border border-teal-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-slate-900"
                        autoFocus
                      />
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setIsEditingName(false)}
                          className="px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-800 rounded-md cursor-pointer"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          disabled={savingName}
                          onClick={handleSaveName}
                          className="px-3 py-1 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-md flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{savingName ? 'Đang lưu...' : 'Lưu tên'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Nút Đăng xuất */}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 p-2 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors text-xs font-semibold cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-slate-400" />
                    <span>Đăng xuất tài khoản</span>
                  </button>
                </div>
              )}
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
