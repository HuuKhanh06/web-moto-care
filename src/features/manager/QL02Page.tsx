// src/features/manager/QL02Page.tsx
// Màn hình QL-02: Xử lý sự cố vượt SLA / Hết đối tác (SC_Escalate, SC_GResolve)
// Quản lý xem xét sự cố leo thang, ghi chú phương án xử lý và quyết định có thể tiếp tục hỗ trợ hay thu hồi xe sớm.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { Incident, RentalRequest, Vehicle, IncidentDispatch, Partner } from '@/db/types';
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
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Bike,
  History,
  RotateCcw,
} from 'lucide-react';

interface EscalatedIncidentItem {
  incident: Incident;
  request: RentalRequest;
  vehicle?: Vehicle;
  dispatches: (IncidentDispatch & { partner?: Partner })[];
}

export function QL02Page() {
  const [searchParams] = useSearchParams();
  const directRequestId = searchParams.get('requestId');
  const currentActor = useAuthStore((s) => s.currentActor);

  const [escalatedItems, setEscalatedItems] = useState<EscalatedIncidentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [escalationNotes, setEscalationNotes] = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Tìm các process_state đang chờ ở SC_Escalate
      const pStates = await db.process_state
        .filter((ps) => ps.waiting_node_ids.includes('SC_Escalate'))
        .toArray();

      const items: EscalatedIncidentItem[] = [];
      for (const ps of pStates) {
        if (directRequestId && ps.request_id !== directRequestId) continue;

        const req = await db.rental_requests.get(ps.request_id);
        const inc = await db.incidents.where('request_id').equals(ps.request_id).reverse().first();

        if (req && inc) {
          const veh = req.vehicle_id ? await db.vehicles.get(req.vehicle_id) : undefined;
          const dispatches = await db.incident_dispatches
            .where('incident_id')
            .equals(inc.id)
            .sortBy('attempt_no');

          const enrichedDispatches = [];
          for (const d of dispatches) {
            const p = await db.partners.get(d.partner_id);
            enrichedDispatches.push({ ...d, partner: p });
          }

          items.push({
            incident: inc,
            request: req,
            vehicle: veh,
            dispatches: enrichedDispatches,
          });
        }
      }

      setEscalatedItems(items);
    } catch (err) {
      console.error('Lỗi nạp QL-02:', err);
    } finally {
      setLoading(false);
    }
  }, [directRequestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Quản lý ra quyết định tại cổng SC_GResolve
  const handleResolveDecision = async (
    item: EscalatedIncidentItem,
    decision: 'Có phương án' | 'Không'
  ) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    const note = escalationNotes[item.incident.id]?.trim() || '';
    if (!note) {
      toast.error('Vui lòng ghi chú phương án xử lý của Quản lý trước khi quyết định');
      return;
    }

    setSubmittingId(item.incident.id);
    try {
      await engine.complete(
        item.request.id,
        'SC_Escalate',
        {
          decision,
          escalation_note: note,
        },
        currentActor
      );

      if (decision === 'Có phương án') {
        toast.success('Đã duyệt phương án xử lý! Chuyển nhân viên ghi nhận chi phí.');
      } else {
        toast.warning('Đã quyết định thu hồi xe! Chuyển hồ sơ sang quy trình nhận xe trả sớm.');
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi xử lý sự cố leo thang:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể lưu quyết định');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            Điều phối cứu hộ khẩn cấp
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Can thiệp và điều phối cứu hộ khi có sự cố cần hỗ trợ đặc biệt từ Quản lý
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
          Làm mới
        </Button>
      </div>

      {escalatedItems.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="Không có sự cố nào cần quản lý phê duyệt phương án"
            description="Tất cả sự cố cứu hộ đều đang được mạng lưới đối tác xử lý trong hạn mức thời gian SLA an toàn."
            icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {escalatedItems.map((item) => {
            const { incident: inc, request: req, vehicle: veh, dispatches } = item;
            const isSubmitting = submittingId === inc.id;

            return (
              <Card
                key={inc.id}
                data-testid="node-SC_Escalate"
                className="p-6 border-2 border-rose-300 bg-rose-50/20 space-y-5 shadow-sm"
              >
                {/* Header phiếu leo thang */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-rose-200 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-600" />
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">
                        Sự cố leo thang #{inc.incident_code}
                      </h3>
                      <p className="text-xs text-rose-700">
                        Lý do leo thang: Hết đối tác cứu hộ khả dụng hoặc quá hạn thời gian xử lý sự cố
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(req.status)}>
                      {getStatusLabel(req.status)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      Báo lúc: {formatDateTime(inc.created_at)}
                    </span>
                  </div>
                </div>

                {/* Thông tin phương tiện & Mô tả khách */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                    <span className="text-slate-500 font-medium text-xs flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5 text-brand-600" />
                      Thông tin phương tiện:
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {veh ? `${veh.model} (${veh.plate})` : 'Chưa rõ xe'}
                    </p>
                    <p className="text-xs text-slate-500">
                      Hợp đồng #{req.id.slice(0, 8)} • Khách hàng: ID {req.customer_id.slice(0, 8)}
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-1">
                    <span className="text-slate-500 font-medium text-xs flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                      Mô tả sự cố từ khách hàng:
                    </span>
                    <p className="font-semibold text-rose-800 text-xs sm:text-sm">
                      {inc.description}
                    </p>
                    {inc.lat && inc.lng && (
                      <p className="text-[11px] text-slate-500">
                        Vị trí GPS: {inc.lat.toFixed(5)}, {inc.lng.toFixed(5)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Lịch sử các đối tác đã liên hệ */}
                {dispatches.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-700">
                      <History className="h-4 w-4 text-slate-500" />
                      Lịch sử điều phối đối tác ({dispatches.length} lần thử)
                    </div>
                    <div className="space-y-1.5">
                      {dispatches.map((d) => (
                        <div
                          key={d.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between text-xs p-2 rounded bg-slate-50 border gap-1"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">
                              Lần {d.attempt_no}: {d.partner?.name || 'Đối tác'} ({d.partner?.region})
                            </span>
                            <span className="ml-2 text-rose-700 font-medium">
                              - Trạng thái: {d.status}
                            </span>
                          </div>
                          <span className="text-slate-400 text-[11px]">
                            {formatDateTime(d.sent_at)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ô nhập phương án của Quản lý */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Phương án xử lý khẩn cấp của Quản lý * (Bắt buộc)
                  </label>
                  <Textarea
                    placeholder="Ví dụ: Điều xe tải của cửa hàng tới kéo xe về xưởng; hoặc bố trí thợ chuyên trách của chi nhánh tới hỗ trợ..."
                    rows={3}
                    value={escalationNotes[inc.id] ?? ''}
                    onChange={(e) =>
                      setEscalationNotes((prev) => ({ ...prev, [inc.id]: e.target.value }))
                    }
                    className="bg-white"
                  />
                </div>

                {/* Cổng quyết định BPMN SC_GResolve */}
                <div className="rounded-xl border border-rose-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Quyết định của Quản lý
                    </h4>
                    <p className="text-xs text-slate-500">
                      Chọn &quot;Có phương án&quot; để tiếp tục khắc phục hoặc &quot;Không&quot; để thu hồi xe và hướng dẫn khách trả xe sớm.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      data-testid="node-SC_GResolve"
                      variant="outline"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      onClick={() => handleResolveDecision(item, 'Không')}
                      className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Không (Thu hồi & Trả xe sớm)
                    </Button>

                    <Button
                      data-testid="node-SC_GResolve"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      onClick={() => handleResolveDecision(item, 'Có phương án')}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Có phương án hỗ trợ
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
