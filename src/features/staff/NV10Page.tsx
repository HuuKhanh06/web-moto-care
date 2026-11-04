// src/features/staff/NV10Page.tsx
// Màn hình NV-10: Xác nhận sự cố & Ghi nhận phí (SC_Log, SC_SettleDecision)
// Nhân viên xác nhận chi phí thực tế phát sinh, ghi chú nghiệp vụ và quyết định khách tiếp tục thuê hay trả xe sớm.

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
  Input,
  EmptyState,
  toast,
} from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Bike,
  CreditCard,
  RotateCcw,
  Sparkles,
} from 'lucide-react';

interface SettlementItem {
  incident: Incident;
  request: RentalRequest;
  vehicle?: Vehicle;
  lastDispatch?: IncidentDispatch & { partner?: Partner };
}

export function NV10Page() {
  const [searchParams] = useSearchParams();
  const directRequestId = searchParams.get('requestId');
  const currentActor = useAuthStore((s) => s.currentActor);

  const [settlementItems, setSettlementItems] = useState<SettlementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Chi phí thực tế nhập cho từng sự cố
  const [costs, setCosts] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // Tìm các process_state đang chờ ở SC_Log
      const pStates = await db.process_state
        .filter((ps) => ps.waiting_node_ids.includes('SC_Log'))
        .toArray();

      const items: SettlementItem[] = [];
      const initCosts: Record<string, number> = {};

      for (const ps of pStates) {
        if (directRequestId && ps.request_id !== directRequestId) continue;

        const req = await db.rental_requests.get(ps.request_id);
        const inc = await db.incidents.where('request_id').equals(ps.request_id).reverse().first();

        if (req && inc) {
          const veh = req.vehicle_id ? await db.vehicles.get(req.vehicle_id) : undefined;
          const d = await db.incident_dispatches.where('incident_id').equals(inc.id).reverse().first();
          let partner = undefined;
          if (d?.partner_id) {
            partner = await db.partners.get(d.partner_id);
          }

          items.push({
            incident: inc,
            request: req,
            vehicle: veh,
            lastDispatch: d ? { ...d, partner } : undefined,
          });

          initCosts[inc.id] = inc.actual_cost || 150000; // Chi phí mẫu mặc định nếu chưa nhập
        }
      }

      setSettlementItems(items);
      setCosts((prev) => ({ ...initCosts, ...prev }));
    } catch (err) {
      console.error('Lỗi nạp NV-10:', err);
    } finally {
      setLoading(false);
    }
  }, [directRequestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Nhân viên xác nhận chi phí và quyết định tiếp tục thuê tại SC_SettleDecision
  const handleSettleDecision = async (
    item: SettlementItem,
    continueRental: boolean
  ) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    const actualCost = Number(costs[item.incident.id] || 0);

    setSubmittingId(item.incident.id);
    try {
      await engine.complete(
        item.request.id,
        'SC_Log',
        {
          actual_cost: actualCost,
          continue_rental: continueRental,
        },
        currentActor
      );

      if (continueRental) {
        toast.success('Đã xác nhận sự cố! Khách hàng tiếp tục thuê xe (SC_SendContinue).');
      } else {
        toast.warning('Đã quyết định kết thúc sớm! Chuyển hồ sơ sang bước nhận xe trả (SC_NotifyEarly).');
      }
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi ghi nhận phí sự cố:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể lưu xác nhận');
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800 border border-brand-200">
              NV-10
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Xác nhận sự cố & Ghi nhận chi phí (SC_Log)
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Nghiệm thu kết quả xử lý kỹ thuật, đối soát chi phí cứu hộ và quyết định phương án hợp đồng (SC_SettleDecision).
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

      {settlementItems.length === 0 ? (
        <Card className="p-8">
          <EmptyState
            title="Không có sự cố nào đang chờ nghiệm thu chi phí"
            description="Khi đối tác hoặc quản lý hoàn tất hỗ trợ sự cố cứu hộ, phiếu sẽ xuất hiện tại đây để nhân viên chốt chi phí."
            icon={<CheckCircle2 className="w-8 h-8 text-emerald-600" />}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {settlementItems.map((item) => {
            const { incident: inc, request: req, vehicle: veh, lastDispatch } = item;
            const isSubmitting = submittingId === inc.id;
            const currentCost = costs[inc.id] || 0;

            return (
              <Card
                key={inc.id}
                data-testid="node-SC_Log"
                className="p-6 border-slate-200 space-y-5 shadow-sm"
              >
                {/* Header phiếu */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-800">
                      Phiếu sự cố: #{inc.incident_code}
                    </span>
                    <Badge variant={getStatusBadgeVariant(req.status)}>
                      {getStatusLabel(req.status)}
                    </Badge>
                  </div>

                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    Báo lúc: {formatDateTime(inc.created_at)}
                  </span>
                </div>

                {/* Thông tin xe & Kết quả cứu hộ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
                    <span className="text-slate-500 font-medium text-xs flex items-center gap-1">
                      <Bike className="h-3.5 w-3.5 text-brand-600" />
                      Phương tiện thuê:
                    </span>
                    <p className="font-bold text-slate-900 text-sm">
                      {veh ? `${veh.model} (${veh.plate})` : 'Chưa rõ xe'}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Sự cố: <strong className="text-rose-800">{inc.description}</strong>
                    </p>
                  </div>

                  <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-4 space-y-1">
                    <span className="text-brand-700 font-medium text-xs flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-brand-600" />
                      Kết quả xử lý từ đối tác / Quản lý:
                    </span>
                    <p className="font-semibold text-slate-800 text-sm">
                      {lastDispatch?.result || inc.escalation_note || 'Đã sửa chữa và khắc phục tại chỗ.'}
                    </p>
                    {lastDispatch?.partner && (
                      <p className="text-xs text-slate-500 mt-1">
                        Thực hiện bởi: {lastDispatch.partner.name} ({lastDispatch.partner.contact})
                      </p>
                    )}
                  </div>
                </div>

                {/* Ô nhập chi phí thực tế */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <CreditCard className="h-4 w-4 text-brand-600" />
                    Ghi nhận chi phí cứu hộ / sửa chữa thực tế (SC_Log)
                  </div>

                  <div className="max-w-xs">
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Số tiền chi phí hợp lệ (VNĐ)
                    </label>
                    <Input
                      type="number"
                      step={10000}
                      value={currentCost}
                      onChange={(e) =>
                        setCosts((prev) => ({ ...prev, [inc.id]: Number(e.target.value) }))
                      }
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Chi phí: <strong>{formatCurrency(currentCost)}</strong>
                    </p>
                  </div>
                </div>

                {/* Cổng quyết định BPMN SC_SettleDecision */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      Quyết định tiếp tục thuê hay trả xe sớm? (Cổng BPMN SC_SettleDecision)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Nếu xe còn an toàn để lưu thông &rarr; Tiếp tục thuê. Nếu xe hỏng nặng &rarr; Trả xe sớm.
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <Button
                      data-testid="node-SC_SettleDecision"
                      variant="outline"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      onClick={() => handleSettleDecision(item, false)}
                      className="border-amber-300 text-amber-800 hover:bg-amber-50 text-xs"
                    >
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Trả xe sớm (SC_NotifyEarly)
                    </Button>

                    <Button
                      data-testid="node-SC_SettleDecision"
                      disabled={isSubmitting}
                      loading={isSubmitting}
                      onClick={() => handleSettleDecision(item, true)}
                      className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs"
                    >
                      <CheckCircle2 className="mr-1.5 h-4 w-4" />
                      Tiếp tục cho thuê (SC_SendContinue)
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
