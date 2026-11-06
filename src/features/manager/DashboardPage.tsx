// src/features/manager/DashboardPage.tsx
// Bảng điều hành tổng quan dành cho Quản lý (Executive Dashboard)

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '@/db';
import { engine } from '@/engine';
import type { Vehicle, RentalRequest } from '@/db/types';
import { Card, Button, StatusChip } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { COPY } from '@/copy';
import {
  Bike,
  Calendar,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';

export function DashboardPage() {
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeRentals, setActiveRentals] = useState<RentalRequest[]>([]);
  const [managerTasksCount, setManagerTasksCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vList, rList, tasks] = await Promise.all([
        db.vehicles.toArray(),
        db.rental_requests.where('status').equals('DANG_THUE').toArray(),
        engine.getPendingTasks('quan_ly'),
      ]);

      setVehicles(vList);
      setActiveRentals(rList);
      setManagerTasksCount(tasks.length);
    } catch (err) {
      console.error('Lỗi nạp dữ liệu điều hành:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const totalVehicles = vehicles.length;
  const readyVehicles = vehicles.filter((v) => v.status === 'SAN_SANG').length;
  const rentedVehicles = vehicles.filter((v) => v.status === 'DANG_THUE').length;
  const maintenanceVehicles = vehicles.filter((v) => v.status === 'BAO_TRI').length;

  const occupancyRate = totalVehicles > 0 ? Math.round((rentedVehicles / totalVehicles) * 100) : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Tiêu đề & Làm mới */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            {COPY.TITLES.MANAGER_DASHBOARD}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Tổng quan năng lực vận hành đội xe 30 chiếc và điều phối dịch vụ tại Đà Nẵng
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            loading={loading}
            title="Làm mới dữ liệu"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* 4 Thẻ chỉ số tổng quan (Executive KPI Row) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Đội xe sẵn sàng */}
        <Card className="p-4 md:p-5 border border-slate-200 bg-white rounded-xl space-y-1">
          <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider block">
            Xe sẵn sàng
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-emerald-700">
              {readyVehicles}
            </span>
            <span className="text-xs text-slate-400">/ {totalVehicles} xe</span>
          </div>
          <span className="text-[13px] text-slate-500 block pt-1">
            Đã sẵn sàng đón khách
          </span>
        </Card>

        {/* KPI 2: Đang cho thuê */}
        <Card className="p-4 md:p-5 border border-slate-200 bg-white rounded-xl space-y-1">
          <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider block">
            Đang phục vụ
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-teal-800">
              {rentedVehicles}
            </span>
            <span className="text-xs font-semibold text-teal-700">{occupancyRate}% lấp đầy</span>
          </div>
          <span className="text-[13px] text-slate-500 block pt-1">
            {activeRentals.length} khách đang lưu thông
          </span>
        </Card>

        {/* KPI 3: Bảo dưỡng / Kiểm tra */}
        <Card className="p-4 md:p-5 border border-slate-200 bg-white rounded-xl space-y-1">
          <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider block">
            Bảo dưỡng
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-amber-800">
              {maintenanceVehicles}
            </span>
            <span className="text-xs text-slate-400">xe kỹ thuật</span>
          </div>
          <span className="text-[13px] text-slate-500 block pt-1">
            Đang kiểm tra định kỳ
          </span>
        </Card>

        {/* KPI 4: Chờ quản lý xử lý */}
        <Card className="p-4 md:p-5 border border-slate-200 bg-white rounded-xl space-y-1">
          <span className="text-[13px] font-semibold text-slate-500 uppercase tracking-wider block">
            Cần phê duyệt
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-semibold text-purple-700">
              {managerTasksCount}
            </span>
            <StatusChip
              status={managerTasksCount > 0 ? 'pending' : 'success'}
              label={managerTasksCount > 0 ? 'Đang chờ' : 'Đã xong'}
            />
          </div>
          <span className="text-[13px] text-slate-500 block pt-1">
            Khiếu nại & điều phối cứu hộ
          </span>
        </Card>
      </div>

      {/* Lối tắt nghiệp vụ điều hành */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Lối tắt 1: Lịch trình & Gantt */}
        <Card className="p-5 border border-slate-200 bg-white rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Lịch trình điều độ đội xe
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Xem sơ đồ thời gian thực các khung giờ thuê của toàn bộ 30 xe máy tại Đà Nẵng, phát hiện trùng lịch và luân chuyển xe thông minh.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/manager/timeline')}
            className="self-start mt-2"
          >
            <span>Mở sơ đồ lịch trình</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Card>

        {/* Lối tắt 2: Quản trị đội xe */}
        <Card className="p-5 border border-slate-200 bg-white rounded-xl space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Bike className="w-5 h-5 text-teal-700" />
              <h2 className="text-base font-semibold text-slate-900">
                Danh mục phương tiện & Giá niêm yết
              </h2>
            </div>
            <p className="text-sm text-slate-600">
              Quản lý chi tiết danh mục 30 xe, điều chỉnh giá thuê theo ngày, thêm xe mới và đồng bộ dữ liệu đám mây Supabase.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/ad/01')}
            className="self-start mt-2"
          >
            <span>Quản trị đội xe</span>
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </Card>
      </div>

      {/* Danh sách xe cần chú ý */}
      <Card className="p-5 border border-slate-200 bg-white rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-semibold text-slate-900">
            Tình trạng đội xe 30 chiếc
          </h2>
          <span className="text-[13px] text-slate-500">
            Cập nhật theo thời gian thực
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {vehicles.slice(0, 6).map((v) => (
            <div
              key={v.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900 text-sm truncate">
                  {v.model}
                </span>
                <StatusChip
                  status={v.status === 'SAN_SANG' ? 'success' : v.status === 'DANG_THUE' ? 'pending' : 'inactive'}
                  label={v.status === 'SAN_SANG' ? 'Sẵn sàng' : v.status === 'DANG_THUE' ? 'Đang thuê' : 'Bảo trì'}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono font-medium">{v.plate}</span>
                <span className="font-semibold text-teal-800">{formatCurrency(v.daily_price)}/ngày</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default DashboardPage;
