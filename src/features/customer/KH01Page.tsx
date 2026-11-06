// src/features/customer/KH01Page.tsx
// Màn hình KH-01: Khởi tạo yêu cầu thuê (M_START, M_CheckFleet)

import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import {
  Card,
  Button,
  Input,
  Stepper,
  toast,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { CUSTOMER_RENTAL_STEPS } from './constants';
import { BpmnBadge } from '@/components/common/BpmnBadge';
import { useBpmnStore } from '@/features/bpmn/bpmnStore';
import {
  Bike,
  ArrowRight,
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export function KH01Page() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const currentActor = useAuthStore((s) => s.currentActor);
  const isBpmnMode = useBpmnStore((s) => s.isBpmnMode);

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

  const [vehicleType, setVehicleType] = useState(paramType || 'tay_ga');
  const [startAt, setStartAt] = useState(paramStart || toInputDate(tomorrow));
  const [endAt, setEndAt] = useState(paramEnd || toInputDate(dayAfter));
  const [hasCccd, setHasCccd] = useState(true);
  const [hasGplx, setHasGplx] = useState(true);
  const [loading, setLoading] = useState(false);

  const [simulateNoVehicle, setSimulateNoVehicle] = useState(false);

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));

  const basePriceMap: Record<string, number> = {
    xe_so: 120000,
    tay_ga: 160000,
    xe_con: 200000,
  };
  const estimatedPrice = (basePriceMap[vehicleType] || 150000) * diffDays;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập để tiếp tục');
      navigate('/login');
      return;
    }

    if (new Date(startAt) >= new Date(endAt)) {
      toast.warning('Thời gian trả xe phải sau thời gian nhận xe ít nhất vài giờ');
      return;
    }

    setLoading(true);
    try {
      let savedBackup: unknown[] = [];
      if (simulateNoVehicle) {
        const matchingVehicles = await db.vehicles.where('vehicle_type').equals(vehicleType).toArray();
        savedBackup = matchingVehicles.map(v => ({ id: v.id, status: v.status }));
        for (const v of matchingVehicles) {
          await db.vehicles.update(v.id, { status: 'BAO_TRI' });
        }
      }

      const requestId = await engine.start(currentActor, {
        customer_id: currentActor.id,
        vehicle_type: vehicleType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
      });

      if (simulateNoVehicle && savedBackup.length > 0) {
        for (const v of savedBackup as Array<{ id: string; status: 'SAN_SANG' | 'BAO_TRI' | 'DANG_THUE' }>) {
          await db.vehicles.update(v.id, { status: v.status });
        }
      }

      const request = await db.rental_requests.get(requestId);
      if (request?.status === 'TU_CHOI' && request?.closed_reason === 'HET_XE') {
        toast.error('Rất tiếc! Đã hết xe sẵn sàng trong khung giờ bạn chọn.');
        navigate('/kh/06');
        return;
      }

      toast.success('Yêu cầu thuê xe đã được tiếp nhận thành công!');
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
    <div className="space-y-6 max-w-3xl mx-auto pb-24 sm:pb-8 animate-in fade-in duration-300">
      {/* Stepper tiến trình khách hàng */}
      <Card className="p-4 border-slate-200/80 shadow-xs bg-white/90 backdrop-blur-md rounded-2xl">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={0} />
      </Card>

      {/* Tiêu đề & Giới thiệu phong cách Eco-Mobility */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70 shadow-2xs">
              Bước 1 &bull; Chọn xe &amp; Thời gian
            </span>
            <BpmnBadge nodeId="M_START" name="Khởi tạo yêu cầu" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Đặt thuê xe máy trực tuyến
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Lựa chọn phân khúc xe máy phù hợp và lịch trình nhận xe mong muốn
          </p>
        </div>
      </div>

      {/* Form đặt xe */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-6 border-slate-200/80 shadow-md space-y-6 rounded-3xl bg-white/90">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bike className="w-5 h-5 text-brand-600" />
              <span>1. Lựa chọn dòng xe</span>
            </h2>
            <span className="text-xs text-brand-700 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Đảm bảo 100% xe bảo dưỡng định kỳ
            </span>
          </div>

          {/* Chọn dòng xe Card Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              {
                id: 'xe_so',
                title: 'Xe số',
                models: 'Wave Alpha, Sirius FI 110cc',
                price: 120000,
                tag: 'Tiết kiệm xăng',
                desc: 'Phù hợp di chuyển linh hoạt, đi xa',
                image: '/images/vehicles/honda-wave-alpha.png',
              },
              {
                id: 'tay_ga',
                title: 'Xe tay ga',
                models: 'Vision, Air Blade 125cc',
                price: 160000,
                tag: 'Được chuộng nhất',
                desc: 'Êm ái, cốp rộng, dễ điều khiển',
                image: '/images/vehicles/honda-vision.jpg',
              },
              {
                id: 'xe_con',
                title: 'Xe côn tay',
                models: 'Winner X, Exciter 150cc',
                price: 200000,
                tag: 'Mạnh mẽ',
                desc: 'Động cơ thể thao, thích hợp phượt',
                image: '/images/vehicles/honda-winner-x.png',
              },
            ].map((item) => {
              const isSelected = vehicleType === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setVehicleType(item.id)}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/70 shadow-md shadow-brand-600/10 scale-[1.01]'
                      : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{item.models}</div>
                    </div>
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-brand-600 text-white flex items-center justify-center shrink-0">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300 shrink-0" />
                    )}
                  </div>

                  {/* Ảnh thực tế của dòng xe */}
                  <div className="h-28 my-2 rounded-xl bg-slate-50/80 flex items-center justify-center overflow-hidden p-2">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="h-full w-full object-contain filter drop-shadow-xs hover:scale-105 transition-transform"
                      loading="lazy"
                    />
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline justify-between">
                    <span className="font-extrabold text-brand-700 text-base">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-[11px] text-slate-400">/ ngày</span>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                      {item.tag}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Lịch trình thuê */}
        <Card className="p-6 border-slate-200/80 shadow-md space-y-5 rounded-3xl bg-white/90">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-600" />
              <span>2. Lịch trình thuê & Trả xe</span>
            </h2>
            <span className="text-xs text-slate-500 font-semibold">
              Tổng cộng: <strong className="text-brand-700">{diffDays} ngày</strong>
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

          <div className="p-4 rounded-2xl bg-brand-50/60 border border-brand-200/70 flex items-center justify-between text-xs sm:text-sm">
            <span className="text-slate-600">Dự tính chi phí thuê ({diffDays} ngày):</span>
            <span className="font-black text-lg text-brand-800">
              {formatCurrency(estimatedPrice)}
            </span>
          </div>
        </Card>

        {/* Giấy tờ định danh */}
        <Card className="p-6 border-slate-200/80 shadow-md space-y-4 rounded-3xl bg-white/90">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              <span>3. Chuẩn bị giấy tờ định danh</span>
            </h2>
            <span className="text-xs text-brand-700 font-semibold">Xác thực AI tự động</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-brand-50/30 hover:border-brand-300 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={hasCccd}
                onChange={(e) => setHasCccd(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-slate-800 block text-xs">Căn cước công dân (CCCD)</span>
                <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                  Chụp 2 mặt để hệ thống tự động điền thông tin hợp đồng
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl border border-slate-200 bg-white hover:bg-brand-50/30 hover:border-brand-300 cursor-pointer transition-all">
              <input
                type="checkbox"
                checked={hasGplx}
                onChange={(e) => setHasGplx(e.target.checked)}
                className="w-4 h-4 mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-bold text-slate-800 block text-xs">Giấy phép lái xe (GPLX A1/A2)</span>
                <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                  Bắt buộc còn hạn để đảm bảo điều kiện nhận xe
                </span>
              </div>
            </label>
          </div>

          {/* Tùy chọn test giả lập hết xe (chỉ hiển thị khi bật chế độ BPMN) */}
          {isBpmnMode && (
            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 text-xs text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={simulateNoVehicle}
                  onChange={(e) => setSimulateNoVehicle(e.target.checked)}
                  className="rounded text-red-600 focus:ring-red-500"
                />
                <span className="text-slate-500 text-[11px]">
                  Mô phỏng kịch bản hết xe sẵn sàng trong khung giờ chọn (Test BPMN M_CheckFleet: No)
                </span>
              </label>
            </div>
          )}
        </Card>

        {/* Nút gửi form Desktop */}
        <div className="hidden sm:flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            data-testid="node-M_START"
            className="flex items-center justify-center gap-2 px-8 shadow-md"
          >
            <span>Tiếp tục: Báo giá & Hồ sơ</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Sticky CTA Bottom Bar trên Mobile */}
        <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 z-40 shadow-2xl flex items-center justify-between gap-3">
          <div>
            <div className="text-[11px] text-slate-500">Ước tính ({diffDays} ngày):</div>
            <div className="text-base font-black text-brand-700">
              {formatCurrency(estimatedPrice)}
            </div>
          </div>
          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={loading}
            data-testid="node-M_START"
            className="flex items-center gap-1.5"
          >
            <span>Tiếp tục</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
