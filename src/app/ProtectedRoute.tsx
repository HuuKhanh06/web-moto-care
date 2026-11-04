// src/app/ProtectedRoute.tsx
// Route Guard: Kiểm tra đăng nhập và phân quyền nghiêm ngặt theo Actor Role

import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { toast } from '@/components/ui/toastStore';
import type { Actor } from '@/db/types';

export interface ProtectedRouteProps {
  allowedRoles: Array<Actor['role']>;
  children: React.ReactNode;
}

export function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const location = useLocation();
  const { currentActor, isAuthenticated, isLoading } = useAuthStore();

  // Đang khôi phục phiên từ sessionStorage
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold text-slate-500">Đang tải phiên làm việc...</span>
        </div>
      </div>
    );
  }

  // Chưa đăng nhập -> Chuyển về trang đăng nhập
  if (!isAuthenticated || !currentActor) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Đã đăng nhập nhưng không đủ quyền truy cập
  if (!allowedRoles.includes(currentActor.role)) {
    // Thông báo từ chối truy cập
    toast.warning(
      `Từ chối truy cập: Vai trò '${currentActor.role}' không có quyền truy cập trang này.`
    );

    // Chuyển hướng về trang chủ tương ứng của vai trò hiện tại
    if (currentActor.role === 'khach_hang') {
      return <Navigate to="/kh/06" replace />;
    } else {
      return <Navigate to="/nv/01" replace />;
    }
  }

  return <>{children}</>;
}
