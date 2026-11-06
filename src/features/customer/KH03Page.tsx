// src/features/customer/KH03Page.tsx
// Màn hình 3: Thanh toán tiền cọc qua mã VietQR

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
  Input,
  Modal,
  QRBox,
  toast,
  BookingProgress,
  StatusChip,
  StickyBottomBar,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import {
  Clock,
  Building2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ShieldAlert,
  Copy,
  Check,
  CreditCard,
} from 'lucide-react';
import { COPY } from '@/copy';

export function KH03Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [timerRecord, setTimerRecord] = useState<ProcessTimer | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(1800);
  const [loading, setLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Modal Giả lập ngân hàng (Demo & Testing)
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

      let p = await db.payments
        .where('request_id')
        .equals(requestId)
        .and((item) => item.kind === 'DEPOSIT')
        .last();

      if (!p && req.deposit_amount && currentActor) {
        p = await fn_create_deposit_qr(requestId, currentActor);
      }

      setPayment(p || null);
      if (p) {
        setSimAmount(p.amount);
        setSimContent(p.qr_ref);
      }

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

  // Đồng hồ đếm ngược
  useEffect(() => {
    const dueTime = payment?.expires_at || timerRecord?.due_at;
    if (!dueTime) return;

    const updateTimer = () => {
      const now = clock.now();
      const expire = new Date(dueTime);
      const diffSec = Math.max(0, Math.floor((expire.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        loadData();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [payment?.expires_at, timerRecord?.due_at, loadData]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Đã sao chép vào bộ nhớ tạm');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeDisplay = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isExpired = (request?.status === 'TU_CHOI' && request?.closed_reason === 'QUA_HAN_COC') || remainingSeconds <= 0;
  const isPaidSuccess = payment?.status === 'VERIFIED' || ['CHO_KY', 'CHO_BAN_GIAO', 'DANG_THUE', 'HOAN_TAT'].includes(request?.status || '');
  const isPendingStaff = request?.status === 'CHO_COC' && !timerRecord;

  const applyPreset = (preset: 'DU' | 'THIEU' | 'SAI') => {
    if (!payment) return;
    if (preset === 'DU') {
      setSimAmount(payment.amount);
      setSimContent(payment.qr_ref);
    } else if (preset === 'THIEU') {
      setSimAmount(Math.round(payment.amount * 0.7));
      setSimContent(payment.qr_ref);
    } else {
      setSimAmount(payment.amount);
      setSimContent('Chuyen tien thue xe');
    }
  };

  const handleConfirmSimulator = async () => {
    if (!requestId || !payment || !currentActor) return;
    setSubmittingPayment(true);
    try {
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
      await loadData();

      const updatedReq = await db.rental_requests.get(requestId);
      if (updatedReq?.status === 'CHO_KY') {
        toast.success('Đã nhận đủ tiền cọc! Chuyển sang ký hợp đồng.');
        navigate(`/kh/04?requestId=${requestId}`);
      } else if (updatedReq?.status === 'CHO_COC') {
        toast.warning('Số tiền hoặc nội dung chưa khớp. Đã chuyển nhân viên xử lý.');
      }
    } catch (err: unknown) {
      console.error('Lỗi thanh toán giả lập:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi khi xử lý chuyển khoản';
      toast.error(msg);
    } finally {
      setSubmittingPayment(false);
    }
  };

  if (loading || !request || !payment) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <CreditCard className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang tạo mã VietQR...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* 4 Bước tiến trình */}
      <BookingProgress currentStep={3} />

      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.PAYMENT_DEPOSIT}
        </h1>
        <StatusChip
          status={isPaidSuccess ? 'success' : isExpired ? 'error' : isPendingStaff ? 'pending' : 'pending'}
          label={isPaidSuccess ? 'Đã cọc thành công' : isExpired ? 'Hết hạn cọc' : isPendingStaff ? 'Đang đối soát' : 'Chờ quét mã'}
        />
      </div>

      {isExpired && (
        <Card className="p-4 md:p-6 border border-rose-200 bg-rose-50 text-rose-900 space-y-3 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base text-rose-800">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Thời gian đặt cọc đã hết hạn</span>
          </div>
          <p className="text-sm text-rose-700">
            Đã quá 30 phút kể từ lúc tạo yêu cầu. Vui lòng tạo yêu cầu thuê mới để giữ xe.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="bg-white text-rose-700 border-rose-300"
          >
            Tạo yêu cầu mới
          </Button>
        </Card>
      )}

      {isPendingStaff && !isExpired && (
        <Card className="p-4 md:p-6 border border-amber-200 bg-amber-50 text-amber-900 space-y-2 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-sm text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Đang hỗ trợ đối soát tiền cọc</span>
          </div>
          <p className="text-[13px] text-amber-800">
            Số tiền hoặc nội dung chuyển khoản có sự chênh lệch. Nhân viên đang kiểm tra và xác nhận thủ công cho bạn.
          </p>
        </Card>
      )}

      {isPaidSuccess && (
        <Card className="p-4 md:p-6 border border-emerald-200 bg-emerald-50 text-emerald-900 flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Tiền cọc đã được xác nhận thành công!</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/kh/04?requestId=${requestId}`)}
            className="flex items-center gap-1.5 shrink-0"
          >
            <span>Ký hợp đồng</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </Card>
      )}

      {!isExpired && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* Cột trái: Mã QRBox */}
          <div className="md:col-span-5 flex flex-col items-center">
            <Card className="p-6 border border-slate-200 w-full flex flex-col items-center text-center space-y-3 bg-white rounded-xl">
              <span className="text-sm font-semibold text-slate-800">
                Quét mã VietQR chuyển khoản
              </span>

              <div className="p-2 rounded-xl bg-white border border-slate-100 shadow-xs">
                <QRBox
                  qrRef={payment.qr_ref}
                  amount={payment.amount}
                  bankName="MB Bank (Napas 247)"
                  accountName="CONG TY CP MOTO CARE"
                  size={200}
                />
              </div>

              {/* Đếm ngược 30 phút */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[13px] font-semibold">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Hết hạn sau: </span>
                <span className="font-mono">{timeDisplay}</span>
              </div>
            </Card>
          </div>

          {/* Cột phải: Thông tin chuyển khoản */}
          <div className="md:col-span-7 space-y-4">
            <Card className="p-4 md:p-6 border border-slate-200 space-y-4 bg-white rounded-xl">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Building2 className="w-5 h-5 text-teal-700 shrink-0" />
                <h2 className="text-base font-semibold text-slate-900">Thông tin tài khoản</h2>
              </div>

              <div className="space-y-3 text-sm divide-y divide-slate-100">
                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Số tiền cọc:</span>
                  <span className="font-semibold text-lg text-teal-700">
                    {formatCurrency(payment.amount)}
                  </span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Ngân hàng:</span>
                  <span className="font-semibold text-slate-800">MB Bank (Quân Đội)</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Số tài khoản:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-slate-900">99998888MC</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('99998888MC', 'acc')}
                      className="p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer"
                      title="Sao chép"
                    >
                      {copiedKey === 'acc' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Chủ tài khoản:</span>
                  <span className="font-semibold text-slate-800">CONG TY CP MOTO CARE</span>
                </div>

                <div className="flex justify-between items-center py-2">
                  <span className="text-slate-500">Nội dung chuyển:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {payment.qr_ref}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(payment.qr_ref, 'ref')}
                      className="p-1 rounded text-slate-400 hover:text-teal-600 cursor-pointer"
                      title="Sao chép"
                    >
                      {copiedKey === 'ref' ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-slate-500 leading-normal p-3 bg-slate-50 rounded-xl border border-slate-200">
                Hệ thống tự động xác nhận ngay sau khi bạn hoàn tất chuyển khoản trên ứng dụng ngân hàng.
              </p>
            </Card>

            {/* Nút hành động Desktop */}
            {!isPaidSuccess && (
              <Button
                type="button"
                variant="primary"
                size="md"
                fullWidth
                data-testid="node-M_WaitDeposit"
                onClick={() => setIsSimulatorOpen(true)}
                className="hidden md:flex items-center justify-center gap-2"
              >
                <span>Tôi đã chuyển khoản</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Sticky Bottom Bar trên Mobile */}
      {!isPaidSuccess && !isExpired && (
        <StickyBottomBar className="md:hidden">
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            data-testid="node-M_WaitDeposit"
            onClick={() => setIsSimulatorOpen(true)}
            className="flex items-center justify-center gap-2"
          >
            <span>Tôi đã chuyển khoản</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </StickyBottomBar>
      )}

      {/* Modal Mô phỏng thanh toán ngân hàng */}
      <Modal
        isOpen={isSimulatorOpen}
        onClose={() => setIsSimulatorOpen(false)}
        title="Xác nhận chuyển khoản ngân hàng"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Chọn kịch bản chuyển khoản để hệ thống tự động đối soát:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyPreset('DU')}
              className="p-3 rounded-xl border border-emerald-300 bg-emerald-50 text-left cursor-pointer"
            >
              <div className="text-sm font-semibold text-emerald-800 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Đúng số tiền
              </div>
              <div className="text-[13px] text-emerald-700 mt-0.5">Khớp đủ 100%</div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('THIEU')}
              className="p-3 rounded-xl border border-amber-300 bg-amber-50 text-left cursor-pointer"
            >
              <div className="text-sm font-semibold text-amber-900 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Chuyển thiếu
              </div>
              <div className="text-[13px] text-amber-800 mt-0.5">Thiếu tiền (70%)</div>
            </button>

            <button
              type="button"
              onClick={() => applyPreset('SAI')}
              className="p-3 rounded-xl border border-rose-300 bg-rose-50 text-left cursor-pointer"
            >
              <div className="text-sm font-semibold text-rose-800 flex items-center gap-1">
                <XCircle className="w-4 h-4 text-rose-600" />
                Sai nội dung
              </div>
              <div className="text-[13px] text-rose-700 mt-0.5">Nội dung tự do</div>
            </button>
          </div>

          <div className="space-y-3 pt-2">
            <Input
              label="Số tiền chuyển (VND)"
              type="number"
              step="1000"
              value={simAmount}
              onChange={(e) => setSimAmount(Number(e.target.value))}
              required
            />

            <Input
              label="Nội dung chuyển khoản"
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
              Xác nhận thanh toán
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
