// src/features/customer/KH01Page.tsx
// Màn hình KH-01: Gửi yêu cầu thuê xe (M_START)
// Nâng cấp: Staggered Car Selection, Sticky Bottom Bar, Micro-interactions

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { VehicleStatus } from '@/db/types';
import {
  Card,
  Button,
  Input,
  Stepper,
  toast,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { CUSTOMER_RENTAL_STEPS } from './constants';
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
  const currentActor = useAuthStore((s) => s.currentActor);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const dayAfterTomorrow = new Date(tomorrow);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
  dayAfterTomorrow.setHours(18, 0, 0, 0);

  const formatForInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [vehicleType, setVehicleType] = useState<string>('xe_so');
  const [startAt, setStartAt] = useState<string>(formatForInput(tomorrow));
  const [endAt, setEndAt] = useState<string>(formatForInput(dayAfterTomorrow));
  const [simulateNoVehicle, setSimulateNoVehicle] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);

  const [hasCccd, setHasCccd] = useState<boolean>(true);
  const [hasGplx, setHasGplx] = useState<boolean>(true);

  const startDate = new Date(startAt);
  const endDate = new Date(endAt);
  const diffDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));

  const dailyRates: Record<string, number> = {
    xe_so: 120000,
    tay_ga: 160000,
    xe_con: 200000,
  };
  const estimatedPrice = (dailyRates[vehicleType] || 120000) * diffDays;
  const estimatedDeposit = Math.round(estimatedPrice * 0.3);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập để gửi yêu cầu thuê');
      navigate('/login');
      return;
    }

    if (startDate >= endDate) {
      toast.warning('Thời gian trả xe phải sau thời gian nhận xe');
      return;
    }

    setLoading(true);
    try {
      let originalStatuses: Array<{ id: string; status: VehicleStatus }> = [];
      if (simulateNoVehicle) {
        const candidateVehicles = await db.vehicles
          .where('vehicle_type')
          .equals(vehicleType)
          .toArray();
        originalStatuses = candidateVehicles.map((v) => ({ id: v.id, status: v.status }));
        for (const v of candidateVehicles) {
          await db.vehicles.update(v.id, { status: 'BAO_TRI' });
        }
      }

      const documents: Array<{
        doc_type: 'CCCD_TRUOC' | 'CCCD_SAU' | 'BANG_LAI_TRUOC' | 'BANG_LAI_SAU' | 'OTHER';
        file_url: string;
        is_valid?: boolean;
      }> = [];

      if (hasCccd) {
        documents.push(
          { doc_type: 'CCCD_TRUOC', file_url: 'blob:simulated_cccd_front.jpg', is_valid: true },
          { doc_type: 'CCCD_SAU', file_url: 'blob:simulated_cccd_back.jpg', is_valid: true }
        );
      }
      if (hasGplx) {
        documents.push({
          doc_type: 'BANG_LAI_TRUOC',
          file_url: 'blob:simulated_gplx_front.jpg',
          is_valid: true,
        });
      }

      const requestId = await engine.start(currentActor, {
        customer_id: currentActor.id,
        vehicle_type: vehicleType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        documents: documents.length > 0 ? documents : undefined,
      });

      if (simulateNoVehicle && originalStatuses.length > 0) {
        for (const os of originalStatuses) {
          await db.vehicles.update(os.id, { status: os.status });
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
      <Card className="p-4 border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-md">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={0} />
      </Card>

      {/* Tiêu đề & Giới thiệu phong cách Eco-Mobility */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-300 shadow-sm">
              KH-01 &bull; BPMN M_START
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Gửi yêu cầu thuê xe máy
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Chọn dòng xe yêu thích và thời gian di chuyển để hệ thống tự động kiểm tra đội xe sẵn sàng
          </p>
        </div>
      </div>

      {/* Form đặt xe */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-6 border-slate-200/80 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Bike className="w-5 h-5 text-brand-600" />
              <span>1. Lựa chọn dòng xe</span>
            </h2>
            <span className="text-xs text-brand-700 font-semibold flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              Đảm bảo 100% xe đời mới
            </span>
          </div>

          {/* Chọn dòng xe Card Selection với Stagger Effect & Micro-interactions */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {[
              {
                id: 'xe_so',
                title: 'Xe số',
                models: 'Wave Alpha, Sirius FI 110cc',
                price: 120000,
                tag: 'Tiết kiệm xăng',
                desc: 'Phù hợp leo dốc, di chuyển xa',
              },
              {
                id: 'tay_ga',
                title: 'Xe tay ga',
                models: 'Vision, Air Blade 125cc',
                price: 160000,
                tag: 'Phổ biến nhất',
                desc: 'Êm ái, cốp rộng, dễ điều khiển',
              },
              {
                id: 'xe_con',
                title: 'Xe côn tay',
                models: 'Winner X, Exciter 150cc',
                price: 200000,
                tag: 'Mạnh mẽ',
                desc: 'Trải nghiệm phượt, thể thao',
              },
            ].map((item) => {
              const isSelected = vehicleType === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setVehicleType(item.id)}
                  className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all duration-200 select-none ${
                    isSelected
                      ? 'border-brand-600 bg-brand-50/60 shadow-lg shadow-brand-600/10 scale-[1.02]'
                      : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-3 right-3 text-brand-600">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-extrabold text-slate-900 text-base">{item.title}</span>
                  </div>
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 mb-2">
                    {item.tag}
                  </span>

                  <div className="text-xs text-slate-600 font-medium mb-1">{item.models}</div>
                  <div className="text-[11px] text-slate-400 mb-3">{item.desc}</div>

                  <div className="pt-2 border-t border-slate-100 flex items-baseline gap-1">
                    <span className="text-base font-black text-brand-700">
                      {formatCurrency(item.price)}
                    </span>
                    <span className="text-[11px] text-slate-500">/ngày</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Chọn ngày giờ nhận và trả xe */}
          <div className="pt-2">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600" />
              <span>2. Lịch trình di chuyển</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Thời gian nhận xe (Dự kiến)"
                  type="datetime-local"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  required
                />
              </div>
              <div>
                <Input
                  label="Thời gian trả xe (Dự kiến)"
                  type="datetime-local"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Bảng tính toán chi phí thông minh dạng Glassmorphism Surface */}
          <div className="p-4.5 bg-gradient-to-r from-brand-50/80 via-white to-brand-50/50 rounded-2xl border border-brand-200/70 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs text-slate-500">Thời gian thuê:</div>
              <div className="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                <span>{diffDays} ngày lưu thông</span>
                <span className="text-slate-300">&bull;</span>
                <span className="text-brand-700">{formatCurrency(estimatedPrice)}</span>
              </div>
            </div>

            <div className="sm:text-right space-y-1">
              <div className="text-xs text-slate-500">Tiền cọc giữ xe (30%):</div>
              <div className="text-base font-black text-amber-700 font-mono">
                {formatCurrency(estimatedDeposit)}
              </div>
            </div>
          </div>
        </Card>

        {/* Giấy tờ tùy thân đính kèm */}
        <Card className="p-6 border-slate-200/80 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              <span>3. Giấy tờ định danh & Lái xe</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">Thẩm định qua AI Gemini</span>
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
                  Đính kèm 2 mặt để AI bóc tách họ tên, số định danh tự động
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
                  Bắt buộc còn hạn để hợp thức hóa hợp đồng thuê
                </span>
              </div>
            </label>
          </div>

          {/* Tùy chọn test giả lập hết xe */}
          <div className="pt-2 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateNoVehicle}
                onChange={(e) => setSimulateNoVehicle(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span className="text-slate-600">
                <strong>(Ngoại lệ BPMN)</strong> Giả lập hết xe sẵn sàng (<code className="font-mono text-red-600">M_G01 = Không &rarr; M_RejectNoVehicle</code>)
              </span>
            </label>
          </div>
        </Card>

        {/* Nút gửi form Desktop */}
        <div className="hidden sm:flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            data-testid="node-M_START"
            className="flex items-center justify-center gap-2 px-8"
          >
            <span>Tiếp tục: Báo giá & Hồ sơ</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Sticky CTA Bottom Bar trên Mobile (Chuẩn Ergonomics 2026+) */}
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
