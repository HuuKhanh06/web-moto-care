// src/features/staff/NV06Page.tsx
// Màn hình NV-06: Nhận và kiểm tra xe trả (M_ReceiveReturn, M_CheckReturn)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, toast, FileUpload } from '@/components/ui';
import type { FileUploadResult } from '@/components/ui/FileUpload';
import { formatCurrency, formatDateTime, getStatusBadgeVariant, getStatusLabel } from '@/lib/format';
import {
  CheckCircle,
  AlertTriangle,
  Camera,
  Car,
  User,
  Phone,
  FileCheck,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';

interface ChecklistRow {
  key: string;
  label: string;
  category: 'dong_co' | 'an_toan' | 'than_vo' | 'phu_kien';
  initialStatus: string;
  returnStatus: 'BINH_THUONG' | 'SAI_LECH';
  note: string;
}

export function NV06Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [effectiveRequestId, setEffectiveRequestId] = useState<string>(requestId);
  const activeId = requestId || effectiveRequestId;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    async function loadPending() {
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_NHAN_XE_TRA' || r.status === 'DANG_THUE')
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
      if (!requestId && pList.length > 0) {
        setEffectiveRequestId(pList[0].id);
      }
    }
    loadPending();
  }, [requestId]);

  // Đọc dữ liệu từ IndexedDB bằng live query
  const rentalReq = useLiveQuery(
    () => (activeId ? db.rental_requests.get(activeId) : undefined),
    [activeId]
  );
  const processState = useLiveQuery(
    () => (activeId ? db.process_state.get(activeId) : undefined),
    [activeId]
  );
  const vehicle = useLiveQuery(
    () => (rentalReq?.vehicle_id ? db.vehicles.get(rentalReq.vehicle_id) : undefined),
    [rentalReq?.vehicle_id]
  );
  const customer = useLiveQuery(
    () => (rentalReq?.customer_id ? db.profiles.get(rentalReq.customer_id) : undefined),
    [rentalReq?.customer_id]
  );

  // Lấy biên bản PRE_HANDOVER đạt có attempt_no lớn nhất để làm chuẩn so sánh
  const preHandoverInsp = useLiveQuery(async () => {
    if (!activeId) return undefined;
    return await db.inspections
      .where('request_id')
      .equals(activeId)
      .and((i) => i.kind === 'PRE_HANDOVER' && i.result === 'DAT')
      .reverse()
      .first();
  }, [activeId]);

  // Checklist kiểm tra đối chiếu
  const [checklistRows, setChecklistRows] = useState<ChecklistRow[]>([
    {
      key: 'phanh',
      label: 'Hệ thống phanh (trước & sau)',
      category: 'an_toan',
      initialStatus: 'Hoạt động tốt, ăn đều',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'den',
      label: 'Đèn pha, xi-nhan, đèn hậu',
      category: 'an_toan',
      initialStatus: 'Sáng rõ, chóa lành lặn',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'lop',
      label: 'Lốp xe & áp suất lốp',
      category: 'an_toan',
      initialStatus: 'Gai lốp dày, đủ áp suất',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'guong_coi',
      label: 'Gương chiếu hậu (2 bên) & Còi xe',
      category: 'an_toan',
      initialStatus: 'Gương zin đầy đủ, còi to rõ',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'than_vo',
      label: 'Thân vỏ, yếm xe & nước sơn',
      category: 'than_vo',
      initialStatus: 'Không vết móp vỡ, xước nhẹ chấp nhận',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'nhien_lieu',
      label: 'Nhiên liệu xăng / Pin',
      category: 'dong_co',
      initialStatus: 'Bình đầy 100%',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'mu_bao_hiem',
      label: 'Mũ bảo hiểm đạt chuẩn (2 chiếc)',
      category: 'phu_kien',
      initialStatus: 'Đủ 2 mũ, quai cài tốt',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
    {
      key: 'giay_to_phu_tung',
      label: 'Giấy tờ xe & Áo mưa đi kèm',
      category: 'phu_kien',
      initialStatus: 'Đầy đủ bản sao công chứng & 2 áo mưa',
      returnStatus: 'BINH_THUONG',
      note: '',
    },
  ]);

  // Cập nhật lại initialStatus nếu preHandover có dữ liệu ghi chú cụ thể
  useEffect(() => {
    if (preHandoverInsp?.checklist) {
      const ch = preHandoverInsp.checklist as Record<string, string>;
      setChecklistRows((prev) =>
        prev.map((r) => ({
          ...r,
          initialStatus: ch[r.key] ? String(ch[r.key]) : r.initialStatus,
        }))
      );
    }
  }, [preHandoverInsp]);

  const waitingNodes = processState?.waiting_node_ids || [];
  const isWaitingReceive = waitingNodes.includes('M_ReceiveReturn');
  const isWaitingCheck = waitingNodes.includes('M_CheckReturn');

  const updateRowStatus = (key: string, status: 'BINH_THUONG' | 'SAI_LECH') => {
    setChecklistRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, returnStatus: status } : r))
    );
  };

  const updateRowNote = (key: string, note: string) => {
    setChecklistRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, note } : r))
    );
  };

  // 1. Thao tác M_ReceiveReturn
  const handleConfirmReceive = async () => {
    if (!currentActor || !activeId) return;
    try {
      setIsSubmitting(true);
      await engine.complete(activeId, 'M_ReceiveReturn', {}, currentActor);
      toast.success('Xác nhận đã tiếp nhận xe trả thành công. Chuyển sang kiểm tra checklist.');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xác nhận nhận xe');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Thao tác M_CheckReturn
  const handleCompleteCheckReturn = async () => {
    if (!currentActor || !activeId) return;
    try {
      setIsSubmitting(true);

      const checklistData: Record<string, unknown> = {};
      const diffItems: Record<string, unknown> = {};

      checklistRows.forEach((r) => {
        checklistData[r.key] = {
          status: r.returnStatus,
          note: r.note,
        };
        if (r.returnStatus === 'SAI_LECH') {
          diffItems[r.key] = {
            label: r.label,
            initial: r.initialStatus,
            issue: r.note || 'Phát hiện hư hỏng hoặc thiếu phụ kiện lúc trả',
          };
        }
      });

      await engine.complete(
        activeId,
        'M_CheckReturn',
        {
          vehicle_id: rentalReq?.vehicle_id,
          checklist: checklistData,
          diff_items: diffItems,
          photo_urls: photoUrls,
        },
        currentActor
      );

      // Kiểm tra nút tiếp theo từ state
      const nextState = await db.process_state.get(activeId);
      if (nextState?.waiting_node_ids.includes('M_VerifyDamage')) {
        toast.success('Phát hiện sai lệch! Chuyển sang khâu xác minh chi phí hư hỏng.');
        setTimeout(() => {
          navigate(`/nv/07?requestId=${activeId}`);
        }, 800);
      } else {
        toast.success('Xe không có hư hỏng, hệ thống đã tự động tính phí và gửi bảng kê đến khách.');
        setTimeout(() => {
          navigate('/nv/01');
        }, 1200);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi hoàn tất kiểm tra trả xe');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeId) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 text-center">
        <Card className="py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <Car className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có xe nào đang chờ tiếp nhận trả xe</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại các đơn thuê đang lưu thông bình thường hoặc chưa đến thời hạn tiếp nhận bàn giao trả xe.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành (NV-01)</Button>
          </div>
        </Card>
      </div>
    );
  }

  const diffCount = checklistRows.filter((r) => r.returnStatus === 'SAI_LECH').length;

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Thanh chọn nhanh hồ sơ đang chờ tiếp nhận trả xe */}
      <PendingRequestBar
        label="Hồ sơ chờ nhận xe trả"
        currentRequestId={activeId}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Tiêu đề & Thông tin chung */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình NV-06
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{activeId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Nhận &amp; Kiểm Tra Xe Trả (Đối Chiếu)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Quy trình BPMN: <code className="font-mono text-brand-700 font-semibold">M_ReceiveReturn</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_CheckReturn</code> &rarr;{' '}
            <code className="font-mono text-brand-700 font-semibold">M_DigitalCompare</code>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {rentalReq?.status && (
            <Badge variant={getStatusBadgeVariant(rentalReq.status)}>
              {getStatusLabel(rentalReq.status)}
            </Badge>
          )}
        </div>
      </div>

      {/* Tóm tắt thông tin hợp đồng và phương tiện */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Phương tiện thuê</div>
              <div className="text-base font-bold text-slate-900">
                {vehicle?.model || 'Đang nạp xe...'} ({vehicle?.plate || 'Chưa gán'})
              </div>
              <div className="text-xs text-slate-600">
                Đơn giá: {formatCurrency(vehicle?.daily_price || 0)}/ngày
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-slate-50 border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500 font-medium">Khách hàng</div>
              <div className="text-base font-bold text-slate-900">
                {customer?.full_name || 'Khách thuê'}
              </div>
              <div className="text-xs text-slate-600 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span>{customer?.phone || 'Chưa cập nhật'}</span>
                <span>• Hạn trả ban đầu: {rentalReq?.end_at ? formatDateTime(rentalReq.end_at) : '—'}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* BƯỚC 1: XÁC NHẬN NHẬN XE TRẢ (M_ReceiveReturn) */}
      {isWaitingReceive && (
        <Card className="p-6 border-amber-200 bg-amber-50/50 space-y-4">
          <div className="flex items-start gap-3">
            <FileCheck className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-bold text-slate-900">Bước 1: Tiếp nhận phương tiện và chìa khóa</h3>
              <p className="text-sm text-slate-600 mt-1">
                Khách hàng đã đưa xe đến trạm hoặc điểm hẹn bàn giao. Nhân viên vui lòng kiểm tra chìa khóa,
                xác nhận đã nhận xe thực tế để hệ thống ghi nhận thời điểm trả xe.
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              data-testid="node-M_ReceiveReturn"
              onClick={handleConfirmReceive}
              loading={isSubmitting}
              className="bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-2"
            >
              <span>Xác nhận đã nhận xe</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* BƯỚC 2: KIỂM TRA ĐỐI CHIẾU CHECKLIST & ẢNH TRẢ XE (M_CheckReturn) */}
      {isWaitingCheck && (
        <div className="space-y-6">
          <Card className="p-5 border-brand-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-brand-600" />
                  <span>Bước 2: Đối chiếu tình trạng xe với biên bản bàn giao ban đầu</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Bản chuẩn đối chiếu: Biên bản kiểm tra trước bàn giao (PRE_HANDOVER) đạt chuẩn gần nhất.
                </p>
              </div>

              {diffCount > 0 ? (
                <Badge variant="waiting" className="flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>{diffCount} sai lệch / hư hại</span>
                </Badge>
              ) : (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" />
                  <span>Chưa phát hiện sai lệch</span>
                </Badge>
              )}
            </div>

            {/* Bảng checklist song song */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-semibold text-xs uppercase">
                    <th className="p-3 rounded-l">Hạng mục kiểm tra</th>
                    <th className="p-3 w-1/3">Tình trạng lúc giao ban đầu</th>
                    <th className="p-3 w-1/4">Tình trạng lúc nhận xe</th>
                    <th className="p-3 rounded-r">Ghi chú sai lệch (nếu có)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checklistRows.map((row) => (
                    <tr
                      key={row.key}
                      className={row.returnStatus === 'SAI_LECH' ? 'bg-amber-50/60' : 'hover:bg-slate-50/60'}
                    >
                      <td className="p-3 font-medium text-slate-900">{row.label}</td>
                      <td className="p-3 text-slate-600 text-xs bg-slate-50/50">
                        <span className="inline-block px-2 py-0.5 rounded bg-white border border-slate-200">
                          {row.initialStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updateRowStatus(row.key, 'BINH_THUONG')}
                            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                              row.returnStatus === 'BINH_THUONG'
                                ? 'bg-brand-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Bình thường
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRowStatus(row.key, 'SAI_LECH')}
                            className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                              row.returnStatus === 'SAI_LECH'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                          >
                            Sai lệch
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        {row.returnStatus === 'SAI_LECH' ? (
                          <input
                            type="text"
                            placeholder="Mô tả cụ thể hư hại / sai khác..."
                            value={row.note}
                            onChange={(e) => updateRowNote(row.key, e.target.value)}
                            className="w-full text-xs p-1.5 border border-amber-300 rounded focus:ring-1 focus:ring-amber-500 bg-white"
                          />
                        ) : (
                          <span className="text-xs text-slate-400 italic">Khớp chuẩn ban đầu</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Chụp / Tải ảnh xe lúc trả */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Camera className="w-4 h-4 text-brand-600" />
                <span>Chụp / Tải ảnh tình trạng xe lúc nhận lại</span>
              </div>
              <p className="text-xs text-slate-500">
                Tải lên ảnh tổng thể xe và ảnh cận cảnh các vị trí có vết trầy xước/hư hỏng nếu có.
              </p>
              <FileUpload
                label="Chọn hoặc chụp ảnh xe lúc nhận lại"
                onFileSelect={(res: FileUploadResult | null) => {
                  if (res?.previewUrl) {
                    setPhotoUrls((prev) => [...prev, res.previewUrl]);
                  }
                }}
              />
              {photoUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {photoUrls.map((url, idx) => (
                    <img
                      key={idx}
                      src={url}
                      alt={`Ảnh trả xe ${idx + 1}`}
                      className="w-20 h-20 object-cover rounded border border-slate-200 shadow-xs"
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Nút hoàn tất kiểm tra */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200">
              <div className="text-xs text-slate-600">
                {diffCount > 0 ? (
                  <span className="text-amber-700 font-semibold flex items-center gap-1">
                    <ShieldAlert className="w-4 h-4" />
                    Có {diffCount} sai lệch: hệ thống sẽ chuyển sang khâu xác minh chi phí phát sinh.
                  </span>
                ) : (
                  <span className="text-brand-700 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Không có sai lệch: hệ thống sẽ tự động tính phí hoàn cọc hoặc phí phát sinh.
                  </span>
                )}
              </div>

              <Button
                data-testid="node-M_CheckReturn"
                onClick={handleCompleteCheckReturn}
                loading={isSubmitting}
                className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold"
              >
                Hoàn tất kiểm tra đối chiếu
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Trường hợp hồ sơ đã vượt qua bước nhận xe và đang ở các khâu sau */}
      {!isWaitingReceive && !isWaitingCheck && (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">
            Hồ sơ này đã hoàn tất khâu nhận và kiểm tra xe trả!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hồ sơ hiện đang ở trạng thái <strong>{rentalReq ? getStatusLabel(rentalReq.status) : ''}</strong>. Bạn có thể quay lại Hộp việc cần làm
            hoặc chuyển sang màn hình tiếp theo để xử lý.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Về Danh sách việc cần làm
            </Button>
            {rentalReq?.status === 'CHO_KHACH_XAC_NHAN_BANG_KE' && (
              <Button onClick={() => navigate(`/kh/09?requestId=${requestId}`)}>
                Xem bảng kê thanh lý
              </Button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
export default NV06Page;
