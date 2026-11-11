// src/features/customer/KH02Page.tsx
// Màn hình 2: Xác thực hồ sơ và xem thông tin biểu phí
// Hỗ trợ tải ảnh thật từ thiết bị của khách hàng và tự động quét/xác thực không bắt khách bấm thủ công

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import { fn_request_more_docs, fn_end_cancel } from '@/engine/fn';
import { aiService } from '@/ai';
import { compressImageToDataUrl } from '@/ai/images';
import { OcrError, safeOcrError } from '@/ai/errors';
import { AiOcrResponseSchema, type AiOcrResponse } from '@/ai/types';
import { isValidBirthDate } from '@/ai/validation';
import { documentNamesMismatch, IDENTITY_MISMATCH_MESSAGE } from '@/ai/documentIdentity';
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
import {
  FileText,
  ArrowRight,
  ShieldAlert,
  Bike,
  RefreshCw,
  CheckCircle2,
  Check,
  AlertCircle,
  Camera,
  Upload,
  Edit3,
} from 'lucide-react';
import { COPY } from '@/copy';

const EMPTY_PROFILE = { fullName: '', idNumber: '', dob: '', licenseClass: '', address: '' };
const requiredTypes: DocumentType[] = ['CCCD_TRUOC', 'CCCD_SAU', 'BANG_LAI_TRUOC'];
const hasRequiredDocuments = (docs: CustomerDocument[]) => requiredTypes.every(type => docs.some(d => d.doc_type === type && d.file_url));
const imageSnapshot = (docs: CustomerDocument[]) => JSON.stringify(requiredTypes.map(type => {
  const doc = docs.find(d => d.doc_type === type);
  return [doc?.id, doc?.file_url];
}));

