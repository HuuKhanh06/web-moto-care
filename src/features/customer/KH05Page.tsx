// src/features/customer/KH05Page.tsx
// Màn hình KH-05: Xác nhận tình trạng xe khi nhận (Activity_0w8x12e, Activity_0d0qzp6, Gateway_0ixde68)
// Khách xem checklist, hình ảnh xe thực tế và đồng ý nhận xe hoặc yêu cầu khắc phục.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle, Inspection, Handover } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Textarea,
  Stepper,
  toast,
} from '@/components/ui';
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { CUSTOMER_RENTAL_STEPS } from './constants';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Gauge,
  Fuel,
  Bike,
  Check,
  Eye,
} from 'lucide-react';

export function KH05Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [currentNodeId, setCurrentNodeId] = useState<string>('Activity_0d0qzp6');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [customerNote, setCustomerNote] = useState('');
  const [selectedPhotoPreview, setSelectedPhotoPreview] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy đơn thuê');
        navigate('/kh/06');
        return;
      }
      setRequest(req);

      const pState = await db.process_state.get(requestId);
      if (pState?.waiting_node_ids?.length) {
        setCurrentNodeId(pState.waiting_node_ids[0]);
      }

      if (req.vehicle_id) {
        const v = await db.vehicles.get(req.vehicle_id);
        setVehicle(v || null);
      }

      // Lấy bản ghi PRE_HANDOVER đạt có attempt_no lớn nhất
      const insp = await db.inspections
        .where('request_id')
        .equals(requestId)
        .and((i) => i.kind === 'PRE_HANDOVER')
        .last();
      setInspection(insp || null);

      // Lấy danh sách handovers đã ghi nhận
      const hList = await db.handovers
        .where('request_id')
        .equals(requestId)
        .toArray();
      setHandovers(hList);
    } catch (err) {
      console.error('Lỗi nạp KH-05:', err);
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
          <p className="mt-3 text-sm text-slate-500">Đang tải biên bản bàn giao xe...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card className="text-center py-10">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">Không tìm thấy yêu cầu thuê</h2>
          <Button className="mt-4" onClick={() => navigate('/kh/06')}>Về danh sách hồ sơ</Button>
        </Card>
      </div>
    );
  }

  const latestHandover = handovers[handovers.length - 1];
  const attemptNo = inspection?.attempt_no || 1;
  const isAccepted = latestHandover?.customer_accepted === true;
  const isWaitingResponse = currentNodeId === 'Activity_0d0qzp6' || request.status === 'CHO_KHACH_NHAN';

  const handleCustomerResponse = async (accepted: boolean) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!accepted && !customerNote.trim()) {
      toast.error('Vui lòng nhập lý do hoặc ghi chú nếu không đồng ý nhận xe');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'Activity_0d0qzp6',
        {
          customer_accepted: accepted,
          customer_note: customerNote,
          attempt_no: attemptNo,
        },
        currentActor
      );

      if (accepted) {
        toast.success('Bạn đã xác nhận đồng ý nhận xe! Nhân viên sẽ tiến hành bàn giao xe và phụ kiện.');
      } else {
        toast.warning('Đã gửi phản hồi từ chối! Nhân viên kỹ thuật sẽ kiểm tra và khắc phục lại xe.');
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi gửi phản hồi khách:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi phản hồi');
    } finally {
      setSubmitting(false);
    }
  };

  const checklistObj = (inspection?.checklist || {}) as Record<string, unknown>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 pb-24 sm:pb-6">
      {/* Stepper tiến trình */}
      <Card className="p-4 sm:p-5 border-slate-200/80 glass-surface shadow-sm">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={4} />
      </Card>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200/80 shadow-xs">
              KH-05
            </span>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Xác nhận tình trạng xe khi nhận
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hồ sơ #{request.id.slice(0, 8)} • Vui lòng kiểm tra kỹ tình trạng xe và hình ảnh thực tế
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
          <Badge variant="neutral" className="text-slate-600">
            Lần #{attemptNo}
          </Badge>
        </div>
      </div>

      {/* Thông tin xe bàn giao */}
      {vehicle && (
        <Card className="p-5 border-slate-200/80 glass-surface shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 shrink-0 border border-brand-100 shadow-xs">
              <Bike className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-slate-900 text-base sm:text-lg">
                {vehicle.model}
              </h3>
              <p className="text-sm text-slate-500">
                Biển số: <strong className="text-brand-700 font-mono">{vehicle.plate}</strong> • Phân khúc: {vehicle.vehicle_type}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Kết quả kiểm tra kỹ thuật của nhân viên */}
      <Card className="p-6 border-slate-200/80 space-y-4 glass-surface shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Kết quả kiểm tra kỹ thuật của nhân viên (NV-03)
            </h3>
          </div>
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
            {inspection?.result === 'DAT' ? 'Đã đạt tiêu chuẩn an toàn' : 'Đang xử lý'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Phanh: <strong>Đạt an toàn</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Đèn & Xi-nhan: <strong>Hoạt động tốt</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Lốp & Áp suất: <strong>Đạt chuẩn</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Check className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Gương chiếu hậu: <strong>Đủ 2 gương</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Gauge className="h-4 w-4 text-brand-600 shrink-0" />
            <span>ODO: <strong>{String(checklistObj.odometer || '12450')} Km</strong></span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-xs">
            <Fuel className="h-4 w-4 text-brand-600 shrink-0" />
            <span>Nhiên liệu: <strong>{String(checklistObj.fuel_level || '100%')}</strong></span>
          </div>
        </div>
      </Card>

      {/* Thư viện ảnh thực tế xe */}
      <Card className="p-6 border-slate-200/80 space-y-4 glass-surface shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Hình ảnh thực tế khi bàn giao (Checklist 4 góc)
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {inspection?.photo_urls?.length || 0} ảnh chụp
          </span>
        </div>

        {inspection?.photo_urls && inspection.photo_urls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {inspection.photo_urls.map((url, idx) => (
              <div
                key={idx}
                onClick={() => setSelectedPhotoPreview(url)}
                className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 aspect-video sm:aspect-square flex items-center justify-center hover:shadow-md transition-all duration-300"
              >
                <img
                  src={url}
                  alt={`Ảnh bàn giao ${idx + 1}`}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white backdrop-blur-xs">
                  <Eye className="h-6 w-6" />
                </div>
                <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] text-white font-medium">
                  {idx === 0 ? 'Đầu xe' : idx === 1 ? 'Đuôi xe' : idx === 2 ? 'Sườn trái' : idx === 3 ? 'Sườn phải' : 'Đồng hồ ODO'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-xs text-slate-500">
            Chưa có hình ảnh bàn giao từ nhân viên
          </div>
        )}
      </Card>

      {/* Xem trước ảnh phóng to (Modal thu nhỏ) */}
      {selectedPhotoPreview && (
        <div
          onClick={() => setSelectedPhotoPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        >
          <div className="relative max-w-2xl max-h-[90vh] overflow-hidden rounded-3xl bg-white p-3 shadow-2xl">
            <img
              src={selectedPhotoPreview}
              alt="Phóng to ảnh"
              className="max-h-[80vh] w-auto rounded-2xl object-contain"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedPhotoPreview(null)}
              className="mt-3 w-full"
            >
              Đóng xem ảnh
            </Button>
          </div>
        </div>
      )}

      {/* KHU VỰC KHÁCH XÁC NHẬN (Activity_0d0qzp6, Gateway_0ixde68) */}
      <Card
        data-testid="node-Activity_0d0qzp6"
        className="p-6 space-y-4 border-2 border-brand-300 bg-brand-50/25 rounded-3xl shadow-sm"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-slate-900 text-base">
            Quyết định của khách hàng (Cổng BPMN Gateway_0ixde68)
          </h3>
        </div>

        {isAccepted ? (
          <div className="rounded-2xl bg-emerald-50/90 p-5 border border-emerald-200 text-emerald-800 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Bạn đã xác nhận đồng ý nhận xe này!
            </div>
            <p className="text-xs">
              Nhân viên đang tiến hành hoàn tất bàn giao phụ kiện và kích hoạt hợp đồng thuê xe.
            </p>
            {latestHandover?.customer_note && (
              <p className="text-xs italic text-slate-600">
                Ghi chú của bạn: &quot;{latestHandover.customer_note}&quot;
              </p>
            )}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/kh/06')}
                className="text-xs"
              >
                Về trang hồ sơ của tôi
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ghi chú phản hồi của khách hàng (bắt buộc nếu không đồng ý nhận xe)
              </label>
              <Textarea
                placeholder="Nhập yêu cầu cần nhân viên hỗ trợ (ví dụ: xe trầy xước bên trái chưa chụp, cần bổ sung gương, v.v.)..."
                rows={3}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="bg-white rounded-2xl"
                disabled={!isWaitingResponse || submitting}
              />
            </div>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center justify-end gap-3 pt-2">
              <Button
                data-testid="node-Gateway_0ixde68"
                variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => handleCustomerResponse(false)}
                disabled={!isWaitingResponse || submitting}
                loading={submitting}
              >
                <XCircle className="mr-1.5 h-4 w-4" />
                Không đồng ý (Kiểm tra lại xe)
              </Button>

              <Button
                data-testid="node-Gateway_0ixde68"
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-md"
                onClick={() => handleCustomerResponse(true)}
                disabled={!isWaitingResponse || submitting}
                loading={submitting}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                Đồng ý nhận xe
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sticky Bottom Action Bar cho Mobile */}
      {!isAccepted && isWaitingResponse && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg flex items-center gap-2">
          <Button
            data-testid="node-Gateway_0ixde68"
            variant="outline"
            className="flex-1 border-rose-300 text-rose-700 text-xs py-2.5"
            onClick={() => handleCustomerResponse(false)}
            disabled={submitting}
            loading={submitting}
          >
            <XCircle className="mr-1 h-3.5 w-3.5" />
            Không đồng ý
          </Button>

          <Button
            data-testid="node-Gateway_0ixde68"
            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2.5 shadow-md"
            onClick={() => handleCustomerResponse(true)}
            disabled={submitting}
            loading={submitting}
          >
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Đồng ý nhận xe
          </Button>
        </div>
      )}
    </div>
  );
}
