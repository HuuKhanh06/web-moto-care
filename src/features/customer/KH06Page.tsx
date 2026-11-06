// src/features/customer/KH06Page.tsx
// Màn hình chuyến đi của tôi (Khách hàng)

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  EmptyState,
  StatusChip,
  toast,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { COPY } from '@/copy';
import {
  Bike,
  PlusCircle,
  RotateCcw,
  Calendar,
  Wrench,
  KeyRound,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

interface EnrichedRequest {
  request: RentalRequest;
  vehicle?: Vehicle;
  processState?: {
    waiting_node_ids: string[];
  };
}

export function KH06Page() {
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [requests, setRequests] = useState<EnrichedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingReturnId, setProcessingReturnId] = useState<string | null>(null);
  const [filterTab, setFilterTab] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'DONE'>('ALL');

  const loadRequests = useCallback(async () => {
    if (!currentActor) return;
    setLoading(true);
    try {
      const list = await db.rental_requests
        .where('customer_id')
        .equals(currentActor.id)
        .reverse()
        .sortBy('created_at');

      const enriched: EnrichedRequest[] = [];
      for (const req of list) {
        let veh: Vehicle | undefined;
        if (req.vehicle_id) {
          veh = await db.vehicles.get(req.vehicle_id);
        }
        const pState = await db.process_state.get(req.id);
        enriched.push({ request: req, vehicle: veh, processState: pState });
      }
      setRequests(enriched);
    } catch (err) {
      console.error('Lỗi khi tải danh sách chuyến đi:', err);
    } finally {
      setLoading(false);
    }
  }, [currentActor]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleReturnVehicle = async (requestId: string) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn kết thúc chuyến đi và yêu cầu trả xe?')) {
      return;
    }

    setProcessingReturnId(requestId);
    try {
      await engine.complete(
        requestId,
        'M_EG',
        { event_type: 'RETURN' },
        currentActor
      );

      toast.success('Đã gửi yêu cầu trả xe. Kỹ thuật viên sẽ hỗ trợ kiểm tra xe ngay.');
      await loadRequests();
    } catch (err: unknown) {
      console.error('Lỗi khi yêu cầu trả xe:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu trả xe');
    } finally {
      setProcessingReturnId(null);
    }
  };

  const filteredRequests = requests.filter(({ request: req }) => {
    if (filterTab === 'ACTIVE') {
      return ['DANG_THUE', 'DANG_GIA_HAN', 'DANG_XU_LY_SU_CO'].includes(req.status);
    }
    if (filterTab === 'PENDING') {
      return [
        'MOI',
        'CHO_HO_SO',
        'CHO_COC',
        'CHO_KY',
        'CHO_BAN_GIAO',
        'CHO_KHACH_NHAN',
        'CHO_NHAN_XE_TRA',
        'CHO_KHACH_XAC_NHAN_BANG_KE',
        'CHO_THU_THEM',
        'CONG_NO',
      ].includes(req.status);
    }
    if (filterTab === 'DONE') {
      return ['HOAN_TAT', 'DA_HUY', 'TU_CHOI'].includes(req.status);
    }
    return true;
  });

  const getStatusDisplay = (req: RentalRequest) => {
    if (req.status === 'DANG_THUE') return { status: 'success' as const, label: COPY.STATUS.ACTIVE };
    if (req.status === 'HOAN_TAT') return { status: 'success' as const, label: COPY.STATUS.DONE };
    if (req.status === 'TU_CHOI' || req.status === 'DA_HUY') return { status: 'error' as const, label: 'Đã kết thúc' };
    if (req.status === 'DANG_GIA_HAN') return { status: 'pending' as const, label: 'Đang gia hạn' };
    if (req.status === 'DANG_XU_LY_SU_CO') return { status: 'pending' as const, label: 'Đang hỗ trợ sự cố' };
    if (req.status === 'CHO_KHACH_NHAN') return { status: 'pending' as const, label: 'Chờ nhận xe' };
    if (req.status === 'CHO_COC') return { status: 'pending' as const, label: 'Chờ đặt cọc' };
    if (req.status === 'CHO_KY') return { status: 'pending' as const, label: 'Chờ ký số' };
    return { status: 'pending' as const, label: COPY.STATUS.PENDING };
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6 pb-24 md:pb-8">
      {/* Tiêu đề & Nút thuê xe mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            {COPY.TITLES.TRIPS}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            title="Làm mới danh sách"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Làm mới</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/kh/01')}
          >
            <PlusCircle className="w-4 h-4 mr-1.5" />
            <span>Thuê xe mới</span>
          </Button>
        </div>
      </div>

      {/* Tabs lọc trạng thái */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setFilterTab('ALL')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 cursor-pointer ${
            filterTab === 'ALL'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Tất cả ({requests.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('ACTIVE')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 cursor-pointer ${
            filterTab === 'ACTIVE'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Đang thuê (
          {
            requests.filter((r) =>
              ['DANG_THUE', 'DANG_GIA_HAN', 'DANG_XU_LY_SU_CO'].includes(r.request.status)
            ).length
          }
          )
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('PENDING')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 cursor-pointer ${
            filterTab === 'PENDING'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Chờ xử lý (
          {
            requests.filter((r) =>
              [
                'MOI',
                'CHO_HO_SO',
                'CHO_COC',
                'CHO_KY',
                'CHO_BAN_GIAO',
                'CHO_KHACH_NHAN',
                'CHO_NHAN_XE_TRA',
                'CHO_KHACH_XAC_NHAN_BANG_KE',
                'CHO_THU_THEM',
                'CONG_NO',
              ].includes(r.request.status)
            ).length
          }
          )
        </button>
        <button
          type="button"
          onClick={() => setFilterTab('DONE')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors shrink-0 cursor-pointer ${
            filterTab === 'DONE'
              ? 'bg-teal-700 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Lịch sử (
          {
            requests.filter((r) =>
              ['HOAN_TAT', 'DA_HUY', 'TU_CHOI'].includes(r.request.status)
            ).length
          }
          )
        </button>
      </div>

      {/* Danh sách các chuyến đi */}
      {loading ? (
        <div className="py-16 text-center text-slate-500">
          <Bike className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
          <span className="text-sm font-normal">Đang tải danh sách chuyến đi...</span>
        </div>
      ) : filteredRequests.length === 0 ? (
        <EmptyState
          title={COPY.EMPTY.NO_TRIPS}
          description="Bạn chưa có chuyến đi nào trong danh mục này. Hãy đặt xe ngay để trải nghiệm nhé!"
          action={{
            label: COPY.ACTIONS.SELECT_VEHICLE,
            onClick: () => navigate('/kh/01'),
          }}
        />
      ) : (
        <div className="space-y-4">
          {filteredRequests.map(({ request: req, vehicle, processState: pState }) => {
            const isUnderRentalEvent = [
              'DANG_THUE',
              'DANG_GIA_HAN',
              'DANG_XU_LY_SU_CO',
            ].includes(req.status);
            const isExtending = req.status === 'DANG_GIA_HAN';
            const isIncident = req.status === 'DANG_XU_LY_SU_CO';
            const statusInfo = getStatusDisplay(req);

            return (
              <Card
                key={req.id}
                className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4"
              >
                {/* Header thẻ: Tên xe, biển số, chip trạng thái */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    {vehicle ? (
                      <div className="w-14 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                        <img
                          src={getVehicleImageUrl(vehicle.model)}
                          alt={vehicle.model}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                        <Bike className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <h2 className="text-base font-semibold text-slate-900">
                        {vehicle?.model || 'Đang chọn phương tiện'}
                      </h2>
                      {vehicle?.plate && (
                        <span className="text-[13px] font-mono font-medium text-slate-500">
                          {vehicle.plate}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusChip status={statusInfo.status} label={statusInfo.label} />
                  </div>
                </div>

                {/* Chi tiết lịch trình và giá */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <span className="text-[13px] text-slate-500 block">Thời gian thuê:</span>
                    <p className="text-slate-800 font-medium">
                      {formatDateTime(req.start_at)} — {formatDateTime(req.end_at)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[13px] text-slate-500 block">Tổng tiền / Đã cọc:</span>
                    <p className="text-slate-900 font-semibold">
                      {req.total_price ? formatCurrency(req.total_price) : '0 ₫'} ·{' '}
                      <span className="text-teal-700">
                        Cọc: {req.deposit_amount ? formatCurrency(req.deposit_amount) : '0 ₫'}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Thông báo nếu xe hết hoặc bị từ chối */}
                {req.status === 'TU_CHOI' && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      {req.closed_reason === 'HET_XE'
                        ? 'Rất tiếc dòng xe này vừa hết. Quý khách vui lòng chọn dòng xe khác nhé.'
                        : 'Yêu cầu thuê chưa thể hoàn tất. Quý khách có thể tạo đơn thuê mới bất cứ lúc nào.'}
                    </span>
                  </div>
                )}

                {/* KHU VỰC HÀNH ĐỘNG */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {isUnderRentalEvent ? (
                    <div className="w-full space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {/* 1. Nút Gia hạn hợp đồng */}
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="node-M_CatchExtend"
                            disabled={isIncident}
                            onClick={() => navigate(`/kh/07?requestId=${req.id}`)}
                          >
                            <Calendar className="w-4 h-4 mr-1.5 text-teal-600" />
                            <span>{isExtending ? 'Tiến trình gia hạn' : 'Gia hạn xe'}</span>
                          </Button>

                          {/* 2. Nút Báo sự cố khẩn cấp */}
                          <Button
                            variant="outline"
                            size="sm"
                            data-testid="node-M_CatchIncident"
                            disabled={isExtending}
                            onClick={() => navigate(`/kh/08?requestId=${req.id}`)}
                          >
                            <Wrench className="w-4 h-4 mr-1.5 text-amber-600" />
                            <span>{isIncident ? 'Theo dõi cứu hộ' : 'Báo sự cố'}</span>
                          </Button>
                        </div>

                        {/* 3. Nút Trả xe */}
                        <Button
                          variant="primary"
                          size="sm"
                          data-testid="node-M_CatchReturn"
                          disabled={isExtending || isIncident || processingReturnId === req.id}
                          loading={processingReturnId === req.id}
                          onClick={() => handleReturnVehicle(req.id)}
                        >
                          <KeyRound className="w-4 h-4 mr-1.5" />
                          <span>Trả xe</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-end gap-2">
                      {req.status === 'CHO_HO_SO' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/02?requestId=${req.id}`)}
                        >
                          <span>Nộp hồ sơ</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}

                      {req.status === 'CHO_COC' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/03?requestId=${req.id}`)}
                        >
                          <span>Đặt cọc</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}

                      {req.status === 'CHO_KY' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/04?requestId=${req.id}`)}
                        >
                          <span>Ký hợp đồng</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}

                      {req.status === 'CHO_KHACH_NHAN' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/05?requestId=${req.id}`)}
                        >
                          <span>Nhận xe</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}

                      {pState?.waiting_node_ids?.includes('M_ConfirmRefund') && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/10?requestId=${req.id}`)}
                        >
                          <span>Nhận hoàn cọc</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}

                      {req.status === 'CHO_KHACH_XAC_NHAN_BANG_KE' &&
                        !pState?.waiting_node_ids?.includes('M_ConfirmRefund') && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate(`/kh/09?requestId=${req.id}`)}
                          >
                            <span>Xem bảng kê</span>
                            <ArrowRight className="w-4 h-4 ml-1.5" />
                          </Button>
                        )}

                      {req.status === 'CHO_THU_THEM' && (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/kh/10?requestId=${req.id}`)}
                        >
                          <span>Thanh toán thêm</span>
                          <ArrowRight className="w-4 h-4 ml-1.5" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
