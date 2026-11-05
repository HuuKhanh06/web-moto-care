// src/features/customer/KH08Page.tsx
// Màn hình KH-08: Báo sự cố & Theo dõi cứu hộ (SP2: SC_Create, SC_Track, SC_SendContinue, SC_NotifyEarly)
// Khách hàng gửi vị trí GPS/mô tả sự cố, tải ảnh, theo dõi phản hồi thời gian thực qua useLiveQuery.

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import {
  Card,
  Button,
  Badge,
  Input,
  Textarea,
  FileUpload,
  toast,
} from '@/components/ui';
import type { FileUploadResult } from '@/components/ui/FileUpload';
import {
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import {
  Wrench,
  AlertTriangle,
  MapPin,
  Camera,
  Clock,
  CheckCircle2,
  PhoneCall,
  UserCheck,
  ShieldCheck,
  ArrowRight,
  Navigation,
} from 'lucide-react';

export function KH08Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  // Form báo cáo sự cố (SC_Create)
  const [description, setDescription] = useState('');
  const [locationText, setLocationText] = useState('');
  const [latitude, setLatitude] = useState<number | undefined>(undefined);
  const [longitude, setLongitude] = useState<number | undefined>(undefined);
  const [incidentPhoto, setIncidentPhoto] = useState<string>('');
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Truy vấn dữ liệu thời gian thực (Live Query) từ Dexie
  const liveData = useLiveQuery(async () => {
    if (!requestId) return null;

    const [req, pState] = await Promise.all([
      db.rental_requests.get(requestId),
      db.process_state.get(requestId),
    ]);
    if (!req) return null;

    const [v, inc] = await Promise.all([
      req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
      db.incidents.where('request_id').equals(requestId).reverse().first(),
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
      request: req,
      vehicle: v,
      processState: pState,
      incident: inc,
      partner,
      lastDispatch,
    };
  }, [requestId]);

  // Lấy tọa độ GPS tự động từ trình duyệt
  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.warning('Trình duyệt không hỗ trợ định vị tự động. Vui lòng nhập địa chỉ.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setLocationText(`Tọa độ GPS: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`);
        setLocating(false);
        toast.success('Đã lấy tọa độ định vị hiện tại!');
      },
      (err) => {
        console.warn('Lỗi định vị:', err);
        setLocating(false);
        toast.warning('Không thể lấy vị trí GPS tự động. Vui lòng nhập vị trí bằng tay.');
      },
      { timeout: 8000 }
    );
  };

  // Nạp ảnh mẫu nhanh phục vụ demo đồ án
  const handleFillDemoIncident = () => {
    setDescription('Xe bị thủng lốp sau và đứt xích khi đang di chuyển trên đường');
    setLocationText('123 Đường Nguyễn Văn Cừ, Quận 5, TP.HCM');
    setLatitude(10.758);
    setLongitude(106.682);
    setIncidentPhoto('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%23DC2626" width="400" height="300"/><text fill="%23ffffff" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Ảnh chụp hiện trường sự cố xe</text></svg>');
    toast.success('Đã nạp dữ liệu sự cố mẫu');
  };

  // Gửi sự cố tại cổng M_EG (SC_Create)
  const handleSubmitIncident = async () => {
    if (!currentActor || !requestId) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!description.trim()) {
      toast.error('Vui lòng nhập mô tả sự cố gặp phải');
      return;
    }

    setSubmitting(true);
    try {
      await engine.complete(
        requestId,
        'M_EG',
        {
          event_type: 'INCIDENT',
          description: description.trim(),
          lat: latitude,
          lng: longitude,
          photo_urls: incidentPhoto ? [incidentPhoto] : [],
        },
        currentActor
      );

      toast.success('Đã gửi yêu cầu cứu hộ khẩn cấp! Đội ngũ kỹ thuật đang tiếp nhận.');
      setDescription('');
    } catch (err: unknown) {
      console.error('Lỗi gửi sự cố:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể gửi yêu cầu cứu hộ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!liveData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải thông tin theo dõi sự cố...</p>
        </div>
      </div>
    );
  }

  const { request, vehicle, incident, partner, lastDispatch } = liveData;
  const isIncidentInProgress =
    request.status === 'DANG_XU_LY_SU_CO' ||
    (incident && incident.status !== 'DONG_TIEP_TUC' && incident.status !== 'DONG_TRA_SOM');

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-bold text-rose-700 border border-rose-200/80 shadow-xs">
              Cứu hộ 24/7
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Hỗ trợ sự cố & Cứu hộ khẩn cấp
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hợp đồng #{request.id.slice(0, 8)} • Điều phối đối tác cứu hộ theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
        </div>
      </div>

      {/* Thông tin xe */}
      {vehicle && (
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-white border border-slate-200/80 p-1 flex items-center justify-center shadow-xs">
              <img
                src={getVehicleImageUrl(vehicle.model)}
                alt={vehicle.model}
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                {vehicle.model} ({vehicle.plate})
              </h3>
              <p className="text-xs text-slate-500">
                Hotline hỗ trợ kỹ thuật khẩn cấp: <strong className="text-brand-700">1900 6868</strong>
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* THÔNG BÁO TIẾP TỤC THUÊ */}
      {incident?.status === 'DONG_TIEP_TUC' && (
        <Card className="p-5 border-emerald-300 bg-emerald-50/40 text-emerald-900 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-base">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            Sự cố đã được khắc phục hoàn tất!
          </div>
          <p className="text-xs sm:text-sm">
            Kỹ thuật viên đã hỗ trợ khắc phục tại chỗ xong. Xe đạt tiêu chuẩn an toàn để bạn tiếp tục hành trình của mình.
            Chi phí phát sinh đã được nhân viên ghi nhận.
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/kh/06')}
              className="text-xs border-emerald-300 hover:bg-emerald-100"
            >
              Về trang chủ của tôi
            </Button>
          </div>
        </Card>
      )}

      {/* THÔNG BÁO HƯỚNG DẪN TRẢ XE SỚM */}
      {(incident?.status === 'DONG_TRA_SOM' || request.status === 'CHO_NHAN_XE_TRA') && (
        <Card className="p-5 border-amber-300 bg-amber-50/50 text-amber-900 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 font-bold text-base">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            Hướng dẫn trả xe sớm do sự cố kỹ thuật
          </div>
          <p className="text-xs sm:text-sm">
            Xe không thể khắc phục tại chỗ và cần đưa về trạm bảo dưỡng. Hợp đồng của bạn đã được chuyển sang trạng thái <strong>Chờ nhận xe trả</strong>.
            Nhân viên MotoCare sẽ liên hệ đón nhận xe và tiến hành quyết toán hoàn tiền cho thời gian chưa sử dụng.
          </p>
          <div className="pt-2">
            <Button
              size="sm"
              onClick={() => navigate('/kh/06')}
              className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
            >
              Xem danh sách yêu cầu thuê
            </Button>
          </div>
        </Card>
      )}

      {/* FORM BÁO CÁO SỰ CỐ MỚI */}
      {!isIncidentInProgress && incident?.status !== 'DONG_TIEP_TUC' && incident?.status !== 'DONG_TRA_SOM' && (
        <Card data-testid="node-SC_Create" className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-rose-600" />
              <h3 className="font-bold text-slate-900 text-base">
                Báo cáo sự cố khẩn cấp
              </h3>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleFillDemoIncident}
              className="text-xs text-brand-700 border-brand-300 hover:bg-brand-50"
            >
              Nạp thông tin mẫu nhanh
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mô tả chi tiết tình trạng sự cố *
              </label>
              <Textarea
                placeholder="Ví dụ: Xe bị chết máy giữa đường, phanh trước kêu to, lốp sau bị dính đinh..."
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-brand-600" />
                  Vị trí xe hiện tại
                </label>
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locating}
                  className="text-xs text-brand-700 hover:text-brand-800 font-medium flex items-center gap-1"
                >
                  <Navigation className="h-3 w-3" />
                  {locating ? 'Đang lấy tọa độ...' : 'Lấy vị trí GPS tự động'}
                </button>
              </div>
              <Input
                placeholder="Nhập địa chỉ hoặc cột mốc nơi xe gặp sự cố..."
                value={locationText}
                onChange={(e) => setLocationText(e.target.value)}
              />
              {latitude && longitude && (
                <p className="text-[11px] text-emerald-700 mt-1">
                  Tọa độ xác thực: {latitude.toFixed(5)}, {longitude.toFixed(5)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                <Camera className="h-3.5 w-3.5 text-brand-600" />
                Ảnh chụp hiện trường sự cố (Tùy chọn)
              </label>
              <FileUpload
                label="Tải ảnh chụp sự cố"
                onFileSelect={(res: FileUploadResult | null) => setIncidentPhoto(res?.previewUrl || '')}
              />
              {incidentPhoto && (
                <img
                  src={incidentPhoto}
                  alt="Hiện trường sự cố"
                  className="mt-2 h-32 w-full max-w-xs rounded-xl object-cover border"
                />
              )}
            </div>

            <div className="pt-2">
              <Button
                data-testid="node-SC_Create"
                onClick={handleSubmitIncident}
                loading={submitting}
                className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-bold"
              >
                <AlertTriangle className="mr-2 h-4 w-4" />
                Gửi yêu cầu cứu hộ khẩn cấp
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* THEO DÕI TIẾN TRÌNH CỨU HỘ THỜI GIAN THỰC */}
      {isIncidentInProgress && incident && (
        <Card data-testid="node-SC_Track" className="p-5 sm:p-6 space-y-5 border-2 border-amber-300 bg-amber-50/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600 animate-pulse" />
              <div>
                <h3 className="font-bold text-slate-900 text-base">
                  Tiến độ cứu hộ thời gian thực
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Mã phiếu sự cố: #{incident.incident_code}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                {incident.status === 'MOI' && 'Đang điều phối đối tác'}
                {incident.status === 'DANG_HO_TRO' && 'Đối tác đang di chuyển / xử lý'}
                {incident.status === 'VUOT_SLA' && 'Đã chuyển Quản lý xử lý khẩn cấp'}
              </span>
            </div>
          </div>

          {/* Chi tiết sự cố đã báo */}
          <div className="rounded-xl bg-white p-4 border border-slate-200 text-xs sm:text-sm space-y-2">
            <div className="flex justify-between items-start">
              <span className="text-slate-500 font-medium">Nội dung báo:</span>
              <span className="text-slate-400 text-xs">{formatDateTime(incident.created_at)}</span>
            </div>
            <p className="font-semibold text-slate-800">{incident.description}</p>
            {incident.photo_urls && incident.photo_urls.length > 0 && (
              <div className="pt-2">
                <img
                  src={incident.photo_urls[0]}
                  alt="Hiện trường"
                  className="h-28 w-auto rounded-lg object-cover border"
                />
              </div>
            )}
          </div>

          {/* Thông tin đối tác tiếp nhận */}
          {partner && lastDispatch ? (
            <div className="rounded-xl bg-white p-4 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-700 font-bold text-sm">
                  <UserCheck className="h-4 w-4" />
                  Đối tác cứu hộ tiếp nhận
                </div>
                <span className="text-xs text-slate-500">
                  Lần điều phối thứ <strong>#{lastDispatch.attempt_no}</strong>
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs sm:text-sm">
                <div>
                  <span className="text-slate-500 block">Đơn vị hỗ trợ:</span>
                  <strong className="text-slate-900">{partner.name}</strong>
                  <p className="text-slate-500 text-xs">Khu vực: {partner.region}</p>
                </div>

                <div>
                  <span className="text-slate-500 block">Số điện thoại liên hệ:</span>
                  <a
                    href={`tel:${partner.contact}`}
                    className="inline-flex items-center gap-1.5 font-bold text-brand-700 text-sm hover:underline mt-0.5"
                  >
                    <PhoneCall className="h-3.5 w-3.5" />
                    {partner.contact}
                  </a>
                </div>
              </div>

              <div className="rounded-lg bg-brand-50 p-3 text-xs text-brand-800 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-600 shrink-0" />
                Đối tác đã xác nhận tiếp nhận và đang trên đường đến vị trí của bạn.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-amber-300 p-6 text-center text-xs text-slate-600 space-y-2 bg-white">
              <Clock className="h-6 w-6 text-amber-500 mx-auto animate-spin" />
              <p className="font-semibold">Đang liên hệ mạng lưới đối tác cứu hộ gần nhất...</p>
              <p className="text-slate-400">
                Nếu đối tác không phản hồi trong 15 phút (SC_AckTimer) hoặc từ chối, hệ thống sẽ tự động thử đối tác tiếp theo (SC_TryNext).
              </p>
            </div>
          )}

          {/* Nút giả lập chuyển sang cổng đối tác DT-01 khi demo */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t text-xs text-slate-500">
            <span>Dành cho demo: Quản lý hoặc Đối tác có thể thao tác tiếp nhận trên Cổng đối tác DT-01.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/dt/01')}
              className="text-xs text-slate-700 hover:bg-slate-50 shrink-0"
            >
              Mở Cổng đối tác DT-01 (Mô phỏng)
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
