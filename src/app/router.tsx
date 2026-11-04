// src/app/router.tsx
// Khai báo Router với Route Guard nghiêm ngặt bám sát screens.csv

import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { ProtectedRoute } from './ProtectedRoute';

// Layouts
import { CustomerLayout } from '@/components/layout/CustomerLayout';
import { StaffLayout } from '@/components/layout/StaffLayout';
import { ManagerLayout } from '@/components/layout/ManagerLayout';

// Pages
import { AuthPage } from '@/features/auth/AuthPage';
import { StyleGuidePage } from '@/features/customer/StyleGuidePage';
import { KH01Page } from '@/features/customer/KH01Page';
import { KH02Page } from '@/features/customer/KH02Page';
import { KH03Page } from '@/features/customer/KH03Page';
import { KH04Page } from '@/features/customer/KH04Page';
import { KH05Page } from '@/features/customer/KH05Page';
import { KH06Page } from '@/features/customer/KH06Page';
import { KH07Page } from '@/features/customer/KH07Page';
import { KH08Page } from '@/features/customer/KH08Page';
import { KH09Page } from '@/features/customer/KH09Page';
import { KH10Page } from '@/features/customer/KH10Page';
import { NV01Page } from '@/features/staff/NV01Page';
import { NV02Page } from '@/features/staff/NV02Page';
import { NV03Page } from '@/features/staff/NV03Page';
import { NV04Page } from '@/features/staff/NV04Page';
import { NV05Page } from '@/features/staff/NV05Page';
import { NV06Page } from '@/features/staff/NV06Page';
import { NV07Page } from '@/features/staff/NV07Page';
import { NV08Page } from '@/features/staff/NV08Page';
import { NV09Page } from '@/features/staff/NV09Page';
import { NV10Page } from '@/features/staff/NV10Page';
import { QL01Page } from '@/features/manager/QL01Page';
import { QL02Page } from '@/features/manager/QL02Page';
import { DT01Page } from '@/features/partner/DT01Page';
import { AD01Page } from '@/features/admin/AD01Page';
import { TracePage } from '@/features/manager/TracePage';
import { IntegrationLogPage } from '@/features/manager/IntegrationLogPage';
import { AiLogPage } from '@/features/manager/AiLogPage';

/**
 * Điều hướng thông minh từ đường dẫn gốc '/'
 */
function RootRedirect() {
  const { currentActor, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated || !currentActor) {
    return <Navigate to="/login" replace />;
  }

  if (currentActor.role === 'khach_hang') {
    return <Navigate to="/kh/06" replace />;
  }

  return <Navigate to="/nv/01" replace />;
}

/**
 * Component bọc trang AD-01 với Layout tương ứng của vai trò đang đăng nhập
 */
function AD01Wrapper() {
  const currentActor = useAuthStore((s) => s.currentActor);
  if (currentActor?.role === 'quan_ly') {
    return (
      <ManagerLayout>
        <AD01Page />
      </ManagerLayout>
    );
  }
  return (
    <StaffLayout>
      <AD01Page />
    </StaffLayout>
  );
}

/**
 * Component bọc trang Trace với Layout tương ứng của vai trò đang đăng nhập
 */
function TraceWrapper() {
  const currentActor = useAuthStore((s) => s.currentActor);
  if (currentActor?.role === 'quan_ly') {
    return (
      <ManagerLayout>
        <TracePage />
      </ManagerLayout>
    );
  }
  return (
    <StaffLayout>
      <TracePage />
    </StaffLayout>
  );
}

/**
 * Component bọc trang Nhật ký tích hợp với Layout tương ứng
 */
function IntegrationLogWrapper() {
  const currentActor = useAuthStore((s) => s.currentActor);
  if (currentActor?.role === 'quan_ly') {
    return (
      <ManagerLayout>
        <IntegrationLogPage />
      </ManagerLayout>
    );
  }
  return (
    <StaffLayout>
      <IntegrationLogPage />
    </StaffLayout>
  );
}

