// src/features/customer/KH06Page.tsx
// Màn hình KH-06: Yêu cầu thuê của tôi (Trang chủ Khách hàng)
// Hiển thị danh sách đơn thuê, thông báo từ chối hết xe (M_RejectNoVehicle),
// và 3 nút sự kiện BPMN khi đang thuê (M_EG) với khóa tương hỗ (chỉ một sự kiện hoạt động).

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle } from '@/db/types';
import {
  Card,
  Button,
  Badge,
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
  Bike,
  PlusCircle,
  RotateCcw,
  ArrowRight,
  AlertTriangle,
  Calendar,
  Wrench,
  KeyRound,
  CheckCircle2,
  Clock,
  ShieldAlert,
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
      console.error('Lỗi khi tải danh sách đơn thuê:', err);
    } finally {
      setLoading(false);
    }
  }, [currentActor]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Xử lý sự kiện trả xe tại cổng M_EG
  const handleReturnVehicle = async (requestId: string) => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!window.confirm('Bạn có chắc chắn muốn yêu cầu trả xe và tiến hành đối soát, quyết toán hợp đồng?')) {
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

      toast.success('Đã gửi yêu cầu trả xe! Nhân viên sẽ tiến hành kiểm tra phương tiện.');
      await loadRequests();
    } catch (err: unknown) {
      console.error('Lỗi khi yêu cầu trả xe:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể kích hoạt yêu cầu trả xe');
    } finally {
      setProcessingReturnId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              KH-06
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Yêu cầu thuê của tôi</h1>
          </div>
          <p className="text-sm text-slate-500">
            Theo dõi tiến trình các hợp đồng thuê xe máy và quản lý các sự kiện quy trình (Cổng sự kiện M_EG).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadRequests}
            loading={loading}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="w-4 h-4" />
            Làm mới
          </Button>

          <Button
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white font-semibold shadow-sm"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Thuê xe mới</span>
          </Button>
        </div>
      </div>

      {/* Danh sách các yêu cầu thuê */}
      {requests.length === 0 ? (
        <Card className="p-8 border-slate-200">
          <EmptyState
            title="Bạn chưa có yêu cầu thuê xe nào"
            description="Hãy bắt đầu hành trình của bạn bằng cách gửi yêu cầu thuê xe mới với thủ tục trực tuyến nhanh chóng."
            actionLabel="Đặt xe ngay"
            onAction={() => navigate('/kh/01')}
            icon={<Bike className="w-8 h-8 text-brand-600" />}
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map(({ request: req, vehicle: veh, processState: pState }) => {
            const isRejectedNoVehicle =
              req.status === 'TU_CHOI' && req.closed_reason === 'HET_XE';
            const isRenting = req.status === 'DANG_THUE';
            const isExtending = req.status === 'DANG_GIA_HAN';
            const isIncident = req.status === 'DANG_XU_LY_SU_CO';
            const isUnderRentalEvent = isRenting || isExtending || isIncident;

            return (
              <Card
                key={req.id}
                className={`p-5 border transition-all ${
                  isRejectedNoVehicle
                    ? 'border-red-200 bg-red-50/20'
                    : isRenting
                    ? 'border-brand-300 bg-brand-50/15 shadow-sm'
                    : isExtending
                    ? 'border-blue-300 bg-blue-50/20'
                    : isIncident
                    ? 'border-amber-300 bg-amber-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Header đơn */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      #{req.id.slice(0, 8)}
                    </span>
                    <Badge variant={getStatusBadgeVariant(req.status)} size="md">
                      {getStatusLabel(req.status)}
                    </Badge>
                  </div>

                  <span className="text-xs text-slate-500">
                    Thời gian tạo: {formatDateTime(req.start_at)}
                  </span>
                </div>

                {/* Thông báo nếu bị từ chối do hết xe (M_RejectNoVehicle) */}
                {isRejectedNoVehicle && (
                  <div className="my-3 p-3 bg-red-50 rounded-xl border border-red-200 flex items-start gap-2 text-xs text-red-800">
                    <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Từ chối tiếp nhận (Hết xe phù hợp):</strong> Hệ thống tự động kiểm tra lịch xe tại cổng <code className="font-mono font-bold">M_G01</code> và phát hiện tạm thời không còn xe sẵn sàng trong khung giờ bạn yêu cầu. Vui lòng chọn khung giờ khác hoặc đổi phân khúc xe.
                    </div>
                  </div>
                )}

                {/* Chi tiết xe & thời gian */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 py-3 text-xs">
                  <div>
                    <span className="text-slate-500 block">Phương tiện thuê:</span>
                    <strong className="text-slate-900 text-sm flex items-center gap-1.5 mt-0.5">
                      <Bike className="w-4 h-4 text-brand-600" />
                      {veh ? `${veh.model} (${veh.plate})` : 'Chưa phân bổ xe'}
                    </strong>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Thời gian thuê:</span>
                    <div className="text-slate-800 mt-0.5">
                      {formatDateTime(req.start_at)} &rarr; {formatDateTime(req.end_at)}
                    </div>
                  </div>

                  <div>
                    <span className="text-slate-500 block">Tổng tiền / Tiền cọc:</span>
                    <div className="text-slate-900 font-bold mt-0.5">
                      {req.total_price ? formatCurrency(req.total_price) : 'Chưa dự toán'} /{' '}
                      <span className="text-amber-700">
                        {req.deposit_amount ? formatCurrency(req.deposit_amount) : '0 ₫'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* KHU VỰC HÀNH ĐỘNG DỰA TRÊN TRẠNG THÁI HIỆN TẠI */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  {/* Trường hợp ĐANG THUÊ / GIA HẠN / SỰ CỐ (Cổng sự kiện M_EG: 3 nút với khóa tương hỗ) */}
                  {isUnderRentalEvent ? (
                    <div className="w-full space-y-3">
                      <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-brand-600" />
                          <span>Hợp đồng đang có hiệu lực (Cổng sự kiện BPMN M_EG):</span>
                        </span>

                        {isExtending && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                            <Clock className="w-3 h-3 animate-spin" />
                            Đang xử lý gia hạn (SP1)
                          </span>
                        )}

                        {isIncident && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <ShieldAlert className="w-3 h-3" />
                            Đang xử lý sự cố cứu hộ (SP2)
                          </span>
                        )}
                      </div>

                      {/* Cảnh báo khóa tương hỗ (ngữ nghĩa exclusive của Event-Based Gateway) */}
                      {(isExtending || isIncident) && (
                        <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200">
                          * Theo quy trình BPMN, chỉ có 1 sự kiện được xử lý tại một thời điểm. Khi đang xử lý {isExtending ? 'gia hạn' : 'sự cố'}, các sự kiện khác tạm thời bị khóa.
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Nút Gia hạn hợp đồng (M_CatchExtend -> SP1) */}
                        <Button
                          variant={isExtending ? 'primary' : 'outline'}
                          size="sm"
                          data-testid="node-M_CatchExtend"
                          disabled={isIncident}
                          onClick={() => navigate(`/kh/07?requestId=${req.id}`)}
                          className={`flex items-center gap-1 text-xs ${
                            isExtending
                              ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                              : 'text-brand-800 border-brand-300 hover:bg-brand-50'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{isExtending ? 'Xem tiến trình Gia hạn (SP1)' : 'Gia hạn hợp đồng (SP1)'}</span>
                        </Button>

                        {/* 2. Nút Báo sự cố khẩn cấp (M_CatchIncident -> SP2) */}
                        <Button
                          variant={isIncident ? 'primary' : 'outline'}
                          size="sm"
                          data-testid="node-M_CatchIncident"
                          disabled={isExtending}
                          onClick={() => navigate(`/kh/08?requestId=${req.id}`)}
                          className={`flex items-center gap-1 text-xs ${
                            isIncident
                              ? 'bg-amber-600 hover:bg-amber-700 text-white font-bold'
                              : 'text-amber-800 border-amber-300 hover:bg-amber-50'
                          }`}
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>{isIncident ? 'Theo dõi Cứu hộ sự cố (SP2)' : 'Báo sự cố cứu hộ (SP2)'}</span>
                        </Button>

                        {/* 3. Nút Trả xe (M_CatchReturn -> NV-06) */}
                        <Button
                          size="sm"
                          data-testid="node-M_CatchReturn"
                          disabled={isExtending || isIncident || processingReturnId === req.id}
                          loading={processingReturnId === req.id}
                          onClick={() => handleReturnVehicle(req.id)}
                          className="flex items-center gap-1 text-xs ml-auto bg-slate-800 hover:bg-slate-900 text-white font-semibold"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Yêu cầu trả xe (M_CatchReturn)</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Các trạng thái đang chờ xử lý trước khi bàn giao hoặc sau trả xe */
                    <>
                      <div className="text-xs text-slate-500">
                        {req.status === 'CHO_HO_SO' && 'Cần tải giấy tờ định danh & xác nhận báo giá.'}
                        {req.status === 'CHO_COC' && 'Chờ thanh toán cọc 30% qua QR VietQR.'}
                        {req.status === 'CHO_KY' && 'Chờ ký hợp đồng điện tử trực tuyến.'}
                        {req.status === 'CHO_KHACH_NHAN' && 'Xe đã sẵn sàng, vui lòng xác nhận tình trạng.'}
                        {req.status === 'CHO_NHAN_XE_TRA' && 'Đang chờ nhân viên nhận bàn giao xe trả lại.'}
                        {req.status === 'CHO_KHACH_XAC_NHAN_BANG_KE' && 'Đã có bảng kê thanh lý, vui lòng kiểm tra đối soát.'}
                        {req.status === 'CHO_THU_THEM' && 'Có khoản phí phát sinh cần thanh toán bổ sung.'}
                        {req.status === 'CONG_NO' && 'Hồ sơ ghi nhận công nợ chưa quyết toán.'}
                        {req.status === 'HOAN_TAT' && 'Hợp đồng thuê đã thanh lý và hoàn tất trọn vẹn.'}
                        {req.status === 'TU_CHOI' && 'Đơn thuê đã bị từ chối tiếp nhận.'}
                        {req.status === 'DA_HUY' && 'Đơn thuê đã bị hủy.'}
                      </div>

                      <div className="flex items-center gap-2">
                        {req.status === 'CHO_HO_SO' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/02?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Nộp hồ sơ (KH-02)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {req.status === 'CHO_COC' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/03?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Thanh toán cọc QR (KH-03)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {req.status === 'CHO_KY' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/04?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Ký hợp đồng (KH-04)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {req.status === 'CHO_KHACH_NHAN' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/05?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Xác nhận nhận xe (KH-05)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {pState?.waiting_node_ids?.includes('M_ConfirmRefund') && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/10?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Nhận tiền hoàn cọc (KH-10)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {req.status === 'CHO_KHACH_XAC_NHAN_BANG_KE' && !pState?.waiting_node_ids?.includes('M_ConfirmRefund') && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/09?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Xem bảng kê thanh lý (KH-09)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {req.status === 'CHO_THU_THEM' && (
                          <Button
                            size="sm"
                            onClick={() => navigate(`/kh/10?requestId=${req.id}`)}
                            className="flex items-center gap-1 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                          >
                            <span>Thanh toán bổ sung (KH-10)</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </>
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
