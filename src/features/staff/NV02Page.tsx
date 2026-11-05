// src/features/staff/NV02Page.tsx
// Màn hình NV-02: Kiểm tra cọc ngoại lệ (M_ManualDeposit, M_G03b)
// Nhân viên xem chi tiết giao dịch chuyển khoản thiếu/sai, nhập ghi chú và bấm Xác nhận (Có) hoặc Chưa (Chưa)

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Payment, Profile, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Textarea,
  toast,
} from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  User,
  Bike,
  RotateCcw,
  Receipt,
  HelpCircle,
} from 'lucide-react';

export function NV02Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [manualNote, setManualNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Quét toàn bộ hồ sơ đang ở trạng thái CHO_COC
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_COC')
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

      const targetId = requestId || (pList.length > 0 ? pList[0].id : null);
      if (!targetId) {
        setRequest(null);
        setPayment(null);
        setCustomer(null);
        setVehicle(null);
        return;
      }

      const req = await db.rental_requests.get(targetId);
      if (!req) {
        toast.error('Không tìm thấy yêu cầu');
        setRequest(null);
        return;
      }
      setRequest(req);

      const [p, c, v] = await Promise.all([
        db.payments
          .where('request_id')
          .equals(targetId)
          .and((item) => item.kind === 'DEPOSIT')
          .last(),
        db.profiles.get(req.customer_id),
        req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
      ]);

      setPayment(p || null);
      setCustomer(c || null);
      setVehicle(v || null);

      if (p?.manual_note) {
        setManualNote(p.manual_note);
      }
    } catch (err) {
      console.error('Lỗi tải dữ liệu NV-02:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDecision = async (decision: 'Có' | 'Chưa') => {
    if (!request?.id || !currentActor) return;

    if (decision === 'Chưa' && !manualNote.trim()) {
      toast.warning('Vui lòng nhập lý do từ chối cọc ngoại lệ vào ô ghi chú');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'M_ManualDeposit',
        {
          decision,
          note: manualNote.trim() || (decision === 'Có' ? 'Nhân viên phê duyệt cọc hợp lệ' : 'Nhân viên từ chối cọc'),
        },
        currentActor
      );

      if (decision === 'Có') {
        toast.success('Đã xác nhận cọc ngoại lệ thành công! Hồ sơ chuyển sang bước Ký hợp đồng.');
      } else {
        toast.info('Đã từ chối cọc. Hệ thống áp dụng quy tắc tạo thanh toán mới cho khách hàng.');
      }

      navigate('/nv/01');
    } catch (err: unknown) {
      console.error('Lỗi phê duyệt NV-02:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi khi cập nhật quyết định cọc';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="text-center py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Receipt className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có giao dịch cọc nào cần phê duyệt</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại không có khoản tiền cọc nào bị lệch hoặc chờ nhân viên duyệt thủ công.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành (NV-01)</Button>
          </div>
        </Card>
      </div>
    );
  }

  const isDepositVerified = payment?.status === 'VERIFIED';
  const expectedAmount = request.deposit_amount || 0;
  const paidAmount = payment?.paid_amount ?? 0;
  const diffAmount = paidAmount - expectedAmount;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Thanh chọn nhanh hồ sơ đang chờ duyệt cọc */}
      <PendingRequestBar
        label="Hồ sơ chờ duyệt cọc"
        currentRequestId={request.id}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Header & Quay lại */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/nv/01')}
              className="flex items-center gap-1 text-slate-600"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Hộp việc</span>
            </Button>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              NV-02
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Kiểm tra cọc ngoại lệ (M_ManualDeposit)</h1>
          <p className="text-xs text-slate-500">
            Mã hồ sơ: <code className="font-mono font-bold text-slate-700">{requestId}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)} size="md">
            {getStatusLabel(request.status)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            loading={loading}
            className="flex items-center gap-1"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Tóm tắt thông tin hồ sơ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-4 border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <User className="w-4 h-4 text-brand-600" />
            <span>Thông tin khách hàng</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {customer?.full_name || 'Khách vãng lai'}
          </div>
          <div className="text-xs text-slate-500">
            SĐT: <strong className="text-slate-800">{customer?.phone || 'Chưa cập nhật'}</strong>
          </div>
        </Card>

        <Card className="p-4 border-slate-200 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <Bike className="w-4 h-4 text-brand-600" />
            <span>Phương tiện thuê</span>
          </div>
          <div className="text-sm font-bold text-slate-900">
            {vehicle ? `${vehicle.model} (${vehicle.plate})` : 'Xe đang phân bổ'}
          </div>
          <div className="text-xs text-slate-500">
            Thời gian: {formatDateTime(request.start_at)} &rarr; {formatDateTime(request.end_at)}
          </div>
        </Card>
      </div>

      {/* CHI TIẾT ĐỐI SOÁT KHOẢN CỌC NGOẠI LỆ */}
      <Card className="p-6 border-slate-200 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-600" />
            Chi tiết đối soát giao dịch ngân hàng
          </h2>

          <Badge
            variant={
              payment?.match_result === 'DU'
                ? 'success'
                : payment?.match_result === 'THIEU'
                ? 'waiting'
                : 'danger'
            }
          >
            {payment?.match_result === 'DU'
              ? 'Khớp ĐỦ'
              : payment?.match_result === 'THIEU'
              ? 'Chuyển THIẾU'
              : 'SAI nội dung'}
          </Badge>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Số tiền cọc cần thu (30%):</span>
            <span className="text-base font-bold text-slate-900">
              {formatCurrency(expectedAmount)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Số tiền thực nhận (Sao kê):</span>
            <span
              className={`text-base font-bold ${
                paidAmount < expectedAmount ? 'text-amber-700' : 'text-emerald-700'
              }`}
            >
              {formatCurrency(paidAmount)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block">Chênh lệch:</span>
            <span
              className={`text-base font-bold ${
                diffAmount < 0 ? 'text-red-600' : 'text-slate-700'
              }`}
            >
              {diffAmount < 0 ? `- ${formatCurrency(Math.abs(diffAmount))}` : '0 ₫'}
            </span>
          </div>
        </div>

        {/* So sánh cú pháp chuyển khoản */}
        <div className="space-y-2 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 font-medium">Mã QR tham chiếu chuẩn (qr_ref):</div>
            <code className="font-mono font-bold text-brand-800 text-sm">{payment?.qr_ref || 'N/A'}</code>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <div className="text-slate-500 font-medium">Nội dung chuyển khoản thực tế ghi nhận:</div>
            <div className="font-mono text-slate-800 bg-white p-2 rounded border border-slate-200">
              {payment?.provider_txn_id || payment?.manual_note || '(Không có nội dung)'}
            </div>
          </div>
        </div>

        {/* Nhập ghi chú xử lý của nhân viên */}
        <div className="pt-2">
          <Textarea
            label="Ghi chú xác minh của Nhân viên (Lưu vết kiểm toán)"
            placeholder="Ví dụ: Đã đối chiếu với kế toán, khách chuyển thiếu 20k nhưng cam kết đóng bù khi nhận xe..."
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            disabled={isDepositVerified}
            rows={3}
          />
        </div>

        {/* Nút hành động M_G03b */}
        {!isDepositVerified ? (
          <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-4 h-4 text-slate-400" />
              <span>Quyết định rẽ nhánh BPMN To-Be: <code className="font-mono text-brand-700">M_G03b</code></span>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="md"
                data-testid="node-M_G03b"
                loading={submitting}
                onClick={() => handleDecision('Chưa')}
                className="flex items-center gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
              >
                <XCircle className="w-4 h-4" />
                <span>Chưa xác nhận (Yêu cầu nộp lại)</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="md"
                data-testid="node-M_G03b"
                loading={submitting}
                onClick={() => handleDecision('Có')}
                className="flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Xác nhận cọc hợp lệ (Chuyển ký HĐ)</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Khoản cọc ngoại lệ này đã được phê duyệt hợp lệ.</span>
          </div>
        )}
      </Card>
    </div>
  );
}