export function KH02Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const { currentActor } = useAuthStore();
  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingType, setUploadingType] = useState<DocumentType | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'IDLE' | 'PROCESSING' | 'COMPLETED' | 'FAILED'>('IDLE');
  const [ocrError, setOcrError] = useState('');
  const [identityMismatch, setIdentityMismatch] = useState(false);
  const ocrLoading = ocrStatus === 'PROCESSING';
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isCustomerConfirmed, setIsCustomerConfirmed] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState(EMPTY_PROFILE);
  const [isAppliedToProfile, setIsAppliedToProfile] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [allowCloudOcr, setAllowCloudOcr] = useState(!import.meta.env.VITE_OCR_ENDPOINT);
  const activeRequest = useRef<string | null>(requestId);
  const mounted = useRef(false);
  const ocrBusy = useRef(false);
  const uploadBusy = useRef(false);
  const confirmationBusy = useRef(false);
  const attempt = useRef('');
  const generation = useRef(0);
  const loadGeneration = useRef(0);

  useEffect(() => {
    mounted.current = true;
    activeRequest.current = requestId;
    attempt.current = '';
    generation.current++;
    ocrBusy.current = false;
    setRequest(null); setVehicle(null); setDocuments([]); setLoading(true);
    setIsEditingDetails(false); setUploadingType(null);
    setOcrStatus('IDLE');
    setOcrError('');
    setIdentityMismatch(false);
    setIsCustomerConfirmed(false);
    setIsAppliedToProfile(false);
    setExtractedProfile(EMPTY_PROFILE);
    return () => { mounted.current = false; };
  }, [requestId]);

  const inputRefCccdFront = useRef<HTMLInputElement>(null);
  const inputRefCccdBack = useRef<HTMLInputElement>(null);
  const inputRefGplxFront = useRef<HTMLInputElement>(null);
  const getInputRef = (type: DocumentType): React.RefObject<HTMLInputElement> =>
    type === 'CCCD_TRUOC' ? inputRefCccdFront : type === 'CCCD_SAU' ? inputRefCccdBack : inputRefGplxFront;
  const getDoc = (type: DocumentType) => documents.find(d => d.doc_type === type);

  const applyOcrResponse = useCallback((res: AiOcrResponse, announce = false) => {
    if (res.checks.name_consistency === 'MISMATCH') setIdentityMismatch(true);
    else if (res.checks.name_consistency === 'PASS' && res.checks.required_fields_present) setIdentityMismatch(false);
    const profile = {
      fullName: res.documents.cccd?.full_name.value || '',
      idNumber: res.documents.cccd?.id_number.value || '',
      dob: res.documents.cccd?.date_of_birth.value || '',
      licenseClass: res.documents.gplx?.license_class.value || '',
      address: '',
    };
    setExtractedProfile(profile);
    setIsCustomerConfirmed(false);
    setIsAppliedToProfile(Object.values(profile).some(Boolean));
    if (res.routing.action === 'FALLBACK_MANUAL') {
      setOcrStatus('FAILED');
      setOcrError(res.routing.reason_codes.find(code => code.startsWith('AI_ERROR:'))?.replace(/^AI_ERROR: /, '') || 'Không thể xử lý giấy tờ. Vui lòng thử lại hoặc nhập thủ công.');
    } else if (res.routing.action === 'REQUEST_REUPLOAD' || !res.checks.required_fields_present) {
      setOcrStatus('FAILED');
      setOcrError('Chưa đọc đủ thông tin bắt buộc. Vui lòng đổi ảnh rõ nét hoặc kiểm tra và nhập các trường còn thiếu.');
    } else {
      setOcrStatus('COMPLETED');
      setOcrError(res.checks.name_consistency === 'MISMATCH' ? IDENTITY_MISMATCH_MESSAGE : '');
      setIsAppliedToProfile(true);
      if (announce) toast.success('Đã đọc thông tin từ ảnh. Vui lòng đối chiếu và xác nhận bên dưới.');
    }
  }, []);

  // Callback không phụ thuộc trạng thái loading: effect nạp dữ liệu không bị gọi lại khi OCR đổi trạng thái.
  const triggerAutoOcr = useCallback(async (currentDocs: CustomerDocument[], req: RentalRequest, v: Vehicle | null, retry = false) => {
    if (!allowCloudOcr) return;
    if (!hasRequiredDocuments(currentDocs)) return;
    const key = req.id + imageSnapshot(currentDocs);
    if (ocrBusy.current || (!retry && attempt.current === key)) return;
    attempt.current = key;
    ocrBusy.current = true;
    const run = ++generation.current;
    const current = () => mounted.current && activeRequest.current === req.id && generation.current === run;
    setOcrStatus('PROCESSING');
    setOcrError('');
    setIsCustomerConfirmed(false);
    try {
      const res = await aiService.processOcr({
        requestId: req.id,
        cccdImageRef: currentDocs.find(d => d.doc_type === 'CCCD_TRUOC')?.file_url,
        cccdBackImageRef: currentDocs.find(d => d.doc_type === 'CCCD_SAU')?.file_url,
        gplxImageRef: currentDocs.find(d => d.doc_type === 'BANG_LAI_TRUOC')?.file_url,
        selectedVehicleType: v?.vehicle_type,
      });
      if (!current()) return;
      const freshDocs = await db.customer_documents.where('request_id').equals(req.id).toArray();
      if (!current()) return;
      if (imageSnapshot(freshDocs) !== imageSnapshot(currentDocs)) {
        throw new OcrError('STALE_DOCUMENTS', 'Ảnh đã thay đổi. Vui lòng quét lại bộ ảnh mới.');
      }
      setDocuments(freshDocs);
      applyOcrResponse(res, true);
    } catch (error) {
      if (current()) {
        setOcrStatus('FAILED');
        setOcrError(safeOcrError(error).message);
      }
    } finally {
      if (generation.current === run) ocrBusy.current = false;
    }
  }, [applyOcrResponse, allowCloudOcr]);

  const loadData = useCallback(async () => {
    if (!requestId) { toast.error('Không tìm thấy mã yêu cầu thuê xe'); navigate('/kh/01'); return; }
    const load = ++loadGeneration.current;
    const current = () => mounted.current && activeRequest.current === requestId && loadGeneration.current === load;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!current()) return;
      if (!req || (currentActor?.role === 'khach_hang' && req.customer_id !== currentActor.id)) {
        toast.error('Không tìm thấy hồ sơ của bạn'); navigate('/kh/01'); return;
      }
      const foundVehicle = req.vehicle_id ? await db.vehicles.get(req.vehicle_id) || null : null;
      const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      const pState = await db.process_state.get(requestId);
      if (!current()) return;
      setRequest(req); setVehicle(foundVehicle); setDocuments(docs);
      const mismatch = documentNamesMismatch(docs) || pState?.variables.document_identity_mismatch === true;
      setIdentityMismatch(mismatch);
      if (mismatch) setOcrError(IDENTITY_MISMATCH_MESSAGE);
      if (!mismatch && hasRequiredDocuments(docs) && docs.every(d => d.is_valid === true) && pState?.variables.customer_id_number) {
        setExtractedProfile({
          fullName: String(pState.variables.customer_full_name || ''),
          idNumber: String(pState.variables.customer_id_number || ''),
          dob: String(pState.variables.customer_date_of_birth || ''),
          licenseClass: String(pState.variables.customer_license_class || ''),
          address: String(pState.variables.customer_address || ''),
        });
        setIsAppliedToProfile(true); setIsCustomerConfirmed(true); setOcrStatus('COMPLETED');
      } else if (hasRequiredDocuments(docs)) {
        // Kết quả lưu cùng transaction với bộ ảnh; đổi ảnh xóa ai_source của cả bộ.
        const reusableSource = docs.every(d => import.meta.env.VITE_OCR_ENDPOINT ? d.ai_source === 'GEMINI' : Boolean(d.ai_source));
        const lastLog = reusableSource ? await db.ai_logs.where('request_id').equals(requestId).last() : undefined;
        if (!current()) return;
        const parsed = lastLog ? AiOcrResponseSchema.safeParse(lastLog.output) : null;
        if (parsed?.success && parsed.data.model_version !== 'ocr-mock-v1') {
          attempt.current = req.id + imageSnapshot(docs);
          applyOcrResponse(parsed.data);
        } else {
          void triggerAutoOcr(docs, req, foundVehicle);
        }
      }
    } catch {
      if (current()) toast.error('Không thể nạp dữ liệu hồ sơ. Vui lòng tải lại trang.');
    } finally {
      if (current()) setLoading(false);
    }
  }, [requestId, navigate, currentActor?.id, currentActor?.role, triggerAutoOcr, applyOcrResponse]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleRealFileSelect = async (type: DocumentType, e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const file = input.files?.[0];
    if (!file || !requestId || !request || uploadBusy.current || ocrBusy.current || confirmationBusy.current) return;
    uploadBusy.current = true;
    setUploadingType(type);
    const uploadRequestId = requestId;
    const current = () => mounted.current && activeRequest.current === uploadRequestId;
    try {
      const dataUrl = await compressImageToDataUrl(file);
      if (!current()) return;
      await db.transaction('rw', db.customer_documents, db.process_state, async () => {
        const docs = await db.customer_documents.where('request_id').equals(uploadRequestId).toArray();
        for (const doc of docs) {
          await db.customer_documents.update(doc.id, {
            is_valid: false, ai_result: null, ai_confidence: null, ai_source: undefined,
            check_note: doc.check_note === 'Khách hàng đã kiểm tra & xác nhận' ? '' : doc.check_note,
          });
        }
        const existing = docs.find(d => d.doc_type === type);
        await db.customer_documents.put({
          id: existing?.id || crypto.randomUUID(), request_id: uploadRequestId, doc_type: type,
          file_url: dataUrl, check_note: file.name, is_valid: false,
        });
        const state = await db.process_state.get(uploadRequestId);
        if (state) {
          const variables: Record<string, unknown> = { ...state.variables, docs_all_valid: false, document_identity_mismatch: false };
          for (const key of ['customer_full_name', 'customer_id_number', 'customer_date_of_birth', 'customer_license_class', 'customer_address']) delete variables[key];
          await db.process_state.update(uploadRequestId, { variables });
        }
      });
      if (!current()) return;
      const docs = await db.customer_documents.where('request_id').equals(uploadRequestId).toArray();
      if (!current()) return;
      attempt.current = '';
      setIdentityMismatch(false);
      setDocuments(docs); setIsCustomerConfirmed(false); setIsAppliedToProfile(false);
      setExtractedProfile(EMPTY_PROFILE); setOcrError(''); setOcrStatus('IDLE');
      toast.success('Đã lưu ảnh giấy tờ.');
      void triggerAutoOcr(docs, request, vehicle);
    } catch (error) {
      if (current()) toast.error(error instanceof OcrError ? error.message : 'Không lưu được ảnh giấy tờ. Vui lòng thử lại.');
    } finally {
      uploadBusy.current = false;
      if (current()) setUploadingType(null);
      input.value = '';
    }
  };

  const handleConfirmCustomerData = async () => {
    if (!requestId || ocrBusy.current || uploadBusy.current || confirmationBusy.current) return;
    if (identityMismatch) { toast.warning(IDENTITY_MISMATCH_MESSAGE); return; }
    if (!extractedProfile.fullName.trim() || !/^0\d{11}$/.test(extractedProfile.idNumber) || !isValidBirthDate(extractedProfile.dob) || !extractedProfile.licenseClass.trim()) {
      toast.warning('Vui lòng kiểm tra họ tên, số CCCD 12 chữ số, ngày sinh và hạng bằng lái.');
      setIsEditingDetails(true); return;
    }
    confirmationBusy.current = true; setSubmitting(true);
    try {
      await db.transaction('rw', db.profiles, db.process_state, db.customer_documents, async () => {
        const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
        if (!hasRequiredDocuments(docs) || imageSnapshot(docs) !== imageSnapshot(documents)) {
          throw new OcrError('STALE_DOCUMENTS', 'Ảnh đã thay đổi. Vui lòng kiểm tra lại trước khi xác nhận.');
        }
        const state = await db.process_state.get(requestId);
        if (!state) throw new OcrError('STORAGE_ERROR', 'Không tìm thấy trạng thái hồ sơ. Vui lòng tải lại trang.');
        if (documentNamesMismatch(docs) || state.variables.document_identity_mismatch === true) {
          setIdentityMismatch(true);
          throw new OcrError('IDENTITY_MISMATCH', IDENTITY_MISMATCH_MESSAGE);
        }
        if (currentActor?.id) await db.profiles.update(currentActor.id, { full_name: extractedProfile.fullName });
        await db.process_state.update(requestId, { variables: {
          ...state.variables, customer_full_name: extractedProfile.fullName, customer_id_number: extractedProfile.idNumber,
          customer_date_of_birth: extractedProfile.dob, customer_license_class: extractedProfile.licenseClass,
          customer_address: extractedProfile.address,
        } });
        for (const doc of docs) await db.customer_documents.update(doc.id, { is_valid: true, check_note: 'Khách hàng đã kiểm tra & xác nhận' });
      });
      if (mounted.current && activeRequest.current === requestId) {
        setIsCustomerConfirmed(true); setIsAppliedToProfile(true); setIsEditingDetails(false);
        toast.success('Đã xác nhận thông tin giấy tờ.');
      }
    } catch (error) {
      toast.error(error instanceof OcrError ? error.message : 'Không thể lưu thông tin xác thực. Vui lòng thử lại.');
    } finally {
      confirmationBusy.current = false; setSubmitting(false);
    }
  };
  const handleAcceptAi = handleConfirmCustomerData;

  const handleVerifyDocuments = async () => {
    if (!requestId || !currentActor || uploadBusy.current || ocrBusy.current || confirmationBusy.current) return;
    if (identityMismatch) { toast.warning(IDENTITY_MISMATCH_MESSAGE); return; }
    if (!isCustomerConfirmed) { toast.warning('Vui lòng đối chiếu và xác nhận thông tin trước khi đặt cọc'); return; }
    if (!agreeTerms) { toast.warning('Vui lòng đồng ý với điều khoản dịch vụ và mức cọc 30%'); return; }
    setSubmitting(true);
    try {
      const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      const state = await db.process_state.get(requestId);
      if (documentNamesMismatch(docs) || state?.variables.document_identity_mismatch === true) {
        setIdentityMismatch(true); setIsCustomerConfirmed(false); setOcrError(IDENTITY_MISMATCH_MESSAGE);
        return;
      }
      if (hasRequiredDocuments(docs) && docs.every(d => d.is_valid === true) && imageSnapshot(docs) === imageSnapshot(documents)) {
        await engine.advance(requestId, 'M_CheckDocs', undefined, currentActor);
        navigate(`/kh/03?requestId=${requestId}`);
      } else if (!hasRequiredDocuments(docs)) {
        const count = await fn_request_more_docs(requestId, currentActor);
        if (count > 3) await fn_end_cancel(requestId, currentActor, 'HO_SO_KHONG_DAT');
        else toast.warning('Vui lòng tải đủ ba ảnh giấy tờ.');
        await loadData();
      } else {
        setIsCustomerConfirmed(false);
        toast.warning('Giấy tờ đã thay đổi. Vui lòng đối chiếu và xác nhận lại.');
        await loadData();
      }
    } catch {
      toast.error('Không thể chuyển sang đặt cọc. Vui lòng thử lại.');
    } finally { setSubmitting(false); }
  };
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang nạp thông tin hồ sơ...</span>
      </div>
    );
  }

  if (!request) return (
    <Card className="p-6 space-y-3" role="alert">
      <p>Không thể nạp hồ sơ. Vui lòng thử lại.</p>
      <Button onClick={() => void loadData()}>Tải lại hồ sơ</Button>
    </Card>
  );

  const isCancelled = request.status === 'DA_HUY' || request.status === 'TU_CHOI';
  const isMovedToDeposit = ['CHO_COC', 'CHO_KY', 'CHO_BAN_GIAO', 'DANG_THUE'].includes(request.status);

  const uploadedCount = documents.filter((d) => Boolean(d.file_url)).length;
  const isAllDocsReady = hasRequiredDocuments(documents);

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
          status={isCancelled ? 'error' : isMovedToDeposit || isCustomerConfirmed ? 'success' : 'pending'}
          label={isCancelled ? 'Đã hủy' : isMovedToDeposit ? 'Hồ sơ đạt' : isCustomerConfirmed ? 'Đã xác nhận' : 'Chờ xác nhận'}
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

      {/* 2. Giấy tờ định danh - Tải ảnh THẬT từ thiết bị */}
      <Card className="p-4 md:p-6 border border-slate-200 rounded-xl bg-white space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-700 shrink-0" />
            <h2 className="text-lg font-semibold text-slate-900">Giấy tờ tùy thân (3 ảnh)</h2>
          </div>
          <span className="text-[13px] font-semibold text-teal-800 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
            {uploadedCount}/3 ảnh
          </span>
        </div>

        {import.meta.env.VITE_OCR_ENDPOINT && !allowCloudOcr && hasRequiredDocuments(documents) && (
          <Button size="sm" variant="outline" onClick={() => { setIsAppliedToProfile(true); setIsEditingDetails(true); }}>Nhập thông tin thủ công</Button>
        )}
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
            const isUploadingThis = uploadingType === item.type;
            const inputRef = getInputRef(item.type);

            return (
              <div
                key={item.type}
                className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Ẩn input file thực tế gắn với từng slot */}
                <input
                  type="file"
                  ref={inputRef}
                  accept="image/jpeg,image/png,image/webp,image/bmp"
                  aria-label={item.title}
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleRealFileSelect(item.type, e)}
                  disabled={isCancelled || isMovedToDeposit || ocrLoading || uploadingType !== null || submitting}
                />

                <div className="flex items-start gap-3 min-w-0">
                  {/* Thumbnail ảnh thực tế sau khi tải lên */}
                  {isUploaded && doc?.file_url ? (
                    <div className="h-14 w-20 shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                      <img
                        src={doc.file_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-14 w-20 shrink-0 rounded-lg border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center text-slate-400">
                      <Camera className="w-5 h-5 mb-0.5" />
                      <span className="text-[10px] font-semibold">Ảnh chụp</span>
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 text-sm truncate">{item.title}</span>
                      <StatusChip
                        status={isUploaded ? 'success' : 'pending'}
                        label={isUploaded ? 'Đã tải' : 'Chưa có'}
                        size="sm"
                      />
                    </div>
                    <p className="text-[13px] text-slate-500 mt-0.5 truncate">{item.desc}</p>
                    {isUploaded && doc?.check_note && doc.check_note !== 'Đã xác thực tự động' && (
                      <p className="text-[12px] text-teal-700 font-medium truncate mt-0.5">
                        {doc.check_note}
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant={isUploaded ? 'outline' : 'primary'}
                  size="sm"
                  loading={isUploadingThis}
                  onClick={() => inputRef.current?.click()}
                  disabled={isCancelled || isMovedToDeposit || ocrLoading || uploadingType !== null || submitting}
                  className="shrink-0 flex items-center gap-1.5"
                >
                  {isUploaded ? (
                    <>
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Đổi ảnh</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" />
                      <span>Chọn ảnh từ máy</span>
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>

        {/* Khối quét & xác thực tự động (HOÀN TOÀN TỰ ĐỘNG, KHÔNG BẮT KHÁCH BẤM NÚT) */}
        {ocrLoading && (
          <div role="status" data-testid="ocr-processing" className="p-4 rounded-xl border border-teal-200 bg-teal-50/50 space-y-3 animate-pulse">
            <div className="flex items-center gap-2 text-teal-800 font-semibold text-sm">
              <RefreshCw className="w-4 h-4 animate-spin text-teal-600 shrink-0" />
              <span>{import.meta.env.VITE_OCR_ENDPOINT ? 'Đang đọc giấy tờ qua dịch vụ trực tuyến. Có thể mất khoảng 1–2 phút...' : 'Đang đọc thông tin từ ảnh giấy tờ. Vui lòng chờ...'}</span>
            </div>
            <OcrScanningSkeleton />
          </div>
        )}

        {!ocrLoading && (ocrError || identityMismatch) && !isCustomerConfirmed && (
          <div role="alert" data-testid="ocr-error" className="p-4 rounded-xl border border-amber-200 bg-amber-50 space-y-3">
            <p className="text-sm text-amber-900">{identityMismatch ? IDENTITY_MISMATCH_MESSAGE : ocrError}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" disabled={!isAllDocsReady || submitting || uploadingType !== null}
                onClick={() => void triggerAutoOcr(documents, request, vehicle, true)}>Thử quét lại</Button>
              <Button size="sm" variant="outline" disabled={submitting || uploadingType !== null}
                onClick={() => { setIsAppliedToProfile(true); setIsEditingDetails(true); setIsCustomerConfirmed(false); }}>Nhập thông tin thủ công</Button>
            </div>
          </div>
        )}

        {!ocrLoading && isAppliedToProfile && (
          <div className="p-4 md:p-5 rounded-xl border border-teal-200 bg-white shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                {isCustomerConfirmed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <FileText className="w-5 h-5 text-teal-700 shrink-0" />
                )}
                <div>
                  <span className="text-sm font-bold text-slate-900 block">
                    {ocrStatus === 'COMPLETED' ? 'Thông tin trích xuất từ ảnh giấy tờ' : 'Thông tin giấy tờ (cần bổ sung thủ công)'}
                  </span>
                  <span className="text-xs text-slate-500 font-normal block">
                    {isCustomerConfirmed
                      ? 'Đã đối chiếu và xác nhận chính xác'
                      : 'Vui lòng kiểm tra thông tin dưới đây và bấm Xác nhận trước khi đặt cọc'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setIsEditingDetails(!isEditingDetails); setIsCustomerConfirmed(false); }}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800 self-start sm:self-auto cursor-pointer flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{isEditingDetails ? 'Đóng chỉnh sửa' : 'Chỉnh sửa'}</span>
              </button>
            </div>

            {!isEditingDetails ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 text-sm">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[12px] text-slate-500 block">Họ và tên</span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {extractedProfile.fullName || (
                      <span className="text-amber-600 italic text-xs font-normal">Chưa rõ - Bấm sửa</span>
                    )}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[12px] text-slate-500 block">Số CCCD</span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {extractedProfile.idNumber || (
                      <span className="text-amber-600 italic text-xs font-normal">Chưa rõ - Bấm sửa</span>
                    )}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[12px] text-slate-500 block">Hạng GPLX</span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {extractedProfile.licenseClass || 'Chưa rõ - Bấm sửa'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 shadow-xs">
                  <span className="text-[12px] text-slate-500 block">Ngày sinh</span>
                  <span className="font-bold text-slate-900 truncate block mt-0.5">
                    {extractedProfile.dob || (
                      <span className="text-slate-400 italic text-xs font-normal">Chưa rõ - Bấm sửa</span>
                    )}
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Họ và tên (chính xác theo CCCD)"
                    placeholder="Nhập họ và tên có dấu"
                    value={extractedProfile.fullName}
                    onChange={(e) => setExtractedProfile((p) => ({ ...p, fullName: e.target.value }))}
                  />
                  <Input
                    label="Số CCCD (12 chữ số)"
                    placeholder="vd: 048098001234"
                    value={extractedProfile.idNumber}
                    onChange={(e) => setExtractedProfile((p) => ({ ...p, idNumber: e.target.value }))}
                  />
                  <Input
                    label="Ngày sinh (YYYY-MM-DD)"
                    type="date"
                    value={extractedProfile.dob}
                    onChange={(e) => setExtractedProfile((p) => ({ ...p, dob: e.target.value }))}
                  />
                  <Input
                    label="Hạng bằng lái xe"
                    placeholder="vd: A1 hoặc A2"
                    value={extractedProfile.licenseClass}
                    onChange={(e) => setExtractedProfile((p) => ({ ...p, licenseClass: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleAcceptAi}
                    disabled={identityMismatch || submitting || uploadingType !== null}
                    data-testid="ai-accept"
                  >
                    Lưu thông tin
                  </Button>
                </div>
              </div>
            )}

            {/* Khối xác nhận thông tin đúng để tiến sang đặt cọc */}
            {!isCustomerConfirmed ? (
              <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start sm:items-center gap-2 text-xs text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
                  <span>Vui lòng đối chiếu thông tin trên xem đã đúng với CCCD &amp; Bằng lái của bạn chưa.</span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleConfirmCustomerData}
                  loading={submitting}
                  disabled={identityMismatch || uploadingType !== null}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs px-4 py-2 shrink-0 cursor-pointer shadow-xs self-end sm:self-auto flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Xác nhận thông tin đúng</span>
                </Button>
              </div>
            ) : (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-900 font-semibold">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Thông tin giấy tờ đã được xác nhận chính xác. Bạn có thể tiến hành đặt cọc ngay bên dưới.</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerConfirmed(false)}
                  className="text-teal-700 underline hover:text-teal-900 text-xs font-semibold cursor-pointer shrink-0 ml-2"
                >
                  Sửa lại
                </button>
              </div>
            )}
          </div>
        )}

        {/* Cam kết điều khoản */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {import.meta.env.VITE_OCR_ENDPOINT && (
            <label className="flex items-start gap-2.5 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={allowCloudOcr} disabled={ocrLoading}
                onChange={e => setAllowCloudOcr(e.target.checked)} className="mt-1 rounded text-teal-600 focus:ring-teal-500" />
              <span>Tôi đồng ý gửi ảnh để tự động điền thông tin hồ sơ</span>
            </label>
          )}
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
          <div className="hidden md:flex flex-col items-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              loading={submitting}
              disabled={identityMismatch || !isAllDocsReady || ocrLoading || uploadingType !== null || !isCustomerConfirmed}
              data-testid="node-M_CheckDocs"
              onClick={handleVerifyDocuments}
              className="flex items-center gap-2 px-8 min-w-[200px]"
            >
              <span>{COPY.ACTION.DEPOSIT}</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
            {!isCustomerConfirmed && isAllDocsReady && (
              <span className="text-xs text-amber-700 font-medium mt-1.5">
                * Vui lòng bấm &quot;Xác nhận thông tin đúng&quot; ở trên để tiến hành đặt cọc
              </span>
            )}
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
                {!isCustomerConfirmed && isAllDocsReady && (
                  <div className="text-[11px] text-amber-600 font-medium">
                    * Chưa xác nhận giấy tờ ở trên
                  </div>
                )}
              </div>
              <Button
                type="button"
                variant="primary"
                size="md"
                loading={submitting}
                disabled={identityMismatch || !isAllDocsReady || ocrLoading || uploadingType !== null || !isCustomerConfirmed}
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
