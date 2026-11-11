// src/app/RequestOwnershipGuard.tsx
// Cô lập dữ liệu (Data Isolation): Khách hàng chỉ được xem hồ sơ thuê của chính mình.
// Chặn truy cập trái phép khi sửa tham số ?requestId= trên URL.

import { Navigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { useAuthStore } from '@/features/auth/authStore';
import { toast } from '@/components/ui/toastStore';

export function RequestOwnershipGuard({ children }: { children: React.ReactNode }) {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const currentActor = useAuthStore((s) => s.currentActor);

  // undefined = đang tải; null = không có hồ sơ cục bộ (chưa đồng bộ / không tồn tại)
  const ownerId = useLiveQuery(
    async () => (requestId ? ((await db.rental_requests.get(requestId))?.customer_id ?? null) : null),
    [requestId]
  );

  if (
    requestId &&
    currentActor?.role === 'khach_hang' &&
    typeof ownerId === 'string' &&
    ownerId !== currentActor.id
  ) {
    toast.warning('Từ chối truy cập: Hồ sơ này không thuộc về tài khoản của bạn.');
    return <Navigate to="/kh/06" replace />;
  }

  return <>{children}</>;
}
