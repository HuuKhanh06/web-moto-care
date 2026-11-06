// src/features/manager/QL01Page.tsx
// Màn hình QL-01: Xử lý bất đồng bảng kê (M_Resolve)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, Textarea, toast } from '@/components/ui';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/format';
import {
  Gavel,
  AlertTriangle,
  Car,
  User,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';

interface EditableItem {
  name: string;
  amount: number;
}

export function QL01Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [effectiveRequestId, setEffectiveRequestId] = useState<string>(requestId);
  const activeId = requestId || effectiveRequestId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [items, setItems] = useState<EditableItem[]>([]);

  useEffect(() => {
    async function loadPending() {
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_KHACH_XAC_NHAN_BANG_KE')
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

  // Live queries
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
  const statement = useLiveQuery(
    () => (activeId ? db.statements.where('request_id').equals(activeId).reverse().first() : undefined),
    [activeId]
  );
  const damages = useLiveQuery(
    () => (activeId ? db.damage_findings.where('request_id').equals(activeId).toArray() : []),
    [activeId]
  );

  useEffect(() => {
    if (statement?.items && items.length === 0) {
      setItems(statement.items.map((it) => ({ name: it.name, amount: it.amount })));
      if (statement.resolution_note) {
        setResolutionNote(statement.resolution_note);
      }
    }
  }, [statement, items.length]);

  const updateItemAmount = (index: number, newAmount: number) => {
    setItems((prev) =>
      prev.map((it, idx) => (idx === index ? { ...it, amount: Math.max(0, newAmount) } : it))
    );
  };

  const calculatedTotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const isWaitingResolve = processState?.waiting_node_ids?.includes('M_Resolve');
  const disputeCount = processState?.loop_counters?.dispute_count || 0;

  // Xử lý hoàn tất M_Resolve
  const handleApproveAdjustment = async () => {
    if (!currentActor) return;
    if (!resolutionNote.trim()) {
      toast.error('Vui lòng nhập kết luận / ghi chú giải quyết của Quản lý');
      return;
    }

    try {
      setIsSubmitting(true);
      await engine.complete(
        activeId,
        'M_Resolve',
        {
          resolution_note: resolutionNote.trim(),
          items: items,
          total_fee: calculatedTotal,
        },
        currentActor
      );

      toast.success('Đã duyệt phương án điều chỉnh và gửi lại bảng kê mới tới khách hàng!');
      setTimeout(() => {
        navigate('/nv/01');
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xử lý khiếu nại');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeId) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 text-center">
        <Card className="py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Gavel className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có khiếu nại bảng kê nào cần giải quyết</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại khách hàng đã xác nhận đồng thuận toàn bộ bảng kê thanh lý hoặc không có tranh chấp phát sinh.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Thanh chọn nhanh hồ sơ đang có bất đồng / khiếu nại */}
      <PendingRequestBar
        label="Hồ sơ khiếu nại cần xử lý"
        currentRequestId={activeId}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Tiêu đề & Thông tin chung */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình QL-01
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{activeId.slice(0, 8)}</span>
            {statement && (
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Bảng kê v{statement.version}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Xử Lý Bất Đồng Bảng Kê Thanh Lý
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Xem xét phản hồi của khách hàng và ban hành bảng kê quyết toán điều chỉnh
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="waiting" className="flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Khiếu nại lần {disputeCount + 1}</span>
          </Badge>
        </div>
      </div>

      {/* Thông tin phương tiện và khách hàng */}
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
              Trả xe lúc: {rentalReq?.returned_at ? formatDateTime(rentalReq.returned_at) : '—'}
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Khách hàng khiếu nại</div>
            <div className="font-bold text-slate-900 text-sm">
              {customer?.full_name} ({customer?.phone})
            </div>
            <div className="text-slate-500">
              Tiền cọc đã nộp: {formatCurrency(rentalReq?.deposit_amount || 0)}
            </div>
          </div>
        </Card>
      </div>

      {/* NỘI DUNG KHIẾU NẠI CỦA KHÁCH HÀNG */}
      <Card className="p-4 border-amber-300 bg-amber-50/60 space-y-2">
        <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>Ý kiến phản hồi / Lý do khiếu nại từ khách hàng:</span>
        </div>
        <div className="text-xs text-amber-950 bg-white p-3 rounded border border-amber-200 font-medium">
          {statement?.dispute_reason || 'Khách hàng không đồng ý với một số khoản phí trong bảng kê.'}
        </div>
      </Card>

      {/* BẰNG CHỨNG HƯ HẠI DO NHÂN VIÊN GHI NHẬN */}
      {damages && damages.length > 0 && (
        <Card className="p-4 border-slate-200 space-y-3">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Các khoản hư hại đã được nhân viên ghi nhận tại biên bản kiểm tra:
          </div>
          <div className="space-y-2">
            {damages.map((d) => (
              <div key={d.id} className="p-2.5 bg-slate-50 rounded border border-slate-200 text-xs flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-900">{d.description}</div>
                  <div className="text-slate-500">Chi phí đề xuất: {formatCurrency(d.estimated_cost)}</div>
                </div>
                {d.evidence_urls && d.evidence_urls.length > 0 && (
                  <div className="flex gap-1.5">
                    {d.evidence_urls.map((url, i) => (
                      <img
                        key={i}
                        src={url}
                        alt="Bằng chứng"
                        className="w-10 h-10 object-cover rounded border border-slate-300"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ĐIỀU CHỈNH CÁC MỤC CHI PHÍ BẢNG KÊ */}
      {isWaitingResolve ? (
        <Card className="p-5 border-brand-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Gavel className="w-5 h-5 text-brand-600" />
              <span>Phương án điều chỉnh chi phí của Quản lý</span>
            </h3>
            <span className="text-xs text-slate-500">Có thể điều chỉnh số tiền trực tiếp</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 text-xs uppercase font-semibold">
                  <th className="p-2.5 rounded-l">STT</th>
                  <th className="p-2.5">Hạng mục chi phí</th>
                  <th className="p-2.5 text-right w-44 rounded-r">Số tiền điều chỉnh (VNĐ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="p-2.5 text-xs text-slate-500 w-12">{idx + 1}</td>
                    <td className="p-2.5 font-medium text-slate-900">{it.name}</td>
                    <td className="p-2.5 text-right">
                      <input
                        type="number"
                        min={0}
                        step={10000}
                        value={it.amount}
                        onChange={(e) => updateItemAmount(idx, Number(e.target.value))}
                        className="w-full text-right text-xs font-bold text-slate-900 p-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex justify-between items-center text-sm font-bold border-t border-slate-200">
            <span className="text-slate-700">Tổng phí sau khi Quản lý điều chỉnh:</span>
            <span className="text-lg text-brand-700">{formatCurrency(calculatedTotal)}</span>
          </div>

          {/* Ô nhập giải trình / kết luận */}
          <div className="pt-3 border-t border-slate-100 space-y-2">
            <Textarea
              label="Kết luận & Phương án giải quyết (bắt buộc, khách sẽ thấy nội dung này)"
              rows={3}
              value={resolutionNote}
              onChange={(e) => setResolutionNote(e.target.value)}
              placeholder="Ví dụ: Đã kiểm tra lại ảnh bàn giao ban đầu, đồng ý giảm 50% phí sửa chữa cánh yếm..."
            />
          </div>

          {/* Nút Submit */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Quay lại Hộp việc
            </Button>
            <Button
              data-testid="node-M_Resolve"
              onClick={handleApproveAdjustment}
              loading={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-1.5"
            >
              <span>Duyệt phương án &amp; Gửi lại bảng kê</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">
            Hồ sơ không ở trạng thái chờ giải quyết khiếu nại!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hiện hồ sơ đang ở trạng thái <strong>{rentalReq ? getStatusLabel(rentalReq.status) : ''}</strong>. Có thể khách hàng đã chấp thuận bảng kê hoặc quản lý đã giải quyết xong.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Về Hộp việc cần làm
            </Button>
            <Button onClick={() => navigate(`/kh/09?requestId=${requestId}`)}>
              Xem bảng kê chi tiết
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default QL01Page;

