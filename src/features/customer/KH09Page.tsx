// src/features/customer/KH09Page.tsx
// Màn hình KH-09: Bảng kê trả xe & Xác nhận (M_SendStatement, M_ReceiveReview)

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, Modal, Textarea, toast } from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Car,
  Clock,
  ShieldCheck,
  MessageSquare,
  ArrowRight,
  Info,
} from 'lucide-react';

export function KH09Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');

  // Live query dữ liệu hồ sơ
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
  const damages = useLiveQuery(
    () => (requestId ? db.damage_findings.where('request_id').equals(requestId).toArray() : []),
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
  const disputeCount = processState?.loop_counters?.dispute_count || 0;

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

      toast.success('Bạn đã chấp thuận bảng kê. Đang chuyển sang bước thanh toán/hoàn cọc.');
      setTimeout(() => {
        navigate(`/kh/10?requestId=${requestId}`);
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi chấp thuận bảng kê');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Khiếu nại bảng kê
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim()) {
      toast.error('Vui lòng nhập lý do bạn chưa đồng ý với bảng kê');
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
      toast.success('Ý kiến khiếu nại của bạn đã được chuyển tới Quản lý để xem xét.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi gửi khiếu nại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <div className="max-w-3xl mx-auto p-4 sm:p-6 text-center">
        <Card className="p-8">
          <p className="text-slate-600 mb-4">Không tìm thấy mã hồ sơ để xem bảng kê.</p>
          <Button onClick={() => navigate('/kh/06')}>Về danh sách yêu cầu của tôi</Button>
        </Card>
      </div>
    );
  }

  const depositAmount = depositPayment?.paid_amount || depositPayment?.amount || rentalReq?.deposit_amount || 0;
  const totalFee = statement?.total_fee || 0;
  const estimatedBalance = depositAmount - totalFee;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Tiêu đề & Thông tin phiên bản */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình KH-09
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{requestId.slice(0, 8)}</span>
            {statement && (
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Phiên bản v{statement.version}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Bảng Kê Chi Tiết Trả Xe &amp; Quyết Toán
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Quy trình BPMN: <code className="font-mono text-brand-700 font-semibold">M_SendStatement</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_ReceiveReview</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_GDispute</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {disputeCount > 0 && (
            <Badge variant="waiting" className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Đã khiếu nại {disputeCount} lần</span>
            </Badge>
          )}
        </div>
      </div>

      {/* Thông báo nếu quản lý vừa điều chỉnh */}
      {statement?.resolution_note && (
        <Card className="p-4 bg-sky-50 border-sky-200 space-y-1">
          <div className="flex items-center gap-2 text-sky-800 font-bold text-sm">
            <Info className="w-4 h-4" />
            <span>Phản hồi &amp; Phương án điều chỉnh từ Quản lý (v{statement.version}):</span>
          </div>
          <p className="text-xs text-sky-900 pl-6">{statement.resolution_note}</p>
        </Card>
      )}

      {/* Thông báo nếu đang chờ Quản lý duyệt */}
      {isWaitingManagerResolve && (
        <Card className="p-4 bg-amber-50 border-amber-200 space-y-1">
          <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
            <Clock className="w-4 h-4" />
            <span>Đang chờ Quản lý xem xét ý kiến khiếu nại của bạn:</span>
          </div>
          <p className="text-xs text-amber-900 pl-6">
            Lý do bạn gửi: "{statement?.dispute_reason || 'Đang chờ xem xét'}"
          </p>
        </Card>
      )}

      {/* Tóm tắt phương tiện */}
      <Card className="p-4 bg-slate-50 border-slate-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <Car className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-500 font-medium">Xe đã thuê</div>
            <div className="text-base font-bold text-slate-900">
              {vehicle?.model} ({vehicle?.plate})
            </div>
            <div className="text-xs text-slate-600">
              Thời gian thuê: {rentalReq?.start_at ? formatDateTime(rentalReq.start_at) : '—'} &rarr;{' '}
              {rentalReq?.returned_at
                ? formatDateTime(rentalReq.returned_at)
                : rentalReq?.end_at
                ? formatDateTime(rentalReq.end_at)
                : '—'}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-500">Tiền cọc ban đầu</div>
          <div className="text-sm font-bold text-slate-900">{formatCurrency(depositAmount)}</div>
        </div>
      </Card>

      {/* BẢNG KÊ CHI TIẾT CÁC KHOẢN PHÁT SINH */}
      <Card className="p-5 border-slate-200 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">Chi tiết các khoản phí thanh lý</h3>
          </div>
          <span className="text-xs text-slate-500">Đơn vị: VNĐ</span>
        </div>

        {statement && statement.items && statement.items.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold">
                  <th className="p-2.5 rounded-l">STT</th>
                  <th className="p-2.5">Hạng mục chi phí</th>
                  <th className="p-2.5 text-right rounded-r">Số tiền</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-xs text-slate-500 w-12">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{item.name}</td>
                    <td className="p-2.5 text-right font-bold text-slate-900">
                      {formatCurrency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-sm bg-slate-50 rounded-lg">
            <CheckCircle className="w-8 h-8 text-brand-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Không phát sinh chi phí phụ trội!</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Xe được trả đúng hạn và hoàn toàn nguyên vẹn như lúc nhận ban đầu.
            </p>
          </div>
        )}

        {/* Bằng chứng hư hại nếu có */}
        {damages && damages.length > 0 && (
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <div className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-slate-500" />
              <span>Biên bản &amp; Ảnh chụp đối chiếu hư hỏng:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {damages.map((d) => (
                <div key={d.id} className="p-2 bg-slate-50 rounded border border-slate-200 text-xs space-y-1">
                  <div className="font-bold text-slate-900">{d.description}</div>
                  <div className="text-slate-600">Ước tính: {formatCurrency(d.estimated_cost)}</div>
                  {d.evidence_urls && d.evidence_urls.length > 0 && (
                    <div className="flex gap-1.5 pt-1">
                      {d.evidence_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Bằng chứng"
                          className="w-12 h-12 object-cover rounded border border-slate-200"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TỔNG KẾT ĐỐI TRỪ CỌC (M_NetDeposit) */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tiền đặt cọc đã nộp:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(depositAmount)}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-600">
            <span>Tổng chi phí phát sinh:</span>
            <span className="font-semibold text-red-600">- {formatCurrency(totalFee)}</span>
          </div>
          <div className="pt-2 border-t border-dashed border-slate-200 flex justify-between items-baseline">
            <div>
              <span className="text-base font-bold text-slate-900">Dự kiến quyết toán: </span>
              {estimatedBalance > 0 ? (
                <span className="text-xs font-semibold text-brand-700 bg-brand-50 px-2 py-0.5 rounded ml-2">
                  Hoàn trả tiền cọc dư cho bạn
                </span>
              ) : estimatedBalance < 0 ? (
                <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded ml-2">
                  Thu thêm khoản phí chênh lệch
                </span>
              ) : (
                <span className="text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded ml-2">
                  Cân bằng (Tiền cọc cấn trừ trọn vẹn)
                </span>
              )}
            </div>
            <div
              className={`text-xl font-bold ${
                estimatedBalance >= 0 ? 'text-brand-600' : 'text-amber-600'
              }`}
            >
              {estimatedBalance >= 0
                ? formatCurrency(estimatedBalance)
                : formatCurrency(Math.abs(estimatedBalance))}
            </div>
          </div>
        </div>
      </Card>

      {/* KHU VỰC HÀNH ĐỘNG CỦA KHÁCH HÀNG (M_ReceiveReview) */}
      {isWaitingCustomerReview && (
        <Card className="p-5 border-brand-200 bg-brand-50/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-slate-900">Bạn có đồng ý với bảng kê thanh lý này không?</div>
            <p className="text-xs text-slate-600 mt-0.5">
              Nếu đồng ý, hệ thống sẽ tự động thực hiện hoàn tiền cọc dư hoặc hướng dẫn thanh toán thêm.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => setShowDisputeModal(true)}
              disabled={isSubmitting}
              className="flex-1 sm:flex-none border-amber-300 text-amber-800 hover:bg-amber-50"
            >
              <AlertCircle className="w-4 h-4 mr-1.5" />
              <span>Khiếu nại</span>
            </Button>

            <Button
              data-testid="node-M_ReceiveReview"
              onClick={handleAcceptStatement}
              loading={isSubmitting}
              className="flex-1 sm:flex-none bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-1.5"
            >
              <span>Chấp thuận bảng kê</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Trường hợp hồ sơ đã qua bước review */}
      {!isWaitingCustomerReview && !isWaitingManagerResolve && (
        <div className="text-center pt-2">
          <Button variant="outline" onClick={() => navigate('/kh/06')}>
            Quay về danh sách yêu cầu của tôi (KH-06)
          </Button>
        </div>
      )}

      {/* MODAL KHIẾU NẠI BẢNG KÊ */}
      <Modal
        isOpen={showDisputeModal}
        onClose={() => setShowDisputeModal(false)}
        title="Gửi ý kiến khiếu nại bảng kê thanh lý"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Vui lòng nêu rõ lý do bạn chưa đồng ý với bảng kê (ví dụ: vết trầy đã có từ trước khi nhận xe, thời gian trễ do sự cố thời tiết,...).
            Quản lý sẽ trực tiếp kiểm tra lại biên bản bàn giao ban đầu và điều chỉnh phù hợp.
          </p>

          <Textarea
            label="Lý do khiếu nại / Đề xuất điều chỉnh"
            rows={4}
            value={disputeReason}
            onChange={(e) => setDisputeReason(e.target.value)}
            placeholder="Nhập nội dung khiếu nại cụ thể..."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowDisputeModal(false)}>
              Hủy
            </Button>
            <Button
              data-testid="node-M_ReceiveReview"
              onClick={handleSubmitDispute}
              loading={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Gửi khiếu nại tới Quản lý
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default KH09Page;

