// src/features/admin/AD01Page.tsx
// Quản trị đội xe, đối tác cứu hộ & Người dùng nội bộ
// Phân quyền: Quản lý toàn quyền Thêm/Sửa xe và Bật/Tắt đối tác; Nhân viên có quyền xem

import React, { useState, useEffect } from 'react';
import { db } from '@/db';
import { seedDatabase } from '@/db/seed';
import { useAuthStore } from '@/features/auth/authStore';
import type { Vehicle, Partner, Profile, VehicleStatus } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Select,
  Modal,
  Tabs,
  toast,
} from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import {
  Plus,
  Edit2,
  RefreshCw,
  Search,
} from 'lucide-react';

interface EnrichedProfile extends Profile {
  email?: string;
}

export function AD01Page() {
  const currentActor = useAuthStore((s) => s.currentActor);
  const isManager = currentActor?.role === 'quan_ly';

  const [activeTab, setActiveTab] = useState('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [profiles, setProfiles] = useState<EnrichedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Modal thêm / sửa xe
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Partial<Vehicle> | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      let vList = await db.vehicles.toArray();
      if (vList.length < 30) {
        await seedDatabase();
        vList = await db.vehicles.toArray();
      }
      const [pList, uList, aList] = await Promise.all([
        db.partners.toArray(),
        db.profiles.toArray(),
        db.auth_accounts.toArray(),
      ]);
      setVehicles(vList);
      setPartners(pList);
      setProfiles(
        uList.map((u) => ({
          ...u,
          email: aList.find((a) => a.user_id === u.id)?.email || 'N/A',
        }))
      );
    } catch (err) {
      console.error('Lỗi khi tải dữ liệu AD-01:', err);
      toast.error('Không thể nạp dữ liệu quản trị');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Bật/tắt đối tác cứu hộ
  const handleTogglePartner = async (partner: Partner) => {
    if (!isManager) return;
    try {
      const nextStatus = !partner.available;
      await db.partners.update(partner.id, { available: nextStatus });
      setPartners((prev) =>
        prev.map((p) => (p.id === partner.id ? { ...p, available: nextStatus } : p))
      );
      toast.info(`Đối tác ${partner.name}: ${nextStatus ? 'ĐANG SẴN SÀNG' : 'TẠM TẮT'}`);
    } catch (err) {
      console.error(err);
      toast.error('Lỗi cập nhật trạng thái đối tác');
    }
  };

  // Lưu xe (Thêm mới hoặc Cập nhật)
  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager || !editingVehicle) return;

    if (!editingVehicle.plate?.trim() || !editingVehicle.model?.trim()) {
      toast.warning('Vui lòng nhập Biển số và Mẫu xe');
      return;
    }

    try {
      if (editingVehicle.id) {
        // Cập nhật
        await db.vehicles.update(editingVehicle.id, {
          plate: editingVehicle.plate.trim().toUpperCase(),
          model: editingVehicle.model.trim(),
          vehicle_type: editingVehicle.vehicle_type || 'xe_so',
          daily_price: Number(editingVehicle.daily_price) || 120000,
          status: editingVehicle.status || 'SAN_SANG',
          condition_note: editingVehicle.condition_note || '',
        });
        toast.success('Đã cập nhật thông tin xe!');
      } else {
        // Thêm mới
        const newId = crypto.randomUUID();
        await db.vehicles.add({
          id: newId,
          plate: editingVehicle.plate.trim().toUpperCase(),
          model: editingVehicle.model.trim(),
          vehicle_type: editingVehicle.vehicle_type || 'xe_so',
          daily_price: Number(editingVehicle.daily_price) || 120000,
          status: editingVehicle.status || 'SAN_SANG',
          condition_note: editingVehicle.condition_note || '',
        });
        toast.success('Đã thêm xe mới thành công!');
      }

      setIsVehicleModalOpen(false);
      setEditingVehicle(null);
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error('Lỗi lưu thông tin xe');
    }
  };

  // Mở modal thêm xe
  const openAddVehicleModal = () => {
    if (!isManager) return;
    setEditingVehicle({
      plate: '',
      model: '',
      vehicle_type: 'xe_so',
      daily_price: 120000,
      status: 'SAN_SANG',
      condition_note: 'Xe mới kiểm tra, hoạt động tốt',
    });
    setIsVehicleModalOpen(true);
  };

  // Mở modal sửa xe
  const openEditVehicleModal = (v: Vehicle) => {
    if (!isManager) return;
    setEditingVehicle({ ...v });
    setIsVehicleModalOpen(true);
  };

  // Lọc dữ liệu xe
  const filteredVehicles = vehicles.filter((v) =>
    searchQuery === ''
      ? true
      : v.plate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.vehicle_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            Quản trị đội xe & Vận hành
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Cấu hình danh mục xe, đối tác cứu hộ ngoại vi và giám sát tình trạng kỹ thuật.
          </p>
        </div>

        {/* Thanh công cụ hành động */}
        <div className="flex items-center gap-2">
          {isManager && (
            <Button
              variant="primary"
              size="sm"
              onClick={openAddVehicleModal}
              className="flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm xe mới</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={loadAll}
            loading={loading}
            className="flex items-center gap-1.5"
            title="Làm mới danh sách"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>


      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'vehicles', label: 'Danh mục Xe', count: vehicles.length },
          { id: 'partners', label: 'Đối tác cứu hộ', count: partners.length },
          { id: 'users', label: 'Người dùng', count: profiles.length },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* TAB 1: DANH MỤC XE */}
      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="max-w-md w-full">
              <Input
                placeholder="Tìm biển số, mẫu xe, loại xe..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                icon={<Search className="w-4 h-4 text-slate-400" />}
              />
            </div>

            {isManager && (
              <Button
                variant="primary"
                size="sm"
                onClick={openAddVehicleModal}
                className="flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                Thêm xe mới
              </Button>
            )}
          </div>

          <Card className="border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-3 px-4">Biển số</th>
                    <th className="py-3 px-4">Mẫu xe</th>
                    <th className="py-3 px-4">Phân loại</th>
                    <th className="py-3 px-4">Giá thuê / ngày</th>
                    <th className="py-3 px-4">Trạng thái</th>
                    <th className="py-3 px-4">Ghi chú kỹ thuật</th>
                    {isManager && <th className="py-3 px-4 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredVehicles.length === 0 ? (
                    <tr>
                      <td colSpan={isManager ? 7 : 6} className="py-8 text-center text-slate-400">
                        Không có xe nào phù hợp.
                      </td>
                    </tr>
                  ) : (
                    filteredVehicles.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {v.plate}
                        </td>
                        <td className="py-3 px-4 font-medium text-slate-800">
                          <div className="flex items-center gap-2.5">
                            <div className="w-10 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center overflow-hidden shrink-0 p-0.5">
                              <img
                                src={getVehicleImageUrl(v.model)}
                                alt={v.model}
                                className="h-full w-full object-contain filter drop-shadow-2xs"
                              />
                            </div>
                            <span>{v.model}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                            {v.vehicle_type === 'xe_so'
                              ? 'Xe số'
                              : v.vehicle_type === 'tay_ga'
                              ? 'Tay ga'
                              : 'Xe côn'}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-semibold text-brand-700">
                          {formatCurrency(v.daily_price)}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              v.status === 'SAN_SANG'
                                ? 'success'
                                : v.status === 'DANG_THUE'
                                ? 'info'
                                : 'danger'
                            }
                          >
                            {v.status === 'SAN_SANG'
                              ? 'Sẵn sàng'
                              : v.status === 'DANG_THUE'
                              ? 'Đang thuê'
                              : 'Bảo trì'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {v.condition_note || 'Bình thường'}
                        </td>
                        {isManager && (
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditVehicleModal(v)}
                              className="h-7 px-2 text-brand-700 hover:text-brand-900"
                            >
                              <Edit2 className="w-3.5 h-3.5 mr-1" />
                              Sửa
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: ĐỐI TÁC CỨU HỘ */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          <div className="text-xs text-slate-500">
            Danh sách đối tác cứu hộ hỗ trợ khi có sự cố trên đường. Quản lý có thể Bật/Tắt trạng thái tiếp nhận để thử nghiệm điều phối.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {partners.map((p) => (
              <Card key={p.id} className="p-4 border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">{p.name}</h3>
                    <div className="text-xs text-slate-500 mt-0.5">Khu vực: {p.region}</div>
                    <div className="text-xs text-slate-600 mt-1">Liên hệ: {p.contact}</div>
                  </div>

                  <Badge variant={p.available ? 'success' : 'danger'}>
                    {p.available ? 'Sẵn sàng' : 'Tạm tắt'}
                  </Badge>
                </div>

                {isManager && (
                  <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end">
                    <Button
                      variant={p.available ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleTogglePartner(p)}
                      className="text-xs"
                    >
                      {p.available ? 'Tạm tắt đối tác' : 'Bật sẵn sàng'}
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: NGƯỜI DÙNG */}
      {activeTab === 'users' && (
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Tên đầy đủ</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Số điện thoại</th>
                  <th className="py-3 px-4">Vai trò</th>
                  <th className="py-3 px-4">Mã định danh (ID)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {profiles.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {u.full_name}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 text-slate-600">{u.phone || 'Chưa có'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-semibold ${
                          u.role === 'quan_ly'
                            ? 'bg-purple-100 text-purple-800'
                            : u.role === 'nhan_vien'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role === 'quan_ly'
                          ? 'Quản lý'
                          : u.role === 'nhan_vien'
                          ? 'Nhân viên'
                          : 'Khách hàng'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 text-xs">
                      {u.id.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL THÊM / SỬA XE */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        title={editingVehicle?.id ? 'Cập nhật thông tin xe' : 'Thêm xe máy mới'}
        size="md"
      >
        <form onSubmit={handleSaveVehicle} className="space-y-4">
          <Input
            label="Biển số xe"
            placeholder="Ví dụ: 59A1-99999"
            value={editingVehicle?.plate || ''}
            onChange={(e) => setEditingVehicle((prev) => ({ ...prev, plate: e.target.value }))}
            required
          />

          <Input
            label="Mẫu xe (Model)"
            placeholder="Ví dụ: Honda Vision 2024"
            value={editingVehicle?.model || ''}
            onChange={(e) => setEditingVehicle((prev) => ({ ...prev, model: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Phân loại xe"
              value={editingVehicle?.vehicle_type || 'xe_so'}
              onChange={(e) =>
                setEditingVehicle((prev) => ({ ...prev, vehicle_type: e.target.value }))
              }
              options={[
                { value: 'xe_so', label: 'Xe số' },
                { value: 'tay_ga', label: 'Tay ga' },
                { value: 'xe_con', label: 'Xe côn tay' },
              ]}
            />

            <Select
              label="Trạng thái"
              value={editingVehicle?.status || 'SAN_SANG'}
              onChange={(e) =>
                setEditingVehicle((prev) => ({
                  ...prev,
                  status: e.target.value as VehicleStatus,
                }))
              }
              options={[
                { value: 'SAN_SANG', label: 'Sẵn sàng' },
                { value: 'DANG_THUE', label: 'Đang cho thuê' },
                { value: 'BAO_TRI', label: 'Bảo trì / Sửa chữa' },
              ]}
            />
          </div>

          <Input
            label="Giá thuê theo ngày (VND)"
            type="number"
            step="10000"
            value={editingVehicle?.daily_price || 120000}
            onChange={(e) =>
              setEditingVehicle((prev) => ({ ...prev, daily_price: Number(e.target.value) }))
            }
            required
          />

          <Input
            label="Ghi chú tình trạng xe"
            placeholder="Ví dụ: Xe mới bảo dưỡng, lốp mới..."
            value={editingVehicle?.condition_note || ''}
            onChange={(e) =>
              setEditingVehicle((prev) => ({ ...prev, condition_note: e.target.value }))
            }
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsVehicleModalOpen(false)}
            >
              Hủy bỏ
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Lưu thông tin
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
