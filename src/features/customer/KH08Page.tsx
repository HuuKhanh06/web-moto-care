// src/features/customer/KH08Page.tsx
// Màn hình báo cáo sự cố & Cứu hộ khẩn cấp 24/7

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import {
  Card,
  Button,
  Input,
  Textarea,
  FileUpload,
  toast,
  StatusChip,
} from '@/components/ui';
import type { FileUploadResult } from '@/components/ui/FileUpload';
import { formatDateTime } from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { COPY } from '@/copy';
import {
  Wrench,
  AlertTriangle,
  MapPin,
  Camera,
  Clock,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  Navigation,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const COMMON_INCIDENTS = [
  'Chết máy / Không nổ được',
  'Thủng lốp / Xịt lốp',
  'Hết bình ắc quy / Mất điện',
  'Đứt phanh / Phanh không ăn',
  'Va chạm giao thông',
  'Sự cố khác',
];

export function KH08Page() {
  const [searchParams] = useSearchParams();
  const rawRequestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [incidentPhoto, setIncidentPhoto] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const toggleIncident = (type: string) => {
    setSelectedIncidents((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const liveData = useLiveQuery(async () => {
    let targetId = rawRequestId;

    if (!targetId && currentActor) {
      const activeReq = await db.rental_requests
        .where('customer_id')
        .equals(currentActor.id)
        .and((r) => r.status === 'DANG_XU_LY_SU_CO' || r.status === 'DANG_THUE')
        .first();

      if (activeReq) {
        targetId = activeReq.id;
      } else {
        const list = await db.rental_requests
          .where('customer_id')
          .equals(currentActor.id)
          .reverse()
          .sortBy('created_at');
        if (list.length > 0) {
          targetId = list[0].id;
        }
      }
    }

    if (!targetId) return null;

    const [req, pState] = await Promise.all([
      db.rental_requests.get(targetId),
      db.process_state.get(targetId),
    ]);
    if (!req) return null;

    const [v, inc] = await Promise.all([
      req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
      db.incidents.where('request_id').equals(targetId).reverse().first(),
    ]);

    let partner = undefined;
    let lastDispatch = undefined;
    if (inc) {
      lastDispatch = await db.incident_dispatches
        .where('incident_id')
        .equals(inc.id)
        .reverse()
        .first();

      if (lastDispatch?.partner_id) {
        partner = await db.partners.get(lastDispatch.partner_id);
      }
    }

    return {
      targetId,
      request: req,
      vehicle: v,
      processState: pState,
      incident: inc,
      partner,
      lastDispatch,
    };
  }, [rawRequestId, currentActor]);

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.warning('Trình duyệt không hỗ trợ định vị. Vui lòng nhập địa chỉ.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationText(`Tọa độ: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
        toast.success('Đã nhận diện tọa độ định vị.');
      },
      (err) => {
        console.warn('Lỗi định vị:', err);
        setLocating(false);
        toast.warning('Không thể lấy vị trí GPS tự động. Vui lòng nhập vị trí bằng tay.');
      },
      { timeout: 8000 }
    );
  };

  const handleSubmitIncident = async () => {
    const targetId = liveData?.targetId || rawRequestId;
    if (!currentActor || !targetId) {
      toast.error('Vui lòng chọn chuyến đi cần cứu hộ');
      return;
    }

    const combinedDescription = [
      selectedIncidents.length > 0 ? `Sự cố: ${selectedIncidents.join(', ')}` : '',
      description.trim() ? `Chi tiết: ${description.trim()}` : '',
      locationText.trim() ? `Vị trí: ${locationText.trim()}` : '',
    ].filter(Boolean).join('. ');

    if (!combinedDescription) {
      toast.warning('Vui lòng chọn loại sự cố hoặc nhập mô tả');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        targetId,
        'M_EG',
        {
          event_type: 'INCIDENT',
          description: combinedDescription,
          lat: latitude,
          lng: longitude,
          photo_urls: incidentPhoto ? [incidentPhoto] : [],
        },
        currentActor
      );

      toast.success('Đã gửi yêu cầu cứu hộ khẩn cấp! Đội ngũ kỹ thuật đang tiếp nhận.');
      setDescription('');
      setSelectedIncidents([]);
    } catch (err: unknown) {
      console.error('Lỗi gửi sự cố:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu cứu hộ');
    } finally {
      setSubmitting(false);
    }
  };

  if (liveData === undefined) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <Wrench className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang kiểm tra thông tin cứu hộ...</span>
      </div>
    );
  }

  // Khách chưa có đơn thuê nào cần cứu hộ trực tiếp
  if (liveData === null) {
    return (
      <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-2 border border-rose-200">
            <PhoneCall className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
            {COPY.TITLES.INCIDENT}
          </h1>
          <p className="text-sm text-slate-600">
            Tổng đài hỗ trợ kỹ thuật và cứu hộ đường bộ MotoCare hoạt động 24/7.
          </p>
        </div>

        <Card className="p-6 md:p-8 border border-rose-200 bg-rose-50 text-center space-y-3 rounded-xl">
          <span className="text-[13px] font-semibold text-rose-700 block uppercase tracking-wider">
            Hotline khẩn cấp 24/7
          </span>
          <a
            href="tel:19006868"
            className="inline-flex items-center justify-center gap-3 text-3xl font-semibold text-rose-700 hover:text-rose-800"
          >
            <PhoneCall className="w-8 h-8" />
            <span>1900 6868</span>
          </a>
          <p className="text-[13px] text-rose-600">
            Miễn phí cước gọi · Có mặt hỗ trợ trong vòng 15-30 phút tại Đà Nẵng
          </p>
        </Card>
      </div>
    );
  }

  const { vehicle, incident, partner } = liveData;
  const isIncidentInProgress = incident && ['MOI', 'DANG_HO_TRO', 'VUOT_SLA'].includes(incident.status);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.INCIDENT}
        </h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/kh/06')}
        >
          Chuyến đi của tôi
        </Button>
      </div>

      {/* Thông tin phương tiện */}
      {vehicle && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl flex items-center gap-4">
          <div className="w-20 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center p-1 shrink-0 overflow-hidden">
            <img
              src={getVehicleImageUrl(vehicle.model)}
              alt={vehicle.model}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 truncate">
              {vehicle.model}
            </h2>
            <p className="text-sm text-slate-500 font-mono font-medium">
              {vehicle.plate}
            </p>
          </div>
        </Card>
      )}

      {/* FORM BÁO SỰ CỐ MỚI */}
      {!isIncidentInProgress && incident?.status !== 'DONG_TIEP_TUC' && incident?.status !== 'DONG_TRA_SOM' && (
        <Card data-testid="node-SC_Create" className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Wrench className="w-5 h-5 text-rose-600" />
            <h2 className="text-base font-semibold text-slate-900">
              Gửi thông tin sự cố
            </h2>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Loại sự cố gặp phải:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_INCIDENTS.map((item) => {
                  const isSelected = selectedIncidents.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleIncident(item)}
                      className={cn(
                        'p-3 rounded-xl text-sm font-semibold border text-left transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-rose-50 border-rose-300 text-rose-800'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Chi tiết sự cố:
              </label>
              <Textarea
                placeholder="Ví dụ: Xe chết máy khi vừa qua cầu Rồng, không nổ lại được..."
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-slate-50 border-slate-200 rounded-xl"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-semibold text-slate-700 flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-teal-600" />
                  <span>Vị trí hiện tại</span>
                </label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locating}
                  className="text-[13px] text-teal-700 hover:underline font-semibold flex items-center gap-1"
                >
                  <Navigation className="w-3.5 h-3.5" />
                  <span>{locating ? 'Đang định vị...' : 'Lấy vị trí GPS'}</span>
                </button>
              </div>
              <Input
                placeholder="Nhập số nhà, tên đường hoặc địa danh gần nhất..."
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1 flex items-center gap-1">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Ảnh chụp hiện trường (nếu có)</span>
              </label>
              <FileUpload
                label="Tải ảnh sự cố"
                onFileSelect={(res: FileUploadResult | null) => setIncidentPhoto(res?.previewUrl || '')}
              />
            </div>

            <Button
              data-testid="node-SC_Create"
              variant="primary"
              onClick={handleSubmitIncident}
              loading={submitting}
              className="bg-rose-600 hover:bg-rose-700 w-full"
            >
              <AlertTriangle className="w-4 h-4 mr-1.5" />
              <span>Gửi yêu cầu cứu hộ khẩn cấp</span>
            </Button>
          </div>
        </Card>
      )}

      {/* THEO DÕI TIẾN ĐỘ CỨU HỘ */}
      {isIncidentInProgress && incident && (
        <Card data-testid="node-SC_Track" className="p-4 md:p-6 border border-amber-200 bg-white rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
              <h2 className="text-base font-semibold text-slate-900">
                Tiến độ cứu hộ
              </h2>
            </div>
            <StatusChip
              status="pending"
              label={incident.status === 'VUOT_SLA' ? 'Đang ưu tiên cao' : 'Đang xử lý'}
            />
          </div>

          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-[13px] text-slate-500 block">Nội dung sự cố:</span>
              <p className="font-semibold text-slate-900">{incident.description}</p>
              <span className="text-[13px] text-slate-500 block pt-1">
                Thời điểm ghi nhận: {formatDateTime(incident.created_at)}
              </span>
            </div>

            {partner && (
              <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <UserCheck className="w-5 h-5 text-teal-700" />
                  <span>Kỹ thuật viên đang di chuyển đến</span>
                </div>
                <p className="text-sm">
                  Đơn vị cứu hộ: <strong>{partner.name}</strong> ({partner.region})
                </p>
                <p className="text-sm">
                  Hotline liên hệ: <a href={`tel:${partner.contact}`} className="font-semibold underline">{partner.contact}</a>
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* KẾT QUẢ: ĐÃ XỬ LÝ XONG, TIẾP TỤC THUÊ */}
      {incident?.status === 'DONG_TIEP_TUC' && (
        <Card className="p-4 md:p-6 border border-emerald-200 bg-emerald-50 text-emerald-900 space-y-3 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>Sự cố đã được khắc phục thành công!</span>
          </div>
          <p className="text-sm text-emerald-800">
            Xe đã hoạt động ổn định trở lại. Bạn có thể tiếp tục hành trình của mình.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/06')}
          >
            Chuyến đi của tôi
          </Button>
        </Card>
      )}

      {/* KẾT QUẢ: TRẢ XE SỚM */}
      {incident?.status === 'DONG_TRA_SOM' && (
        <Card className="p-4 md:p-6 border border-amber-200 bg-amber-50 text-amber-900 space-y-3 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Xe đã được chuyển về trạm bảo dưỡng</span>
          </div>
          <p className="text-sm text-amber-800">
            Hệ thống đã chuyển hợp đồng sang quyết toán. MotoCare sẽ hoàn trả tiền thuê các ngày chưa sử dụng cho bạn.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/06')}
          >
            Chuyến đi của tôi
          </Button>
        </Card>
      )}
    </div>
  );
}
