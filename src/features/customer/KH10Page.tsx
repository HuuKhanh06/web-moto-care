// src/features/customer/KH10Page.tsx
// Màn hình quyết toán hoàn cọc hoặc thanh toán bổ sung

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, QRBox, Modal, Input, toast, StatusChip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { COPY } from '@/copy';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Building2,
} from 'lucide-react';

export function KH10Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  const [showBankModal, setShowBankModal] = useState(false);
  const [simPaidAmount, setSimPaidAmount] = useState<string>('');
  const [simTxnId, setSimTxnId] = useState<string>('');

  const rentalReq = useLiveQuery(
    () => (requestId ? db.rental_requests.get(requestId) : undefined),
    [requestId]
  );
  const processState = useLiveQuery(
    () => (requestId ? db.process_state.get(requestId) : undefined),
    [requestId]
  );
  const vehicle = useLiveQuery(
    () => (rentalReq?.vehicle_id ? db.vehicles.get(rentalReq.vehicle_id) : undefined),
    [rentalReq?.vehicle_id]
  );
  const settlement = useLiveQuery(
    () => (requestId ? db.settlements.where('request_id').equals(requestId).reverse().first() : undefined),
    [requestId]
  );
  const refundPayment = useLiveQuery(
    () =>
      requestId
        ? db.payments
            .where('request_id')
            .equals(requestId)
            .and((p) => p.kind === 'REFUND')
            .reverse()
            .first()
        : undefined,
    [requestId]
  );
  const extraPayment = useLiveQuery(
    () =>
      requestId
        ? db.payments
            .where('request_id')
            .equals(requestId)
            .and((p) => p.kind === 'EXTRA')
            .reverse()
            .first()
        : undefined,
    [requestId]
  );

  const waitingNodes = processState?.waiting_node_ids || [];
  const isWaitingRefundConfirm = waitingNodes.includes('M_ConfirmRefund');
  const isWaitingExtraPayment = waitingNodes.includes('M_ReceiveExtra');

  useEffect(() => {
    if (extraPayment?.expires_at && isWaitingExtraPayment) {
      const updateTimer = () => {
        const diff = Math.floor(
          (new Date(extraPayment.expires_at!).getTime() - Date.now()) / 1000
        );
        setTimeLeft(diff > 0 ? diff : 0);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [extraPayment?.expires_at, isWaitingExtraPayment]);

  const formatTimeLeft = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleConfirmRefund = async () => {
    if (!currentActor) return;
    try {
      setIsSubmitting(true);
      await engine.complete(requestId, 'M_ConfirmRefund', {}, currentActor);
      toast.success('Xác nhận đã nhận hoàn cọc thành công! Chuyến đi đã hoàn tất.');
      navigate('/kh/06');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xác nhận nhận tiền hoàn cọc');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenBankSim = () => {
    if (extraPayment) {
      setSimPaidAmount(extraPayment.amount.toString());
      setSimTxnId(`EXTRA_TXN_${Date.now().toString().slice(-6)}`);
      setShowBankModal(true);
    }
  };

  const handleProcessExtraPayment = async () => {
    if (!currentActor || !extraPayment) return;
    const paidNum = Number(simPaidAmount);
    if (isNaN(paidNum) || paidNum <= 0) {
      toast.warning('Vui lòng nhập số tiền hợp lệ');
      return;
    }

    try {
      setIsSubmitting(true);
      await engine.complete(
        requestId,
        'M_ReceiveExtra',
        {
          paid_amount: paidNum,
          provider_txn_id: simTxnId || `EXTRA_TXN_${Date.now()}`,
        },
        currentActor
      );

      setShowBankModal(false);

      const nextState = await db.process_state.get(requestId);
      if (nextState?.waiting_node_ids.includes('M_ManualExtra')) {
        toast.warning(
          'Số tiền thanh toán chưa khớp. Hệ thống đã chuyển nhân viên hỗ trợ đối soát.'
        );
      } else {
        toast.success('Thanh toán khoản phát sinh thành công! Quyết toán hoàn tất.');
        navigate('/kh/06');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xử lý giao dịch thanh toán');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center">
        <Card className="p-8 border border-slate-200 bg-white rounded-xl space-y-4">
          <p className="text-slate-600">Không tìm thấy thông tin chuyến đi.</p>
          <Button variant="primary" onClick={() => navigate('/kh/06')}>
            Chuyến đi của tôi
          </Button>
        </Card>
      </div>
    );
  }

  const isRefundKind = settlement?.kind === 'HOAN_DU' || (settlement?.balance || 0) > 0;
  const isExtraKind = settlement?.kind === 'THU_THEM' || (settlement?.balance || 0) < 0;
  const isBalanceKind = settlement?.kind === 'CAN_BANG' || settlement?.balance === 0;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.SETTLEMENT}
        </h1>
        <StatusChip
          status={isRefundKind ? 'success' : isExtraKind ? 'pending' : 'success'}
          label={isRefundKind ? 'Hoàn tiền cọc' : isExtraKind ? 'Cần thanh toán thêm' : 'Cân bằng cọc'}
        />
      </div>

      {/* Thông tin phương tiện */}
      {vehicle && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <span className="text-[13px] text-slate-500 block">Phương tiện bàn giao:</span>
            <p className="text-base font-semibold text-slate-900">
              {vehicle.model} ({vehicle.plate})
            </p>
          </div>
          <div className="text-right space-y-0.5">
            <span className="text-[13px] text-slate-500 block">Tiền cọc ban đầu:</span>
            <p className="text-base font-semibold text-teal-800">
              {formatCurrency(settlement?.deposit_paid || rentalReq?.deposit_amount || 0)}
            </p>
          </div>
        </Card>
      )}

      {/* 1. TRƯỜNG HỢP HOÀN TIỀN CỌC DƯ */}
      {isRefundKind && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Hoàn trả tiền cọc thừa
            </h2>
            <p className="text-sm text-slate-600">
              Số tiền cọc thừa sau khi tất toán được chuyển trực tiếp về tài khoản ngân hàng của bạn.
            </p>
          </div>

          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-[13px] font-semibold text-teal-900 block">
                Số tiền bạn được nhận lại:
              </span>
              <span className="text-3xl font-semibold text-teal-800 block mt-0.5">
                {formatCurrency(settlement?.balance || refundPayment?.amount || 0)}
              </span>
            </div>
            <div className="text-[13px] text-slate-600 sm:text-right">
              <div>Mã đối soát: <strong className="text-slate-900 font-mono">{refundPayment?.qr_ref || 'REF_AUTO'}</strong></div>
              <div>Trạng thái: <strong className="text-teal-800">Đã giải ngân</strong></div>
            </div>
          </div>

          {isWaitingRefundConfirm ? (
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-sm text-slate-500">
                Vui lòng kiểm tra tài khoản ngân hàng và xác nhận:
              </span>
              <Button
                data-testid="node-M_ConfirmRefund"
                variant="primary"
                onClick={handleConfirmRefund}
                loading={isSubmitting}
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                <span>Xác nhận đã nhận tiền</span>
              </Button>
            </div>
          ) : (
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center text-sm text-emerald-900 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Giao dịch hoàn cọc đã hoàn tất thành công!</span>
            </div>
          )}
        </Card>
      )}

      {/* 2. TRƯỜNG HỢP THU THÊM CHI PHÍ */}
      {isExtraKind && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">
              Thanh toán chi phí phát sinh
            </h2>
            {isWaitingExtraPayment && (
              <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Hết hạn: {formatTimeLeft(timeLeft)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
            <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <span className="text-[13px] font-semibold text-slate-700">Mã VietQR thanh toán</span>
              {extraPayment && (
                <QRBox
                  qrRef={extraPayment.qr_ref}
                  amount={extraPayment.amount}
                />
              )}
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-200 space-y-1">
                <span className="text-[13px] font-semibold text-amber-900 block">
                  Số tiền cần thanh toán:
                </span>
                <span className="text-3xl font-semibold text-amber-900 block">
                  {formatCurrency(Math.abs(settlement?.balance || extraPayment?.amount || 0))}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-sm text-slate-600">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <Building2 className="w-4 h-4 text-teal-600" />
                  <span>Tài khoản thụ hưởng MotoCare</span>
                </div>
                <div>Ngân hàng: <strong>Vietcombank (Đà Nẵng)</strong></div>
                <div>Số tài khoản: <strong className="font-mono text-slate-900">0123456789</strong></div>
              </div>

              {isWaitingExtraPayment && (
                <Button
                  data-testid="node-M_ReceiveExtra"
                  variant="primary"
                  onClick={handleOpenBankSim}
                  loading={isSubmitting}
                  className="w-full"
                >
                  <CreditCard className="w-4 h-4 mr-1.5" />
                  <span>Xác nhận đã chuyển khoản</span>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 3. TRƯỜNG HỢP CÂN BẰNG TIỀN CỌC */}
      {isBalanceKind && (
        <Card className="p-6 md:p-8 border border-slate-200 bg-white rounded-xl text-center space-y-3">
          <ShieldCheck className="w-12 h-12 text-teal-600 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-900">
            Hợp đồng đã quyết toán trọn vẹn
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Số tiền cọc ban đầu ({formatCurrency(settlement?.deposit_paid || 0)}) đã cân bằng với chi phí thanh lý. Cảm ơn bạn đã lựa chọn đồng hành cùng MotoCare!
          </p>
          <div className="pt-2">
            <Button variant="primary" onClick={() => navigate('/kh/06')}>
              Chuyến đi của tôi
            </Button>
          </div>
        </Card>
      )}

      {/* MODAL GIẢ LẬP XÁC NHẬN CHUYỂN KHOẢN PHÁT SINH */}
      <Modal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        title="Xác nhận thanh toán bổ sung"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Nhập số tiền bạn đã chuyển khoản để hoàn tất đối soát đơn thuê.
          </p>

          <Input
            label="Số tiền chuyển (VND):"
            type="number"
            value={simPaidAmount}
            onChange={(e) => setSimPaidAmount(e.target.value)}
          />

          <Input
            label="Mã giao dịch ngân hàng:"
            value={simTxnId}
            onChange={(e) => setSimTxnId(e.target.value)}
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowBankModal(false)}>
              Hủy
            </Button>
            <Button
              data-testid="node-M_ReceiveExtra"
              variant="primary"
              onClick={handleProcessExtraPayment}
              loading={isSubmitting}
            >
              <span>Xác nhận giao dịch</span>
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default KH10Page;
