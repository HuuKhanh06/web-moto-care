// src/features/customer/KH01Page.tsx
// Màn hình 1: Chọn dòng xe & Thời gian thuê

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { findAvailableVehicle, rentalDays } from '@/engine/fleet';
import { db } from '@/db';
import {
  Card,
  Button,
  Input,
  toast,
  BookingProgress,
  StickyBottomBar,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getAssetUrl } from '@/lib/vehicleImages';
import {
  Bike,
  ArrowRight,
  Calendar,
  Check,
} from 'lucide-react';
import { COPY } from '@/copy';

const VEHICLE_OPTIONS = [
  {
    id: 'xe_so',
    title: 'Xe số',
    models: 'Wave Alpha, Sirius 110cc',
    tag: 'Tiết kiệm xăng',
    image: 'images/vehicles/honda-wave-alpha.png',
  },
  {
    id: 'tay_ga',
    title: 'Xe tay ga',
    models: 'Vision, Air Blade 125cc',
    tag: 'Phổ biến nhất',
    image: 'images/vehicles/honda-vision.jpg',
  },
  {
    id: 'xe_con',
    title: 'Xe côn tay',
    models: 'Winner X, Exciter 155cc',
    tag: 'Mạnh mẽ',
    image: 'images/vehicles/honda-winner-x.png',
  },
];

const isVehicleType = (value: string | null): value is string => VEHICLE_OPTIONS.some((option) => option.id === value);

