// src/features/staff/NV01Page.tsx
// Màn hình Việc cần làm của Nhân viên & Vận hành

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Profile, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  Input,
  Select,
  EmptyState,
  StatusChip,
} from '@/components/ui';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { COPY } from '@/copy';
import {
  Search,
  ArrowRight,
  RotateCcw,
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

const TASK_HUMAN_NAMES: Record<string, string> = {
  M_ManualDeposit: 'Đối soát tiền cọc',
  M_InspectPre: 'Kiểm tra xe',
  M_Rework: 'Khắc phục kỹ thuật',
  M_Photo: 'Chụp ảnh bàn giao',
  M_Handover: 'Bàn giao xe',
  M_ReceiveReturn: 'Nhận bàn giao xe',
  M_CheckReturn: 'Kiểm tra xe trả',
  M_VerifyDamage: 'Xác minh chi phí',
  M_ManualExtra: 'Thu phí phát sinh',
  M_CheckReady: 'Đưa xe vào bãi',
  SC_Log: 'Hỗ trợ sự cố',
  M_Resolve: 'Xử lý khiếu nại',
  SC_Escalate: 'Điều phối cứu hộ',
};

export function NV01Page() {
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);
  const isManager = currentActor?.role === 'quan_ly';

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const pendingRaw = await engine.getPendingTasks('nhan_vien');

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

        const prefVehicleType = (state?.variables?.preferred_vehicle_type as string) || veh?.vehicle_type || 'Xe máy';

        taskList.push({
          requestId: t.request_id,
          nodeId: t.node_id,
          nodeName: TASK_HUMAN_NAMES[t.node_id] || t.node_name,
          request: req,
          customer: cust,
          vehicle: veh,
          vehicleType: prefVehicleType,
          targetScreenUrl: NODE_TO_SCREEN_MAP[t.node_id] || `/nv/01`,
        });
      }
      setTasks(taskList);
    } catch (err) {
      console.error('Lỗi tải danh sách việc cần làm:', err);
    } finally {
      setLoading(false);
    }
  }, [isManager]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredTasks = tasks.filter((item) => {
    const matchesSearch =
      searchQuery === '' ||
      item.requestId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.customer?.phone?.includes(searchQuery) ||
      item.nodeName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterType === 'all') return true;
    if (filterType === 'pre_inspect') return item.nodeId === 'M_InspectPre' || item.nodeId === 'M_Rework';
    if (filterType === 'handover') return item.nodeId === 'M_Photo' || item.nodeId === 'M_Handover';
    if (filterType === 'return') return item.nodeId === 'M_ReceiveReturn' || item.nodeId === 'M_CheckReturn' || item.nodeId === 'M_VerifyDamage';
    if (filterType === 'settle') return item.nodeId === 'M_ManualExtra' || item.nodeId === 'M_CheckReady';
    if (filterType === 'incident') return item.nodeId === 'SC_Log' || item.nodeId === 'SC_Escalate';

    return true;
  });

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Tiêu đề & Làm mới */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.STAFF_TASKS}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          loading={loading}
          title="Làm mới danh sách"
        >
          <RotateCcw className="w-4 h-4 mr-1.5" />
          <span>Làm mới</span>
        </Button>
      </div>

      {/* Tìm kiếm & Bộ lọc */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="sm:col-span-8">
          <Input
            placeholder="Tìm đơn, khách, SĐT"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="w-4 h-4 text-slate-400" />}
          />
        </div>
        <div className="sm:col-span-4">
          <Select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            options={[
              { value: 'all', label: `Tất cả (${tasks.length})` },
              { value: 'pre_inspect', label: 'Kiểm tra xe' },
              { value: 'handover', label: 'Bàn giao xe' },
              { value: 'return', label: 'Nhận xe trả' },
              { value: 'settle', label: 'Quyết toán' },
              { value: 'incident', label: 'Sự cố' },
            ]}
          />
        </div>
      </div>

      {/* Danh sách nhiệm vụ */}
      {filteredTasks.length === 0 ? (
        <EmptyState
          title={COPY.EMPTY.NO_TASKS}
          description="Hiện tại không có công việc nào chờ xử lý. Hệ thống sẽ tự động cập nhật khi khách hàng tạo đơn mới."
        />
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const req = task.request;
            const cust = task.customer;
            const veh = task.vehicle;

            return (
              <Card
                key={`${task.requestId}-${task.nodeId}`}
                className="p-4 md:p-5 border border-slate-200 bg-white rounded-xl hover:border-slate-300 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  {/* Ảnh xe và thông tin cốt lõi */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-16 h-14 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 p-1">
                      <img
                        src={getVehicleImageUrl(veh?.model || task.vehicleType)}
                        alt={veh?.model || 'Xe'}
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-slate-900 truncate">
                          {task.nodeName}
                        </h2>
                        <StatusChip status="pending" label="Chờ kiểm tra" />
                      </div>

                      <p className="text-sm text-slate-700 truncate">
                        {cust?.full_name || 'Khách hàng'} · {veh ? `${veh.model} (${veh.plate})` : task.vehicleType}
                      </p>

                      {req?.start_at && (
                        <span className="text-[13px] text-slate-500 block">
                          Nhận: {COPY.FORMAT.DATE_TIME(req.start_at)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Đúng 1 nút hành động duy nhất */}
                  <div className="shrink-0">
                    <Button
                      variant="primary"
                      size="sm"
                      data-testid={`node-${task.nodeId}`}
                      onClick={() => navigate(`${task.targetScreenUrl}?requestId=${task.requestId}`)}
                      className="w-full sm:w-auto"
                    >
                      <span>Xử lý</span>
                      <ArrowRight className="w-4 h-4 ml-1.5" />
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

export default NV01Page;
