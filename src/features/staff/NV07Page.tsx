// src/features/staff/NV07Page.tsx
// Màn hình NV-07: Xác minh hư hỏng và bằng chứng (M_VerifyDamage)

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { engine } from '@/engine';
import { useAuthStore } from '@/features/auth/authStore';
import { Button, Card, Badge, toast, FileUpload } from '@/components/ui';
import type { FileUploadResult } from '@/components/ui/FileUpload';
import { formatCurrency, getStatusLabel } from '@/lib/format';
import {
  AlertTriangle,
  Camera,
  Car,
  User,
  Plus,
  Trash2,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import {
  PendingRequestBar,
  type PendingRequestSummary,
} from '@/components/common/PendingRequestBar';

interface DamageItemForm {
  id: string;
  sourceKey?: string;
  title: string;
  description: string;
  estimated_cost: number;
  evidence_urls: string[];
}

export function NV07Page() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestId = searchParams.get('requestId') || '';
  const currentActor = useAuthStore((s) => s.currentActor);

  const [pendingList, setPendingList] = useState<PendingRequestSummary[]>([]);
  const [effectiveRequestId, setEffectiveRequestId] = useState<string>(requestId);
  const activeId = requestId || effectiveRequestId;

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    async function loadPending() {
      const candidates = await db.rental_requests
        .filter((r) => r.status === 'CHO_DANH_GIA_XE')
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

  // Live queries
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

  // Lấy biên bản trả xe RETURN gần nhất
  const returnInsp = useLiveQuery(async () => {
    if (!activeId) return undefined;
    return await db.inspections
      .where('request_id')
      .equals(activeId)
      .and((i) => i.kind === 'RETURN')
      .reverse()
      .first();
  }, [activeId]);

  const [damages, setDamages] = useState<DamageItemForm[]>([]);

  // Tự động chuyển đổi các mục sai lệch trong diff_items thành form xác minh hư hỏng
  useEffect(() => {
    if (damages.length === 0 && (returnInsp?.diff_items || processState?.variables?.diff_items)) {
      const diffs = (returnInsp?.diff_items || processState?.variables?.diff_items || {}) as Record<
        string,
        { label?: string; issue?: string }
      >;
      const initialList: DamageItemForm[] = Object.entries(diffs).map(([k, v]) => ({
        id: crypto.randomUUID(),
        sourceKey: k,
        title: v.label || k,
        description: v.issue || 'Hư hại phát hiện lúc nhận lại xe',
        estimated_cost: 150000, // Giá trị khởi tạo hợp lý
        evidence_urls: [],
      }));

      if (initialList.length > 0) {
        setDamages(initialList);
      } else {
        // Dự phòng ít nhất 1 mục mặc định
        setDamages([
          {
            id: crypto.randomUUID(),
            title: 'Hư hỏng linh kiện / Vết xước',
            description: 'Trầy xước thân vỏ hoặc hỏng phụ kiện lúc trả xe',
            estimated_cost: 100000,
            evidence_urls: [],
          },
        ]);
      }
    }
  }, [returnInsp, processState, damages.length]);

  const updateDamage = (id: string, field: keyof DamageItemForm, val: unknown) => {
    setDamages((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [field]: val } : d))
    );
  };

  const addDamageRow = () => {
    setDamages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: 'Hư hỏng phát sinh bổ sung',
        description: '',
        estimated_cost: 50000,
        evidence_urls: [],
      },
    ]);
  };

  const removeDamageRow = (id: string) => {
    setDamages((prev) => prev.filter((d) => d.id !== id));
  };

  const totalCost = damages.reduce((sum, d) => sum + (Number(d.estimated_cost) || 0), 0);
  const isWaitingVerify = processState?.waiting_node_ids?.includes('M_VerifyDamage');

  // Submit M_VerifyDamage
  const handleSubmitVerifyDamage = async () => {
    if (!currentActor || !activeId) return;
    if (damages.length === 0) {
      toast.error('Cần ít nhất 1 khoản hư hại được xác minh hoặc bấm bỏ qua nếu không phát sinh chi phí');
      return;
    }

    try {
      setIsSubmitting(true);
      await engine.complete(
        activeId,
        'M_VerifyDamage',
        {
          damages: damages.map((d) => ({
            description: `${d.title}: ${d.description}`,
            estimated_cost: Number(d.estimated_cost) || 0,
            evidence_urls: d.evidence_urls,
          })),
          inspection_id: returnInsp?.id,
        },
        currentActor
      );

      toast.success('Đã xác minh hư hỏng và tự động lập bảng kê gửi tới khách hàng!');

      setTimeout(() => {
        navigate('/nv/01');
      }, 1000);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Có lỗi khi xác minh hư hỏng');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeId) {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-6 text-center">
        <Card className="py-12 px-6 border-slate-200 shadow-sm">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Không có xe nào cần xác minh hư hại</h2>
          <p className="mt-2 text-sm text-slate-500 max-w-md mx-auto">
            Hiện tại các xe trả đều ở tình trạng đạt chuẩn hoặc chưa có biên bản kiểm tra cần lập báo giá bồi thường.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/nv/01')}>Về Hộp việc điều hành (NV-01)</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Thanh chọn nhanh hồ sơ chờ xác minh hư hại */}
      <PendingRequestBar
        label="Hồ sơ chờ xác minh hư hại"
        currentRequestId={activeId}
        pendingList={pendingList}
        onSelect={(id) => setSearchParams({ requestId: id })}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Màn hình NV-07
            </span>
            <span className="text-xs font-mono text-slate-500">Mã đơn #{activeId.slice(0, 8)}</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Xác Minh Hư Hỏng &amp; Ước Tính Bồi Thường
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Đối soát danh mục phụ kiện và tình trạng hư hỏng phương tiện sau khi trả xe
          </p>
        </div>

        <Badge variant="waiting" className="flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Đang xác minh hư hại</span>
        </Badge>
      </div>

      {/* Thông tin phương tiện và khách hàng */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 shrink-0">
            <Car className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Xe thuê</div>
            <div className="font-bold text-slate-900 text-sm">
              {vehicle?.model} ({vehicle?.plate})
            </div>
          </div>
        </Card>

        <Card className="p-3.5 bg-slate-50 border-slate-200 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 shrink-0">
            <User className="w-4 h-4" />
          </div>
          <div className="text-xs">
            <div className="text-slate-500 font-medium">Khách hàng thuê xe</div>
            <div className="font-bold text-slate-900 text-sm">
              {customer?.full_name} ({customer?.phone})
            </div>
          </div>
        </Card>
      </div>

      {isWaitingVerify ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span>Danh sách các hạng mục sai lệch cần định giá</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addDamageRow}
              className="text-xs flex items-center gap-1 text-brand-700 border-brand-300"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm mục hư hại</span>
            </Button>
          </div>

          {/* Danh sách từng hư hại */}
          <div className="space-y-3">
            {damages.map((item, idx) => (
              <Card key={item.id} className="p-4 border-slate-200 space-y-3 bg-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => updateDamage(item.id, 'title', e.target.value)}
                      placeholder="Tên bộ phận / linh kiện hư hỏng..."
                      className="font-bold text-slate-900 text-sm border-b border-transparent hover:border-slate-300 focus:border-brand-500 outline-none pb-0.5"
                    />
                  </div>
                  {damages.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDamageRow(item.id)}
                      className="text-slate-400 hover:text-red-600 p-1 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Mô tả chi tiết hư hại thực tế
                    </label>
                    <textarea
                      rows={2}
                      value={item.description}
                      onChange={(e) => updateDamage(item.id, 'description', e.target.value)}
                      placeholder="Mô tả cụ thể vết trầy xước, nứt vỡ, tình trạng linh kiện..."
                      className="w-full text-xs p-2 border border-slate-200 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-600">
                      Chi phí ước tính sửa/thay (VND)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={item.estimated_cost}
                      onChange={(e) => updateDamage(item.id, 'estimated_cost', Number(e.target.value))}
                      className="w-full text-xs font-bold text-slate-900 p-2 border border-slate-200 rounded focus:ring-1 focus:ring-brand-500 outline-none"
                    />
                    <div className="text-[11px] text-slate-500">
                      Hiển thị: {formatCurrency(item.estimated_cost)}
                    </div>
                  </div>
                </div>

                {/* Đính kèm bằng chứng ảnh cho từng mục */}
                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <span>Ảnh bằng chứng hư hại</span>
                  </div>
                  <FileUpload
                    label="Tải ảnh bằng chứng hư hại"
                    onFileSelect={(res: FileUploadResult | null) => {
                      if (res?.previewUrl) {
                        updateDamage(item.id, 'evidence_urls', [...item.evidence_urls, res.previewUrl]);
                      }
                    }}
                  />
                  {item.evidence_urls.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {item.evidence_urls.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt="Bằng chứng"
                          className="w-16 h-16 object-cover rounded border border-slate-200 shadow-xs"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>

          {/* Tổng tiền và Nút xác nhận */}
          <Card className="p-4 bg-brand-50/60 border-brand-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <div className="text-xs text-brand-900 font-medium">Tổng chi phí bồi thường hư hại:</div>
              <div className="text-2xl font-bold text-brand-700">
                {formatCurrency(totalCost)}
              </div>
              <div className="text-xs text-slate-500">
                Khoản này sẽ tự động đưa vào Bảng kê chi tiết gửi tới khách hàng.
              </div>
            </div>

            <Button
              data-testid="node-M_VerifyDamage"
              onClick={handleSubmitVerifyDamage}
              loading={isSubmitting}
              className="w-full sm:w-auto bg-brand-600 hover:bg-brand-700 text-white font-semibold flex items-center gap-2"
            >
              <span>Xác nhận hư hỏng &amp; Gửi bảng kê</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </Card>
        </div>
      ) : (
        <Card className="p-8 text-center space-y-4">
          <CheckCircle className="w-12 h-12 text-brand-600 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900">
            Hồ sơ hiện không ở bước xác minh hư hại!
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            Hồ sơ hiện ở trạng thái <strong>{rentalReq ? getStatusLabel(rentalReq.status) : ''}</strong>. Có thể hồ sơ không phát hiện hư hỏng hoặc đã được chuyển tiếp sang bước thanh toán bảng kê.
          </p>
          <div className="pt-2 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/nv/01')}>
              Về Danh sách việc cần làm
            </Button>
            <Button onClick={() => navigate(`/kh/09?requestId=${requestId}`)}>
              Xem bảng kê trả xe
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
export default NV07Page;
