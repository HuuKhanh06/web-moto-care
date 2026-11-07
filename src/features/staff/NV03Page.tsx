// src/features/staff/NV03Page.tsx
// Màn hình NV-03: Kiểm tra kỹ thuật xe và khắc phục (M_InspectPre, M_G04, M_Rework)
// Checklist phanh, đèn, lốp, nhiên liệu, gương, còi. Lịch sử kiểm tra (attempt_no).

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { isVehicleFree } from '@/engine/fleet';
import { db } from '@/db';
import type { RentalRequest, Vehicle, Inspection } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  toast,
} from '@/components/ui';
import {
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';
import {
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Fuel,
  Volume2,
  Lightbulb,
  ShieldCheck,
  Disc,
  ArrowRight,
  History,
  Layers,
} from 'lucide-react';

interface TechnicalChecklist {
  brakes: boolean;
  lights: boolean;
  tires: boolean;
  mirrors: boolean;
  horn: boolean;
  fuel_level: string; // '25%' | '50%' | '75%' | '100%'
  general_notes: string;
}

export function NV03Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>('M_InspectPre');
  const [availableVehicles, setAvailableVehicles] = useState<Vehicle[]>([]);
  const [inspectionsHistory, setInspectionsHistory] = useState<Inspection[]>([]);
  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Trạng thái checklist hiện tại
  const [checklist, setChecklist] = useState<TechnicalChecklist>({
    brakes: true,
    lights: true,
    tires: true,
    mirrors: true,
    horn: true,
    fuel_level: '100%',
    general_notes: '',
  });

  // Khu vực khắc phục / đổi xe (khi chưa đạt hoặc đang ở M_Rework)
  const [reworkNote, setReworkNote] = useState('');
  const [selectedNewVehicleId, setSelectedNewVehicleId] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Quét toàn bộ hồ sơ đang ở trạng thái CHO_BAN_GIAO
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_BAN_GIAO')
        .toArray();

      const pList: PendingRequestSummary[] = [];
      for (const cand of candidates) {
        let vName = 'Xe máy';
        if (cand.vehicle_id) {
          const veh = await db.vehicles.get(cand.vehicle_id);
          if (veh) vName = `${veh.model} (${veh.plate})`;
        }
        const cust = await db.profiles.get(cand.customer_id);
        pList.push({
          id: cand.id,
          customerName: cust?.full_name,
          vehicleModel: vName,
          status: cand.status,
        });
      }
      setPendingList(pList);

      // Xác định ID cần tải
      const targetId = requestId || (pList.length > 0 ? pList[0].id : null);
      if (!targetId) {
        setRequest(null);
        setVehicle(null);
        return;
      }

      const req = await db.rental_requests.get(targetId);
      if (!req) {
        toast.error('Không tìm thấy đơn thuê');
        setRequest(null);
        setVehicle(null);
        return;
      }
      setRequest(req);

      const pState = await db.process_state.get(targetId);
      if (pState?.waiting_node_ids?.length) {
        setCurrentNodeId(pState.waiting_node_ids[0]);
      }

      let v: Vehicle | undefined;
      if (req.vehicle_id) {
        v = await db.vehicles.get(req.vehicle_id);
        setVehicle(v || null);
      }

      // Lấy lịch sử kiểm tra kỹ thuật (PRE_HANDOVER)
      const history = await db.inspections
        .where('request_id')
        .equals(targetId)
        .and((i) => i.kind === 'PRE_HANDOVER')
        .sortBy('attempt_no');
      setInspectionsHistory(history);

      // Lấy danh sách xe khả dụng cùng phân hạng nếu cần đổi xe.
      // Chỉ liệt kê xe còn trống trong khung giờ thuê: loại xe đã khóa lịch hoặc đang giữ cho hồ sơ khác.
      if (v) {
        const candidates = await db.vehicles
          .where('vehicle_type')
          .equals(v.vehicle_type)
          .and((veh) => veh.id !== v?.id && veh.status === 'SAN_SANG')
          .toArray();
        const startMs = new Date(req.start_at).getTime();
        const endMs = new Date(req.end_at).getTime();
        const free = await Promise.all(candidates.map((veh) => isVehicleFree(veh.id, startMs, endMs, targetId)));
        setAvailableVehicles(candidates.filter((_, i) => free[i]));
      }
    } catch (err) {
      console.error('Lỗi nạp NV-03:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải hồ sơ kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (!request || !vehicle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="text-center py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Wrench className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có hồ sơ nào chờ kiểm tra kỹ thuật</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại toàn bộ phương tiện đã hoàn tất kiểm tra đạt hoặc chưa có đơn thuê mới ở trạng thái Chờ bàn giao.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành</Button>
          </div>
        </Card>
      </div>
    );
  }

  const nextAttemptNo = (inspectionsHistory[inspectionsHistory.length - 1]?.attempt_no || 0) + 1;
  const isAllChecklistPassed = checklist.brakes && checklist.lights && checklist.tires && checklist.mirrors && checklist.horn;
  const isAtReworkNode = currentNodeId === 'M_Rework';

  // Xử lý gửi kết quả kiểm tra kỹ thuật
  const handleSubmitInspection = async (result: 'DAT' | 'CHUA_DAT') => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'M_InspectPre',
        {
          result,
          checklist: {
            ...checklist,
            checked_at: new Date().toISOString(),
          },
          attempt_no: nextAttemptNo,
          vehicle_id: vehicle.id,
        },
        currentActor
      );

      if (result === 'DAT') {
        toast.success('Kiểm tra kỹ thuật ĐẠT! Chuyển sang bước chụp ảnh bàn giao');
        navigate(`/nv/04?requestId=${request.id}`);
      } else {
        toast.warning('Kiểm tra CHƯA ĐẠT! Vui lòng khắc phục lỗi hoặc đổi xe');
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Lỗi hoàn tất kiểm tra:', err);
      toast.error(err instanceof Error ? err.message : 'Có lỗi xảy ra khi lưu biên bản');
    } finally {
      setSubmitting(false);
    }
  };

  // Xử lý hoàn tất khắc phục hoặc đổi xe ở M_Rework
  const handleReworkSubmit = async () => {
    if (!currentActor) return;
    if (!reworkNote.trim() && !selectedNewVehicleId) {
      toast.error('Vui lòng ghi chú nội dung đã khắc phục hoặc chọn xe thay thế');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        request.id,
        'M_Rework',
        {
          rework_note: reworkNote,
          new_vehicle_id: selectedNewVehicleId || undefined,
        },
        currentActor
      );

      toast.success('Đã ghi nhận khắc phục! Tiếp tục kiểm tra lại kỹ thuật');
      setReworkNote('');
      setSelectedNewVehicleId('');
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi khắc phục xe:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể cập nhật khắc phục');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Thanh chọn nhanh hồ sơ đang chờ kiểm tra */}
      <PendingRequestBar
        label="Hồ sơ chờ kiểm tra kỹ thuật"
        currentRequestId={request.id}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Kiểm tra kỹ thuật xe & Khắc phục
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hồ sơ thuê #{request.id.slice(0, 8)} • Lần kiểm tra số {nextAttemptNo}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
        </div>
      </div>

      {/* Thông tin xe được gán */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-20 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 p-1 shrink-0 overflow-hidden">
              <img
                src={getVehicleImageUrl(vehicle.model)}
                alt={vehicle.model}
                className="h-full w-full object-contain filter drop-shadow-2xs"
              />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 sm:text-lg">
                {vehicle.model}
              </h2>
              <p className="text-sm text-slate-500">
                Biển số: <strong className="text-slate-700">{vehicle.plate}</strong> • Loại: {vehicle.vehicle_type}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Trạng thái xe</p>
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800">
              {vehicle.status}
            </span>
          </div>
        </div>
      </Card>

      {/* Lịch sử các lần kiểm tra trước (nếu có) */}
      {inspectionsHistory.length > 0 && (
        <Card className="p-4 sm:p-5 border-amber-200 bg-amber-50/40">
          <div className="mb-3 flex items-center gap-2 text-amber-900 font-semibold text-sm">
            <History className="h-4 w-4" />
            Lịch sử kiểm tra kỹ thuật ({inspectionsHistory.length} lần)
          </div>
          <div className="space-y-2">
            {inspectionsHistory.map((insp) => (
              <div
                key={insp.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg bg-white p-3 border border-amber-100 shadow-sm text-xs text-slate-600 gap-2"
              >
                <div>
                  <span className="font-bold text-slate-800">Lần {insp.attempt_no}: </span>
                  <span className={insp.result === 'DAT' ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                    {insp.result === 'DAT' ? 'ĐẠT TIÊU CHUẨN' : 'CHƯA ĐẠT'}
                  </span>
                  {insp.rework_note && (
                    <p className="mt-1 text-slate-500">
                      <em>Ghi chú khắc phục: {insp.rework_note}</em>
                    </p>
                  )}
                </div>
                <div className="text-slate-400">
                  {formatDateTime(new Date().toISOString())}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* VÙNG KHẮC PHỤC / ĐỔI XE (Khi đang ở M_Rework) */}
      {isAtReworkNode && (
        <Card
          data-testid="node-M_Rework"
          className="border-2 border-rose-300 bg-rose-50/50 p-5 shadow-sm space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-bold text-rose-900">
                Khu vực khắc phục &amp; Đổi xe kỹ thuật
              </h3>
              <p className="text-xs text-rose-700">
                Xe chưa đạt tiêu chuẩn kỹ thuật. Nhân viên kỹ thuật cần thực hiện khắc phục tại chỗ hoặc đổi sang xe khác cùng loại.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú khắc phục kỹ thuật
              </label>
              <Textarea
                placeholder="Ví dụ: Đã tăng phanh sau, thay bóng xi-nhan phải, bơm lốp đạt 2.2 kg/cm2..."
                rows={3}
                value={reworkNote}
                onChange={(e) => setReworkNote(e.target.value)}
                className="bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hoặc đổi sang xe khác cùng loại ({vehicle.vehicle_type})
              </label>
              {availableVehicles.length > 0 ? (
                <select
                  value={selectedNewVehicleId}
                  onChange={(e) => setSelectedNewVehicleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-brand-500 focus:outline-none"
                >
                  <option value="">-- Giữ nguyên xe hiện tại ({vehicle.plate}) --</option>
                  {availableVehicles.map((av) => (
                    <option key={av.id} value={av.id}>
                      {av.model} - {av.plate}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Không còn xe nào khác cùng phân hạng đang ở trạng thái Sẵn sàng.
                </p>
              )}
            </div>

            <div className="pt-2">
              <Button
                data-testid="node-M_Rework"
                onClick={handleReworkSubmit}
                loading={submitting}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Xác nhận khắc phục &amp; Kiểm tra lại
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* FORM CHECKLIST KIỂM TRA XE (M_InspectPre) */}
      {!isAtReworkNode && (
        <Card data-testid="node-M_InspectPre" className="p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-brand-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Bảng kiểm tra kỹ thuật (Checklist bàn giao)
              </h3>
            </div>
            <span className="text-xs text-slate-500">
              Lần thứ <strong>#{nextAttemptNo}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Phanh */}
            <div
              onClick={() => setChecklist((prev) => ({ ...prev, brakes: !prev.brakes }))}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                checklist.brakes ? 'border-brand-300 bg-brand-50/30' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  checklist.brakes ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checklist.brakes && <Check className="h-4 w-4" />}
              </div>
              <div className="select-none">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <Disc className="h-4 w-4 text-brand-600" />
                  Hệ thống phanh (Trước & Sau)
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Độ bám tốt, không kẹt phanh, má phanh còn độ dày an toàn.
                </p>
              </div>
            </div>

            {/* Đèn */}
            <div
              onClick={() => setChecklist((prev) => ({ ...prev, lights: !prev.lights }))}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                checklist.lights ? 'border-brand-300 bg-brand-50/30' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  checklist.lights ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checklist.lights && <Check className="h-4 w-4" />}
              </div>
              <div className="select-none">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <Lightbulb className="h-4 w-4 text-brand-600" />
                  Đèn chiếu sáng & Xi-nhan
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Đèn pha, cos, đèn hậu và 4 đèn xi-nhan hoạt động chuẩn.
                </p>
              </div>
            </div>

            {/* Lốp */}
            <div
              onClick={() => setChecklist((prev) => ({ ...prev, tires: !prev.tires }))}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                checklist.tires ? 'border-brand-300 bg-brand-50/30' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  checklist.tires ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checklist.tires && <Check className="h-4 w-4" />}
              </div>
              <div className="select-none">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <Layers className="h-4 w-4 text-brand-600" />
                  Lốp xe & Áp suất lốp
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Gai lốp còn sâu, không nứt nẻ, áp suất đạt chuẩn kỹ thuật.
                </p>
              </div>
            </div>

            {/* Gương */}
            <div
              onClick={() => setChecklist((prev) => ({ ...prev, mirrors: !prev.mirrors }))}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                checklist.mirrors ? 'border-brand-300 bg-brand-50/30' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  checklist.mirrors ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checklist.mirrors && <Check className="h-4 w-4" />}
              </div>
              <div className="select-none">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <ShieldCheck className="h-4 w-4 text-brand-600" />
                  Gương chiếu hậu (Đủ 2 gương)
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Đủ 2 gương trái và phải, không vỡ nứt, quan sát rõ ràng.
                </p>
              </div>
            </div>

            {/* Còi */}
            <div
              onClick={() => setChecklist((prev) => ({ ...prev, horn: !prev.horn }))}
              className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition-colors ${
                checklist.horn ? 'border-brand-300 bg-brand-50/30' : 'border-rose-200 bg-rose-50/20'
              }`}
            >
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                  checklist.horn ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-300 bg-white'
                }`}
              >
                {checklist.horn && <Check className="h-4 w-4" />}
              </div>
              <div className="select-none">
                <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800">
                  <Volume2 className="h-4 w-4 text-brand-600" />
                  Còi xe (Âm lượng chuẩn)
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Âm lượng rõ ràng, phím bấm nhạy.
                </p>
              </div>
            </div>

            {/* Mức xăng bàn giao */}
            <div className="rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div className="flex items-center gap-1.5 font-bold text-sm text-slate-800 mb-2">
                <Fuel className="h-4 w-4 text-brand-600" />
                Mức xăng hiện tại
              </div>
              <div className="grid grid-cols-4 gap-2">
                {(['25%', '50%', '75%', '100%'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setChecklist((prev) => ({ ...prev, fuel_level: lvl }))}
                    className={`rounded-lg py-1.5 text-xs font-semibold border transition-all ${
                      checklist.fuel_level === lvl
                        ? 'border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-500'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Ghi chú thêm về ngoại quan / tình trạng động cơ
            </label>
            <Input
              placeholder="Ví dụ: Xe sạch sẽ, máy êm, đề nhạy..."
              value={checklist.general_notes}
              onChange={(e) => setChecklist((prev) => ({ ...prev, general_notes: e.target.value }))}
            />
          </div>

          {/* Quyết định BPMN M_G04 (Xe đạt?) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-sm text-slate-900">
                  Kết luận kiểm tra kỹ thuật
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isAllChecklistPassed
                    ? 'Tất cả hạng mục đều đạt chuẩn kỹ thuật sẵn sàng bàn giao.'
                    : 'Một số hạng mục chưa đạt, hồ sơ sẽ chuyển sang quy trình khắc phục / đổi xe.'}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  data-testid="node-M_InspectPre"
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50"
                  loading={submitting}
                  onClick={() => handleSubmitInspection('CHUA_DAT')}
                >
                  <XCircle className="mr-1.5 h-4 w-4" />
                  Chưa đạt (Khắc phục)
                </Button>

                <Button
                  data-testid="node-M_InspectPre"
                  className="bg-brand-600 hover:bg-brand-700 text-white"
                  loading={submitting}
                  onClick={() => handleSubmitInspection('DAT')}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Đạt & Chụp ảnh bàn giao
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
