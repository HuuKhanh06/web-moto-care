// src/features/customer/KH02Page.tsx
// Màn hình KH-02: Báo giá và hồ sơ (M_SendTerms, M_CheckDocs, M_AskDocs)
// Nâng cấp: Skeleton Shimmer & Laser Scanning khi quét AI OCR, Glassmorphism AI Card, Micro-interactions

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import { fn_request_more_docs, fn_end_cancel } from '@/engine/fn';
import { aiService } from '@/ai';
import type { AiOcrResponse } from '@/ai/types';
import type { RentalRequest, Vehicle, CustomerDocument, DocumentType } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Stepper,
  toast,
  OcrScanningSkeleton,
} from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { CUSTOMER_RENTAL_STEPS } from './constants';
import { BpmnBadge } from '@/components/common/BpmnBadge';
import {
  FileText,
  ArrowRight,
  ShieldAlert,
  Bike,
  Sparkles,
  Bot,
  Cpu,
  RefreshCw,
  CheckCircle2,
  UserCheck,
} from 'lucide-react';

export function KH02Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<AiOcrResponse | null>(null);
  const [extractedProfile, setExtractedProfile] = useState({
    fullName: '',
    idNumber: '',
    dob: '',
    licenseClass: '',
    address: '',
  });
  const [isAppliedToProfile, setIsAppliedToProfile] = useState(false);

  const [agreeTerms, setAgreeTerms] = useState(true);

  const loadData = useCallback(async () => {
    if (!requestId) {
      toast.error('Không tìm thấy mã yêu cầu thuê xe');
      navigate('/kh/01');
      return;
    }

    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Hồ sơ không tồn tại trong hệ thống');
        navigate('/kh/01');
        return;
      }
      setRequest(req);

      if (req.vehicle_id) {
        const v = await db.vehicles.get(req.vehicle_id);
        if (v) setVehicle(v);
      }

      const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      setDocuments(docs);
    } catch (err) {
      console.error('Lỗi khi nạp dữ liệu KH-02:', err);
      toast.error('Không thể nạp dữ liệu hồ sơ');
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunAiOcr = async (preset?: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'BLURRY_IMAGE' | 'NAME_MISMATCH') => {
    if (!requestId) return;
    setOcrLoading(true);
    try {
      const cccd = documents.find((d) => d.doc_type.includes('CCCD'));
      const gplx = documents.find((d) => d.doc_type.includes('BANG_LAI'));
      const res = await aiService.processOcr({
        requestId,
        cccdImageRef: cccd?.file_url || 'blob:mock_cccd.jpg',
        gplxImageRef: gplx?.file_url || 'blob:mock_gplx.jpg',
        selectedVehicleType: vehicle?.vehicle_type,
        scenarioPreset: preset || 'HIGH_CONFIDENCE',
      });
      setOcrResult(res);

      const cName = res.documents.cccd?.full_name?.value || res.documents.gplx?.full_name?.value || 'NGUYỄN VĂN AN';
      const cId = res.documents.cccd?.id_number?.value || '079095012345';
      const cDob = res.documents.cccd?.date_of_birth?.value || '1995-05-12';
      const cLic = res.documents.gplx?.license_class?.value || 'A1';
      const cAddr = 'TP. Hồ Chí Minh';

      setExtractedProfile({
        fullName: cName,
        idNumber: cId,
        dob: cDob,
        licenseClass: cLic,
        address: cAddr,
      });
      setIsAppliedToProfile(false);

      toast.success(`AI OCR bóc tách thành công: ${res.routing.action} (Độ tin cậy m = ${((res.minimum_required_confidence || 0) * 100).toFixed(0)}%)`);
    } catch (err: unknown) {
      console.error('Lỗi AI OCR:', err);
      toast.error('Lỗi khi chạy AI OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleAcceptAi = async () => {
    if (!ocrResult || !requestId) return;
    try {
      const cccdDoc = documents.find((d) => d.doc_type === 'CCCD_TRUOC');
      if (cccdDoc) {
        await db.customer_documents.update(cccdDoc.id, {
          is_valid: ocrResult.checks.image_quality === 'PASS',
          check_note: `Đã xác thực qua AI Gemini OCR (m = ${ocrResult.minimum_required_confidence})`,
        });
      }
      const gplxDoc = documents.find((d) => d.doc_type === 'BANG_LAI_TRUOC');
      if (gplxDoc) {
        await db.customer_documents.update(gplxDoc.id, {
          is_valid: ocrResult.checks.name_consistency === 'PASS',
          check_note: `Hạng ${extractedProfile.licenseClass || ocrResult.documents.gplx?.license_class?.value || 'A1'} - Khớp tên định danh`,
        });
      }

      // Cập nhật họ tên vào Profile khách hàng trong CSDL IndexedDB
      if (currentActor?.id && extractedProfile.fullName) {
        await db.profiles.update(currentActor.id, {
          full_name: extractedProfile.fullName,
        });
      }

      // Đồng bộ vào variables của quy trình BPMN để hợp đồng KH-04 và bàn giao NV-05 sử dụng
      const pState = await db.process_state.get(requestId);
      if (pState) {
        await db.process_state.update(requestId, {
          variables: {
            ...pState.variables,
            customer_full_name: extractedProfile.fullName,
            customer_id_number: extractedProfile.idNumber,
            customer_license_class: extractedProfile.licenseClass,
            customer_address: extractedProfile.address,
          },
        });
      }

      setIsAppliedToProfile(true);
      toast.success('Đã áp dụng thông tin trích xuất từ AI vào hồ sơ!');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Không thể áp dụng kết quả AI');
    }
  };

  const getDoc = (type: DocumentType) => documents.find((d) => d.doc_type === type);

  const handleQuickUpload = async (type: DocumentType, name: string) => {
    if (!requestId) return;
    const existing = getDoc(type);
    const mockUrl = `blob:mock_${type.toLowerCase()}.jpg`;

    if (existing) {
      await db.customer_documents.update(existing.id, {
        file_url: mockUrl,
        is_valid: true,
      });
    } else {
      await db.customer_documents.add({
        id: crypto.randomUUID(),
        request_id: requestId,
        doc_type: type,
        file_url: mockUrl,
        is_valid: true,
      });
    }
    toast.success(`Đã đính kèm ảnh mẫu: ${name}`);
    await loadData();
  };

  const handleVerifyDocuments = async () => {
    if (!requestId || !currentActor) return;

    if (!agreeTerms) {
      toast.warning('Vui lòng đồng ý với điều khoản và điều kiện dịch vụ');
      return;
    }

    setSubmitting(true);
    try {
      const currentDocs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      const hasCccdFront = currentDocs.some((d) => d.doc_type === 'CCCD_TRUOC' && d.is_valid);
      const hasCccdBack = currentDocs.some((d) => d.doc_type === 'CCCD_SAU' && d.is_valid);
      const hasGplxFront = currentDocs.some((d) => d.doc_type === 'BANG_LAI_TRUOC' && d.is_valid);

      const isAllValid = hasCccdFront && hasCccdBack && hasGplxFront;

      if (isAllValid) {
        await engine.advance(requestId, 'M_CheckDocs', undefined, currentActor);
        toast.success('Hồ sơ đã được thẩm định đạt! Chuyển sang thanh toán tiền cọc.');
        navigate(`/kh/03?requestId=${requestId}`);
      } else {
        const newCount = await fn_request_more_docs(requestId, currentActor);

        if (newCount > 3) {
          await fn_end_cancel(requestId, currentActor, 'HO_SO_KHONG_DAT');
          toast.error('Hồ sơ bị từ chối và hủy tự động do vượt quá 3 lần bổ sung.');
        } else {
          toast.warning(`Hồ sơ thiếu hoặc chưa đạt. Đã ghi nhận lần yêu cầu bổ sung thứ ${newCount}/3.`);
        }
        await loadData();
      }
    } catch (err: unknown) {
      console.error('Lỗi thẩm định hồ sơ:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi khi thẩm định hồ sơ';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !request) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-brand-600 mb-2" />
        <span>Đang nạp báo giá và hồ sơ...</span>
      </div>
    );
  }

  const isCancelled = request.status === 'DA_HUY' || request.status === 'TU_CHOI';
  const isMovedToDeposit = ['CHO_COC', 'CHO_KY', 'CHO_BAN_GIAO', 'DANG_THUE'].includes(request.status);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-24 sm:pb-8 animate-in fade-in duration-300">
      {/* Stepper */}
      <Card className="p-4 border-slate-200/80 shadow-sm bg-white/90 backdrop-blur-md">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={1} />
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70 shadow-2xs">
              Bước 2 &bull; Xác thực hồ sơ &amp; Báo giá
            </span>
            <BpmnBadge nodeId="M_CheckDocs" name="AI OCR & Thẩm định" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Xác thực hồ sơ & Báo giá
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Xem chi tiết biểu phí và tải ảnh giấy tờ để hệ thống xác thực tự động
          </p>
        </div>

        <Badge variant={getStatusBadgeVariant(request.status)} size="md">
          {getStatusLabel(request.status)}
        </Badge>
      </div>

      {/* Cảnh báo khi bị hủy do quá 3 lần */}
      {isCancelled && (
        <Card className="p-5 border-red-300 bg-red-50 text-red-900 space-y-3">
          <div className="flex items-center gap-2 font-bold text-base text-red-800">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            Hồ sơ thuê xe đã dừng xử lý
          </div>
          <p className="text-xs text-red-700 leading-relaxed">
            Hồ sơ đã vượt quá số lần tải lại giấy tờ cho phép. Vui lòng tạo yêu cầu thuê mới khi bạn đã có sẵn ảnh chụp rõ nét.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="bg-white text-red-700 border-red-300 hover:bg-red-50"
          >
            Tạo yêu cầu thuê mới
          </Button>
        </Card>
      )}

      {/* 1. Báo giá chi tiết */}
      <Card className="p-6 border-slate-200/80 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bike className="w-5 h-5 text-brand-600" />
            <span>Phương tiện được phân bổ</span>
          </h2>
          <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
            #{request.id.slice(-8).toUpperCase()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100 flex items-center gap-3">
            {vehicle && (
              <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-white border border-slate-200/60 p-1 flex items-center justify-center shadow-xs">
                <img
                  src={getVehicleImageUrl(vehicle.model)}
                  alt={vehicle.model}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-slate-500 block mb-0.5 text-[11px]">Mẫu xe & Biển số</span>
              <span className="font-extrabold text-slate-900 text-sm block truncate">
                {vehicle?.model || 'Đang phân bổ'}
              </span>
              <span className="text-brand-700 font-mono font-semibold text-xs">
                {vehicle?.plate || 'Chờ gán'}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-100">
            <span className="text-slate-500 block mb-1">Thời gian nhận xe</span>
            <span className="font-extrabold text-slate-800 text-xs block">
              {formatDateTime(request.start_at)}
            </span>
            <span className="text-slate-400 text-[11px]">Đến: {formatDateTime(request.end_at)}</span>
          </div>

          <div className="p-3.5 rounded-2xl bg-brand-50/60 border border-brand-200/60">
            <span className="text-brand-800 font-medium block mb-1">Tiền cọc giữ xe (30%)</span>
            <span className="font-black text-brand-800 text-base font-mono block">
              {formatCurrency(request.deposit_amount || 0)}
            </span>
            <span className="text-brand-600 text-[11px]">
              Tổng thuê: {formatCurrency(request.total_price || 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Giấy tờ định danh & AI Gemini OCR */}
      <Card className="p-6 border-slate-200/80 shadow-md space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-600" />
            <span>Giấy tờ định danh bắt buộc (3/3)</span>
          </h2>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500">Số lần yêu cầu:</span>
            <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${
              request.doc_request_count > 2 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
            }`}>
              {request.doc_request_count}/3
            </span>
          </div>
        </div>

        <div className="space-y-3.5">
          {[
            {
              type: 'CCCD_TRUOC' as DocumentType,
              title: 'Căn cước công dân (Mặt trước)',
              desc: 'Rõ họ tên, số CCCD, hình chân dung không bị bóng sáng',
            },
            {
              type: 'CCCD_SAU' as DocumentType,
              title: 'Căn cước công dân (Mặt sau)',
              desc: 'Rõ đặc điểm nhận dạng, chip điện tử và ngày cấp',
            },
            {
              type: 'BANG_LAI_TRUOC' as DocumentType,
              title: 'Giấy phép lái xe A1 / A2 (Mặt trước)',
              desc: 'Hạng xe phù hợp với phân khúc xe bạn đã chọn',
            },
          ].map((item) => {
            const doc = getDoc(item.type);
            const isUploaded = Boolean(doc?.file_url);

            return (
              <div
                key={item.type}
                className="p-4 rounded-2xl border border-slate-200/80 bg-white hover:border-brand-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-slate-900 text-sm">{item.title}</span>
                    {isUploaded ? (
                      <Badge variant="success">Đã đính kèm</Badge>
                    ) : (
                      <Badge variant="waiting">Chưa có</Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickUpload(item.type, item.title)}
                    className="text-xs"
                    disabled={isCancelled}
                  >
                    Nạp ảnh mẫu nhanh
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* KHUNG GỢI Ý AI AGENT OCR VỚI SKELETON SHIMMER VÀ LASER SCANNING */}
        <div className="p-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50/60 via-white to-purple-50/30 shadow-md space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm shadow-purple-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="font-extrabold text-slate-900 text-sm">AI Agent OCR (T02b &bull; M_CheckDocs)</span>
                <span className="block text-xs text-slate-500">Bóc tách thực thể CCCD/GPLX & thẩm định độ tin cậy kép</span>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              variant="primary"
              loading={ocrLoading}
              onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
              className="bg-purple-700 hover:bg-purple-600 text-white shadow-purple-600/20"
            >
              <Cpu className="w-3.5 h-3.5 mr-1.5" />
              Chạy AI OCR Thẩm định
            </Button>
          </div>

          {/* Khi đang quét OCR: Hiển thị Skeleton Shimmer + Laser Animation */}
          {ocrLoading && <OcrScanningSkeleton />}

          {/* Hiển thị kết quả AI nếu có */}
          {!ocrLoading && ocrResult && (
            <div className="p-4 bg-white/90 backdrop-blur-md rounded-2xl border border-purple-100 text-xs space-y-3 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-700">Điểm tin cậy m:</span>
                  <span className="font-mono font-black text-purple-700 text-sm">
                    {ocrResult.minimum_required_confidence !== null
                      ? `${(ocrResult.minimum_required_confidence * 100).toFixed(1)}%`
                      : 'N/A'}
                  </span>
                </div>
                <Badge
                  variant={
                    ocrResult.routing.action === 'PREFILL_FOR_RULES'
                      ? 'success'
                      : ocrResult.routing.action === 'MANUAL_REVIEW'
                      ? 'waiting'
                      : 'danger'
                  }
                >
                  {ocrResult.routing.action}
                </Badge>
              </div>

              {ocrResult.documents.cccd && (
                <div className="text-xs text-slate-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                  <div><strong>CCCD:</strong> {ocrResult.documents.cccd.full_name?.value || 'N/A'}</div>
                  <div><strong>Ngày sinh:</strong> {ocrResult.documents.cccd.date_of_birth?.value || 'N/A'}</div>
                  <div><strong>Số:</strong> {ocrResult.documents.cccd.id_number?.value || 'N/A'}</div>
                </div>
              )}

              {ocrResult.documents.gplx && (
                <div className="text-xs text-slate-700 bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex flex-wrap gap-x-4 gap-y-1">
                  <div><strong>GPLX:</strong> {ocrResult.documents.gplx.full_name?.value || 'N/A'}</div>
                  <div><strong>Hạng:</strong> {ocrResult.documents.gplx.license_class?.value || 'N/A'}</div>
                </div>
              )}

              {/* Form xác nhận thông tin bóc tách đưa lên giao diện FE */}
              <div className="mt-3 pt-3 border-t border-purple-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4 text-purple-600" />
                    Thông tin định danh bóc tách lên giao diện (AI Auto-fill)
                  </span>
                  {isAppliedToProfile && (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã lưu vào hồ sơ
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Họ và tên (CCCD/GPLX)
                    </label>
                    <Input
                      value={extractedProfile.fullName}
                      onChange={(e) =>
                        setExtractedProfile((p) => ({ ...p, fullName: e.target.value }))
                      }
                      placeholder="Họ và tên khách hàng"
                      className="text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Số Căn cước công dân (CCCD)
                    </label>
                    <Input
                      value={extractedProfile.idNumber}
                      onChange={(e) =>
                        setExtractedProfile((p) => ({ ...p, idNumber: e.target.value }))
                      }
                      placeholder="Số CCCD 12 số"
                      className="text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Ngày sinh
                    </label>
                    <Input
                      value={extractedProfile.dob}
                      onChange={(e) =>
                        setExtractedProfile((p) => ({ ...p, dob: e.target.value }))
                      }
                      placeholder="YYYY-MM-DD"
                      className="text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Hạng Giấy phép lái xe
                    </label>
                    <Input
                      value={extractedProfile.licenseClass}
                      onChange={(e) =>
                        setExtractedProfile((p) => ({ ...p, licenseClass: e.target.value }))
                      }
                      placeholder="A1 / A2 / B2"
                      className="text-xs font-bold uppercase text-purple-700"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Nơi thường trú
                    </label>
                    <Input
                      value={extractedProfile.address}
                      onChange={(e) =>
                        setExtractedProfile((p) => ({ ...p, address: e.target.value }))
                      }
                      placeholder="Địa chỉ thường trú"
                      className="text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    onClick={handleAcceptAi}
                    className="bg-purple-700 hover:bg-purple-600 text-white shadow-xs"
                    data-testid="ai-accept"
                  >
                    <Bot className="w-3.5 h-3.5 mr-1.5" />
                    Áp dụng & Lưu vào hồ sơ cá nhân
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Các nút giả lập kịch bản demo */}
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-purple-100/70 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-600">Thử kịch bản demo:</span>
            <button
              type="button"
              onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold border border-emerald-200 transition-colors"
            >
              m=96% (Tự động)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('MEDIUM_CONFIDENCE')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-bold border border-amber-200 transition-colors"
            >
              m=87% (Cần duyệt)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('LOW_CONFIDENCE')}
              className="px-2.5 py-1 rounded-lg bg-red-50 text-red-800 hover:bg-red-100 text-[11px] font-bold border border-red-200 transition-colors"
            >
              m=65% (Chụp lại)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('NAME_MISMATCH')}
              className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 hover:bg-amber-100 text-[11px] font-bold border border-amber-200 transition-colors"
            >
              Lệch tên
            </button>
          </div>
        </div>

        {/* Checkbox chấp thuận điều khoản */}
        <div className="pt-3 border-t border-slate-100">
          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-0.5 rounded text-brand-600 focus:ring-brand-500"
              disabled={isCancelled}
            />
            <span>
              Tôi xác nhận thông tin giấy tờ trên là chính chủ và hoàn toàn đồng ý với các điều khoản thuê xe, mức phí cọc 30% cùng quy chế bồi hoàn của MOTO CARE.
            </span>
          </label>
        </div>

        {/* Nút hành động Desktop */}
        {!isCancelled && !isMovedToDeposit && (
          <div className="hidden sm:flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={submitting}
              data-testid="node-M_CheckDocs"
              onClick={handleVerifyDocuments}
              className="flex items-center justify-center gap-2 px-8"
            >
              <span>Nộp hồ sơ & Xác nhận cọc</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Sticky Bottom Bar trên Mobile */}
        {!isCancelled && !isMovedToDeposit && (
          <div className="sm:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-4 z-40 shadow-2xl flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] text-slate-500">Cọc giữ xe (30%):</div>
              <div className="text-base font-black text-brand-700">
                {formatCurrency(request.deposit_amount || 0)}
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={submitting}
              data-testid="node-M_CheckDocs"
              onClick={handleVerifyDocuments}
              className="flex items-center gap-1.5"
            >
              <span>Nộp hồ sơ</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
