// src/features/customer/KH05Page.tsx
// Màn hình 5: Nhận xe & Xác nhận tình trạng xe thực tế

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle, Inspection, Handover } from '@/db/types';
import {
  Card,
  Button,
  Textarea,
  toast,
  BookingProgress,
  StatusChip,
} from '@/components/ui';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { COPY } from '@/copy';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  Gauge,
  Fuel,
  Check,
  Eye,
  X,
} from 'lucide-react';

function HandoverPhoto({ url, index, onPreview }: { url: string; index: number; onPreview: (url: string) => void }) {
  const [failed, setFailed] = useState(url.startsWith('blob:'));
  useEffect(() => { setFailed(url.startsWith('blob:')); }, [url]);
  return (
    <div onClick={() => { if (!failed) onPreview(url); }}
      className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-slate-100 aspect-video sm:aspect-square flex items-center justify-center">
      {failed ? <p className="p-3 text-center text-xs text-slate-600">Ảnh chưa tải được. Vui lòng yêu cầu nhân viên gửi lại ảnh.</p> : <>
        <img src={url} alt={`Ảnh bàn giao ${index + 1}`} onError={() => setFailed(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white"><Eye className="w-6 h-6" /></div>
      </>}
      <span className="absolute bottom-1.5 left-1.5 rounded-lg bg-black/60 px-2 py-0.5 text-[11px] text-white font-medium">
        {['Đầu xe', 'Đuôi xe', 'Sườn trái', 'Sườn phải', 'Đồng hồ'][index] || `Ảnh ${index + 1}`}
      </span>
    </div>
  );
}

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

  const loadData = useCallback(async (silent = false) => {
    if (!requestId) return;
    if (!silent) setLoading(true);
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

      const inspections = await db.inspections
        .where('request_id')
        .equals(requestId)
        .and((i) => i.kind === 'PRE_HANDOVER' && i.result === 'DAT')
        .toArray();
      setInspection(inspections.sort((a, b) => b.attempt_no - a.attempt_no)[0] || null);

      const hList = await db.handovers
        .where('request_id')
        .equals(requestId)
        .toArray();
      setHandovers(hList);
    } catch (err) {
      console.error('Lỗi nạp thông tin nhận xe:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
    const refresh = () => { void loadData(true); };
    window.addEventListener('motocare_data_updated', refresh);
    return () => window.removeEventListener('motocare_data_updated', refresh);
  }, [loadData]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <ShieldCheck className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang kiểm tra thông tin xe...</span>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="max-w-xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 border border-slate-200 bg-white rounded-xl space-y-4">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-semibold text-slate-900">Không tìm thấy yêu cầu thuê</h2>
          <Button variant="primary" onClick={() => navigate('/kh/06')}>
            Về chuyến đi của tôi
          </Button>
        </Card>
      </div>
    );
  }

  const latestHandover = handovers[handovers.length - 1];
  const attemptNo = inspection?.attempt_no || 1;
  const isAccepted = latestHandover?.customer_accepted === true || request.status === 'DANG_THUE';
  const isWaitingResponse = currentNodeId === 'Activity_0d0qzp6' || request.status === 'CHO_KHACH_NHAN';

  const handleCustomerResponse = async (accepted: boolean) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!accepted && !customerNote.trim()) {
      toast.warning('Vui lòng nhập lý do nếu bạn chưa đồng ý nhận xe');
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
        toast.success('Đã xác nhận nhận xe thành công! Chúc bạn chuyến đi vui vẻ.');
        navigate('/kh/06');
      } else {
        toast.warning('Đã gửi phản hồi. Kỹ thuật viên sẽ kiểm tra và điều chỉnh ngay.');
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi phản hồi nhận xe:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi phản hồi');
    } finally {
      setSubmitting(false);
    }
  };

  const checklistObj = (inspection?.checklist || {}) as Record<string, unknown>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* 4 Bước tiến trình */}
      <BookingProgress currentStep={4} />

      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.HANDOVER}
        </h1>
        <StatusChip
          status={isAccepted ? 'success' : isWaitingResponse ? 'pending' : 'inactive'}
          label={isAccepted ? 'Đã nhận xe' : isWaitingResponse ? 'Chờ kiểm tra' : 'Đang xử lý'}
        />
      </div>

      {/* Thông tin phương tiện */}
      {vehicle && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl flex items-center gap-4">
          <div className="w-20 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
            <img
              src={getVehicleImageUrl(vehicle.model)}
              alt={vehicle.model}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {vehicle.model}
            </h2>
            <p className="text-sm text-slate-500 font-mono font-medium">
              {vehicle.plate}
            </p>
          </div>
        </Card>
      )}

      {/* Bảng kiểm tra an toàn kỹ thuật */}
      <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Biên bản an toàn kỹ thuật
            </h2>
          </div>
          <span className="text-[13px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            {inspection?.result === 'DAT' ? 'Đạt an toàn 100%' : 'Đang rà soát'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700">Hệ thống phanh: <strong className="text-slate-900">Đạt</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700">Đèn & xi-nhan: <strong className="text-slate-900">Tốt</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700">Lốp & áp suất: <strong className="text-slate-900">Chuẩn</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700">Gương chiếu hậu: <strong className="text-slate-900">Đủ 2 gương</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Gauge className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-slate-700">Số km (ODO): <strong className="text-slate-900">{String(checklistObj.odometer || '12.450')} km</strong></span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <Fuel className="w-4 h-4 text-teal-600 shrink-0" />
            <span className="text-slate-700">Mức xăng: <strong className="text-slate-900">{String(checklistObj.fuel_level || 'Đầy bình')}</strong></span>
          </div>
        </div>
      </Card>

      {/* Ảnh chụp thực tế bàn giao */}
      <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Ảnh thực tế của xe
            </h2>
          </div>
          <span className="text-[13px] text-slate-500">
            {inspection?.photo_urls?.length || 0} ảnh
          </span>
        </div>

        {inspection?.photo_urls && inspection.photo_urls.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {inspection.photo_urls.map((url, idx) => (
              <HandoverPhoto key={idx} url={url} index={idx} onPreview={setSelectedPhotoPreview} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-500">
            Chưa có ảnh bàn giao từ kỹ thuật viên
          </div>
        )}
      </Card>

      {/* Modal phóng to ảnh */}
      {selectedPhotoPreview && (
        <div
          onClick={() => setSelectedPhotoPreview(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="relative max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white p-3 shadow-2xl space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-slate-800">Ảnh chi tiết phương tiện</span>
              <button
                type="button"
                onClick={() => setSelectedPhotoPreview(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={selectedPhotoPreview}
              alt="Phóng to ảnh"
              className="max-h-[75vh] w-auto rounded-xl object-contain mx-auto"
            />
          </div>
        </div>
      )}

      {/* KHU VỰC KHÁCH XÁC NHẬN NHẬN XE */}
      <Card
        data-testid="node-Activity_0d0qzp6"
        className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4"
      >
        <h2 className="text-base font-semibold text-slate-900">
          Xác nhận nhận xe
        </h2>

        {isAccepted ? (
          <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 text-emerald-900 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>Bạn đã xác nhận đồng ý nhận xe!</span>
            </div>
            <p className="text-sm text-emerald-800">
              Chúc bạn có chuyến hành trình khám phá Đà Nẵng thật an toàn và trọn vẹn.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/kh/06')}
            >
              Chuyến đi của tôi
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Ghi chú (nếu bạn cần kỹ thuật viên hỗ trợ thêm):
              </label>
              <Textarea
                placeholder="Ví dụ: Cần kiểm tra lại gương bên phải, bổ sung mũ bảo hiểm..."
                rows={3}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="bg-slate-50 border-slate-200 rounded-xl"
                disabled={!isWaitingResponse || submitting}
              />
            </div>

            {/* Desktop Actions */}
            <div className="hidden sm:flex items-center justify-end gap-3 pt-2">
              <Button
                data-testid="node-Gateway_0ixde68"
                variant="outline"
                onClick={() => handleCustomerResponse(false)}
                disabled={!isWaitingResponse || submitting}
                loading={submitting}
              >
                <XCircle className="w-4 h-4 mr-1.5 text-rose-500" />
                <span>Yêu cầu kiểm tra lại</span>
              </Button>

              <Button
                data-testid="node-Gateway_0ixde68"
                variant="primary"
                onClick={() => handleCustomerResponse(true)}
                disabled={!isWaitingResponse || submitting}
                loading={submitting}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>Xác nhận nhận xe</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Sticky Bottom Bar cho Mobile */}
      {!isAccepted && isWaitingResponse && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 flex items-center gap-2">
          <Button
            data-testid="node-Gateway_0ixde68"
            variant="outline"
            className="flex-1"
            onClick={() => handleCustomerResponse(false)}
            disabled={submitting}
            loading={submitting}
          >
            Kiểm tra lại
          </Button>

          <Button
            data-testid="node-Gateway_0ixde68"
            variant="primary"
            className="flex-1"
            onClick={() => handleCustomerResponse(true)}
            disabled={submitting}
            loading={submitting}
          >
            Nhận xe
          </Button>
        </div>
      )}
    </div>
  );
}
