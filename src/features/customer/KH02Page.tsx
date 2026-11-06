// src/features/customer/KH02Page.tsx
// Màn hình 2: Xác thực hồ sơ và xem thông tin biểu phí

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
  Input,
  toast,
  BookingProgress,
  StatusChip,
  StickyBottomBar,
  OcrScanningSkeleton,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { getVehicleImageUrl } from '@/lib/vehicleImages';
import { useBpmnStore } from '@/features/bpmn/bpmnStore';
import {
  FileText,
  ArrowRight,
  ShieldAlert,
  Bike,
  Sparkles,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';
import { COPY } from '@/copy';

export function KH02Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);
  const isBpmnMode = useBpmnStore((s) => s.isBpmnMode);

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
      const cAddr = 'Đà Nẵng';

      setExtractedProfile({
        fullName: cName,
        idNumber: cId,
        dob: cDob,
        licenseClass: cLic,
        address: cAddr,
      });
      setIsAppliedToProfile(false);
      toast.success('Đã xác thực thông tin giấy tờ thành công!');
    } catch (err: unknown) {
      console.error('Lỗi AI OCR:', err);
      toast.error('Có lỗi khi xác thực giấy tờ');
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
          check_note: 'Đã xác thực tự động',
        });
      }
      const gplxDoc = documents.find((d) => d.doc_type === 'BANG_LAI_TRUOC');
      if (gplxDoc) {
        await db.customer_documents.update(gplxDoc.id, {
          is_valid: ocrResult.checks.name_consistency === 'PASS',
          check_note: `Hạng ${extractedProfile.licenseClass || 'A1'} - Khớp tên định danh`,
        });
      }

      if (currentActor?.id && extractedProfile.fullName) {
        await db.profiles.update(currentActor.id, {
          full_name: extractedProfile.fullName,
        });
      }

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
      toast.success('Đã lưu thông tin vào hồ sơ thuê xe!');
      await loadData();
    } catch (err) {
      console.error(err);
      toast.error('Không thể lưu kết quả');
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
    toast.success(`Đã đính kèm ảnh: ${name}`);
    await loadData();
  };

  const handleVerifyDocuments = async () => {
    if (!requestId || !currentActor) return;

    if (!agreeTerms) {
      toast.warning('Vui lòng đồng ý với điều khoản dịch vụ');
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
        navigate(`/kh/03?requestId=${requestId}`);
      } else {
        const newCount = await fn_request_more_docs(requestId, currentActor);

        if (newCount > 3) {
          await fn_end_cancel(requestId, currentActor, 'HO_SO_KHONG_DAT');
          toast.error('Hồ sơ đã bị hủy do chưa đủ giấy tờ sau 3 lần thông báo.');
        } else {
          toast.warning(`Vui lòng bổ sung đủ 3 ảnh giấy tờ (Lần ${newCount}/3).`);
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
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang nạp thông tin hồ sơ...</span>
      </div>
    );
  }

  const isCancelled = request.status === 'DA_HUY' || request.status === 'TU_CHOI';
  const isMovedToDeposit = ['CHO_COC', 'CHO_KY', 'CHO_BAN_GIAO', 'DANG_THUE'].includes(request.status);

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* 4 Bước tiến trình */}
      <BookingProgress currentStep={2} />

      {/* Tiêu đề trang (1-3 từ, không phụ đề) */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.BOOKING_INFO}
        </h1>
        <StatusChip
          status={isCancelled ? 'error' : isMovedToDeposit ? 'success' : 'pending'}
          label={isCancelled ? 'Đã hủy' : isMovedToDeposit ? 'Hồ sơ đạt' : 'Chờ xác thực'}
        />
      </div>

      {isCancelled && (
        <Card className="p-4 md:p-6 border border-rose-200 bg-rose-50 rounded-xl space-y-3">
          <div className="flex items-center gap-2 font-semibold text-base text-rose-800">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Yêu cầu thuê xe đã dừng xử lý</span>
          </div>
          <p className="text-sm text-rose-700">
            {request.closed_reason === 'HO_SO_KHONG_DAT'
              ? 'Hồ sơ chưa đạt sau 3 lần bổ sung. Vui lòng tạo yêu cầu mới khi có ảnh giấy tờ rõ nét.'
              : 'Yêu cầu thuê xe đã kết thúc hoặc bị hủy.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="bg-white text-rose-700 border-rose-300"
          >
            Thuê xe khác
          </Button>
        </Card>
      )}

      {/* 1. Xe được phân bổ & Chi phí */}
      <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Bike className="w-5 h-5 text-teal-700 shrink-0" />
          <h2 className="text-lg font-semibold text-slate-900">Thông tin xe & Lịch thuê</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-3">
            {vehicle && (
              <div className="h-12 w-16 shrink-0 rounded-lg bg-white border border-slate-200 p-1 flex items-center justify-center">
                <img
                  src={getVehicleImageUrl(vehicle.model)}
                  alt={vehicle.model}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[13px] text-slate-500 block">Dòng xe</span>
              <span className="font-semibold text-slate-900 text-sm block truncate">
                {vehicle?.model || 'Đang phân bổ'}
              </span>
              <span className="text-teal-700 font-semibold text-[13px]">
                {vehicle?.plate || 'Chờ bàn giao'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[13px] text-slate-500 block">Nhận xe</span>
            <span className="font-semibold text-slate-900 text-sm block">
              {formatDateTime(request.start_at)}
            </span>
            <span className="text-[13px] text-slate-500 mt-1 block">
              Trả: {formatDateTime(request.end_at)}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <span className="text-[13px] text-teal-900 font-semibold block">Tiền cọc giữ xe (30%)</span>
            <span className="font-semibold text-xl text-teal-800 block mt-0.5">
              {formatCurrency(request.deposit_amount || 0)}
            </span>
            <span className="text-[13px] text-teal-700 mt-1 block">
              Tổng tiền thuê: {formatCurrency(request.total_price || 0)}
            </span>
          </div>
        </div>
      </Card>

      {/* 2. Giấy tờ định danh */}
      <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-700 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900">Giấy tờ tùy thân (3 ảnh)</h2>
          </div>
          <span className="text-[13px] font-normal text-slate-500">
            {documents.filter((d) => d.is_valid).length}/3 ảnh đã tải
          </span>
        </div>

        <div className="space-y-3">
          {[
            {
              type: 'CCCD_TRUOC' as DocumentType,
              title: 'Căn cước công dân (Mặt trước)',
              desc: 'Rõ họ tên, số CCCD và ảnh chân dung',
            },
            {
              type: 'CCCD_SAU' as DocumentType,
              title: 'Căn cước công dân (Mặt sau)',
              desc: 'Rõ đặc điểm nhận dạng và ngày cấp',
            },
            {
              type: 'BANG_LAI_TRUOC' as DocumentType,
              title: 'Bằng lái xe máy (Mặt trước)',
              desc: 'Hạng A1 hoặc A2 còn hạn sử dụng',
            },
          ].map((item) => {
            const doc = getDoc(item.type);
            const isUploaded = Boolean(doc?.file_url);

            return (
              <div
                key={item.type}
                className="p-4 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{item.title}</span>
                    <StatusChip
                      status={isUploaded ? 'success' : 'pending'}
                      label={isUploaded ? 'Đã tải' : 'Chưa có'}
                      size="sm"
                    />
                  </div>
                  <p className="text-[13px] text-slate-500 mt-0.5">{item.desc}</p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickUpload(item.type, item.title)}
                  disabled={isCancelled}
                  className="shrink-0"
                >
                  {isUploaded ? 'Thay ảnh' : 'Tải ảnh lên'}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Khung quét tự động */}
        <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-slate-900 text-sm">Xác thực thông tin tự động</span>
              <p className="text-[13px] text-slate-500 mt-0.5">Tự động trích xuất họ tên & số giấy tờ để lập hợp đồng</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              loading={ocrLoading}
              onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
              className="shrink-0"
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Quét tự động
            </Button>
          </div>

          {ocrLoading && <OcrScanningSkeleton />}

          {!ocrLoading && ocrResult && (
            <div className="p-4 bg-white rounded-xl border border-slate-200 text-sm space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Họ và tên"
                  value={extractedProfile.fullName}
                  onChange={(e) => setExtractedProfile((p) => ({ ...p, fullName: e.target.value }))}
                />
                <Input
                  label="Số CCCD"
                  value={extractedProfile.idNumber}
                  onChange={(e) => setExtractedProfile((p) => ({ ...p, idNumber: e.target.value }))}
                />
                <Input
                  label="Ngày sinh"
                  value={extractedProfile.dob}
                  onChange={(e) => setExtractedProfile((p) => ({ ...p, dob: e.target.value }))}
                />
                <Input
                  label="Hạng bằng lái"
                  value={extractedProfile.licenseClass}
                  onChange={(e) => setExtractedProfile((p) => ({ ...p, licenseClass: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                {isAppliedToProfile && (
                  <span className="flex items-center gap-1 text-[13px] font-semibold text-emerald-800 mr-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Đã lưu thông tin
                  </span>
                )}
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAcceptAi}
                  data-testid="ai-accept"
                >
                  Áp dụng vào hợp đồng
                </Button>
              </div>
            </div>
          )}

          {isBpmnMode && (
            <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-200 text-[13px] text-slate-500">
              <span className="font-semibold text-slate-700">Kịch bản kiểm thử:</span>
              <button
                type="button"
                onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
                className="px-2 py-0.5 rounded bg-white border border-slate-300 text-xs text-slate-700"
              >
                Chuẩn 96%
              </button>
              <button
                type="button"
                onClick={() => handleRunAiOcr('NAME_MISMATCH')}
                className="px-2 py-0.5 rounded bg-white border border-slate-300 text-xs text-slate-700"
              >
                Lệch tên
              </button>
            </div>
          )}
        </div>

        {/* Cam kết điều khoản */}
        <div className="pt-2 border-t border-slate-100">
          <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => setAgreeTerms(e.target.checked)}
              className="mt-1 rounded text-teal-600 focus:ring-teal-500"
              disabled={isCancelled}
            />
            <span>
              Tôi xác nhận thông tin giấy tờ là chính xác và đồng ý với điều khoản thuê xe, mức cọc 30% của MotoCare.
            </span>
          </label>
        </div>

        {/* Nút hành động Desktop */}
        {!isCancelled && !isMovedToDeposit && (
          <div className="hidden md:flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={submitting}
              data-testid="node-M_CheckDocs"
              onClick={handleVerifyDocuments}
              className="flex items-center gap-2 px-8 min-w-[200px]"
            >
              <span>{COPY.ACTION.DEPOSIT}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Sticky CTA trên Mobile */}
        {!isCancelled && !isMovedToDeposit && (
          <StickyBottomBar className="md:hidden">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[13px] text-slate-500">Tiền cọc giữ xe (30%):</div>
                <div className="text-lg font-semibold text-slate-900">
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
                className="flex items-center gap-2 min-w-[140px]"
              >
                <span>{COPY.ACTION.DEPOSIT}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </StickyBottomBar>
        )}
      </Card>
    </div>
  );
}
