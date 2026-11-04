// src/features/staff/NV01Page.tsx
// Màn hình NV-01: Hộp việc - Danh sách yêu cầu thuê & việc cần làm của Nhân viên và Quản lý

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Profile, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  EmptyState,
} from '@/components/ui';
import {
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  ClipboardList,
  Search,
  ArrowRight,
  History,
  AlertTriangle,
  RotateCcw,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';

interface TaskItem {
  requestId: string;
  nodeId: string;
  nodeName: string;
  request?: RentalRequest;
  customer?: Profile;
  vehicle?: Vehicle;
  vehicleType?: string;
  targetScreenUrl: string;
}

// Bảng ánh xạ từ BPMN node ID sang URL màn hình xử lý
const NODE_TO_SCREEN_MAP: Record<string, string> = {
  M_ManualDeposit: '/nv/02',
  M_InspectPre: '/nv/03',
  M_Rework: '/nv/03',
  M_Photo: '/nv/04',
  M_Handover: '/nv/05',
  M_ReceiveReturn: '/nv/06',
  M_CheckReturn: '/nv/06',
  M_VerifyDamage: '/nv/07',
  M_ManualExtra: '/nv/08',
  M_CheckReady: '/nv/09',
  SC_Log: '/nv/10',
  M_Resolve: '/ql/01',
  SC_Escalate: '/ql/02',
  SC_ReceiveAck: '/dt/01',
  SC_ReceiveResult: '/dt/01',
};

export function NV01Page() {
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);
  const isManager = currentActor?.role === 'quan_ly';

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [debtRequests, setDebtRequests] = useState<Array<{ request: RentalRequest; customer?: Profile; vehicle?: Vehicle }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Lấy danh sách việc cần làm cho nhân viên
      const pendingRaw = await engine.getPendingTasks('nhan_vien');

      // Nếu là quản lý, lấy thêm các việc của quản lý
      let managerTasks: Array<{ request_id: string; node_id: string; node_name: string }> = [];
      if (isManager) {
        managerTasks = await engine.getPendingTasks('quan_ly');
      }

      const combinedRaw = [...pendingRaw];
      for (const mt of managerTasks) {
        if (!combinedRaw.some((t) => t.request_id === mt.request_id && t.node_id === mt.node_id)) {
          combinedRaw.push(mt);
        }
      }

      // Làm giàu thông tin đơn, xe và khách hàng
      const taskList: TaskItem[] = [];
      for (const t of combinedRaw) {
        const [req, state] = await Promise.all([
          db.rental_requests.get(t.request_id),
          db.process_state.get(t.request_id),
        ]);

        let cust: Profile | undefined;
        let veh: Vehicle | undefined;

        if (req) {
          cust = await db.profiles.get(req.customer_id);
          if (req.vehicle_id) {
            veh = await db.vehicles.get(req.vehicle_id);
          }
        }

        const prefVehicleType = (state?.variables?.preferred_vehicle_type as string) || veh?.vehicle_type || 'N/A';

        taskList.push({
          requestId: t.request_id,
          nodeId: t.node_id,
          nodeName: t.node_name,
          request: req,
          customer: cust,
          vehicle: veh,
          vehicleType: prefVehicleType,
          targetScreenUrl: NODE_TO_SCREEN_MAP[t.node_id] || `/trace/${t.request_id}`,
        });
      }
      setTasks(taskList);

      // 2. Lấy danh sách hồ sơ công nợ (CONG_NO - ứng với M_END_DEBT)
      const debts = await db.rental_requests.where('status').equals('CONG_NO').toArray();
      const enrichedDebts: Array<{ request: RentalRequest; customer?: Profile; vehicle?: Vehicle }> = [];
      for (const d of debts) {
        const [c, v] = await Promise.all([
          db.profiles.get(d.customer_id),
          d.vehicle_id ? db.vehicles.get(d.vehicle_id) : Promise.resolve(undefined),
        ]);
        enrichedDebts.push({ request: d, customer: c, vehicle: v });
      }
      setDebtRequests(enrichedDebts);
    } catch (err) {
      console.error('Lỗi tải dữ liệu NV-01:', err);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Bộ lọc dữ liệu
  const filteredTasks = tasks.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer?.phone?.includes(searchQuery) ||
      item.nodeName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'deposit') return item.nodeId === 'M_ManualDeposit';
    if (filterType === 'pre_inspect') return item.nodeId === 'M_InspectPre' || item.nodeId === 'M_Rework';
    if (filterType === 'handover') return item.nodeId === 'M_Photo' || item.nodeId === 'M_Handover';
    if (filterType === 'return') return item.nodeId === 'M_ReceiveReturn' || item.nodeId === 'M_CheckReturn' || item.nodeId === 'M_VerifyDamage';
    if (filterType === 'settle') return item.nodeId === 'M_ManualExtra' || item.nodeId === 'M_CheckReady';
    if (filterType === 'incident') return item.nodeId === 'SC_Log' || item.nodeId === 'SC_Escalate';
    if (filterType === 'manager') return item.nodeId === 'M_Resolve' || item.nodeId === 'SC_Escalate' || item.nodeId === 'SC_ReceiveAck';

    return true;
  });

  const showDebtOnly = filterType === 'debt';

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Banner thông tin vai trò */}
      {isManager && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between text-xs text-amber-800">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Chế độ Quản lý:</strong> Bạn đang có quyền xem toàn bộ hộp việc của Nhân viên và các việc cần phê duyệt của Quản lý.
            </span>
          </div>
          <Badge variant="waiting" size="sm">Quản lý xem</Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/80 shadow-xs">
              Điều hành
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Trung tâm điều phối &amp; Hộp việc</h1>
          </div>
          <p className="text-sm text-slate-500">
            Tiếp nhận và xử lý các yêu cầu bàn giao xe, kiểm tra kỹ thuật, đối soát và quyết toán
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          loading={loading}
          className="self-start sm:self-auto flex items-center gap-1.5"
        >
          <RotateCcw className="w-4 h-4" />
          Làm mới
        </Button>
      </div>

      {/* Bộ lọc và Tìm kiếm */}
      <Card className="p-4 border-slate-200">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-7">
            <Input
              placeholder="Tìm theo mã đơn, tên khách, SĐT, công việc..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              icon={<Search className="w-4 h-4 text-slate-400" />}
            />
          </div>
          <div className="sm:col-span-5">
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              options={[
                { value: 'all', label: `Tất cả việc cần làm (${tasks.length})` },
                { value: 'deposit', label: 'Cọc ngoại lệ (NV-02)' },
                { value: 'pre_inspect', label: 'Kiểm tra kỹ thuật & Khắc phục (NV-03)' },
                { value: 'handover', label: 'Checklist ảnh & Bàn giao (NV-04, 05)' },
                { value: 'return', label: 'Nhận xe & Xác minh hư hỏng (NV-06, 07)' },
                { value: 'settle', label: 'Chưa thanh toán & Đánh giá xe (NV-08, 09)' },
                { value: 'incident', label: 'Xử lý sự cố (NV-10)' },
                ...(isManager ? [{ value: 'manager', label: 'Việc của Quản lý (QL-01, QL-02)' }] : []),
                { value: 'debt', label: `Hồ sơ công nợ CONG_NO (${debtRequests.length})` },
              ]}
            />
          </div>
        </div>
      </Card>

      {/* Danh sách nhiệm vụ hoặc Hồ sơ công nợ */}
      {showDebtOnly ? (
        /* Danh sách hồ sơ công nợ M_END_DEBT */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              Danh sách hồ sơ ghi nhận công nợ tồn đọng
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Tổng số: {debtRequests.length} hồ sơ
            </span>
          </div>

          {debtRequests.length === 0 ? (
            <EmptyState
              title="Không có hồ sơ công nợ"
              description="Hiện tại chưa có khách hàng nào bị ghi nhận công nợ tồn đọng."
              icon={<UserCheck className="w-8 h-8 text-slate-400" />}
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {debtRequests.map(({ request, customer, vehicle }) => (
                <Card
                  key={request.id}
                  className="p-4 border-red-200 bg-red-50/20 hover:border-red-300 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold text-slate-800">
                          {request.id.slice(0, 8)}...
                        </span>
                        <Badge variant="danger">CONG_NO (Đã ghi nợ)</Badge>
                        <span className="text-xs text-slate-500">
                          BPMN Node: <code className="font-mono text-red-700">M_END_DEBT</code>
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {customer?.full_name || 'Khách vãng lai'} &bull; {customer?.phone || 'Chưa cập nhật SĐT'}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Xe: <span className="font-medium text-slate-700">{vehicle ? `${vehicle.model} (${vehicle.plate})` : 'Chưa gán xe'}</span> &bull; 
                        Thời gian nhận: {formatDateTime(request.start_at)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/trace/${request.id}`)}
                        className="flex items-center gap-1.5"
                      >
                        <History className="w-3.5 h-3.5" />
                        Xem dấu vết
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/nv/08?requestId=${request.id}`)}
                        className="flex items-center gap-1.5"
                      >
                        Xem chi tiết nợ
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Danh sách Hộp việc đang chờ */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-600" />
              Nhiệm vụ đang chờ thực hiện
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              Đang hiển thị {filteredTasks.length} / {tasks.length} việc
            </span>
          </div>

          {filteredTasks.length === 0 ? (
            <EmptyState
              title="Không có công việc nào chờ xử lý"
              description={
                searchQuery || filterType !== 'all'
                  ? 'Không tìm thấy việc phù hợp với tiêu chí tìm kiếm hoặc bộ lọc.'
                  : 'Hộp việc hiện đang trống. Mọi yêu cầu thuê xe đều đã được giải quyết hoặc đang ở phía khách hàng.'
              }
              action={
                searchQuery || filterType !== 'all' ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setFilterType('all');
                    }}
                  >
                    Xóa bộ lọc
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredTasks.map((task) => {
                const req = task.request;
                const cust = task.customer;
                const veh = task.vehicle;

                return (
                  <Card
                    key={`${task.requestId}-${task.nodeId}`}
                    className="p-4 border-slate-200 hover:border-brand-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Cột thông tin */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                            {task.requestId.slice(0, 8)}...
                          </span>
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                            {task.nodeId}
                          </span>
                          {req && (
                            <Badge variant={getStatusBadgeVariant(req.status)} size="sm">
                              {getStatusLabel(req.status)}
                            </Badge>
                          )}
                        </div>

                        <div className="text-base font-bold text-slate-900 flex items-center gap-2">
                          <span>{task.nodeName}</span>
                        </div>

                        <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
                          <span>
                            Khách hàng: <strong>{cust?.full_name || 'Khách vãng lai'}</strong> ({cust?.phone || 'N/A'})
                          </span>
                          <span>
                            Xe: <strong>{veh ? `${veh.model} (${veh.plate})` : task.vehicleType}</strong>
                          </span>
                          {req?.start_at && (
                            <span>
                              Nhận: {formatDateTime(req.start_at)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Nút hành động */}
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/trace/${task.requestId}`)}
                          className="flex items-center gap-1.5"
                          title="Xem toàn bộ tiến trình lịch sử sự kiện"
                        >
                          <History className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Dấu vết</span>
                        </Button>

                        <Button
                          variant="primary"
                          size="sm"
                          data-testid={`node-${task.nodeId}`}
                          onClick={() => navigate(`${task.targetScreenUrl}?requestId=${task.requestId}`)}
                          className="flex items-center gap-1.5 font-medium shadow-sm"
                        >
                          <span>Xử lý</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
