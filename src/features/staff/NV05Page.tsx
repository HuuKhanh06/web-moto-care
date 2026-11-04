// src/features/staff/NV05Page.tsx
// Màn hình NV-05: Bàn giao xe & Phụ kiện (M_Handover, M_SetRented)
// Ghi nhận bàn giao phụ kiện (mũ, áo mưa, giấy tờ, chìa khóa), cập nhật trạng thái ĐANG THUÊ.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle, Profile, Handover } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Textarea,
  toast,
} from '@/components/ui';
import {
  getStatusBadgeVariant,
  getStatusLabel,
  formatDateTime,
} from '@/lib/format';
import {
  KeyRound,
  CheckCircle2,
  AlertTriangle,
  Bike,
  User,
  Check,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

interface AccessoryChecklist {
  helmets_qty: number;
  raincoat_qty: number;
  registration_paper: boolean;
  insurance_paper: boolean;
  smart_key: boolean;
  phone_holder: boolean;
  notes: string;
}

export function NV05Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [lastHandover, setLastHandover] = useState<Handover | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Danh mục phụ kiện đi kèm
  const [accessories, setAccessories] = useState<AccessoryChecklist>({
    helmets_qty: 2,
    raincoat_qty: 2,
    registration_paper: true,
    insurance_paper: true,
    smart_key: true,
    phone_holder: true,
    notes: 'Đã giao đầy đủ mũ, áo mưa và hướng dẫn sử dụng khóa xe.',
  });

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy đơn thuê');
        navigate('/nv/01');
        return;
      }
      setRequest(req);

      const [v, u, h] = await Promise.all([
        req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
        db.profiles.get(req.customer_id),
        db.handovers.where('request_id').equals(requestId).last(),
      ]);

      setVehicle(v || null);
      setCustomer(u || null);
      setLastHandover(h || null);
    } catch (err) {
      console.error('Lỗi nạp NV-05:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải biểu mẫu bàn giao xe...</p>
        </div>
      </div>
    );
  }

  if (!request || !vehicle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card className="text-center py-10">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">Không tìm thấy thông tin xe hoặc hồ sơ</h2>
          <Button className="mt-4" onClick={() => navigate('/nv/01')}>Về danh sách việc cần làm</Button>
        </Card>
      </div>
    );
  }

  const isAlreadyRented = request.status === 'DANG_THUE';

  const handleConfirmHandover = async () => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'M_Handover',
        {
          accessories: {
            helmets: accessories.helmets_qty,
            raincoats: accessories.raincoat_qty,
            registration_paper: accessories.registration_paper,
            insurance_paper: accessories.insurance_paper,
            smart_key: accessories.smart_key,
            phone_holder: accessories.phone_holder,
            notes: accessories.notes,
          },
        },
        currentActor
      );

      toast.success('Bàn giao thành công! Hợp đồng chính thức chuyển sang trạng thái ĐANG THUÊ (M_SetRented).');
      navigate('/nv/01');
    } catch (err: unknown) {
      console.error('Lỗi hoàn tất bàn giao:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể hoàn tất bàn giao xe');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
              NV-05
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Bàn giao xe & Phụ kiện (M_Handover)
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hồ sơ thuê #{request.id.slice(0, 8)} • Bước cuối cùng trước khi xe lăn bánh
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
          <Badge variant="neutral" className="text-slate-600">
            BPMN: M_Handover
          </Badge>
        </div>
      </div>

      {/* Thông tin khách hàng & Xe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Khách hàng */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Khách hàng nhận xe</p>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {customer?.full_name || 'Khách hàng'}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                SĐT: {customer?.phone || 'Chưa có'}
              </p>
              {lastHandover?.customer_accepted && (
                <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Khách đã duyệt nhận xe ở KH-05
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Xe máy */}
        <Card className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 shrink-0">
              <Bike className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Phương tiện bàn giao</p>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {vehicle.model}
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Biển số: <strong className="text-slate-800">{vehicle.plate}</strong> • Loại: {vehicle.vehicle_type}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                Thời gian thuê: {formatDateTime(request.start_at)} - {formatDateTime(request.end_at)}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Danh mục phụ kiện bàn giao */}
      <Card className="p-5 space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Danh mục phụ kiện đi kèm bàn giao
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            Kiểm tra và tích chọn các món giao cho khách
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mũ bảo hiểm */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-800">Mũ bảo hiểm đạt chuẩn</h4>
              <p className="text-[11px] text-slate-500">Kính chắn gió, quai khóa an toàn</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setAccessories((prev) => ({ ...prev, helmets_qty: Math.max(0, prev.helmets_qty - 1) }))}
              >
                -
              </Button>
              <span className="font-bold text-sm text-slate-800 w-4 text-center">
                {accessories.helmets_qty}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setAccessories((prev) => ({ ...prev, helmets_qty: prev.helmets_qty + 1 }))}
              >
                +
              </Button>
            </div>
          </div>

          {/* Áo mưa */}
          <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50 flex items-center justify-between">
            <div>
              <h4 className="font-bold text-xs text-slate-800">Áo mưa cánh dơi MotoCare</h4>
              <p className="text-[11px] text-slate-500">Chất liệu chống thấm nước</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setAccessories((prev) => ({ ...prev, raincoat_qty: Math.max(0, prev.raincoat_qty - 1) }))}
              >
                -
              </Button>
              <span className="font-bold text-sm text-slate-800 w-4 text-center">
                {accessories.raincoat_qty}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setAccessories((prev) => ({ ...prev, raincoat_qty: prev.raincoat_qty + 1 }))}
              >
                +
              </Button>
            </div>
          </div>

          {/* Đăng ký xe */}
          <div
            onClick={() => setAccessories((prev) => ({ ...prev, registration_paper: !prev.registration_paper }))}
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              accessories.registration_paper ? 'border-brand-300 bg-brand-50/30' : 'border-slate-200 bg-white'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                accessories.registration_paper ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
              }`}
            >
              {accessories.registration_paper && <Check className="h-3.5 w-3.5" />}
            </div>
            <div className="select-none">
              <h4 className="font-bold text-xs text-slate-800">Đăng ký xe (Bản công chứng)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Đặt trong cốp xe phục vụ lưu thông</p>
            </div>
          </div>

          {/* Bảo hiểm TNDS */}
          <div
            onClick={() => setAccessories((prev) => ({ ...prev, insurance_paper: !prev.insurance_paper }))}
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              accessories.insurance_paper ? 'border-brand-300 bg-brand-50/30' : 'border-slate-200 bg-white'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                accessories.insurance_paper ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
              }`}
            >
              {accessories.insurance_paper && <Check className="h-3.5 w-3.5" />}
            </div>
            <div className="select-none">
              <h4 className="font-bold text-xs text-slate-800">Bảo hiểm TNDS bắt buộc</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Còn thời hạn hiệu lực</p>
            </div>
          </div>

          {/* Chìa khóa xe / Smartkey */}
          <div
            onClick={() => setAccessories((prev) => ({ ...prev, smart_key: !prev.smart_key }))}
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              accessories.smart_key ? 'border-brand-300 bg-brand-50/30' : 'border-slate-200 bg-white'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                accessories.smart_key ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
              }`}
            >
              {accessories.smart_key && <Check className="h-3.5 w-3.5" />}
            </div>
            <div className="select-none">
              <h4 className="font-bold text-xs text-slate-800">Chìa khóa xe (Kèm remote Smartkey)</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Đã bàn giao tận tay khách</p>
            </div>
          </div>

          {/* Giá đỡ điện thoại */}
          <div
            onClick={() => setAccessories((prev) => ({ ...prev, phone_holder: !prev.phone_holder }))}
            className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
              accessories.phone_holder ? 'border-brand-300 bg-brand-50/30' : 'border-slate-200 bg-white'
            }`}
          >
            <div
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                accessories.phone_holder ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
              }`}
            >
              {accessories.phone_holder && <Check className="h-3.5 w-3.5" />}
            </div>
            <div className="select-none">
              <h4 className="font-bold text-xs text-slate-800">Giá đỡ điện thoại gắn ghi-đông</h4>
              <p className="text-[11px] text-slate-500 mt-0.5">Hỗ trợ khách xem bản đồ định vị</p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Ghi chú phụ kiện & dặn dò khách hàng
          </label>
          <Textarea
            rows={2}
            value={accessories.notes}
            onChange={(e) => setAccessories((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Ghi chú thêm nếu có..."
          />
        </div>
      </Card>

      {/* Hành động xác nhận bàn giao (M_Handover) */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Sparkles className="h-4 w-4 text-brand-600 shrink-0" />
          Bấm xác nhận để chuyển xe sang trạng thái &quot;Đang thuê&quot; và kích hoạt theo dõi hành trình.
        </div>

        {isAlreadyRented ? (
          <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
            Xe đã được bàn giao (ĐANG THUÊ)
          </div>
        ) : (
          <Button
            data-testid="node-M_Handover"
            onClick={handleConfirmHandover}
            loading={submitting}
            className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold"
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Xác nhận bàn giao xe & Phụ kiện (M_Handover)
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
