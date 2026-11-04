// src/features/customer/KH01Page.tsx
// Màn hình KH-01: Gửi yêu cầu thuê xe (M_START)
// Chọn dòng xe, ngày giờ nhận/trả, tải giấy tờ ban đầu và bắt đầu quy trình BPMN

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
} from 'lucide-react';

export function KH01Page() {
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  // Mặc định thời gian: Bắt đầu 08:00 ngày mai, kết thúc 18:00 ngày mốt (2 ngày)
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

  // Giấy tờ tải lên ban đầu (tùy chọn hoặc nộp trước)
  const [hasCccd, setHasCccd] = useState<boolean>(true);
  const [hasGplx, setHasGplx] = useState<boolean>(true);

  // Tính số ngày và giá tạm tính
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
      // Nếu bật giả lập hết xe: tạm thời chuyển trạng thái tất cả xe của loại đó sang BAO_TRI
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

      // Chuẩn bị giấy tờ khởi tạo (nếu khách chọn đính kèm sẵn)
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

      // Khởi tạo quy trình từ M_START
      const requestId = await engine.start(currentActor, {
        customer_id: currentActor.id,
        vehicle_type: vehicleType,
        start_at: new Date(startAt).toISOString(),
        end_at: new Date(endAt).toISOString(),
        documents: documents.length > 0 ? documents : undefined,
      });

      // Phục hồi lại trạng thái xe nếu lúc nãy giả lập
      if (simulateNoVehicle && originalStatuses.length > 0) {
        for (const os of originalStatuses) {
          await db.vehicles.update(os.id, { status: os.status });
        }
      }

      // Kiểm tra trạng thái đơn sau khi chạy qua M_G01
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
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Stepper tiến trình khách hàng */}
      <Card className="p-4 border-slate-200">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={0} />
      </Card>

      {/* Tiêu đề & Giới thiệu */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
            KH-01
          </span>
          <h1 className="text-2xl font-bold text-slate-900">Gửi yêu cầu thuê xe máy</h1>
        </div>
        <p className="text-sm text-slate-500">
          Bước 1 trong quy trình BPMN: Chọn dòng xe phù hợp và thời gian thuê để hệ thống kiểm tra xe sẵn sàng (M_CheckFleet & M_G01).
        </p>
      </div>

      {/* Form đặt xe */}
      <form onSubmit={handleSubmit} className="space-y-5">
        <Card className="p-6 border-slate-200 space-y-5">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bike className="w-5 h-5 text-brand-600" />
            Thông tin thuê xe
          </h2>

          {/* Chọn dòng xe */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Dòng xe mong muốn</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: 'xe_so',
                  title: 'Xe số',
                  models: 'Wave Alpha, Sirius 110cc',
                  price: 120000,
                  tag: 'Tiết kiệm xăng',
                },
                {
                  id: 'tay_ga',
                  title: 'Xe tay ga',
                  models: 'Vision, Air Blade 125cc',
                  price: 160000,
                  tag: 'Tiện lợi, êm ái',
                },
                {
                  id: 'xe_con',
                  title: 'Xe côn tay',
                  models: 'Winner X, Exciter 150cc',
                  price: 200000,
                  tag: 'Động cơ mạnh mẽ',
                },
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setVehicleType(item.id)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    vehicleType === item.id
                      ? 'border-brand-600 bg-brand-50/50 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900 text-sm">{item.title}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-brand-100 text-brand-800">
                      {item.tag}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mb-2">{item.models}</div>
                  <div className="text-sm font-bold text-brand-700">
                    {formatCurrency(item.price)}{' '}
                    <span className="text-[10px] font-normal text-slate-500">/ ngày</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Chọn ngày giờ nhận và trả xe */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
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

          {/* Tóm tắt ước tính */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-500">Thời gian thuê: </span>
              <strong className="text-slate-800">{diffDays} ngày</strong> &bull;{' '}
              <span className="text-slate-500">Tổng giá thuê dự tính: </span>
              <strong className="text-brand-700 font-bold">{formatCurrency(estimatedPrice)}</strong>
            </div>
            <div>
              <span className="text-slate-500">Tiền cọc ước tính (30%): </span>
              <strong className="text-amber-700 font-bold">{formatCurrency(estimatedDeposit)}</strong>
            </div>
          </div>
        </Card>

        {/* Giấy tờ tùy thân đính kèm */}
        <Card className="p-6 border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-brand-600" />
              Đính kèm giấy tờ ban đầu
            </h2>
            <span className="text-xs text-slate-500">Có thể bổ sung hoặc cập nhật lại ở KH-02</span>
          </div>

          <div className="space-y-3 text-xs">
            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={hasCccd}
                onChange={(e) => setHasCccd(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Đính kèm ảnh Căn cước công dân (CCCD 2 mặt)</span>
                <span className="text-slate-500 text-[11px]">Dùng hình ảnh định danh giả lập phục vụ thẩm định tự động</span>
              </div>
            </label>

            <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={hasGplx}
                onChange={(e) => setHasGplx(e.target.checked)}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500"
              />
              <div>
                <span className="font-semibold text-slate-800 block">Đính kèm ảnh Giấy phép lái xe (GPLX A1/A2)</span>
                <span className="text-slate-500 text-[11px]">Bắt buộc để đủ điều kiện điều khiển phương tiện</span>
              </div>
            </label>
          </div>

          {/* Tùy chọn test giả lập hết xe */}
          <div className="pt-3 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
              <input
                type="checkbox"
                checked={simulateNoVehicle}
                onChange={(e) => setSimulateNoVehicle(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span className="text-slate-700">
                <strong>(Thử nghiệm ngoại lệ)</strong> Giả lập hết xe sẵn sàng (để kiểm tra nhánh BPMN <code className="font-mono text-red-600">M_G01 = Không &rarr; M_RejectNoVehicle</code>)
              </span>
            </label>
          </div>
        </Card>

        {/* Nút gửi form */}
        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            data-testid="node-M_START"
            className="w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <span>Tiếp tục: Báo giá & Hồ sơ</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