function AiLogWrapper() {
  const { currentActor } = useAuthStore();
  if (currentActor?.role === 'quan_ly') {
    return (
      <ManagerLayout>
        <AiLogPage />
      </ManagerLayout>
    );
  }
  return (
    <StaffLayout>
      <AiLogPage />
    </StaffLayout>
  );
}

export function AppRouter() {
  return (
    <Routes>
      {/* Trang gốc */}
      <Route path="/" element={<RootRedirect />} />

      {/* AUTH-01: Đăng nhập / Đăng ký */}
      <Route path="/login" element={<AuthPage />} />

      {/* Bảng kiểu giao diện tham khảo */}
      <Route path="/style" element={<StyleGuidePage />} />

      {/* ============================================================== */}
      {/* PHÂN HỆ KHÁCH HÀNG (khach_hang)                                 */}
      {/* ============================================================== */}
      <Route
        path="/kh"
        element={
          <ProtectedRoute allowedRoles={['khach_hang']}>
            <CustomerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/kh/06" replace />} />
        <Route path="01" element={<KH01Page />} />
        <Route path="02" element={<KH02Page />} />
        <Route path="03" element={<KH03Page />} />
        <Route path="04" element={<KH04Page />} />
        <Route path="05" element={<KH05Page />} />
        <Route path="06" element={<KH06Page />} />
        <Route path="07" element={<KH07Page />} />
        <Route path="08" element={<KH08Page />} />
        <Route path="09" element={<KH09Page />} />
        <Route path="10" element={<KH10Page />} />
      </Route>

      {/* ============================================================== */}
      {/* PHÂN HỆ NHÂN VIÊN (nhan_vien)                                   */}
      {/* ============================================================== */}
      <Route
        path="/nv"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/nv/01" replace />} />
        <Route path="01" element={<NV01Page />} />
        <Route path="02" element={<NV02Page />} />
        <Route path="03" element={<NV03Page />} />
        <Route path="04" element={<NV04Page />} />
        <Route path="05" element={<NV05Page />} />
        <Route path="06" element={<NV06Page />} />
        <Route path="07" element={<NV07Page />} />
        <Route path="08" element={<NV08Page />} />
        <Route path="09" element={<NV09Page />} />
        <Route path="10" element={<NV10Page />} />
      </Route>

      {/* ============================================================== */}
      {/* PHÂN HỆ QUẢN LÝ (quan_ly)                                       */}
      {/* ============================================================== */}
      <Route
        path="/ql"
        element={
          <ProtectedRoute allowedRoles={['quan_ly']}>
            <ManagerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/nv/01" replace />} />
        <Route path="01" element={<QL01Page />} />
        <Route path="02" element={<QL02Page />} />
      </Route>

      {/* DT-01: Giả lập đối tác (Quản lý/Nhân viên thao tác mô phỏng) */}
      <Route
        path="/dt/01"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <StaffLayout>
              <DT01Page />
            </StaffLayout>
          </ProtectedRoute>
        }
      />

      {/* AD-01: Quản lý xe, đối tác và người dùng (Quản lý toàn quyền, Nhân viên chỉ xem) */}
      <Route
        path="/ad/01"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <AD01Wrapper />
          </ProtectedRoute>
        }
      />

      {/* Trang Dấu vết quy trình BPMN (/trace/:requestId) */}
      <Route
        path="/trace/:requestId"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <TraceWrapper />
          </ProtectedRoute>
        }
      />

      {/* Trang Nhật ký tích hợp bên ngoài (/integration-log) */}
      <Route
        path="/integration-log"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <IntegrationLogWrapper />
          </ProtectedRoute>
        }
      />

      {/* Trang Nhật ký AI Agent OCR (/ai-log) */}
      <Route
        path="/ai-log"
        element={
          <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
            <AiLogWrapper />
          </ProtectedRoute>
        }
      />

      {/* 404 fallback */}
      <Route path="*" element={<RootRedirect />} />
    </Routes>
  );
}
