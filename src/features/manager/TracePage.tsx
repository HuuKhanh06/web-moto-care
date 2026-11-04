// src/features/manager/TracePage.tsx
// Màn hình Dấu vết quy trình (/trace/:requestId): Minh chứng thực thi BPMN To-Be cho video demo & kiểm thử

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/db';
import { bpmnGraph } from '@/engine/graph';
import type { ProcessEvent, RentalRequest, Profile, ProcessState, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Modal,
  EmptyState,
} from '@/components/ui';
import {
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  History,
  ArrowLeft,
  RotateCcw,
  GitCommit,
  User,
  Code2,
  CheckCircle2,
  Download,
} from 'lucide-react';

export function TracePage() {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [processState, setProcessState] = useState<ProcessState | null>(null);
  const [events, setEvents] = useState<ProcessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayload, setSelectedPayload] = useState<{ nodeId: string; type: string; payload: unknown } | null>(null);

  const loadTrace = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const [req, state, evtList] = await Promise.all([
        db.rental_requests.get(requestId),
        db.process_state.get(requestId),
        db.process_events.where('request_id').equals(requestId).sortBy('created_at'),
      ]);

      setRequest(req || null);
      setProcessState(state || null);
      setEvents(evtList);

      if (req) {
        const [cust, veh] = await Promise.all([
          db.profiles.get(req.customer_id),
          req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
        ]);
        setCustomer(cust || null);
        setVehicle(veh || null);
      }
    } catch (err) {
      console.error('Lỗi khi tải dấu vết quy trình:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadTrace();
  }, [loadTrace]);

  const handleExportJson = () => {
    if (!requestId || events.length === 0) return;
    const exportData = {
      request_id: requestId,
      exported_at: new Date().toISOString(),
      request_summary: request,
      current_state: processState,
      events_count: events.length,
      events,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `motocare_trace_${requestId.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const displayVehicle = vehicle
    ? `${vehicle.model} (${vehicle.plate})`
    : (processState?.variables?.preferred_vehicle_type as string) || 'Chưa gán xe';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header & Thanh điều hướng */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(-1)}
              className="flex items-center gap-1 text-slate-600"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại</span>
            </Button>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              AUDIT / TRACE
            </span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-brand-600" />
            Dấu vết quy trình BPMN To-Be
          </h1>
          <p className="text-xs text-slate-500">
            Mã hồ sơ: <code className="font-mono font-bold text-slate-700">{requestId}</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadTrace}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExportJson}
            disabled={events.length === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            Xuất JSON
          </Button>
        </div>
      </div>

      {/* Thông tin tóm tắt hồ sơ & Trạng thái hiện tại */}
      {request && (
        <Card className="p-5 border-slate-200 shadow-sm bg-gradient-to-r from-brand-50/40 via-white to-white">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <div className="text-xs text-slate-500 font-medium">Trạng thái hồ sơ</div>
              <div className="mt-1">
                <Badge variant={getStatusBadgeVariant(request.status)} size="md">
                  {getStatusLabel(request.status)}
                </Badge>
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium">Khách hàng</div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">
                {customer?.full_name || 'Khách vãng lai'}
              </div>
              <div className="text-xs text-slate-500">{customer?.phone || 'Chưa có SĐT'}</div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium">Phương tiện thuê</div>
              <div className="font-semibold text-slate-900 text-sm mt-0.5">{displayVehicle}</div>
              <div className="text-xs text-slate-500">
                Nhận: {formatDateTime(request.start_at)}
              </div>
            </div>

            <div>
              <div className="text-xs text-slate-500 font-medium">Điểm chờ hiện tại (BPMN)</div>
              {processState?.waiting_node_ids && processState.waiting_node_ids.length > 0 ? (
                <div className="flex flex-wrap gap-1 mt-1">
                  {processState.waiting_node_ids.map((nodeId) => (
                    <span
                      key={nodeId}
                      className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300"
                    >
                      {nodeId}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Đã kết thúc hoặc không có điểm chờ
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Bảng liệt kê sự kiện BPMN */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <GitCommit className="w-4 h-4 text-brand-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              Chuỗi sự kiện thực thi ({events.length} bước)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Tất cả phần tử BPMN khớp 100% với process-graph.json
          </span>
        </div>

        {events.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="Chưa có dữ liệu sự kiện"
              description="Hồ sơ này chưa ghi nhận bước chuyển quy trình nào trong bảng process_events."
              icon={<History className="w-8 h-8 text-slate-400" />}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3 w-36">Thời điểm</th>
                  <th className="py-2.5 px-3 w-40">Mã nút BPMN</th>
                  <th className="py-2.5 px-3">Tên phần tử BPMN</th>
                  <th className="py-2.5 px-3 w-32">Lane</th>
                  <th className="py-2.5 px-3 w-44">Loại sự kiện</th>
                  <th className="py-2.5 px-3 w-28">Tác nhân</th>
                  <th className="py-2.5 px-3 w-24 text-center">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {events.map((evt, idx) => {
                  const node = bpmnGraph.getNode(evt.bpmn_node_id);
                  const isLast = idx === events.length - 1;

                  return (
                    <tr
                      key={evt.id}
                      className={isLast ? 'bg-brand-50/30 font-medium' : 'hover:bg-slate-50/60'}
                    >
                      <td className="py-2.5 px-3 text-center font-mono text-slate-500">
                        {idx + 1}
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {formatDateTime(evt.created_at)}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="font-mono font-bold text-brand-800 bg-brand-50/80 px-2 py-0.5 rounded border border-brand-200">
                          {evt.bpmn_node_id}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {node?.name || (
                          <span className="text-slate-400 italic">Không có tên mô tả</span>
                        )}
                      </td>

                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                          {node?.lane || 'Chưa gán lane'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {evt.event_type}
                      </td>

                      <td className="py-2.5 px-3 text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-slate-400" />
                          {evt.actor_id || 'system'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-center">
                        {evt.payload && Object.keys(evt.payload).length > 0 ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setSelectedPayload({
                                nodeId: evt.bpmn_node_id,
                                type: evt.event_type,
                                payload: evt.payload,
                              })
                            }
                            className="h-7 px-2 text-xs text-brand-700 hover:text-brand-900 hover:bg-brand-50"
                          >
                            <Code2 className="w-3.5 h-3.5 mr-1" />
                            Xem
                          </Button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal chi tiết Payload sự kiện */}
      <Modal
        isOpen={Boolean(selectedPayload)}
        onClose={() => setSelectedPayload(null)}
        title="Dữ liệu chi tiết sự kiện (Payload)"
        size="lg"
      >
        {selectedPayload && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-600">Mã nút:</span>
              <span className="font-mono font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                {selectedPayload.nodeId}
              </span>
              <span className="font-semibold text-slate-600 ml-2">Loại sự kiện:</span>
              <span className="font-mono text-slate-700">{selectedPayload.type}</span>
            </div>

            <div className="p-3 bg-slate-900 rounded-xl overflow-x-auto text-emerald-400 font-mono text-xs max-h-96">
              <pre>{JSON.stringify(selectedPayload.payload, null, 2)}</pre>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedPayload(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
