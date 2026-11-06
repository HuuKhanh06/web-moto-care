// src/components/timeline/FleetTimeline.tsx
// Sơ đồ xe trực quan dạng Gantt Chart theo ngày giờ - Kế thừa phong cách chuẩn từ GOODBIKE
// Hỗ trợ hiển thị xe thật, dòng xe đệm ảo DUMP, thanh booking màu sắc theo trạng thái BPMN

import { useState, useEffect, useMemo } from 'react';
import {
  format,
  addDays,
  subDays,
  startOfDay,
  endOfDay,
  isSameDay,
} from 'date-fns';
import { vi } from 'date-fns/locale';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Plus,
  Bike,
  RefreshCw,
} from 'lucide-react';
import { dataAdapter } from '@/db/adapter';
import type { Vehicle, RentalRequest } from '@/db/types';
import { Button, Modal, Badge } from '@/components/ui';
import { formatCurrency } from '@/lib/format';

interface FleetTimelineProps {
  onSelectBooking?: (request: RentalRequest) => void;
  onCreateBookingForVehicle?: (vehicle: Vehicle, date: Date) => void;
}

export function FleetTimeline({
  onSelectBooking,
  onCreateBookingForVehicle,
}: FleetTimelineProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [rentals, setRentals] = useState<RentalRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Mặc định xem 7 ngày từ hôm nay (hoặc 14 ngày)
  const [viewDays, setViewDays] = useState<number>(7);
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Modal chi tiết booking
  const [inspectingRequest, setInspectingRequest] = useState<RentalRequest | null>(null);

  // Load dữ liệu qua DataAdapter
  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, rList] = await Promise.all([
        dataAdapter.getVehicles(),
        dataAdapter.getRentalRequests(),
      ]);

      // Bổ sung xe đệm DUMP1, DUMP2 nếu chưa có (học tập GOODBIKE)
      const hasDump = vList.some((v) => v.id.startsWith('dump_') || v.plate.includes('DUMP'));
      const finalVehicles = [...vList];
      if (!hasDump) {
        finalVehicles.push(
          {
            id: 'dump_1',
            plate: 'DUMP-01 (Đệm)',
            model: 'Xe điều phối tạm thời',
            vehicle_type: 'tay_ga',
            daily_price: 150000,
            status: 'SAN_SANG',
            condition_note: 'Dùng giữ chỗ khi đổi xe / sự cố',
          },
          {
            id: 'dump_2',
            plate: 'DUMP-02 (Đệm)',
            model: 'Xe điều phối tạm thời',
            vehicle_type: 'xe_so',
            daily_price: 120000,
            status: 'SAN_SANG',
            condition_note: 'Dùng giữ chỗ khi đổi xe / sự cố',
          }
        );
      }

      setVehicles(finalVehicles);
      setRentals(rList);
    } catch (err) {
      console.error('Error loading timeline data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const unsub = dataAdapter.subscribeMode(() => loadData());
    return unsub;
  }, []);

  // Danh sách các ngày trong phạm vi xem
  const dateColumns = useMemo(() => {
    const dates: Date[] = [];
    for (let i = 0; i < viewDays; i++) {
      dates.push(addDays(startDate, i));
    }
    return dates;
  }, [startDate, viewDays]);

  // Lọc xe theo phân loại
  const filteredVehicles = useMemo(() => {
    if (selectedType === 'ALL') return vehicles;
    return vehicles.filter((v) => v.vehicle_type === selectedType || v.id.startsWith('dump_'));
  }, [vehicles, selectedType]);

  // Màu sắc trạng thái thẻ booking theo BPMN
  const getBookingColor = (status: RentalRequest['status']) => {
    switch (status) {
      case 'DANG_THUE':
        return 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20';
      case 'CHO_COC':
      case 'CHO_KY':
      case 'CHO_BAN_GIAO':
        return 'bg-amber-500 text-slate-900 border-amber-600 shadow-amber-500/20';
      case 'DANG_XU_LY_SU_CO':
        return 'bg-rose-600 text-white border-rose-700 animate-pulse';
      case 'DANG_GIA_HAN':
        return 'bg-sky-500 text-white border-sky-600';
      case 'CHO_NHAN_XE_TRA':
      case 'CHO_KHACH_XAC_NHAN_BANG_KE':
        return 'bg-purple-600 text-white border-purple-700';
      case 'HOAN_TAT':
        return 'bg-slate-400 text-white border-slate-500 opacity-60';
      default:
        return 'bg-brand-600 text-white border-brand-700';
    }
  };

  const getStatusText = (status: RentalRequest['status']) => {
    const map: Record<string, string> = {
      MOI: 'Mới',
      CHO_HO_SO: 'Chờ hồ sơ',
      CHO_COC: 'Chờ cọc VietQR',
      CHO_KY: 'Chờ ký HĐ',
      CHO_BAN_GIAO: 'Chờ kiểm tra bàn giao',
      DANG_THUE: 'Đang lưu thông',
      DANG_GIA_HAN: 'Đang gia hạn',
      DANG_XU_LY_SU_CO: 'Sự cố SOS',
      CHO_NHAN_XE_TRA: 'Chờ nhận xe trả',
      CHO_KHACH_XAC_NHAN_BANG_KE: 'Chờ duyệt bảng kê',
      HOAN_TAT: 'Đã hoàn tất',
      DA_HUY: 'Đã hủy',
      TU_CHOI: 'Từ chối',
    };
    return map[status] || status;
  };

  // Tính toán vị trí phần trăm (left & width) của booking trên dải ngày
  const calculateBarPosition = (req: RentalRequest) => {
    const rangeStart = startOfDay(startDate).getTime();
    const rangeEnd = endOfDay(dateColumns[dateColumns.length - 1]).getTime();
    const totalMs = rangeEnd - rangeStart;

    const reqStart = Math.max(new Date(req.start_at).getTime(), rangeStart);
    const reqEnd = Math.min(new Date(req.end_at).getTime(), rangeEnd);

    if (reqEnd <= rangeStart || reqStart >= rangeEnd) {
      return null;
    }

    const leftPercent = ((reqStart - rangeStart) / totalMs) * 100;
    const widthPercent = Math.max(((reqEnd - reqStart) / totalMs) * 100, 1.5);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
    };
  };

  const DAY_WIDTH_PX = 140;
  const HEADER_VEHICLE_WIDTH = 220;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
      {/* 1. Header Toolbar */}
      <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-brand-50 text-brand-700 border border-brand-200">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800">Sơ đồ điều phối xe (Fleet Timeline)</h2>
            <p className="text-xs text-slate-500">
              Quản lý trạng thái rảnh/bận, luân chuyển xe đệm & hạn chế xung đột lịch
            </p>
          </div>
        </div>

        {/* Bộ lọc phân loại & Thời gian */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'xe_so', label: 'Xe số' },
              { id: 'tay_ga', label: 'Tay ga' },
              { id: 'xe_con', label: 'Xe côn' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedType(t.id)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedType === t.id
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center rounded-xl bg-white border border-slate-200 p-0.5">
            {[7, 14].map((d) => (
              <button
                key={d}
                onClick={() => setViewDays(d)}
                className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                  viewDays === d
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {d} ngày
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setStartDate((d) => subDays(d, viewDays === 7 ? 3 : 7))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"
              title="Lùi ngày"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setStartDate(startOfDay(new Date()))}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 font-semibold text-slate-700"
            >
              Hôm nay
            </button>
            <button
              onClick={() => setStartDate((d) => addDays(d, viewDays === 7 ? 3 : 7))}
              className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"
              title="Tiến ngày"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={loadData}
            className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600"
            title="Làm mới"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Timeline Grid Container (Scroll ngang) */}
      <div className="overflow-x-auto relative">
        <div style={{ minWidth: `${HEADER_VEHICLE_WIDTH + viewDays * DAY_WIDTH_PX}px` }}>
          {/* Header hàng ngày */}
          <div className="flex border-b border-slate-200 bg-slate-100/80 sticky top-0 z-20">
            <div
              className="p-3 font-bold text-xs uppercase tracking-wider text-slate-600 border-r border-slate-200 bg-slate-100 sticky left-0 z-30 flex items-center justify-between"
              style={{ width: `${HEADER_VEHICLE_WIDTH}px` }}
            >
              <span>Phương tiện ({filteredVehicles.length})</span>
              <Bike className="w-4 h-4 text-slate-400" />
            </div>

            {dateColumns.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              return (
                <div
                  key={idx}
                  className={`p-2.5 text-center border-r border-slate-200 font-medium ${
                    isToday ? 'bg-brand-50/70 border-b-2 border-b-brand-600' : ''
                  }`}
                  style={{ width: `${DAY_WIDTH_PX}px` }}
                >
                  <div className={`text-[11px] uppercase ${isToday ? 'text-brand-700 font-bold' : 'text-slate-500'}`}>
                    {format(day, 'EEEE', { locale: vi })}
                  </div>
                  <div className={`text-sm font-extrabold ${isToday ? 'text-brand-700' : 'text-slate-800'}`}>
                    {format(day, 'dd/MM')}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Body: Danh sách xe và các thanh booking */}
          <div className="divide-y divide-slate-100">
            {filteredVehicles.map((vehicle) => {
              const isDump = vehicle.id.startsWith('dump_') || vehicle.plate.includes('DUMP');
              const vehicleRentals = rentals.filter(
                (r) =>
                  r.vehicle_id === vehicle.id &&
                  !['DA_HUY', 'TU_CHOI'].includes(r.status)
              );

              return (
                <div
                  key={vehicle.id}
                  className={`flex group hover:bg-slate-50/60 transition-colors relative ${
                    isDump ? 'bg-amber-50/30' : ''
                  }`}
                >
                  {/* Cột thông tin xe (Sticky trái) */}
                  <div
                    className={`p-3 border-r border-slate-200 flex flex-col justify-center sticky left-0 z-10 transition-colors ${
                      isDump
                        ? 'bg-amber-50/90 border-l-4 border-l-amber-500'
                        : 'bg-white group-hover:bg-slate-50/90'
                    }`}
                    style={{ width: `${HEADER_VEHICLE_WIDTH}px` }}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {vehicle.plate}
                      </span>
                      {isDump ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">
                          ĐỆM ẢO
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                          {vehicle.vehicle_type === 'xe_so'
                            ? 'Xe số'
                            : vehicle.vehicle_type === 'tay_ga'
                            ? 'Tay ga'
                            : 'Xe côn'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">
                      {vehicle.model}
                    </div>
                    <div className="text-[10px] text-brand-700 font-semibold mt-0.5">
                      {formatCurrency(vehicle.daily_price)}/ngày
                    </div>
                  </div>

                  {/* Vùng Timeline cho xe này */}
                  <div
                    className="flex-1 relative flex h-16"
                    style={{ width: `${viewDays * DAY_WIDTH_PX}px` }}
                  >
                    {dateColumns.map((day, idx) => {
                      const isToday = isSameDay(day, new Date());
                      return (
                        <div
                          key={idx}
                          onClick={() => onCreateBookingForVehicle?.(vehicle, day)}
                          className={`border-r border-slate-100 h-full hover:bg-brand-50/30 transition-colors cursor-pointer group/cell relative ${
                            isToday ? 'bg-brand-50/20' : ''
                          }`}
                          style={{ width: `${DAY_WIDTH_PX}px` }}
                          title={`Click để tạo đơn cho xe ${vehicle.plate} ngày ${format(day, 'dd/MM/yyyy')}`}
                        >
                          <div className="hidden group-hover/cell:flex items-center justify-center h-full text-brand-400 opacity-60">
                            <Plus className="w-4 h-4" />
                          </div>
                        </div>
                      );
                    })}

                    {/* Các thanh Booking */}
                    {vehicleRentals.map((req) => {
                      const pos = calculateBarPosition(req);
                      if (!pos) return null;

                      const colorClasses = getBookingColor(req.status);

                      return (
                        <div
                          key={req.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectBooking) onSelectBooking(req);
                            else setInspectingRequest(req);
                          }}
                          style={{
                            left: pos.left,
                            width: pos.width,
                            top: '8px',
                            bottom: '8px',
                          }}
                          className={`absolute z-10 rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer border shadow-sm transition-all hover:scale-[1.01] hover:z-20 flex flex-col justify-center overflow-hidden ${colorClasses}`}
                        >
                          <div className="truncate font-bold leading-tight">
                            Đơn #{req.id.slice(-6).toUpperCase()}
                          </div>
                          <div className="text-[10px] opacity-90 truncate leading-tight mt-0.5">
                            {getStatusText(req.status)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 3. Chú thích màu sắc */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-bold text-slate-700">Chú giải:</span>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-emerald-600 inline-block" />
            <span>Đang thuê</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
            <span>Chờ cọc / Bàn giao</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-rose-600 inline-block" />
            <span>Sự cố SOS</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-purple-600 inline-block" />
            <span>Chờ trả / Quyết toán</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300 inline-block" />
            <span>Xe đệm ảo (DUMP)</span>
          </div>
        </div>
      </div>

      {/* 4. Modal Chi tiết */}
      {inspectingRequest && (
        <Modal
          isOpen={Boolean(inspectingRequest)}
          onClose={() => setInspectingRequest(null)}
          title={`Chi tiết đơn thuê #${inspectingRequest.id.slice(-8).toUpperCase()}`}
        >
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">Trạng thái BPMN:</div>
                <div className="text-sm font-bold text-slate-800">
                  {getStatusText(inspectingRequest.status)}
                </div>
              </div>
              <Badge variant="info">
                {inspectingRequest.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block mb-1">Thời gian bắt đầu:</span>
                <span className="font-semibold text-slate-800">
                  {format(new Date(inspectingRequest.start_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block mb-1">Thời gian dự kiến trả:</span>
                <span className="font-semibold text-slate-800">
                  {format(new Date(inspectingRequest.end_at), 'dd/MM/yyyy HH:mm')}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block mb-1">Tổng tiền thuê:</span>
                <span className="font-bold text-brand-700 text-sm">
                  {formatCurrency(inspectingRequest.total_price || 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <span className="text-slate-500 block mb-1">Tiền cọc:</span>
                <span className="font-bold text-slate-800">
                  {formatCurrency(inspectingRequest.deposit_amount || 0)}
                </span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectingRequest(null)}
              >
                Đóng
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  window.location.hash = `#/trace/${inspectingRequest.id}`;
                }}
              >
                Xem Dấu vết BPMN (/trace)
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
