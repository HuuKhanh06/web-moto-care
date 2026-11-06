// src/features/customer/KH09Page.tsx
// Màn hình bảng kê thanh lý trả xe & Quyết toán

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Modal, Textarea, toast, StatusChip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { COPY } from '@/copy';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';

export function KH09Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

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
  const statement = useLiveQuery(
    () => (requestId ? db.statements.where('request_id').equals(requestId).reverse().first() : undefined),
    [requestId]
  );
  const depositPayment = useLiveQuery(
    () =>
      requestId
        ? db.payments
            .where('request_id')
            .equals(requestId)
            .and((p) => p.kind === 'DEPOSIT' && p.status === 'VERIFIED')
            .first()
        : undefined,
    [requestId]
  );

  const waitingNodes = processState?.waiting_node_ids || [];
  const isWaitingCustomerReview = waitingNodes.includes('M_ReceiveReview');
  const isWaitingManagerResolve = waitingNodes.includes('M_Resolve');

  // 1. Chấp thuận bảng kê
  const handleAcceptStatement = async () => {
    if (!currentActor) return;
    try {
      setIsSubmitting(true);
      await engine.complete(
        requestId,
        'M_ReceiveReview',
        { customer_answer: 'CHAP_THUAN' },
        currentActor
      );

      toast.success('Bạn đã xác nhận bảng kê. Đang chuyển sang quyết toán.');
      navigate(`/kh/10?requestId=${requestId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi chấp thuận bảng kê');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Khiếu nại bảng kê
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) {
      toast.warning('Vui lòng nhập lý do bạn cần điều chỉnh');
      return;
    }
    if (!currentActor) return;

    try {
      setIsSubmitting(true);
      await engine.complete(
        requestId,
        'M_ReceiveReview',
        {
          customer_answer: 'KHIEU_NAI',
          dispute_reason: disputeReason.trim(),
        },
        currentActor
      );

      setShowDisputeModal(false);
      toast.success('Ý kiến của bạn đã được chuyển tới Quản lý để xem xét.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi gửi khiếu nại');
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

  const depositAmount = depositPayment?.paid_amount || depositPayment?.amount || rentalReq?.deposit_amount || 0;
  const totalFee = statement?.total_fee || 0;
  const balance = depositAmount - totalFee;

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.RETURN}
        </h1>
        <StatusChip
          status={isWaitingCustomerReview ? 'pending' : isWaitingManagerResolve ? 'pending' : 'success'}
          label={isWaitingCustomerReview ? 'Chờ bạn xác nhận' : isWaitingManagerResolve ? 'Đang xem xét' : 'Đã xác nhận'}
        />
      </div>

      {/* Thông báo nếu quản lý đang xem xét khiếu nại */}
      {isWaitingManagerResolve && (
        <Card className="p-4 md:p-6 border border-amber-200 bg-amber-50 text-amber-900 space-y-2 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base">
            <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Quản lý đang xem xét ý kiến của bạn</span>
          </div>
          <p className="text-sm text-amber-800">
            MotoCare sẽ kiểm tra lại dữ liệu và gửi lại bảng kê cập nhật cho bạn trong thời gian sớm nhất.
          </p>
        </Card>
      )}

      {/* Thông tin phương tiện */}
      {vehicle && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-1">
          <span className="text-[13px] text-slate-500 block">Phương tiện bàn giao:</span>
          <p className="text-base font-semibold text-slate-900">
            {vehicle.model} ({vehicle.plate})
          </p>
        </Card>
      )}

      {/* CHI TIẾT BẢNG KÊ THANH LÝ */}
      <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Chi tiết các khoản phí
          </h2>
          {statement && (
            <span className="text-[13px] text-slate-500">
              Phiên bản {statement.version || 1}
            </span>
          )}
        </div>

        <div className="divide-y divide-slate-100 text-sm">
          {statement?.items && statement.items.length > 0 ? (
            statement.items.map((item, idx) => (
              <div key={idx} className="py-2.5 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800 block">{item.name}</span>
                  {item.note && <span className="text-[13px] text-slate-500">{item.note}</span>}
                </div>
                <span className="font-semibold text-slate-900">
                  {formatCurrency(item.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="py-3 text-slate-500 text-center">
              Đang tính toán chi phí...
            </div>
          )}
        </div>

        {/* Tổng kết tiền */}
        <div className="pt-3 border-t border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Tổng chi phí thuê & phát sinh:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(totalFee)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Tiền cọc bạn đã nộp:</span>
            <span className="font-semibold text-teal-800">{formatCurrency(depositAmount)}</span>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-base">
            <span className="font-semibold text-slate-900">
              {balance >= 0 ? 'Số tiền hoàn lại cho bạn:' : 'Số tiền cần thanh toán thêm:'}
            </span>
            <span className={`font-semibold text-lg ${balance >= 0 ? 'text-teal-800' : 'text-amber-800'}`}>
              {formatCurrency(Math.abs(balance))}
            </span>
          </div>
        </div>
      </Card>

      {/* HÀNH ĐỘNG KHÁCH XÁC NHẬN */}
      {isWaitingCustomerReview && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Bạn có đồng ý với bảng kê trên không?
            </h2>
            <p className="text-sm text-slate-500">
              Nếu đồng ý, hệ thống sẽ tự động hoàn tiền cọc thừa hoặc hướng dẫn thanh toán thêm.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setShowDisputeModal(true)}
              disabled={isSubmitting}
            >
              <AlertTriangle className="w-4 h-4 mr-1.5 text-amber-600" />
              <span>Khiếu nại</span>
            </Button>

            <Button
              data-testid="node-M_ReceiveReview"
              variant="primary"
              onClick={handleAcceptStatement}
              loading={isSubmitting}
            >
              <CheckCircle2 className="w-4 h-4 mr-1.5" />
              <span>Xác nhận bảng kê</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Nút quay về nếu đã xác nhận */}
      {!isWaitingCustomerReview && !isWaitingManagerResolve && (
        <div className="text-center pt-2">
          <Button variant="outline" onClick={() => navigate('/kh/06')}>
            Chuyến đi của tôi
          </Button>
        </div>
      )}

      {/* MODAL KHIẾU NẠI */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Gửi ý kiến khiếu nại"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Vui lòng nêu rõ nội dung bạn cần làm rõ (ví dụ: vết xước đã có từ trước khi nhận xe, mức xăng...).
            Quản lý sẽ xem xét lại ảnh bàn giao ban đầu và điều chỉnh.
          </p>

          <Textarea
            label="Lý do khiếu nại"
            rows={4}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Nhập chi tiết nội dung khiếu nại..."
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <Button variant="outline" onClick={() => setShowDisputeModal(false)}>
              Hủy
            </Button>
            <Button
              data-testid="node-M_ReceiveReview"
              variant="primary"
              onClick={handleSubmitDispute}
              loading={isSubmitting}
            >
              Gửi khiếu nại
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default KH09Page;
