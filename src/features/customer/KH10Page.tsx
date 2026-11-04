// src/features/customer/KH10Page.tsx
// Màn hình KH-10: Thanh toán bổ sung / Nhận hoàn cọc (M_PayExtra, M_ReceiveExtra, M_Refund, M_ConfirmRefund)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, QRBox, Modal, Input, toast } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  CreditCard,
  CheckCircle,
  Clock,
  Car,
  DollarSign,
  ArrowRight,
  ShieldCheck,
  Building,
} from 'lucide-react';

export function KH10Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Bank simulator state
  const [showBankModal, setShowBankModal] = useState(false);
  const [simPaidAmount, setSimPaidAmount] = useState<string>('');
  const [simTxnId, setSimTxnId] = useState<string>('');

  // Live query dữ liệu
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

  // Đếm ngược 30 phút cho khoản thu thêm
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

  // 1. Khách xác nhận đã nhận hoàn cọc (M_ConfirmRefund)
  const handleConfirmRefund = async () => {
    if (!currentActor) return;
    try {
      setIsSubmitting(true);
      await engine.complete(requestId, 'M_ConfirmRefund', {}, currentActor);
      toast.success('Xác nhận đã nhận hoàn cọc thành công! Quy trình quyết toán hoàn tất.');
      setTimeout(() => {
        navigate('/kh/06');
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xác nhận nhận tiền hoàn cọc');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mở khung giả lập ngân hàng thu thêm
  const handleOpenBankSim = () => {
    if (extraPayment) {
      setSimPaidAmount(extraPayment.amount.toString());
      setSimTxnId(`EXTRA_TXN_${Date.now().toString().slice(-6)}`);
      setShowBankModal(true);
    }
  };

  // 2. Chuyển khoản bổ sung (M_ReceiveExtra)
  const handleProcessExtraPayment = async () => {
    if (!currentActor || !extraPayment) return;
    const paidNum = Number(simPaidAmount);
    if (isNaN(paidNum) || paidNum <= 0) {
      toast.error('Vui lòng nhập số tiền hợp lệ');
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

      // Kiểm tra trạng thái kế tiếp từ state
      const nextState = await db.process_state.get(requestId);
      if (nextState?.waiting_node_ids.includes('M_ManualExtra')) {
        toast.warning(
          'Số tiền chuyển chưa đủ hoặc không khớp. Yêu cầu đã được chuyển tới nhân viên để hỗ trợ xử lý.'
        );
      } else {
        toast.success('Thanh toán khoản thu thêm thành công! Quyết toán hoàn tất.');
        setTimeout(() => {
          navigate('/kh/06');
        }, 1000);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi xử lý giao dịch thanh toán bổ sung');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Giả lập quá hạn thu thêm 30 phút (M_BoundExtra)
  const handleSimulateExtraTimeout = async () => {
    try {
      setIsSubmitting(true);
      await engine.triggerTimer(requestId, 'M_BoundExtra');
      toast.warning('Đã kích hoạt sự kiện quá hạn 30 phút. Khoản thu thêm chuyển sang NV-08 để liên hệ khách.');
      setTimeout(() => {
        navigate('/kh/06');
      }, 800);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi kích hoạt quá hạn');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 text-center">
        <Card className="p-8">
          <p className="text-slate-600 mb-4">Không tìm thấy mã hồ sơ để quyết toán thanh toán.</p>
          <Button onClick={() => navigate('/kh/06')}>Về danh sách yêu cầu của tôi</Button>
        </Card>
      </div>
    );
  }

  const isRefundKind = settlement?.kind === 'HOAN_DU' || (settlement?.balance || 0) > 0;
  const isExtraKind = settlement?.kind === 'THU_THEM' || (settlement?.balance || 0) < 0;
  const isBalanceKind = settlement?.kind === 'CAN_BANG' || (settlement?.balance === 0);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình KH-10
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{requestId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Quyết Toán: {isRefundKind ? 'Nhận Hoàn Cọc' : isExtraKind ? 'Thanh Toán Thu Thêm' : 'Cân Bằng Tiền Cọc'}
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Quy trình BPMN: <code className="font-mono text-brand-700 font-semibold">M_NetDeposit</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_GBalance</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">
              {isRefundKind ? 'M_Refund / M_ConfirmRefund' : isExtraKind ? 'M_PayExtra / M_ReceiveExtra' : 'M_Settle'}
            </code>
          </p>
        </div>

        <div>
          {isRefundKind ? (
            <Badge variant="success">Hoàn tiền cọc dư</Badge>
          ) : isExtraKind ? (
            <Badge variant="waiting">Thu thêm chi phí</Badge>
          ) : (
            <Badge variant="neutral">Cân bằng cọc</Badge>
          )}
        </div>
      </div>

      {/* Thông tin phương tiện */}
      <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Xe thuê</div>
            <div className="font-bold text-slate-900 text-sm">
              {vehicle?.model} ({vehicle?.plate})
            </div>
          </div>
        </div>

        <div className="text-right text-xs">
          <div className="text-slate-500">Tiền cọc ban đầu</div>
          <div className="font-bold text-slate-900 text-sm">
            {formatCurrency(settlement?.deposit_paid || rentalReq?.deposit_amount || 0)}
          </div>
        </div>
      </Card>

      {/* ============================================================== */}
      {/* 1. TRƯỜNG HỢP HOÀN TIỀN CỌC DƯ (M_Refund -> M_ConfirmRefund)    */}
      {/* ============================================================== */}
      {isRefundKind && (
        <Card className="p-6 border-brand-200 bg-white space-y-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-700 shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Bạn nhận hoàn trả số tiền cọc dư
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                Sau khi đối trừ các khoản chi phí (nếu có), hệ thống hoàn lại số tiền cọc dư cho bạn qua hình thức chuyển khoản trực tiếp vào tài khoản ngân hàng.
              </p>
            </div>
          </div>

          <div className="p-4 bg-brand-50/70 rounded-xl border border-brand-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
            <div>
              <span className="text-xs text-brand-900 font-medium">Số tiền cọc thực nhận hoàn trả:</span>
              <div className="text-3xl font-extrabold text-brand-700 mt-0.5">
                {formatCurrency(settlement?.balance || refundPayment?.amount || 0)}
              </div>
            </div>

            <div className="text-xs text-slate-600 text-right">
              <div>Mã tham chiếu: <span className="font-mono font-bold text-slate-900">{refundPayment?.qr_ref || 'REF_AUTO'}</span></div>
              <div>Trạng thái: <span className="font-semibold text-brand-700">Đã giải ngân từ Moto Care</span></div>
            </div>
          </div>

          {/* Hộp xác nhận nhận tiền */}
          {isWaitingRefundConfirm ? (
            <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-500">
                Vui lòng kiểm tra tài khoản ngân hàng và bấm xác nhận để hoàn tất hồ sơ.
              </div>

              <Button
                data-testid="node-M_ConfirmRefund"
                onClick={handleConfirmRefund}
                loading={isSubmitting}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" />
                <span>Xác nhận đã nhận hoàn cọc (M_ConfirmRefund)</span>
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded text-center text-xs text-slate-600">
              <CheckCircle className="w-5 h-5 text-brand-600 mx-auto mb-1" />
              <span>Giao dịch hoàn cọc đã được xác nhận hoàn tất thành công!</span>
            </div>
          )}
        </Card>
      )}

      {/* ============================================================== */}
      {/* 2. TRƯỜNG HỢP THU THÊM CHI PHÍ (M_PayExtra -> M_ReceiveExtra)    */}
      {/* ============================================================== */}
      {isExtraKind && (
        <Card className="p-6 border-amber-200 bg-white space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                Thanh toán khoản chi phí thu thêm
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Tổng chi phí thanh lý vượt quá số tiền cọc ban đầu. Vui lòng chuyển khoản số tiền chênh lệch để tất toán hồ sơ.
              </p>
            </div>

            {isWaitingExtraPayment && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-800 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                <span>Hết hạn trong: {formatTimeLeft(timeLeft)}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
            {/* Mã QR thanh toán */}
            <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="text-xs font-semibold text-slate-600">Quét mã VietQR chuyển khoản nhanh</div>
              {extraPayment && (
                <QRBox
                  qrRef={extraPayment.qr_ref}
                  amount={extraPayment.amount}
                />
              )}
              <div className="text-xs text-slate-500 font-mono">
                Cú pháp: <span className="font-bold text-slate-900">{extraPayment?.qr_ref}</span>
              </div>
            </div>

            {/* Chi tiết khoản thu thêm */}
            <div className="space-y-4">
              <div className="p-4 bg-amber-50/70 rounded-xl border border-amber-200">
                <div className="text-xs text-amber-900 font-medium">Số tiền cần thanh toán thêm:</div>
                <div className="text-3xl font-extrabold text-amber-600 mt-1">
                  {formatCurrency(Math.abs(settlement?.balance || extraPayment?.amount || 0))}
                </div>
                <div className="text-[11px] text-slate-500 mt-2">
                  Hạn thanh toán: {extraPayment?.expires_at ? formatDateTime(extraPayment.expires_at) : '30 phút'}
                </div>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <Building className="w-3.5 h-3.5 text-brand-600" />
                  <span>Thông tin tài khoản thụ hưởng:</span>
                </div>
                <div>Ngân hàng: <strong>Vietcombank (VCB)</strong></div>
                <div>Số tài khoản: <strong className="font-mono text-slate-900">0123456789</strong></div>
                <div>Chủ tài khoản: <strong>CÔNG TY TNHH MOTO CARE</strong></div>
              </div>

              {/* Nút hành động */}
              {isWaitingExtraPayment ? (
                <div className="space-y-2 pt-2">
                  <Button
                    data-testid="node-M_ReceiveExtra"
                    onClick={handleOpenBankSim}
                    loading={isSubmitting}
                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center justify-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Đã chuyển khoản (Mở khung giả lập ngân hàng)</span>
                  </Button>

                  <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1">
                    <span>Thử nghiệm quá hạn 30 phút:</span>
                    <button
                      type="button"
                      onClick={handleSimulateExtraTimeout}
                      className="text-amber-700 hover:underline font-semibold"
                    >
                      Giả lập hết hạn (M_BoundExtra)
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded text-center text-xs text-slate-600">
                  Khoản thu thêm đang chờ xử lý từ phía nhân viên hoặc đã thanh toán hoàn tất.
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ============================================================== */}
      {/* 3. TRƯỜNG HỢP CÂN BẰNG (M_GBalance -> Cân bằng)                  */}
      {/* ============================================================== */}
      {isBalanceKind && (
        <Card className="p-8 text-center space-y-4 border-slate-200 bg-white">
          <ShieldCheck className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-xl font-bold text-slate-900">
            Tiền cọc và Chi phí phát sinh cân bằng trọn vẹn!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Số tiền đặt cọc ban đầu ({formatCurrency(settlement?.deposit_paid || 0)}) đã được đối trừ hoàn toàn với chi phí thanh lý ({formatCurrency(settlement?.total_fee || 0)}). Không bên nào phát sinh nghĩa vụ thanh toán thêm.
          </p>
          <div className="pt-2">
            <Button onClick={() => navigate('/kh/06')} className="bg-brand-600 hover:bg-brand-700 text-white">
              Về trang chủ yêu cầu của tôi (KH-06)
            </Button>
          </div>
        </Card>
      )}

      {/* MODAL GIẢ LẬP NGÂN HÀNG CHUYỂN KHOẢN BỔ SUNG */}
      <Modal
        isOpen={showBankModal}
        onClose={() => setShowBankModal(false)}
        title="Giả lập cổng thanh toán ngân hàng (VietQR Extra)"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-800">Kiểm thử 3 trường hợp đối soát giao dịch:</div>
            <div>• <strong>ĐỦ:</strong> Nhập đúng số tiền {formatCurrency(extraPayment?.amount || 0)} &rarr; Tất toán thành công.</div>
            <div>• <strong>THIẾU:</strong> Nhập số tiền nhỏ hơn &rarr; Chuyển NV-08 xử lý khoản chưa thanh toán.</div>
            <div>• <strong>SAI:</strong> Nhập sai số tiền hoặc mã giao dịch &rarr; Chuyển NV-08 xử lý ngoại lệ.</div>
          </div>

          <Input
            label="Số tiền thực tế chuyển khoản (VNĐ)"
            type="number"
            value={simPaidAmount}
            onChange={(e) => setSimPaidAmount(e.target.value)}
          />

          <Input
            label="Mã giao dịch ngân hàng (Txn ID)"
            value={simTxnId}
            onChange={(e) => setSimTxnId(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowBankModal(false)}>
              Hủy
            </Button>
            <Button
              data-testid="node-M_ReceiveExtra"
              onClick={handleProcessExtraPayment}
              loading={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-1.5"
            >
              <span>Xác nhận giao dịch chuyển khoản</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default KH10Page;
