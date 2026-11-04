// src/features/customer/KH02Page.tsx
// Màn hình KH-02: Báo giá và hồ sơ (M_SendTerms, M_CheckDocs, M_AskDocs)
// Xem bảng báo giá chi tiết, điều kiện thuê, nộp/bổ sung giấy tờ và theo dõi Gateway_0x0p273

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
  Stepper,
  toast,
} from '@/components/ui';
import {
  formatCurrency,
  formatDateTime,
  getStatusBadgeVariant,
  getStatusLabel,
} from '@/lib/format';
import { CUSTOMER_RENTAL_STEPS } from './constants';
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Upload,
  ArrowRight,
  ShieldAlert,
  Bike,
  Sparkles,
  Bot,
  Cpu,
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

  // Gọi AI OCR trích xuất giấy tờ
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
      toast.success(`AI OCR hoàn tất: ${res.routing.action} (Độ tin cậy m = ${((res.minimum_required_confidence || 0) * 100).toFixed(0)}%)`);
      await loadData();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi gọi AI OCR');
    } finally {
      setOcrLoading(false);
    }
  };

  // Người dùng chấp nhận gợi ý AI
  const handleAcceptAi = async () => {
    if (!requestId) return;
    for (const doc of documents) {
      await db.customer_documents.update(doc.id, { is_valid: true });
    }
    toast.success('Đã xác nhận chấp nhận toàn bộ gợi ý trích xuất từ AI OCR!');
    await loadData();
  };
  const [agreeTerms, setAgreeTerms] = useState(true);

  // Load thông tin hồ sơ
  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy yêu cầu thuê');
        navigate('/kh/01');
        return;
      }
      setRequest(req);

      if (req.vehicle_id) {
        const v = await db.vehicles.get(req.vehicle_id);
        setVehicle(v || null);
      }

      const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      setDocuments(docs);
    } catch (err) {
      console.error('Lỗi tải dữ liệu KH-02:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) {
    return null;
  }

  const isCancelled = request.status === 'DA_HUY' || request.closed_reason === 'HO_SO_KHONG_DAT';
  const isMovedToDeposit = request.status === 'CHO_COC' || request.status === 'CHO_KY' || request.status === 'DANG_THUE';

  const docCount = request.doc_request_count || 0;

  // Lấy tài liệu theo loại
  const getDoc = (type: DocumentType) => documents.find((d) => d.doc_type === type);

  // Xử lý nạp ảnh mẫu nhanh phục vụ demo
  const handleQuickUpload = async (type: DocumentType, name: string) => {
    if (!requestId) return;
    const existing = getDoc(type);
    const mockUrl = `blob:mock_${type.toLowerCase()}_sample.jpg`;

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

  // Nộp hồ sơ và kích hoạt kiểm tra
  const handleVerifyDocuments = async () => {
    if (!requestId || !currentActor) return;

    if (!agreeTerms) {
      toast.warning('Vui lòng đồng ý với điều khoản và điều kiện dịch vụ');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Kiểm tra tính đầy đủ của 3 loại giấy tờ bắt buộc
      const currentDocs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      const hasCccdFront = currentDocs.some((d) => d.doc_type === 'CCCD_TRUOC' && d.is_valid);
      const hasCccdBack = currentDocs.some((d) => d.doc_type === 'CCCD_SAU' && d.is_valid);
      const hasGplxFront = currentDocs.some((d) => d.doc_type === 'BANG_LAI_TRUOC' && d.is_valid);

      const isAllValid = hasCccdFront && hasCccdBack && hasGplxFront;

      if (isAllValid) {
        // Hồ sơ hợp lệ -> Chuyển tiếp quy trình qua M_CheckDocs -> M_G02 (Có) -> M_CreateDeposit -> M_WaitDeposit
        await engine.advance(requestId, 'M_CheckDocs', undefined, currentActor);
        toast.success('Hồ sơ đã được thẩm định đạt! Chuyển sang thanh toán tiền cọc.');
        navigate(`/kh/03?requestId=${requestId}`);
      } else {
        // Hồ sơ không đạt -> Tăng số lần yêu cầu bổ sung qua fn_request_more_docs
        const newCount = await fn_request_more_docs(requestId, currentActor);

        if (newCount > 3) {
          // Vượt quá 3 lần -> Gateway_0x0p273 kích hoạt hủy
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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Stepper */}
      <Card className="p-4 border-slate-200">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={1} />
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              KH-02
            </span>
            <h1 className="text-2xl font-bold text-slate-900">Báo giá & Hồ sơ thẩm định</h1>
          </div>
          <p className="text-sm text-slate-500">
            Xem biểu phí thuê, đối soát cọc và nộp giấy tờ định danh (M_SendTerms & M_CheckDocs).
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
            Hồ sơ thuê xe đã bị hủy (M_EndCancel)
          </div>
          <p className="text-xs text-red-700 leading-relaxed">
            Hồ sơ của bạn đã vượt quá giới hạn 3 lần bổ sung giấy tờ theo quy định quy trình BPMN (<code className="font-mono font-bold text-red-800">Gateway_0x0p273</code>). Vui lòng tạo yêu cầu thuê mới khi đã chuẩn bị đầy đủ giấy tờ hợp lệ.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/kh/01')}
            className="text-red-700 border-red-300 bg-white hover:bg-red-100"
          >
            Tạo yêu cầu thuê mới
          </Button>
        </Card>
      )}

      {/* Thông báo nếu đã chuyển sang bước cọc */}
      {isMovedToDeposit && (
        <Card className="p-4 border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Hồ sơ đã được phê duyệt. Bạn có thể tiến hành thanh toán tiền cọc.</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/kh/03?requestId=${requestId}`)}
            className="flex items-center gap-1"
          >
            <span>Đến trang đặt cọc (KH-03)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </Card>
      )}

      {/* CARD 1: BẢNG BÁO GIÁ THUÊ & ĐIỀU KIỆN (M_SendTerms) */}
      <Card className="p-6 border-slate-200 space-y-4">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-brand-600" />
          Bảng báo giá & Dự toán chi phí thuê
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
            <div className="text-slate-500 font-medium">Xe máy dự kiến giao</div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bike className="w-4 h-4 text-brand-600" />
              {vehicle ? `${vehicle.model} (${vehicle.plate})` : 'Đã phân bổ theo phân khúc'}
            </div>
            <div className="text-slate-500">
              Đơn giá thuê: <strong className="text-slate-800">{formatCurrency(vehicle?.daily_price || 120000)} / ngày</strong>
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-xl space-y-2 border border-slate-200">
            <div className="text-slate-500 font-medium">Thời gian thuê</div>
            <div className="text-slate-800 font-medium">
              Từ: <strong>{formatDateTime(request.start_at)}</strong>
            </div>
            <div className="text-slate-800 font-medium">
              Đến: <strong>{formatDateTime(request.end_at)}</strong>
            </div>
          </div>
        </div>

        {/* Tổng tiền & Tiền cọc */}
        <div className="p-4 bg-brand-50/50 rounded-2xl border border-brand-200 grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-slate-600 block">Tổng tiền thuê dự kiến</span>
            <span className="text-lg font-black text-brand-900">
              {formatCurrency(request.total_price)}
            </span>
          </div>

          <div>
            <span className="text-xs text-slate-600 block">Tiền cọc cần thanh toán (30%)</span>
            <span className="text-lg font-black text-amber-700">
              {formatCurrency(request.deposit_amount)}
            </span>
          </div>
        </div>

        <div className="text-[11px] text-slate-500 leading-relaxed border-t border-slate-100 pt-3">
          <strong>Điều khoản cọc:</strong> Tiền cọc 30% được giữ làm bảo chứng hợp đồng và sẽ được hoàn trả toàn bộ vào STK của quý khách sau khi đối soát bàn giao trả xe (hoặc khấu trừ phụ phí nếu có phát sinh).
        </div>
      </Card>

      {/* CARD 2: HỒ SƠ THẨM ĐỊNH (M_CheckDocs & M_AskDocs) */}
      <Card className="p-6 border-slate-200 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Upload className="w-5 h-5 text-brand-600" />
              Hồ sơ định danh & Giấy phép lái xe
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tải lên bản chụp rõ nét 2 mặt CCCD và mặt trước GPLX (còn hiệu lực).
            </p>
          </div>

          {/* Đếm số lần bổ sung */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold self-start sm:self-auto">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Đã yêu cầu bổ sung: {docCount} / 3 lần</span>
          </div>
        </div>

        {/* Danh sách 3 loại giấy tờ */}
        <div className="space-y-4">
          {[
            {
              type: 'CCCD_TRUOC' as DocumentType,
              title: 'Căn cước công dân (Mặt trước)',
              desc: 'Rõ họ tên, số CCCD, hình chân dung',
            },
            {
              type: 'CCCD_SAU' as DocumentType,
              title: 'Căn cước công dân (Mặt sau)',
              desc: 'Rõ đặc điểm nhận dạng, chip điện tử',
            },
            {
              type: 'BANG_LAI_TRUOC' as DocumentType,
              title: 'Giấy phép lái xe A1 / A2 (Mặt trước)',
              desc: 'Hạng xe phù hợp với phân khúc thuê',
            },
          ].map((item) => {
            const doc = getDoc(item.type);
            const isUploaded = Boolean(doc?.file_url);

            return (
              <div
                key={item.type}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{item.title}</span>
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

        {/* KHUNG GỢI Ý AI AGENT OCR (M_CheckDocs) */}
        <div className="p-4 rounded-xl border border-purple-200 bg-purple-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-600 text-white">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-xs">AI Agent OCR (T02b • M_CheckDocs)</span>
                <span className="block text-[11px] text-slate-500">Tự động trích xuất CCCD/GPLX, tính điểm m và đề xuất phân nhánh</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={ocrLoading}
                onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
                className="text-[11px] h-7 bg-white text-purple-700 border-purple-200 hover:bg-purple-50"
              >
                <Cpu className="w-3 h-3 mr-1" />
                Chạy AI OCR
              </Button>
            </div>
          </div>

          {/* Hiển thị kết quả AI nếu có */}
          {ocrResult && (
            <div className="p-3 bg-white rounded-lg border border-purple-100 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-700">Điểm tin cậy m:</span>
                  <span className="font-mono font-bold text-purple-700">
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
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                  <strong>CCCD:</strong> {ocrResult.documents.cccd.full_name?.value || 'N/A'} | Sinh: {ocrResult.documents.cccd.date_of_birth?.value || 'N/A'} | Số: {ocrResult.documents.cccd.id_number?.value || 'N/A'}
                </div>
              )}

              {ocrResult.documents.gplx && (
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                  <strong>GPLX:</strong> {ocrResult.documents.gplx.full_name?.value || 'N/A'} | Hạng: {ocrResult.documents.gplx.license_class?.value || 'N/A'}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleAcceptAi}
                  className="text-[11px] h-7 bg-purple-700 hover:bg-purple-800"
                  data-testid="ai-accept"
                >
                  <Bot className="w-3 h-3 mr-1" />
                  Chấp nhận gợi ý AI
                </Button>
              </div>
            </div>
          )}

          {/* Các nút giả lập kịch bản demo */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-100/60 text-[11px] text-slate-500">
            <span>Mô phỏng demo:</span>
            <button
              type="button"
              onClick={() => handleRunAiOcr('HIGH_CONFIDENCE')}
              className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-semibold border border-emerald-200"
            >
              m=96% (Tự động)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('MEDIUM_CONFIDENCE')}
              className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-semibold border border-amber-200"
            >
              m=87% (Cần duyệt)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('LOW_CONFIDENCE')}
              className="px-2 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 text-[10px] font-semibold border border-red-200"
            >
              m=65% (Chụp lại)
            </button>
            <button
              type="button"
              onClick={() => handleRunAiOcr('NAME_MISMATCH')}
              className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 hover:bg-amber-100 text-[10px] font-semibold border border-amber-200"
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

        {/* Nút hành động nộp hồ sơ */}
        {!isCancelled && !isMovedToDeposit && (
          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="lg"
              loading={submitting}
              data-testid="node-M_CheckDocs"
              onClick={handleVerifyDocuments}
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <span>Nộp hồ sơ & Xác nhận cọc</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
