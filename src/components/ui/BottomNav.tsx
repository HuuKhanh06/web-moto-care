// src/components/ui/BottomNav.tsx
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, Compass, PhoneCall, User } from 'lucide-react';
import { useAuthStore } from '@/features/auth/authStore';

export function BottomNav() {
  const { isAuthenticated } = useAuthStore();

  const navItems = [
    { to: '/', label: 'Trang chủ', icon: Home },
    { to: isAuthenticated ? '/kh/06' : '/login', label: 'Chuyến đi', icon: Compass },
    { to: isAuthenticated ? '/kh/08' : '/login', label: 'Cứu hộ', icon: PhoneCall },
    { to: '/login', label: isAuthenticated ? 'Tài khoản' : 'Đăng nhập', icon: User },
  ];

  return (
    <nav
      aria-label="Thanh điều hướng dưới"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center justify-around px-2 shadow-xs"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center min-w-[44px] min-h-[44px] px-3 py-1 rounded-xl transition-colors duration-150',
                isActive
                  ? 'text-teal-700 font-semibold'
                  : 'text-slate-500 font-normal hover:text-slate-800'
              )
            }
          >
            <Icon className="w-5 h-5 shrink-0" />
            <span className="text-[13px] mt-0.5 leading-none">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
