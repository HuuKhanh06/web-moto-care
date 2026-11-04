// src/features/customer/KH03Page.tsx
// Màn hình KH-03: Thanh toán cọc (M_CreateDeposit, M_WaitDeposit)
// Hiển thị mã QR VietQR, đếm ngược 30 phút và Modal Giả lập ngân hàng (test ĐỦ, THIẾU, SAI)

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { fn_create_deposit_qr } from '@/engine/fn';
import type { RentalRequest, Payment, ProcessTimer } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Modal,
  Stepper,
  QRBox,
  toast,
} from '@/components/ui';
import {
  formatCurrency,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { CUSTOMER_RENTAL_STEPS } from './constants';
import {
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react';

export function KH03Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [timerRecord, setTimerRecord] = useState<ProcessTimer | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800); // 30 phút = 1800s
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal Giả lập ngân hàng
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simAmount, setSimAmount] = useState<number>(0);
  const [simContent, setSimContent] = useState<string>('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

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

      // Tìm thanh toán cọc DEPOSIT
      let p = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((item) => item.kind === 'DEPOSIT')
        .last();

      // Nếu chưa có (hoặc vừa được nhân viên tạo mới sau khi từ chối cọc)
      if (!p && req.deposit_amount && currentActor) {
        p = await fn_create_deposit_qr(requestId, currentActor);
      }

      setPayment(p || null);
      if (p) {
        setSimAmount(p.amount);
        setSimContent(p.qr_ref);
      }

      // Đọc timer M_BoundDeposit đang chạy
      const t = await db.timers
        .where('request_id')
        .equals(requestId)
        .and((tm) => tm.bpmn_node_id === 'M_BoundDeposit' && tm.status === 'PENDING')
        .first();
      setTimerRecord(t || null);
    } catch (err) {
      console.error('Lỗi nạp KH-03:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, currentActor, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cập nhật đồng hồ đếm ngược theo thời gian thực tế của clock
  useEffect(() => {
    if (!payment?.expires_at) return;

    const expiresTime = payment.expires_at;
    const updateTimer = () => {
      const now = clock.now();
      const due = new Date(expiresTime);
      const diffSec = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [payment?.expires_at]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success(`Đã sao chép: ${text}`);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request || !payment) {
    return null;
  }

  const isExpired = request.status === 'TU_CHOI' && request.closed_reason === 'QUA_HAN_COC';
  const isPendingStaff = request.status === 'CHO_COC' && !timerRecord; // đã chuyển sang M_ManualDeposit
  const isPaidSuccess = request.status === 'CHO_KY' || request.status === 'DANG_THUE';

  // Format phút:giây đếm ngược
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Kịch bản nhanh trong modal giả lập
  const applyPreset = (preset: 'DU' | 'THIEU' | 'SAI') => {
    if (preset === 'DU') {
      setSimAmount(payment.amount);
      setSimContent(payment.qr_ref);
    } else if (preset === 'THIEU') {
      setSimAmount(Math.round(payment.amount * 0.7)); // Chuyển thiếu 30%
      setSimContent(payment.qr_ref);
    } else {
      setSimAmount(payment.amount);
      setSimContent(`CK THUE XE ${request.id.slice(0, 6)}`); // Sai mã QR ref
    }
  };

  // Gửi giao dịch thanh toán giả lập
  const handleConfirmSimulator = async () => {
    if (!requestId || !currentActor) return;
    setSubmittingPayment(true);

    try {
      // Gọi engine hoàn thành điểm chờ M_WaitDeposit
      await engine.complete(
        requestId,
        'M_WaitDeposit',
        {
          paid_amount: simAmount,
          transfer_content: simContent,
        },
        currentActor
      );

      setIsSimulatorOpen(false);

      // Kiểm tra trạng thái sau khi đối soát (M_CheckDeposit & M_G03)
      const updatedReq = await db.rental_requests.get(requestId);

      if (updatedReq?.status === 'CHO_KY') {
        toast.success('Đối soát cọc tự động khớp 100% (ĐỦ)! Chuyển sang ký hợp đồng.');
        navigate(`/kh/04?requestId=${requestId}`);
      } else {
        toast.warning(
          'Số tiền hoặc nội dung chưa khớp chuẩn. Đơn đã được chuyển cho Nhân viên kiểm tra cọc ngoại lệ (NV-02).'
        );
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Lỗi thanh toán:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xử lý giao dịch';
      toast.error(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-20 sm:pb-6">
      {/* Stepper */}
      <Card className="p-4 border-slate-200/80 shadow-sm glass-surface">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={2} />
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70 shadow-2xs">
              Bước 3 &bull; Đặt cọc giữ xe
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Thanh toán tiền đặt cọc</h1>
          </div>
          <p className="text-sm text-slate-500">
            Quét mã VietQR chuyển khoản nhanh 30% để xác nhận đặt xe tức thì
          </p>
        </div>

        <Badge variant={getStatusBadgeVariant(request.status)} size="md">
          {getStatusLabel(request.status)}
        </Badge>
      </div>

      {/* CẢNH BÁO: Hết hạn cọc */}
      {isExpired && (
        <Card className="p-5 border-red-300 bg-red-50/80 text-red-900 space-y-3 shadow-sm rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-base text-red-800">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            Yêu cầu thuê đã hết hạn thanh toán cọc
          </div>
          <p className="text-xs text-red-700 leading-relaxed">
            Đã quá thời gian quy định (30 phút) kể từ lúc tạo yêu cầu cọc nhưng chưa ghi nhận giao dịch thành công. Vui lòng tạo yêu cầu mới.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="text-red-700 border-red-300 bg-white hover:bg-red-100 rounded-xl"
          >
            Tạo yêu cầu thuê mới
          </Button>
        </Card>
      )}

      {/* THÔNG BÁO: Đang chờ nhân viên hỗ trợ */}
      {isPendingStaff && !isExpired && (
        <Card className="p-5 border-amber-300 bg-amber-50/80 text-amber-900 space-y-2 shadow-sm rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            Đang hỗ trợ đối soát thanh toán
          </div>
          <p className="text-xs text-amber-700 leading-relaxed">
            Giao dịch chuyển khoản của bạn có sự chênh lệch so với số tiền hoặc nội dung mã QR. Nhân viên đang đối chiếu sao kê và phê duyệt thủ công cho bạn trong ít phút.
          </p>
        </Card>
      )}

      {/* THÔNG BÁO: Đã cọc thành công */}
      {isPaidSuccess && (
        <Card className="p-5 border-emerald-300 bg-emerald-50/90 text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Tiền cọc đã được ghi nhận thành công! Bạn có thể tiếp tục ký hợp đồng.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/kh/04?requestId=${requestId}`)}
            className="flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <span>Đến trang Ký hợp đồng (KH-04)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Card>
      )}

      {/* KHUNG THANH TOÁN QR VÀ THÔNG TIN CHUYỂN KHOẢN */}
      {!isExpired && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Cột trái: Mã QRBox */}
          <div className="md:col-span-5 flex flex-col items-center">
            <Card className="p-6 border-slate-200/80 w-full flex flex-col items-center text-center space-y-3 glass-surface shadow-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Mã QR Chuyển Khoản Nhanh
              </span>

              <div className="p-2 rounded-2xl bg-white border border-slate-100 shadow-inner">
                <QRBox
                  qrRef={payment.qr_ref}
                  amount={payment.amount}
                  bankName="MB Bank (Napas 247)"
                  accountName="CONG TY CP MOTO CARE"
                  size={210}
                />
              </div>

              {/* Đồng hồ đếm ngược */}
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 text-xs font-semibold shadow-xs">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>Hạn thanh toán: </span>
                <span className="font-mono font-bold text-amber-900">{timeDisplay}</span>
              </div>
            </Card>
          </div>

          {/* Cột phải: Chi tiết tài khoản & Nút giả lập */}
          <div className="md:col-span-7 space-y-4">
            <Card className="p-5 border-slate-200/80 space-y-4 glass-surface shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-600" />
                Thông tin thanh toán ngân hàng chính thức
              </h3>

              <div className="space-y-3 text-xs divide-y divide-slate-100">
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Số tiền cọc cần chuyển:</span>
                  <span className="font-bold text-base text-brand-700">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Ngân hàng thụ hưởng:</span>
                  <span className="font-semibold text-slate-800">MB Bank (Quân Đội)</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-slate-900">99998888MC</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('99998888MC', 'acc')}
                      className="p-1 rounded text-slate-400 hover:text-brand-600 transition-colors"
                      title="Sao chép số tài khoản"
                    >
                      {copiedKey === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800 uppercase">CONG TY CP MOTO CARE</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Nội dung CK (Bắt buộc):</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-brand-800 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                      {payment.qr_ref}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.qr_ref, 'ref')}
                      className="p-1 rounded text-slate-400 hover:text-brand-600 transition-colors"
                      title="Sao chép nội dung chuyển khoản"
                    >
                      {copiedKey === 'ref' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-3 bg-brand-50/40 rounded-xl text-[11px] text-slate-600 leading-relaxed border border-brand-100">
                Hệ thống tự động lắng nghe Webhook ngân hàng và cập nhật trạng thái tức thì ngay khi nhận được thanh toán.
              </div>
            </Card>

            {/* Nút mở Modal Giả Lập Ngân Hàng trên desktop */}
            {!isPaidSuccess && (
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                data-testid="node-M_WaitDeposit"
                onClick={() => setIsSimulatorOpen(true)}
                className="hidden sm:flex items-center justify-center gap-2 py-3 shadow-md"
              >
                <Sparkles className="w-4 h-4 text-emerald-200 animate-spin" />
                <span>Đã chuyển khoản (Mở giả lập ngân hàng đối soát)</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom CTA Bar cho Mobile */}
      {!isPaidSuccess && !isExpired && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            data-testid="node-M_WaitDeposit"
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center justify-center gap-2 py-3 shadow-md"
          >
            <Sparkles className="w-4 h-4 text-emerald-200" />
            <span>Đã chuyển khoản (Giả lập đối soát)</span>
          </Button>
        </div>
      )}

      {/* MODAL GIẢ LẬP CỔNG NGÂN HÀNG (Webhook / Bank Simulator) */}
      <Modal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title="Giả lập cổng Webhook Ngân hàng (Đối soát cọc)"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Công cụ giả lập phản hồi của hệ thống ngân hàng đối soát. Chọn kịch bản nhanh hoặc nhập tùy ý để kiểm thử cả 3 nhánh BPMN (<code className="font-mono font-bold">M_G03: ĐỦ, THIẾU, SAI</code>).
          </p>

          {/* 3 Preset kịch bản nhanh */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-700">Chọn nhanh kịch bản kiểm thử:</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => applyPreset('DU')}
                className="p-3 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100 text-left transition-all active:scale-95"
              >
                <div className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Khớp ĐỦ (Happy)
                </div>
                <div className="text-[10px] text-emerald-600 mt-0.5">Đúng số tiền & nội dung</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('THIEU')}
                className="p-3 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100 text-left transition-all active:scale-95"
              >
                <div className="text-xs font-bold text-amber-800 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  Chuyển THIẾU
                </div>
                <div className="text-[10px] text-amber-600 mt-0.5">Thiếu tiền (chuyển 70%)</div>
              </button>

              <button
                type="button"
                onClick={() => applyPreset('SAI')}
                className="p-3 rounded-xl border border-red-300 bg-red-50/70 hover:bg-red-100 text-left transition-all active:scale-95"
              >
                <div className="text-xs font-bold text-red-800 flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-red-600" />
                  SAI nội dung
                </div>
                <div className="text-[10px] text-red-600 mt-0.5">Không chứa mã qr_ref</div>
              </button>
            </div>
          </div>

          {/* Form nhập chi tiết */}
          <div className="space-y-3 pt-2">
            <Input
              label="Số tiền thực nhận (VND)"
              type="number"
              step="1000"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              required
            />

            <Input
              label="Nội dung chuyển khoản thực nhận"
              value={simContent}
              onChange={(e) => setSimContent(e.target.value)}
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSimulatorOpen(false)}
            >
              Hủy
            </Button>

            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={submittingPayment}
              onClick={handleConfirmSimulator}
            >
              Kích hoạt Webhook Ngân hàng
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
