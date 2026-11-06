// src/features/customer/KH07Page.tsx
// Màn hình gia hạn thời gian thuê xe

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
  Input,
  QRBox,
  toast,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { COPY } from '@/copy';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  X,
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

  const [newEndDate, setNewEndDate] = useState<string>('');
  const [remainingOfferSeconds, setRemainingOfferSeconds] = useState<number>(7200);
  const [remainingPaySeconds, setRemainingPaySeconds] = useState<number>(1800);
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

      if (req.end_at && !newEndDate) {
        const curEnd = new Date(req.end_at);
        const nextDay = new Date(curEnd.getTime() + 24 * 60 * 60 * 1000);
        const formatted = nextDay.toISOString().slice(0, 16);
        setNewEndDate(formatted);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu gia hạn:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate, newEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cập nhật đếm ngược đề xuất (2 giờ)
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

  // Cập nhật đếm ngược QR (30 phút)
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
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <Calendar className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang kiểm tra thông tin gia hạn...</span>
      </div>
    );
  }

  if (!request) return null;

  const handleRequestExtension = async () => {
    if (!currentActor) return;
    if (!newEndDate) {
      toast.warning('Vui lòng chọn thời điểm trả xe mới');
      return;
    }

    const newEndIso = new Date(newEndDate).toISOString();
    if (new Date(newEndIso) <= new Date(request.end_at)) {
      toast.warning('Thời điểm trả xe mới phải lớn hơn thời hạn thuê hiện tại');
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

      toast.success('Hệ thống đã tiếp nhận yêu cầu và kiểm tra lịch xe.');
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi gửi yêu cầu gia hạn:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu gia hạn');
    } finally {
      setSubmitting(false);
    }
  };

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
        toast.success('Bạn đã đồng ý với đề xuất gia hạn.');
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

  const handleConfirmExtensionPayment = async () => {
    if (!currentActor || !payment) return;
    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'GH_VerifyQR',
        {
          paid_amount: simPaidAmount,
          provider_txn_id: `EXT_TXN_${Date.now()}`,
        },
        currentActor
      );

      toast.success('Thanh toán gia hạn thành công! Lịch thuê đã được cập nhật.');
      setShowBankSimulator(false);
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi xác thực thanh toán:', err);
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
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.EXTEND}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/kh/06')}
        >
          Chuyến đi của tôi
        </Button>
      </div>

      {/* Thông tin phương tiện đang thuê */}
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
              {vehicle.plate} · Hạn trả hiện tại: {formatDateTime(request.end_at)}
            </p>
          </div>
        </Card>
      )}

      {/* BƯỚC 1: CHỌN NGÀY TRẢ MỚI */}
      {(!extension || extension.status === 'TU_CHOI' || extension.status === 'HET_HAN') && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            Chọn thời điểm trả xe mới
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Ngày giờ trả xe mới:
              </label>
              <Input
                type="datetime-local"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                min={request.end_at ? new Date(request.end_at).toISOString().slice(0, 16) : undefined}
                required
              />
            </div>

            <Button
              data-testid="node-M_CatchExtend"
              variant="primary"
              onClick={handleRequestExtension}
              loading={submitting}
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              <span>Gửi yêu cầu gia hạn</span>
            </Button>
          </div>
        </Card>
      )}

      {/* BƯỚC 2: XÁC NHẬN ĐỀ XUẤT PHÍ GIA HẠN */}
      {waitingNode === 'GH_WaitAccept' && extension && (
        <Card
          data-testid="node-GH_WaitAccept"
          className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Đề xuất gia hạn
            </h2>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>Còn lại: {formatTimer(remainingOfferSeconds)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[13px] block">Thời hạn trả xe mới:</span>
              <p className="font-semibold text-slate-900">
                {formatDateTime(extension.new_end_at)}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[13px] block">Cước phí bổ sung:</span>
              <p className="font-semibold text-teal-800 text-lg">
                {formatCurrency(extension.extra_fee || 0)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              data-testid="node-GH_WaitAccept"
              variant="outline"
              onClick={() => handleAnswerOffer('TU_CHOI')}
              loading={submitting}
            >
              <XCircle className="w-4 h-4 mr-1.5 text-rose-500" />
              <span>Từ chối</span>
            </Button>

            <Button
              data-testid="node-GH_WaitAccept"
              variant="primary"
              onClick={() => handleAnswerOffer('DONG_Y')}
              loading={submitting}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>Đồng ý gia hạn</span>
            </Button>
          </div>
        </Card>
      )}

      {/* BƯỚC 3: THANH TOÁN PHÍ GIA HẠN */}
      {waitingNode === 'GH_VerifyQR' && payment && (
        <Card
          data-testid="node-GH_VerifyQR"
          className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-teal-600" />
              <h2 className="text-base font-semibold text-slate-900">
                Thanh toán phí gia hạn
              </h2>
            </div>
            <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
              <Clock className="w-4 h-4 text-amber-600" />
              <span>{formatTimer(remainingPaySeconds)}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
            <QRBox
              qrRef={payment.qr_ref}
              amount={payment.amount}
              accountName="CONG TY CP MOTOCARE DA NANG"
              bankName="Vietcombank - Chi nhánh Đà Nẵng"
            />

            <div className="space-y-3 w-full sm:max-w-xs text-sm">
              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-[13px] text-slate-500 block">Mã chuyển khoản:</span>
                <span className="font-mono font-semibold text-slate-900 block">
                  {payment.qr_ref}
                </span>
              </div>

              <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                <span className="text-[13px] text-slate-500 block">Số tiền cần thanh toán:</span>
                <span className="font-semibold text-teal-800 text-lg block">
                  {formatCurrency(payment.amount)}
                </span>
              </div>

              <Button
                data-testid="node-GH_VerifyQR"
                variant="primary"
                onClick={() => setShowBankSimulator(true)}
              >
                <span>Xác nhận thanh toán</span>
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* THÀNH CÔNG */}
      {request.status === 'DANG_THUE' && extension?.status === 'DA_AP_DUNG' && (
        <Card className="p-4 md:p-6 border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-3 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Gia hạn thành công!</span>
          </div>
          <p className="text-sm text-emerald-800">
            Thời hạn trả xe mới của bạn đã được cập nhật đến <strong>{formatDateTime(request.end_at)}</strong>.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/06')}
          >
            Chuyến đi của tôi
          </Button>
        </Card>
      )}

      {/* TỪ CHỐI HOẶC HẾT HẠN */}
      {(extension?.status === 'TU_CHOI' || extension?.status === 'HET_HAN') && (
        <Card className="p-4 md:p-6 border border-amber-200 bg-amber-50 text-amber-900 space-y-3 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Yêu cầu gia hạn không được áp dụng</span>
          </div>
          <p className="text-sm text-amber-800">
            Thời hạn thuê xe vẫn giữ nguyên theo hợp đồng ban đầu: <strong>{formatDateTime(request.end_at)}</strong>.
          </p>
        </Card>
      )}

      {/* MODAL XÁC NHẬN CHUYỂN KHOẢN */}
      {showBankSimulator && payment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md p-6 space-y-4 bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-semibold text-slate-900">
                Xác nhận chuyển khoản
              </h2>
              <button
                type="button"
                onClick={() => setShowBankSimulator(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Số tiền chuyển (VND):
                </label>
                <Input
                  type="number"
                  value={simPaidAmount}
                  onChange={(e) => setSimPaidAmount(Number(e.target.value))}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Nội dung chuyển khoản:
                </label>
                <Input value={payment.qr_ref} disabled />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBankSimulator(false)}
              >
                Hủy
              </Button>

              <Button
                data-testid="node-GH_VerifyQR"
                variant="primary"
                size="sm"
                onClick={handleConfirmExtensionPayment}
                loading={submitting}
              >
                Xác nhận
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
