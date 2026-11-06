// src/features/staff/NV08Page.tsx
// Màn hình NV-08: Xử lý khoản chưa thanh toán (M_ManualExtra, M_GExtraDecision)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, Textarea, toast } from '@/components/ui';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/format';
import {
  PhoneCall,
  AlertTriangle,
  Car,
  User,
  CheckCircle,
  ArrowRight,
  RotateCcw,
  FileText,
  DollarSign,
} from 'lucide-react';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';

export function NV08Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [effectiveRequestId, setEffectiveRequestId] = useState<string>(requestId);
  const activeId = requestId || effectiveRequestId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [decision, setDecision] = useState<'Tiếp tục thanh toán' | 'Không / chưa thanh toán'>(
    'Tiếp tục thanh toán'
  );

  useEffect(() => {
    async function loadPending() {
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_THU_THEM' || r.status === 'CONG_NO')
        .toArray();
      const pList: PendingRequestSummary[] = [];
      for (const cand of candidates) {
        let vName = 'Xe máy';
        if (cand.vehicle_id) {
          const veh = await db.vehicles.get(cand.vehicle_id);
          if (veh) vName = `${veh.model} (${veh.plate})`;
        }
        const cust = await db.profiles.get(cand.customer_id);
        pList.push({
          id: cand.id,
          customerName: cust?.full_name,
          vehicleModel: vName,
          status: cand.status,
        });
      }
      setPendingList(pList);
      if (!requestId && pList.length > 0) {
        setEffectiveRequestId(pList[0].id);
      }
    }
    loadPending();
  }, [requestId]);

  // Live query dữ liệu
  const rentalReq = useLiveQuery(
    () => (activeId ? db.rental_requests.get(activeId) : undefined),
    [activeId]
  );
  const processState = useLiveQuery(
    () => (activeId ? db.process_state.get(activeId) : undefined),
    [activeId]
  );
  const vehicle = useLiveQuery(
    () => (rentalReq?.vehicle_id ? db.vehicles.get(rentalReq.vehicle_id) : undefined),
    [rentalReq?.vehicle_id]
  );
  const customer = useLiveQuery(
    () => (rentalReq?.customer_id ? db.profiles.get(rentalReq.customer_id) : undefined),
    [rentalReq?.customer_id]
  );
  const settlement = useLiveQuery(
    () => (activeId ? db.settlements.where('request_id').equals(activeId).reverse().first() : undefined),
    [activeId]
  );
  const extraPayment = useLiveQuery(
    () =>
      activeId
        ? db.payments
            .where('request_id')
            .equals(activeId)
            .and((p) => p.kind === 'EXTRA')
            .reverse()
            .first()
        : undefined,
    [activeId]
  );

  const isWaitingManualExtra = processState?.waiting_node_ids?.includes('M_ManualExtra');

  const handleSubmitDecision = async () => {
    if (!currentActor || !activeId) return;
    if (!note.trim()) {
      toast.error('Vui lòng nhập ghi chú kết quả liên hệ khách hàng');
      return;
    }

    try {
      setIsSubmitting(true);
      await engine.complete(
        activeId,
        'M_ManualExtra',
        {
          decision,
          note: note.trim(),
        },
        currentActor
      );

      if (decision === 'Tiếp tục thanh toán') {
        toast.success(
          'Đã áp dụng quy tắc thanh toán lại: Tạo mã VietQR thu thêm mới với thời hạn 30 phút cho khách.'
        );
      } else {
        toast.warning(
          'Đã ghi nhận công nợ. Hồ sơ kết thúc tại trạng thái Công nợ chưa tất toán.'
        );
      }

      setTimeout(() => {
        navigate('/nv/01');
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xử lý quyết định thu thêm');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeId) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 text-center">
        <Card className="py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <DollarSign className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có khoản thu thêm nào cần xử lý</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại các khoản cọc và quyết toán đã được cân bằng hoặc không có đơn nợ quá hạn.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành (NV-01)</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Thanh chọn nhanh hồ sơ chờ thu thêm */}
      <PendingRequestBar
        label="Hồ sơ cần thu thêm"
        currentRequestId={activeId}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình NV-08
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{activeId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Xử Lý Khoản Chưa Thanh Toán / Quá Hạn Thu Thêm
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Xử lý thu hồi chi phí phát sinh hoặc chuyển sang theo dõi công nợ khách hàng
          </p>
        </div>

        <Badge variant="waiting" className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Chờ xử lý ngoại lệ thu thêm</span>
        </Badge>
      </div>

      {/* Thông tin khách hàng & xe */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Xe thuê</div>
            <div className="font-bold text-slate-900 text-sm">
              {vehicle?.model} ({vehicle?.plate})
            </div>
            <div className="text-slate-500">
              Tổng chi phí phát sinh: {formatCurrency(settlement?.total_fee || 0)}
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Khách hàng cần liên hệ</div>
            <div className="font-bold text-slate-900 text-sm">
              {customer?.full_name} ({customer?.phone})
            </div>
            <div className="text-slate-500">
              Số tiền phải thu thêm: <strong className="text-amber-700">{formatCurrency(Math.abs(settlement?.balance || extraPayment?.amount || 0))}</strong>
            </div>
          </div>
        </Card>
      </div>

      {/* LÝ DO VÀ TRẠNG THÁI KHOẢN THU THÊM */}
      <Card className="p-4 border-amber-300 bg-amber-50/60 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <PhoneCall className="w-4 h-4 text-amber-700" />
          <span>Tình trạng giao dịch thu thêm hiện tại:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="p-2 bg-white rounded border border-amber-200">
            <div className="text-slate-500">Trạng thái khoản thu:</div>
            <div className="font-bold text-slate-900">
              {extraPayment?.status === 'EXPIRED' ? 'Đã quá hạn 30 phút' : extraPayment?.status || 'Chưa thanh toán'}
            </div>
          </div>
          <div className="p-2 bg-white rounded border border-amber-200">
            <div className="text-slate-500">Số tiền khách đã chuyển:</div>
            <div className="font-bold text-slate-900">
              {formatCurrency(extraPayment?.paid_amount || 0)} / {formatCurrency(extraPayment?.amount || 0)}
            </div>
          </div>
          <div className="p-2 bg-white rounded border border-amber-200">
            <div className="text-slate-500">Kết quả đối soát:</div>
            <div className="font-bold text-slate-900">
              {extraPayment?.match_result === 'THIEU'
                ? 'Thiếu tiền'
                : extraPayment?.match_result === 'SAI'
                ? 'Sai nội dung / mã GD'
                : 'Chưa có giao dịch'}
            </div>
          </div>
        </div>
        {extraPayment?.expires_at && (
          <div className="text-[11px] text-slate-600 pl-1">
            Hạn chuyển ban đầu: {formatDateTime(extraPayment.expires_at)}
          </div>
        )}
      </Card>

      {/* KHU VỰC QUYẾT ĐỊNH CỦA NHÂN VIÊN */}
      {isWaitingManualExtra ? (
        <Card className="p-5 border-brand-200 space-y-5 bg-white">
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600" />
            <span>Phương án xử lý từ Nhân viên vận hành</span>
          </h3>

          {/* Chọn quyết định */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setDecision('Tiếp tục thanh toán')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                decision === 'Tiếp tục thanh toán'
                  ? 'border-brand-500 bg-brand-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-brand-600" />
                <span className="font-bold text-slate-900 text-sm">Tiếp tục thanh toán</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Khách đã được liên hệ và đồng ý chuyển khoản lại. Hệ thống sẽ hết hạn khoản cũ, tạo mã VietQR mới và mở thêm 30 phút đếm ngược.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setDecision('Không / chưa thanh toán')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                decision === 'Không / chưa thanh toán'
                  ? 'border-amber-500 bg-amber-50/50 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900 text-sm">Ghi nhận công nợ (Không thu được)</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Khách từ chối thanh toán hoặc không liên lạc được. Hệ thống sẽ ghi nhận hồ sơ nợ chưa tất toán để tiếp tục theo dõi.
              </p>
            </button>
          </div>

          {/* Ô nhập ghi chú */}
          <div className="space-y-1.5">
            <Textarea
              label="Ghi chú chi tiết quá trình liên hệ khách hàng (bắt buộc)"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Đã gọi điện cho khách lúc 14:30, khách báo vừa nạp tiền vào tài khoản và xin chuyển lại qua mã QR mới..."
            />
          </div>

          {/* Nút Submit */}
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Quay lại Hộp việc
            </Button>
            <Button
              data-testid="node-M_ManualExtra"
              onClick={handleSubmitDecision}
              loading={isSubmitting}
              className={`font-semibold flex items-center gap-1.5 text-white ${
                decision === 'Tiếp tục thanh toán'
                  ? 'bg-brand-600 hover:bg-brand-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <span>Xác nhận phương án xử lý</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">
            Hồ sơ hiện không ở bước xử lý khoản chưa thanh toán!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hồ sơ hiện ở trạng thái <strong>{rentalReq ? getStatusLabel(rentalReq.status) : ''}</strong>. Có thể khách hàng đang thực hiện thanh toán lại hoặc đã tất toán xong.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Về danh sách việc cần làm (NV-01)
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default NV08Page;