export function KH01Page() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentActor = useAuthStore((s) => s.currentActor);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(18, 0, 0, 0);

  const toInputDate = (d: Date) => d.toISOString().slice(0, 16);

  const paramType = searchParams.get('vehicleType') || searchParams.get('type');
  const paramStart = searchParams.get('startAt');
  const paramEnd = searchParams.get('endAt');

  // Vào từ menu "Dòng xe" (?vehicleType=...): chỉ hiện dòng xe đó. Không có tham số: hiện đủ 3 dòng.
  const typeFromUrl = isVehicleType(paramType) ? paramType : null;
  const [vehicleType, setVehicleType] = useState(typeFromUrl || 'tay_ga');

  // Đang ở KH-01 mà chọn dòng khác trên menu: URL đổi nhưng component không mount lại, nên phải đồng bộ.
  useEffect(() => {
    if (typeFromUrl) setVehicleType(typeFromUrl);
  }, [typeFromUrl]);

  const visibleOptions = typeFromUrl ? VEHICLE_OPTIONS.filter((option) => option.id === typeFromUrl) : VEHICLE_OPTIONS;

  const showAllTypes = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('vehicleType');
    next.delete('type');
    setSearchParams(next, { replace: true });
  };

  // Các mẫu xe thực có trong kho thuộc dòng đang lọc (hệ thống tự phân bổ một xe sẵn sàng khi gửi yêu cầu).
  const fleetModels = useLiveQuery(async () => {
    if (!typeFromUrl) return [];
    const vehicles = await db.vehicles.where('vehicle_type').equals(typeFromUrl).toArray();
    const byModel = new Map<string, { model: string; available: number; total: number; minPrice: number }>();
    for (const vehicle of vehicles) {
      const entry = byModel.get(vehicle.model) ?? { model: vehicle.model, available: 0, total: 0, minPrice: vehicle.daily_price };
      entry.total += 1;
      if (vehicle.status === 'SAN_SANG') entry.available += 1;
      entry.minPrice = Math.min(entry.minPrice, vehicle.daily_price);
      byModel.set(vehicle.model, entry);
    }
    return [...byModel.values()].sort((a, b) => a.minPrice - b.minPrice || a.model.localeCompare(b.model));
  }, [typeFromUrl]);
  const [startAt, setStartAt] = useState(paramStart || toInputDate(tomorrow));
  const [endAt, setEndAt] = useState(paramEnd || toInputDate(dayAfter));
  const [hasCccd, setHasCccd] = useState(true);
  const [hasGplx, setHasGplx] = useState(true);
  const [loading, setLoading] = useState(false);

  const startMs = new Date(startAt).getTime();
  const endMs = new Date(endAt).getTime();
  const validRange = Number.isFinite(startMs) && Number.isFinite(endMs) && startMs < endMs;
  const diffDays = validRange ? rentalDays(startMs, endMs) : 1;

  // Giá "từ" của mỗi dòng = giá thấp nhất trong kho (ưu tiên xe đang sẵn sàng). Tự cập nhật khi admin đổi giá.
  const fromPrices = useLiveQuery(async () => {
    const vehicles = await db.vehicles.toArray();
    const prices: Record<string, number | null> = {};
    for (const option of VEHICLE_OPTIONS) {
      const ofType = vehicles.filter((v) => v.vehicle_type === option.id);
      const pool = ofType.some((v) => v.status === 'SAN_SANG') ? ofType.filter((v) => v.status === 'SAN_SANG') : ofType;
      prices[option.id] = pool.length ? Math.min(...pool.map((v) => v.daily_price)) : null;
    }
    return prices;
  }, []);

  // Xe mà engine sẽ gán cho khung giờ này (cùng quy tắc M_CheckFleet) → giá ước tính khớp báo giá ở KH-02.
  // undefined = đang tải, null = hết xe trong khung giờ.
  const predictedVehicle = useLiveQuery(
    async () => (validRange ? findAvailableVehicle(startMs, endMs, vehicleType) : null),
    [startMs, endMs, vehicleType, validRange],
  );
  const estimatedPrice = predictedVehicle ? predictedVehicle.daily_price * diffDays : null;
  const estimateText = predictedVehicle === undefined ? 'Đang tính…' : estimatedPrice === null ? 'Hết xe' : formatCurrency(estimatedPrice);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập để tiếp tục');
      navigate('/login');
      return;
    }

    if (new Date(startAt) >= new Date(endAt)) {
      toast.warning('Thời gian trả xe phải sau thời gian nhận xe');
      return;
    }

    setLoading(true);
    try {
      const requestId = await engine.start(currentActor, {
        customer_id: currentActor.id,
        vehicle_type: vehicleType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      });

      const request = await db.rental_requests.get(requestId);
      if (request?.status === 'TU_CHOI' && request?.closed_reason === 'HET_XE') {
        toast.error('Rất tiếc! Đã hết xe sẵn sàng trong khung giờ bạn chọn.');
        navigate('/kh/06');
        return;
      }

      navigate(`/kh/02?requestId=${requestId}`);
    } catch (err: unknown) {
      console.error('Lỗi khi gửi yêu cầu thuê:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi xảy ra khi gửi yêu cầu';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* 4 Bước tiến trình thương mại */}
      <BookingProgress currentStep={1} />

      {/* Tiêu đề trang (1-3 từ, không phụ đề) */}
      <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
        {COPY.TITLES.HOME}
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Chọn dòng xe */}
        <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-teal-700 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900">
                {typeFromUrl ? visibleOptions[0].title : 'Chọn dòng xe'}
              </h2>
            </div>
            {typeFromUrl && (
              <button
                type="button"
                onClick={showAllTypes}
                className="text-sm font-semibold text-teal-700 hover:text-teal-800 hover:underline"
              >
                Xem tất cả dòng xe
              </button>
            )}
          </div>

          <div className={`grid grid-cols-1 gap-3 ${typeFromUrl ? '' : 'sm:grid-cols-3'}`}>
            {visibleOptions.map((option) => ({ ...option, image: getAssetUrl(option.image) })).map((item) => {
              const isSelected = vehicleType === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setVehicleType(item.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 select-none flex flex-col justify-between ${
                    isSelected
                      ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-base">{item.title}</span>
                      <p className="text-[13px] text-slate-500 mt-0.5 line-clamp-1">{item.models}</p>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-teal-600 text-white' : 'border border-slate-300'
                      }`}
                    >
                      {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </div>
                  </div>

                  <div className={`${typeFromUrl ? 'h-40' : 'h-24'} my-3 flex items-center justify-center overflow-hidden`}>
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="font-semibold text-teal-700 text-base">
                      {fromPrices === undefined
                        ? '…'
                        : fromPrices[item.id] == null
                          ? 'Tạm hết xe'
                          : `Từ ${formatCurrency(fromPrices[item.id])}`}
                    </span>
                    <span className="text-[13px] text-slate-500">/ ngày</span>
                  </div>
                </div>
              );
            })}
          </div>

          {typeFromUrl && fleetModels && fleetModels.length > 0 && (
            <div className="space-y-2" data-testid="kh01-fleet-models">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-semibold text-slate-900">Các mẫu xe trong dòng này</h3>
                <span className="text-[13px] text-slate-500">
                  {fleetModels.reduce((sum, m) => sum + m.available, 0)} xe sẵn sàng
                </span>
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {fleetModels.map((m) => (
                  <li key={m.model} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{m.model}</p>
                      <p className={`text-[13px] ${m.available > 0 ? 'text-emerald-700' : 'text-slate-400'}`}>
                        {m.available > 0 ? `Còn ${m.available}/${m.total} xe` : 'Tạm hết xe'}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-slate-700 shrink-0">
                      từ {formatCurrency(m.minPrice)}/ngày
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[13px] text-slate-500">
                Hệ thống tự phân bổ một xe sẵn sàng thuộc dòng này khi bạn gửi yêu cầu.
              </p>
            </div>
          )}
        </Card>

        {/* 2. Thời gian thuê */}
        <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700 shrink-0" />
              <h2 className="text-lg font-semibold text-slate-900">Thời gian thuê</h2>
            </div>
            <span className="text-sm font-semibold text-slate-700">
              Tổng số ngày: <strong className="text-teal-700 font-semibold">{diffDays} ngày</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Thời gian nhận xe"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              required
            />

            <Input
              label="Thời gian trả xe dự kiến"
              type="datetime-local"
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              required
            />
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-sm" data-testid="kh01-estimate">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Tổng tiền thuê ước tính ({diffDays} ngày):</span>
              <span className={`font-semibold text-lg ${estimatedPrice === null && predictedVehicle !== undefined ? 'text-rose-600' : 'text-slate-900'}`}>
                {estimateText}
              </span>
            </div>
            {predictedVehicle && (
              <p className="text-[13px] text-slate-500">
                Dự kiến xe {predictedVehicle.model} · {formatCurrency(predictedVehicle.daily_price)}/ngày
              </p>
            )}
            {predictedVehicle === null && validRange && (
              <p className="text-[13px] text-rose-600">
                Dòng xe này đã hết xe trống trong khung giờ đã chọn. Vui lòng đổi thời gian hoặc dòng xe khác.
              </p>
            )}
          </div>
        </Card>

        {/* 3. Giấy tờ định danh */}
        <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Giấy tờ cần chuẩn bị</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasCccd}
                onChange={(e) => setHasCccd(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block text-sm">Căn cước công dân (CCCD)</span>
                <span className="text-slate-500 text-[13px] block mt-0.5">
                  Chụp 2 mặt để hoàn tất hợp đồng số
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 bg-white cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hasGplx}
                onChange={(e) => setHasGplx(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block text-sm">Bằng lái xe (A1 / A2)</span>
                <span className="text-slate-500 text-[13px] block mt-0.5">
                  Bằng lái xe máy hợp lệ còn hạn
                </span>
              </div>
            </label>
          </div>
        </Card>

        {/* Nút hành động Desktop */}
        <div className="hidden md:flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            data-testid="node-M_START"
            className="flex items-center gap-2 px-8 min-w-[200px]"
          >
            <span>{COPY.ACTION.CONTINUE}</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Sticky CTA trên Mobile */}
        <StickyBottomBar className="md:hidden">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[13px] text-slate-500">Ước tính ({diffDays} ngày):</div>
              <div className="text-lg font-semibold text-slate-900">
                {estimateText}
              </div>
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={loading}
              data-testid="node-M_START"
              className="flex items-center gap-2 min-w-[140px]"
            >
              <span>{COPY.ACTION.CONTINUE}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </StickyBottomBar>
      </form>
    </div>
  );
}
