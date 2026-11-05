// src/features/customer/KH07Page.tsx
// Màn hình KH-07: Gia hạn hợp đồng (SP1: GH_Offer, GH_WaitAccept, GH_CreateQR, GH_VerifyQR)
// Khách chọn ngày trả mới, xem đề xuất phụ phí, thanh toán VietQR và cập nhật hợp đồng.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import type { RentalRequest, Vehicle, ExtensionRequest, Payment } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Stepper,
  QRBox,
  toast,
} from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { CUSTOMER_EXTENSION_STEPS } from './constants';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  Sparkles,
} from 'lucide-react';

export function KH07Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [extension, setExtension] = useState<ExtensionRequest | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [waitingNode, setWaitingNode] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form chọn ngày trả mới (bước 1)
  const [newEndDate, setNewEndDate] = useState<string>('');

  // Đồng hồ đếm ngược đề xuất (2 giờ - GH_Timer) hoặc đếm ngược QR (30 phút - GH_TimerPay)
  const [remainingOfferSeconds, setRemainingOfferSeconds] = useState<number>(7200);
  const [remainingPaySeconds, setRemainingPaySeconds] = useState<number>(1800);

  // Modal giả lập ngân hàng chuyển tiền QR
  const [showBankSimulator, setShowBankSimulator] = useState(false);
  const [simPaidAmount, setSimPaidAmount] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy hợp đồng thuê');
        navigate('/kh/06');
        return;
      }
      setRequest(req);

      const [v, ext, pState, pay] = await Promise.all([
        req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
        db.extension_requests.where('request_id').equals(requestId).reverse().first(),
        db.process_state.get(requestId),
        db.payments
          .where('request_id')
          .equals(requestId)
          .and((p) => p.kind === 'EXTENSION')
          .reverse()
          .first(),
      ]);

      setVehicle(v || null);
      setExtension(ext || null);
      setPayment(pay || null);
      if (pay?.amount) {
        setSimPaidAmount(pay.amount);
      }

      if (pState?.waiting_node_ids?.length) {
        setWaitingNode(pState.waiting_node_ids[0]);
      } else {
        setWaitingNode('');
      }

      // Khởi tạo ngày gia hạn mặc định: thêm 1 ngày so với end_at hiện tại
      if (req.end_at && !newEndDate) {
        const curEnd = new Date(req.end_at);
        const nextDay = new Date(curEnd.getTime() + 24 * 60 * 60 * 1000);
        // Định dạng yyyy-MM-ddTHH:mm
        const formatted = nextDay.toISOString().slice(0, 16);
        setNewEndDate(formatted);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu KH-07:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate, newEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cập nhật countdown đếm ngược đề xuất 2 giờ
  useEffect(() => {
    if (!extension?.offer_expires_at) return;
    const due = new Date(extension.offer_expires_at).getTime();

    const interval = setInterval(() => {
      const now = clock.now().getTime();
      const diff = Math.max(0, Math.floor((due - now) / 1000));
      setRemainingOfferSeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [extension?.offer_expires_at]);

  // Cập nhật countdown đếm ngược QR 30 phút
  useEffect(() => {
    if (!payment?.expires_at) return;
    const due = new Date(payment.expires_at).getTime();

    const interval = setInterval(() => {
      const now = clock.now().getTime();
      const diff = Math.max(0, Math.floor((due - now) / 1000));
      setRemainingPaySeconds(diff);
    }, 1000);

    return () => clearInterval(interval);
  }, [payment?.expires_at]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải thông tin gia hạn...</p>
        </div>
      </div>
    );
  }

  if (!request) return null;

  // Xác định bước tiến trình (Stepper index)
  let currentStepIndex = 0;
  if (waitingNode === 'GH_WaitAccept') currentStepIndex = 1;
  else if (waitingNode === 'GH_VerifyQR') currentStepIndex = 2;
  else if (request.status === 'DANG_THUE' && extension?.status === 'DA_AP_DUNG') currentStepIndex = 3;

  // BƯỚC 1: Khách gửi yêu cầu gia hạn tại cổng M_EG
  const handleRequestExtension = async () => {
    if (!currentActor) return;
    if (!newEndDate) {
      toast.error('Vui lòng chọn thời điểm trả xe mới');
      return;
    }

    const newEndIso = new Date(newEndDate).toISOString();
    if (new Date(newEndIso) <= new Date(request.end_at)) {
      toast.error('Thời điểm trả xe mới phải lớn hơn thời hạn thuê hiện tại');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'M_EG',
        {
          event_type: 'EXTEND',
          new_end_at: newEndIso,
        },
        currentActor
      );

      toast.success('Hệ thống đã tiếp nhận yêu cầu và kiểm tra lịch xe!');
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi gửi yêu cầu gia hạn:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu gia hạn');
    } finally {
      setSubmitting(false);
    }
  };

  // BƯỚC 2: Khách Đồng ý hoặc Từ chối đề xuất (GH_WaitAccept)
  const handleAnswerOffer = async (answer: 'DONG_Y' | 'TU_CHOI') => {
    if (!currentActor) return;
    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'GH_WaitAccept',
        { answer },
        currentActor
      );

      if (answer === 'DONG_Y') {
        toast.success('Bạn đã đồng ý với đề xuất gia hạn!');
      } else {
        toast.warning('Bạn đã từ chối đề xuất. Thời hạn thuê cũ được giữ nguyên.');
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi phản hồi đề xuất:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể ghi nhận phản hồi');
    } finally {
      setSubmitting(false);
    }
  };

  // BƯỚC 3: Xác thực thanh toán QR gia hạn (GH_VerifyQR)
  const handleConfirmExtensionPayment = async () => {
    if (!currentActor || !payment) return;
    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'GH_VerifyQR',
        {
          paid_amount: simPaidAmount,
          provider_txn_id: `EXT_BANK_SIM_${Date.now()}`,
        },
        currentActor
      );

      toast.success('Xác nhận thanh toán gia hạn thành công! Hợp đồng đã được cập nhật.');
      setShowBankSimulator(false);
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi xác thực thanh toán gia hạn:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể hoàn tất thanh toán');
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Stepper */}
      <Card className="p-4 sm:p-5">
        <Stepper steps={CUSTOMER_EXTENSION_STEPS} currentStepIndex={currentStepIndex} />
      </Card>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-700 border border-brand-200/80 shadow-xs">
              Gia hạn chuyến đi
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Gia hạn hợp đồng thuê xe
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hợp đồng #{request.id.slice(0, 8)} • Thời hạn trả hiện tại: <strong>{formatDateTime(request.end_at)}</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
        </div>
      </div>

      {/* Thông tin phương tiện */}
      {vehicle && (
        <Card className="p-4 bg-brand-50/30 border-brand-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-white border border-brand-200/60 p-1 flex items-center justify-center shadow-xs">
              <img
                src={getVehicleImageUrl(vehicle.model)}
                alt={vehicle.model}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {vehicle.model} ({vehicle.plate})
              </h3>
              <p className="text-xs text-slate-600">
                Đơn giá thuê: <strong>{formatCurrency(vehicle.daily_price)}/ngày</strong>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TRƯỜNG HỢP 1: BƯỚC KHỞI ĐẦU CHỌN NGÀY GIA HẠN                  */}
      {/* ============================================================== */}
      {request.status === 'DANG_THUE' && (!extension || extension.status === 'DA_AP_DUNG' || extension.status === 'TU_CHOI' || extension.status === 'HET_HAN') && (
        <Card className="p-5 sm:p-6 space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <Calendar className="h-5 w-5 text-brand-600" />
            <h3 className="font-bold text-slate-900 text-base">
              Chọn thời điểm trả xe mới
            </h3>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-slate-600">
              Hệ thống sẽ tự động kiểm tra tình trạng xe và tính toán phụ phí phát sinh tương ứng.
            </p>

            <div className="max-w-md">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Thời gian trả xe mong muốn mới
              </label>
              <Input
                type="datetime-local"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
              />
            </div>

            <div className="pt-2">
              <Button
                data-testid="node-M_CatchExtend"
                onClick={handleRequestExtension}
                loading={submitting}
                className="bg-brand-600 hover:bg-brand-700 text-white font-bold"
              >
                <Calendar className="mr-2 h-4 w-4" />
                Kiểm tra & Gửi yêu cầu gia hạn
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TRƯỜNG HỢP 2: ĐANG CHỜ KHÁCH DUYỆT ĐỀ XUẤT (GH_WaitAccept)     */}
      {/* ============================================================== */}
      {waitingNode === 'GH_WaitAccept' && extension && (
        <Card
          data-testid="node-GH_WaitAccept"
          className="p-5 sm:p-6 space-y-5 border-2 border-brand-300 bg-brand-50/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Đề xuất chi phí gia hạn
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Clock className="h-3.5 w-3.5" />
              Thời gian xác nhận: <strong>{formatTimer(remainingOfferSeconds)}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <span className="text-slate-500">Thời hạn trả xe mới:</span>
              <p className="font-bold text-slate-900 text-base">
                {formatDateTime(extension.new_end_at)}
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
              <span className="text-slate-500">Phụ phí gia hạn phát sinh:</span>
              <p className="font-bold text-brand-700 text-lg">
                {formatCurrency(extension.extra_fee || 0)}
              </p>
              <p className="text-[11px] text-slate-400">
                (Được tính theo đơn giá niêm yết x số ngày gia hạn thêm)
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
            <Button
              data-testid="node-GH_WaitAccept"
              variant="outline"
              className="w-full sm:w-auto border-rose-300 text-rose-700 hover:bg-rose-50"
              onClick={() => handleAnswerOffer('TU_CHOI')}
              loading={submitting}
            >
              <XCircle className="mr-1.5 h-4 w-4" />
              Từ chối (Giữ hạn cũ)
            </Button>

            <Button
              data-testid="node-GH_WaitAccept"
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold"
              onClick={() => handleAnswerOffer('DONG_Y')}
              loading={submitting}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              Đồng ý đề xuất
            </Button>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* TRƯỜNG HỢP 3: CHỜ THANH TOÁN QR GIA HẠN (GH_VerifyQR)          */}
      {/* ============================================================== */}
      {waitingNode === 'GH_VerifyQR' && payment && (
        <Card
          data-testid="node-GH_VerifyQR"
          className="p-5 sm:p-6 space-y-5 border-2 border-emerald-300 bg-emerald-50/20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Thanh toán phụ phí gia hạn VietQR
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800 bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
              <Clock className="h-3.5 w-3.5" />
              Thời hạn chuyển khoản: <strong>{formatTimer(remainingPaySeconds)}</strong>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
            <QRBox
              qrRef={payment.qr_ref}
              amount={payment.amount}
              accountName="CONG TY MOTO CARE VIET NAM"
              bankName="Vietcombank - Chi nhánh TP.HCM"
            />

            <div className="space-y-3 text-xs sm:text-sm max-w-sm">
              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                <span className="text-slate-500 text-xs">Mã nội dung chuyển khoản (bắt buộc):</span>
                <p className="font-mono font-bold text-slate-900 text-base">
                  {payment.qr_ref}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-1">
                <span className="text-slate-500 text-xs">Số tiền cần thanh toán:</span>
                <p className="font-bold text-brand-700 text-lg">
                  {formatCurrency(payment.amount)}
                </p>
              </div>

              <Button
                data-testid="node-GH_VerifyQR"
                onClick={() => setShowBankSimulator(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Mở khung &quot;Giả lập ngân hàng&quot;
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* THÔNG BÁO HOÀN TẤT GIA HẠN THÀNH CÔNG                          */}
      {/* ============================================================== */}
      {request.status === 'DANG_THUE' && extension?.status === 'DA_AP_DUNG' && (
        <Card className="p-5 border-emerald-300 bg-emerald-50/40 text-emerald-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Gia hạn hợp đồng thành công!
          </div>
          <p className="text-xs sm:text-sm">
            Thời hạn trả xe mới của bạn đã được cập nhật đến <strong>{formatDateTime(request.end_at)}</strong>.
            Lịch xe đã được khóa bảo vệ an toàn.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/kh/06')}
              className="text-xs border-emerald-300 hover:bg-emerald-100"
            >
              Về trang chủ của tôi
            </Button>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* THÔNG BÁO BỊ TỪ CHỐI HOẶC QUÁ HẠN (GH_NotifyOld)               */}
      {/* ============================================================== */}
      {(extension?.status === 'TU_CHOI' || extension?.status === 'HET_HAN') && (
        <Card className="p-5 border-amber-200 bg-amber-50/40 text-amber-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Yêu cầu gia hạn không được chấp thuận (hoặc đã quá hạn)
          </div>
          <p className="text-xs sm:text-sm">
            {extension.reject_reason || 'Đề xuất đã hết hạn phản hồi hoặc bạn đã từ chối.'}{' '}
            Thời hạn thuê xe cũ vẫn giữ nguyên là <strong>{formatDateTime(request.end_at)}</strong>.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/kh/06')}
              className="text-xs border-amber-300 hover:bg-amber-100"
            >
              Về trang chủ của tôi
            </Button>
          </div>
        </Card>
      )}

      {/* MODAL GIẢ LẬP NGÂN HÀNG (Bank Simulator) CHO GIA HẠN */}
      {showBankSimulator && payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-md p-6 space-y-4 bg-white shadow-xl rounded-2xl">
            <div className="flex items-center gap-2 border-b pb-3 text-slate-900 font-bold">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              Khung giả lập cổng ngân hàng (VietQR)
            </div>

            <p className="text-xs text-slate-600">
              Mô phỏng khách hàng quét mã và ứng dụng ngân hàng gửi Webhook đối soát (GH_VerifyQR).
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Số tiền thực chuyển (VNĐ)
                </label>
                <Input
                  type="number"
                  value={simPaidAmount}
                  onChange={(e) => setSimPaidAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nội dung chuyển khoản
                </label>
                <Input value={payment.qr_ref} disabled />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBankSimulator(false)}
              >
                Hủy
              </Button>

              <Button
                data-testid="node-GH_VerifyQR"
                size="sm"
                onClick={handleConfirmExtensionPayment}
                loading={submitting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
              >
                Xác nhận chuyển khoản thành công
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
