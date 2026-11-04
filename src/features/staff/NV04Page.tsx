// src/features/staff/NV04Page.tsx
// Màn hình NV-04: Checklist và ảnh bàn giao (M_Photo)
// Chụp/tải ảnh 4 hướng xe + đồng hồ km, gắn vào bản PRE_HANDOVER đạt có attempt_no lớn nhất.

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import type { RentalRequest, Vehicle, Inspection } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  FileUpload,
  toast,
} from '@/components/ui';
import type { FileUploadResult } from '@/components/ui/FileUpload';
import {
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Gauge,
  Fuel,
  Image as ImageIcon,
  Check,
  Send,
} from 'lucide-react';

export function NV04Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [lastPassedInspection, setLastPassedInspection] = useState<Inspection | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Dữ liệu ảnh bàn giao
  const [frontPhoto, setFrontPhoto] = useState<string>('');
  const [rearPhoto, setRearPhoto] = useState<string>('');
  const [leftPhoto, setLeftPhoto] = useState<string>('');
  const [rightPhoto, setRightPhoto] = useState<string>('');
  const [odometerPhoto, setOdometerPhoto] = useState<string>('');

  // Thông số bàn giao thực tế
  const [odometerValue, setOdometerValue] = useState<string>('12450');
  const [fuelLevel, setFuelLevel] = useState<string>('100%');

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy đơn thuê');
        navigate('/nv/01');
        return;
      }
      setRequest(req);

      if (req.vehicle_id) {
        const v = await db.vehicles.get(req.vehicle_id);
        setVehicle(v || null);
      }

      // Lấy bản ghi PRE_HANDOVER đạt có attempt_no lớn nhất
      const insp = await db.inspections
        .where('request_id')
        .equals(requestId)
        .and((i) => i.kind === 'PRE_HANDOVER' && i.result === 'DAT')
        .last();

      if (insp) {
        setLastPassedInspection(insp);
        if (insp.photo_urls && insp.photo_urls.length > 0) {
          setFrontPhoto(insp.photo_urls[0] || '');
          setRearPhoto(insp.photo_urls[1] || '');
          setLeftPhoto(insp.photo_urls[2] || '');
          setRightPhoto(insp.photo_urls[3] || '');
          setOdometerPhoto(insp.photo_urls[4] || '');
        }
      }
    } catch (err) {
      console.error('Lỗi nạp NV-04:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="mt-3 text-sm text-slate-500">Đang tải biểu mẫu ảnh bàn giao...</p>
        </div>
      </div>
    );
  }

  if (!request || !vehicle) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card className="text-center py-10">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="mt-3 text-lg font-bold text-slate-800">Không tìm thấy thông tin xe hoặc hồ sơ</h2>
          <Button className="mt-4" onClick={() => navigate('/nv/01')}>Về danh sách việc cần làm</Button>
        </Card>
      </div>
    );
  }

  // Tự động điền ảnh mẫu nhanh nếu nhân viên demo
  const handleFillDemoPhotos = () => {
    const demoImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect fill="%2300A651" width="400" height="300"/><text fill="%23ffffff" font-family="sans-serif" font-size="24" dy="10.5" font-weight="bold" x="50%" y="50%" text-anchor="middle">Ảnh chụp thực tế xe</text></svg>';
    setFrontPhoto(demoImg);
    setRearPhoto(demoImg);
    setLeftPhoto(demoImg);
    setRightPhoto(demoImg);
    setOdometerPhoto(demoImg);
    toast.success('Đã nạp 5 ảnh mẫu xe thực tế');
  };

  const allPhotosUploaded = Boolean(
    frontPhoto && rearPhoto && leftPhoto && rightPhoto && odometerPhoto
  );

  const handleSubmitPhotos = async () => {
    if (!currentActor) {
      toast.error('Vui lòng đăng nhập lại');
      return;
    }

    if (!allPhotosUploaded) {
      toast.error('Vui lòng chụp đủ 5 ảnh (4 góc xe và đồng hồ km)');
      return;
    }

    setSubmitting(true);
    try {
      const photos = [frontPhoto, rearPhoto, leftPhoto, rightPhoto, odometerPhoto];

      // Hoàn tất nút M_Photo
      await engine.complete(
        request.id,
        'M_Photo',
        {
          photo_urls: photos,
          checklist: {
            odometer: odometerValue,
            fuel_level: fuelLevel,
            submitted_at: new Date().toISOString(),
          },
        },
        currentActor
      );

      toast.success('Đã gửi checklist và ảnh cho khách hàng xác nhận (Activity_0w8x12e)!');
      navigate('/nv/01');
    } catch (err: unknown) {
      console.error('Lỗi nộp ảnh bàn giao:', err);
      toast.error(err instanceof Error ? err.message : 'Không thể hoàn tất ảnh bàn giao');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
              NV-04
            </span>
            <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">
              Checklist & Ảnh bàn giao xe (M_Photo)
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Hồ sơ thuê #{request.id.slice(0, 8)} • Xe: {vehicle.model} ({vehicle.plate})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)}>
            {getStatusLabel(request.status)}
          </Badge>
          <Badge variant="neutral" className="text-slate-600">
            BPMN: M_Photo
          </Badge>
        </div>
      </div>

      {/* Thông tin biên bản kỹ thuật đã đạt */}
      <Card className="p-4 sm:p-5 bg-brand-50/40 border-brand-200">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                Biên bản kỹ thuật đạt chuẩn (Lần #{lastPassedInspection?.attempt_no || 1})
              </h3>
              <p className="text-xs text-slate-600">
                Các hạng mục phanh, đèn, lốp, còi, gương đã được kiểm tra đạt yêu cầu.
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleFillDemoPhotos}
            className="text-brand-700 border-brand-300 hover:bg-brand-50 text-xs"
          >
            Nạp ảnh mẫu nhanh
          </Button>
        </div>
      </Card>

      {/* Thông số bàn giao: Công tơ mét & Xăng */}
      <Card className="p-5 space-y-4">
        <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <Gauge className="h-4 w-4 text-brand-600" />
          Thông số đồng hồ khi bàn giao
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Số công tơ mét hiện tại (Km ODO)
            </label>
            <Input
              type="number"
              value={odometerValue}
              onChange={(e) => setOdometerValue(e.target.value)}
              placeholder="VD: 12500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Fuel className="h-3.5 w-3.5 text-brand-600" />
              Mức xăng lúc bàn giao
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['25%', '50%', '75%', '100%'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFuelLevel(lvl)}
                  className={`rounded-lg py-2 text-xs font-semibold border transition-all ${
                    fuelLevel === lvl
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
      </Card>

      {/* Bộ 5 ảnh bàn giao */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <Camera className="h-4 w-4 text-brand-600" />
            Bộ ảnh bàn giao tình trạng xe (5 ảnh bắt buộc)
          </h3>
          <span className="text-xs text-slate-500">
            Đã chụp:{' '}
            <strong className="text-brand-600">
              {[frontPhoto, rearPhoto, leftPhoto, rightPhoto, odometerPhoto].filter(Boolean).length}/5
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Ảnh đầu xe */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              1. Đầu xe & Biển số trước {frontPhoto && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            <FileUpload
              label="Tải ảnh đầu xe"
              onFileSelect={(res: FileUploadResult | null) => setFrontPhoto(res?.previewUrl || '')}
            />
            {frontPhoto && (
              <img src={frontPhoto} alt="Đầu xe" className="mt-1 h-24 w-full rounded-lg object-cover border" />
            )}
          </div>

          {/* Ảnh đuôi xe */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              2. Đuôi xe & Biển số sau {rearPhoto && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            <FileUpload
              label="Tải ảnh đuôi xe"
              onFileSelect={(res: FileUploadResult | null) => setRearPhoto(res?.previewUrl || '')}
            />
            {rearPhoto && (
              <img src={rearPhoto} alt="Đuôi xe" className="mt-1 h-24 w-full rounded-lg object-cover border" />
            )}
          </div>

          {/* Ảnh sườn trái */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              3. Sườn bên trái {leftPhoto && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            <FileUpload
              label="Tải ảnh sườn trái"
              onFileSelect={(res: FileUploadResult | null) => setLeftPhoto(res?.previewUrl || '')}
            />
            {leftPhoto && (
              <img src={leftPhoto} alt="Sườn trái" className="mt-1 h-24 w-full rounded-lg object-cover border" />
            )}
          </div>

          {/* Ảnh sườn phải */}
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              4. Sườn bên phải {rightPhoto && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            <FileUpload
              label="Tải ảnh sườn phải"
              onFileSelect={(res: FileUploadResult | null) => setRightPhoto(res?.previewUrl || '')}
            />
            {rightPhoto && (
              <img src={rightPhoto} alt="Sườn phải" className="mt-1 h-24 w-full rounded-lg object-cover border" />
            )}
          </div>

          {/* Ảnh đồng hồ ODO */}
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
              5. Đồng hồ Km & Mức xăng {odometerPhoto && <Check className="h-3.5 w-3.5 text-emerald-600" />}
            </span>
            <FileUpload
              label="Tải ảnh công tơ mét"
              onFileSelect={(res: FileUploadResult | null) => setOdometerPhoto(res?.previewUrl || '')}
            />
            {odometerPhoto && (
              <img src={odometerPhoto} alt="Công tơ mét" className="mt-1 h-24 w-full rounded-lg object-cover border" />
            )}
          </div>
        </div>
      </Card>

      {/* Nút gửi khách xác nhận */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ImageIcon className="h-4 w-4 text-brand-600 shrink-0" />
          Ảnh và chỉ số bàn giao sẽ được gửi tới khách hàng để kiểm tra qua ứng dụng (KH-05).
        </div>

        <Button
          data-testid="node-M_Photo"
          onClick={handleSubmitPhotos}
          disabled={!allPhotosUploaded || submitting}
          loading={submitting}
          className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-bold"
        >
          <Send className="mr-2 h-4 w-4" />
          Gửi khách duyệt tình trạng xe (M_Photo)
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
