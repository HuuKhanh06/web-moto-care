// src/features/staff/NV09Page.tsx
// Màn hình NV-09: Đánh giá xe sau trả (M_CheckReady, M_GReady, M_Maintenance, M_MarkReady, M_Archive)

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, Textarea, toast } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import {
  Sparkles,
  Wrench,
  CheckCircle,
  Car,
  User,
  ArrowRight,
  Archive,
  ShieldCheck,
} from 'lucide-react';

export function NV09Page() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<'DAT' | 'CAN_BAO_TRI'>('DAT');
  const [note, setNote] = useState('');

  // Live queries
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
  const customer = useLiveQuery(
    () => (rentalReq?.customer_id ? db.profiles.get(rentalReq.customer_id) : undefined),
    [rentalReq?.customer_id]
  );
  const damages = useLiveQuery(
    () => (requestId ? db.damage_findings.where('request_id').equals(requestId).toArray() : []),
    [requestId]
  );

  const isWaitingCheckReady = processState?.waiting_node_ids?.includes('M_CheckReady');

  const handleSubmitEvaluation = async () => {
    if (!currentActor) return;
    if (result === 'CAN_BAO_TRI' && !note.trim()) {
      toast.error('Vui lòng nhập lý do / nội dung cần đưa xe vào bảo trì, sửa chữa');
      return;
    }

    try {
      setIsSubmitting(true);
      await engine.complete(
        requestId,
        'M_CheckReady',
        {
          result,
          note: note.trim() || (result === 'DAT' ? 'Xe đủ điều kiện sẵn sàng phục vụ tiếp' : 'Cần bảo dưỡng xe'),
        },
        currentActor
      );

      if (result === 'DAT') {
        toast.success(
          'Xe đã chuyển về trạng thái SẴN SÀNG (SAN_SANG). Hồ sơ đã lưu trữ tập trung (M_Archive) và hoàn tất!'
        );
      } else {
        toast.warning(
          'Đã lập phiếu bảo trì và khóa lịch xe 48 giờ (M_Maintenance). Hồ sơ đã đóng băng lưu trữ (M_Archive)!'
        );
      }

      setTimeout(() => {
        navigate('/nv/01');
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi đánh giá tình trạng xe');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!requestId) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6 text-center">
        <Card className="p-8">
          <p className="text-slate-600 mb-4">Không tìm thấy mã hồ sơ để đánh giá xe sau trả.</p>
          <Button onClick={() => navigate('/nv/01')}>Về danh sách việc cần làm (NV-01)</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình NV-09
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{requestId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Đánh Giá Xe Sau Trả &amp; Lưu Trữ Hồ Sơ
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Quy trình BPMN: <code className="font-mono text-brand-700 font-semibold">M_CheckReady</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_GReady</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_MarkReady / M_Maintenance</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_Archive (Hoàn tất)</code>
          </p>
        </div>

        <Badge variant="processing" className="flex items-center gap-1">
          <Archive className="w-3.5 h-3.5" />
          <span>Bước cuối quy trình</span>
        </Badge>
      </div>

      {/* Thông tin phương tiện và khách hàng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Xe đánh giá</div>
            <div className="font-bold text-slate-900 text-sm">
              {vehicle?.model} ({vehicle?.plate})
            </div>
            <div className="text-slate-500">
              Trạng thái xe hiện tại: <span className="font-mono font-semibold">{vehicle?.status}</span>
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Khách hàng thuê xe</div>
            <div className="font-bold text-slate-900 text-sm">
              {customer?.full_name} ({customer?.phone})
            </div>
            <div className="text-slate-500">
              Thời gian trả: {rentalReq?.returned_at ? formatDateTime(rentalReq.returned_at) : '—'}
            </div>
          </div>
        </Card>
      </div>

      {/* CÁC KHOẢN HƯ HẠI ĐÃ GHI NHẬN (NẾU CÓ) ĐỂ NHÂN VIÊN THAM CHIẾU */}
      {damages && damages.length > 0 && (
        <Card className="p-4 border-amber-200 bg-amber-50/50 space-y-2">
          <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-amber-700" />
            <span>Lưu ý hư hại ghi nhận lúc nhận xe trả:</span>
          </div>
          <div className="space-y-1">
            {damages.map((d) => (
              <div key={d.id} className="text-xs text-amber-950 bg-white p-2 rounded border border-amber-200">
                • <strong>{d.description}</strong>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* KHU VỰC ĐÁNH GIÁ CỦA NHÂN VIÊN */}
      {isWaitingCheckReady ? (
        <Card className="p-5 border-brand-200 space-y-5 bg-white">
          <h3 className="text-base font-bold text-slate-900 pb-3 border-b border-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Kết luận kiểm tra kỹ thuật sau trả xe</span>
          </h3>

          {/* 2 Lựa chọn Đạt / Cần bảo trì */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setResult('DAT')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                result === 'DAT'
                  ? 'border-brand-500 bg-brand-50/60 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-brand-600" />
                <span className="font-bold text-slate-900 text-sm">Đạt (Sẵn sàng phục vụ tiếp)</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Xe hoạt động tốt, vệ sinh sạch sẽ, đáp ứng tiêu chuẩn an toàn kỹ thuật để chuyển ngay sang trạng thái <strong>SẴN SÀNG (SAN_SANG)</strong> cho khách thuê tiếp theo.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setResult('CAN_BAO_TRI')}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                result === 'CAN_BAO_TRI'
                  ? 'border-amber-500 bg-amber-50/60 shadow-xs'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-slate-900 text-sm">Cần bảo trì / sửa chữa</span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5">
                Xe cần thay dầu, bảo dưỡng phanh/lốp hoặc sửa chữa vết hỏng. Hệ thống sẽ tự động lập <strong>phiếu bảo trì (maintenance_orders)</strong> và khóa lịch xe 48h.
              </p>
            </button>
          </div>

          {/* Ô nhập ghi chú khi cần bảo trì */}
          {result === 'CAN_BAO_TRI' && (
            <div className="space-y-1.5 pt-1">
              <Textarea
                label="Hạng mục cần bảo dưỡng, sửa chữa (bắt buộc khi chọn Cần bảo trì)"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ví dụ: Thay dầu nhớt định kỳ, căn chỉnh lại phanh đĩa trước, sơn lại yếm bên phải..."
              />
            </div>
          )}

          {/* Ghi chú hoàn tất hồ sơ */}
          <div className="p-3 bg-slate-50 rounded text-xs text-slate-600 flex items-center gap-2">
            <Archive className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              Sau khi bấm xác nhận, hệ thống sẽ thực thi tác vụ tự động <code>M_Archive</code>, gắn dấu thời gian <code>archived_at</code> và đóng hồ sơ thuê xe ở trạng thái <strong>HOÀN TẤT (HOAN_TAT)</strong>.
            </span>
          </div>

          {/* Nút Submit */}
          <div className="pt-3 border-t border-slate-100 flex justify-end gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Quay lại Hộp việc
            </Button>
            <Button
              data-testid="node-M_CheckReady"
              onClick={handleSubmitEvaluation}
              loading={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-1.5"
            >
              <span>Xác nhận đánh giá &amp; Lưu hồ sơ (M_CheckReady)</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">
            Hồ sơ thuê xe đã hoàn tất trọn vẹn chu trình (HOÀN TẤT)!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hồ sơ này đã được quyết toán và lưu trữ an toàn trong kho dữ liệu. Trạng thái hiện tại: <strong>{rentalReq?.status}</strong>.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Về Hộp việc cần làm (NV-01)
            </Button>
            <Button onClick={() => navigate('/trace')}>
              Xem toàn bộ Trace BPMN
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default NV09Page;

