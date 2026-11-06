// src/features/partner/DT01Page.tsx
// Màn hình DT-01: Cổng đối tác cứu hộ (Mô phỏng thay cho Webhook bí mật)
// Quản lý hoặc Nhân viên thao tác phản hồi thay đối tác (SC_ReceiveAck, SC_ReceiveResult)

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { Incident, IncidentDispatch, Partner, RentalRequest } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Textarea,
  EmptyState,
  toast,
} from '@/components/ui';
import {
  formatDateTime,
} from '@/lib/format';
import {
  Wrench,
  CheckCircle2,
  XCircle,
  Clock,
  PhoneCall,
  MapPin,
  Send,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';

interface EnrichedDispatch {
  dispatch: IncidentDispatch;
  incident: Incident;
  partner?: Partner;
  request?: RentalRequest;
}

export function DT01Page() {
  const currentActor = useAuthStore((s) => s.currentActor);

  const [dispatches, setDispatches] = useState<EnrichedDispatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [resultNotes, setResultNotes] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Lấy các dispatch đang chờ xử lý (SENT hoặc ACCEPTED)
      const list = await db.incident_dispatches
        .where('status')
        .anyOf(['SENT', 'ACCEPTED'])
        .reverse()
        .sortBy('sent_at');

      const enriched: EnrichedDispatch[] = [];
      for (const d of list) {
        const inc = await db.incidents.get(d.incident_id);
        if (inc) {
          const [p, req] = await Promise.all([
            db.partners.get(d.partner_id),
            db.rental_requests.get(inc.request_id),
          ]);
          enriched.push({
            dispatch: d,
            incident: inc,
            partner: p,
            request: req,
          });
        }
      }
      setDispatches(enriched);
    } catch (err) {
      console.error('Lỗi tải DT-01:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Tiếp nhận hoặc Từ chối tiếp nhận (SC_ReceiveAck)
  const handleAck = async (item: EnrichedDispatch, status: 'ACCEPTED' | 'DECLINED') => {
    if (!currentActor) return;
    setProcessingId(item.dispatch.id);
    try {
      await engine.complete(
        item.incident.request_id,
        'SC_ReceiveAck',
        { status },
        currentActor
      );

      if (status === 'ACCEPTED') {
        toast.success(`Đối tác ${item.partner?.name || ''} đã tiếp nhận cứu hộ!`);
      } else {
        toast.warning(`Đối tác ${item.partner?.name || ''} từ chối. Hệ thống sẽ điều phối đối tác tiếp theo.`);
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi phản hồi tiếp nhận:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể thực hiện phản hồi');
    } finally {
      setProcessingId(null);
    }
  };

  // Báo kết quả cứu hộ (SC_ReceiveResult)
  const handleReportResult = async (item: EnrichedDispatch) => {
    if (!currentActor) return;
    const note = resultNotes[item.dispatch.id]?.trim() || 'Đã sửa chữa và khắc phục sự cố tại hiện trường.';

    setProcessingId(item.dispatch.id);
    try {
      await engine.complete(
        item.incident.request_id,
        'SC_ReceiveResult',
        { result_note: note },
        currentActor
      );

      toast.success('Đã gửi báo cáo kết quả cứu hộ hoàn tất!');
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi báo cáo kết quả:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi kết quả cứu hộ');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Cảnh báo mô phỏng */}
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="font-bold">Màn hình mô phỏng Cổng đối tác (DT-01):</strong> Trong môi trường sản phẩm thực tế, đối tác cứu hộ tương tác tự động qua Webhook có chữ ký bảo mật HMAC-SHA256 hoặc ứng dụng đối tác riêng. Màn hình này phục vụ ban giám khảo và người dùng demo thao tác phản hồi thay đối tác cứu hộ theo đúng tiến trình.
        </div>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              DT-01
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Cổng đối tác cứu hộ xe máy (Mô phỏng)
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Tiếp nhận điều phối sự cố và báo cáo kết quả hỗ trợ kỹ thuật.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          loading={loading}
          className="flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RotateCcw className="w-4 h-4" />
          Làm mới danh sách
        </Button>
      </div>

      {/* Danh sách các yêu cầu cứu hộ gửi đến đối tác */}
      {dispatches.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="Hiện không có yêu cầu cứu hộ nào đang chờ phản hồi"
            description="Khi khách hàng gửi báo cáo sự cố qua ứng dụng, hệ thống sẽ tự động điều phối tới đối tác cứu hộ gần nhất theo phân vùng."
            icon={<Wrench className="w-8 h-8 text-slate-400" />}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {dispatches.map((item) => {
            const { dispatch: d, incident: inc, partner: p, request: req } = item;
            const isWaitingAck = d.status === 'SENT';
            const isAccepted = d.status === 'ACCEPTED';
            const isBusy = processingId === d.id;

            return (
              <Card key={d.id} className="p-5 border-slate-200 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                      Mã sự cố: #{inc.incident_code}
                    </span>
                    <Badge variant={isWaitingAck ? 'waiting' : 'processing'}>
                      {isWaitingAck ? 'Chờ đối tác tiếp nhận (15m)' : 'Đối tác đang xử lý'}
                    </Badge>
                  </div>

                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Gửi lúc: {formatDateTime(d.sent_at)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                  {/* Cột 1: Thông tin đối tác được điều phối */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <span className="text-slate-500 font-medium text-xs">Đối tác được điều phối:</span>
                    <p className="font-bold text-slate-900 text-sm">{p?.name || 'Đối tác cứu hộ'}</p>
                    <p className="text-xs text-slate-600">Khu vực: {p?.region || 'Toàn thành phố'}</p>
                    <p className="text-xs text-brand-700 flex items-center gap-1">
                      <PhoneCall className="h-3 w-3" />
                      Hotline: {p?.contact || 'Chưa có'}
                    </p>
                  </div>

                  {/* Cột 2: Thông tin sự cố của khách */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
                    <span className="text-slate-500 font-medium text-xs">Nội dung sự cố từ khách:</span>
                    <p className="font-bold text-rose-800 text-xs sm:text-sm">{inc.description}</p>
                    {inc.lat && inc.lng && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-brand-600" />
                        Tọa độ: {inc.lat.toFixed(5)}, {inc.lng.toFixed(5)}
                      </p>
                    )}
                    {req && (
                      <p className="text-[11px] text-slate-400">
                        Đơn thuê #{req.id.slice(0, 8)} • Lần thử #{d.attempt_no}
                      </p>
                    )}
                  </div>
                </div>

                {/* HÀNH ĐỘNG 1: BƯỚC TIẾP NHẬN / TỪ CHỐI (SC_ReceiveAck) */}
                {isWaitingAck && (
                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t">
                    <p className="text-xs text-slate-500 italic">
                      Đối tác có 15 phút để phản hồi tiếp nhận. Nếu từ chối, hệ thống tự động chuyển sang đối tác kế tiếp.
                    </p>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        data-testid="node-SC_ReceiveAck"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleAck(item, 'DECLINED')}
                        className="w-full sm:w-auto border-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
                      >
                        <XCircle className="mr-1 h-3.5 w-3.5" />
                        Từ chối tiếp nhận
                      </Button>

                      <Button
                        size="sm"
                        data-testid="node-SC_ReceiveAck"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleAck(item, 'ACCEPTED')}
                        className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                      >
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                        Tiếp nhận cứu hộ
                      </Button>
                    </div>
                  </div>
                )}

                {/* HÀNH ĐỘNG 2: BƯỚC BÁO CÁO KẾT QUẢ CỨU HỘ (SC_ReceiveResult) */}
                {isAccepted && (
                  <div className="pt-2 space-y-3 border-t">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Ghi chú kết quả xử lý tại hiện trường
                      </label>
                      <Textarea
                        placeholder="Nhập nội dung xử lý (ví dụ: Đã thay săm lốp mới, tăng xích, kiểm tra dầu nhớt...)"
                        rows={2}
                        value={resultNotes[d.id] ?? ''}
                        onChange={(e) => setResultNotes((prev) => ({ ...prev, [d.id]: e.target.value }))}
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        data-testid="node-SC_ReceiveResult"
                        size="sm"
                        disabled={isBusy}
                        loading={isBusy}
                        onClick={() => handleReportResult(item)}
                        className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                      >
                        <Send className="mr-1.5 h-3.5 w-3.5" />
                        Báo kết quả cứu hộ hoàn tất
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

