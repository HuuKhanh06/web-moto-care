// src/features/customer/KH04Page.tsx
// Màn hình KH-04: Ký hợp đồng điện tử (M_Contract, M_WaitSign)
// Xem trước hợp đồng chuẩn A4, in/tải PDF, đồng hồ đếm ngược 24h và ô ký chữ ký số (Canvas/Tên)

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { engine } from '@/engine';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import type { RentalRequest, Contract, Vehicle, Profile, ProcessState } from '@/db/types';
import {
  Card,
  Button,
  Badge,
  Input,
  Stepper,
  toast,
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
  Clock,
  Printer,
  PenTool,
  CheckCircle2,
  ShieldAlert,
  Eraser,
  Type,
} from 'lucide-react';

export function KH04Page() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId');
  const navigate = useNavigate();
  const currentActor = useAuthStore((s) => s.currentActor);

  const [request, setRequest] = useState<RentalRequest | null>(null);
  const [contract, setContract] = useState<Contract | null>(null);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [customer, setCustomer] = useState<Profile | null>(null);
  const [processState, setProcessState] = useState<ProcessState | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(86400); // 24 giờ
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

  // Chế độ ký: 'draw' (vẽ) hoặc 'type' (gõ tên)
  const [signMode, setSignMode] = useState<'draw' | 'type'>('draw');
  const [typedName, setTypedName] = useState('');
  const [isCanvasEmpty, setIsCanvasEmpty] = useState(true);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const loadData = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    try {
      const req = await db.rental_requests.get(requestId);
      if (!req) {
        toast.error('Không tìm thấy đơn thuê');
        navigate('/kh/06');
        return;
      }
      setRequest(req);

      const [c, v, u, ps] = await Promise.all([
        db.contracts.where('request_id').equals(requestId).last(),
        req.vehicle_id ? db.vehicles.get(req.vehicle_id) : Promise.resolve(undefined),
        db.profiles.get(req.customer_id),
        db.process_state.get(requestId),
      ]);

      setContract(c || null);
      setVehicle(v || null);
      setCustomer(u || null);
      setProcessState(ps || null);

      if (u?.full_name) {
        setTypedName(u.full_name);
      }
    } catch (err) {
      console.error('Lỗi nạp KH-04:', err);
    } finally {
      setLoading(false);
    }
  }, [requestId, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Cập nhật đồng hồ đếm ngược 24h
  useEffect(() => {
    if (!contract?.expires_at) return;

    const expiresTime = contract.expires_at;
    const updateCountdown = () => {
      const now = clock.now();
      const due = new Date(expiresTime);
      const diff = Math.max(0, Math.floor((due.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diff);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [contract?.expires_at]);

  // Canvas drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    isDrawing.current = true;
    setIsCanvasEmpty(false);

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#006233'; // Brand-700
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setIsCanvasEmpty(true);
  };

  // Ký hợp đồng
  const handleSignContract = async () => {
    if (!requestId || !currentActor) return;

    let signatureUrl = '';
    if (signMode === 'draw') {
      if (isCanvasEmpty) {
        toast.warning('Vui lòng vẽ chữ ký của bạn trước khi xác nhận');
        return;
      }
      signatureUrl = canvasRef.current?.toDataURL('image/png') || 'blob:signature.png';
    } else {
      if (!typedName.trim()) {
        toast.warning('Vui lòng nhập họ tên để ký xác nhận');
        return;
      }
      signatureUrl = `data:text/plain;charset=utf-8,${encodeURIComponent(typedName.trim())}`;
    }

    setSigning(true);
    try {
      await engine.complete(
        requestId,
        'M_WaitSign',
        { signature_url: signatureUrl },
        currentActor
      );

      toast.success('Ký hợp đồng thành công! Lịch thuê đã được khóa và chuyển giao kỹ thuật viên.');
      await loadData();
    } catch (err: unknown) {
      console.error('Lỗi khi ký hợp đồng:', err);
      const msg = err instanceof Error ? err.message : 'Có lỗi khi ký hợp đồng';
      toast.error(msg);
    } finally {
      setSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex justify-center">
        <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) return null;

  const isExpired = request.status === 'DA_HUY' && request.closed_reason === 'QUA_HAN_KY';
  const isSigned = contract?.status === 'SIGNED' || request.status === 'CHO_BAN_GIAO' || request.status === 'CHO_KHACH_NHAN' || request.status === 'DANG_THUE';

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const timerStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20 sm:pb-6">
      {/* Stepper */}
      <Card className="p-4 border-slate-200/80 shadow-sm glass-surface">
        <Stepper steps={CUSTOMER_RENTAL_STEPS} currentStepIndex={3} />
      </Card>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-200/70 shadow-2xs">
              Bước 4 &bull; Ký hợp đồng điện tử
            </span>
            <BpmnBadge nodeId="M_Contract" name="Ký số" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ký hợp đồng thuê xe</h1>
          </div>
          <p className="text-sm text-slate-500">
            Xem điều khoản pháp lý và ký số trực tuyến để khóa lịch phương tiện
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={getStatusBadgeVariant(request.status)} size="md">
            {getStatusLabel(request.status)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 shadow-xs"
            title="In hoặc lưu file PDF từ trình duyệt"
          >
            <Printer className="w-4 h-4 text-slate-600" />
            <span>In / Tải PDF</span>
          </Button>
        </div>
      </div>

      {/* Cảnh báo quá hạn 24 giờ */}
      {isExpired && (
        <Card className="p-5 border-red-300 bg-red-50/80 text-red-900 space-y-2 shadow-sm rounded-2xl">
          <div className="flex items-center gap-2 font-bold text-sm text-red-800">
            <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            Hợp đồng đã hết hạn ký nhận (24 giờ)
          </div>
          <p className="text-xs text-red-700 leading-relaxed">
            Hệ thống đã tự động hoàn tiền đặt cọc vào tài khoản của quý khách do quá hạn ký hợp đồng.
          </p>
        </Card>
      )}

      {/* Thông báo nếu đã ký */}
      {isSigned && (
        <Card className="p-4 border-emerald-300 bg-emerald-50/90 text-emerald-900 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>
              Hợp đồng điện tử đã được ký kết thành công vào lúc <strong>{formatDateTime(contract?.signed_at || request.start_at)}</strong>.
            </span>
          </div>
          <Badge variant="success">ĐÃ KÝ SỐ HỢP LỆ</Badge>
        </Card>
      )}

      {/* Đếm ngược 24h */}
      {!isSigned && !isExpired && (
        <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200/80 flex items-center justify-between text-xs text-amber-900 shadow-xs">
          <div className="flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            <span>Thời hạn hoàn tất ký hợp đồng (Timer 24h - M_BoundSign):</span>
          </div>
          <span className="font-mono font-bold text-sm text-amber-950 bg-white px-2.5 py-0.5 rounded-lg border border-amber-300 shadow-xs">
            {timerStr}
          </span>
        </div>
      )}

      {/* KHUNG XEM TRƯỚC HỢP ĐỒNG KHỔ A4 (Preview Document) */}
      <Card className="p-8 sm:p-12 border-slate-200/80 bg-white shadow-xl text-slate-900 font-serif leading-relaxed text-xs sm:text-sm space-y-6 rounded-3xl relative overflow-hidden">
        {/* Dấu chìm bảo chứng an toàn */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] select-none text-center">
          <div className="text-8xl font-black uppercase tracking-widest text-brand-900 font-sans">MOTO CARE</div>
        </div>

        {/* Quốc hiệu & Tiêu ngữ */}
        <div className="text-center space-y-1 font-sans">
          <div className="font-bold uppercase tracking-wider text-xs">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
          <div className="font-semibold text-xs text-slate-700">Độc lập - Tự do - Hạnh phúc</div>
          <div className="w-24 h-0.5 bg-slate-400 mx-auto mt-1" />
        </div>

        {/* Tiêu đề hợp đồng */}
        <div className="text-center pt-4 font-sans">
          <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight text-slate-900">
            HỢP ĐỒNG CHO THUÊ XE MÁY ĐIỆN TỬ
          </h2>
          <div className="text-xs text-slate-500 font-mono mt-1">
            Số: MC-HD/{request.id.slice(0, 8).toUpperCase()}/{new Date().getFullYear()}
          </div>
        </div>

        {/* Căn cứ pháp lý */}
        <div className="italic text-[11px] text-slate-600 text-justify">
          - Căn cứ Bộ luật Dân sự số 91/2015/QH13 ngày 24/11/2015 và các văn bản quy định hiện hành;
          <br />- Căn cứ nhu cầu và khả năng thực tế của hai bên tham gia giao dịch.
        </div>

        {/* Hai bên ký kết */}
        <div className="space-y-3 font-sans text-xs">
          <div>
            <strong className="block text-slate-900 font-bold uppercase text-[12px]">BÊN CHO THUÊ (BÊN A):</strong>
            <div className="mt-1 pl-3 space-y-0.5 text-slate-700">
              <div>Đơn vị: <strong>CÔNG TY CỔ PHẦN DỊCH VỤ MOTO CARE</strong></div>
              <div>Địa chỉ: 123 Đường Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP. Hồ Chí Minh</div>
              <div>Hotline / Cứu hộ: 1900 8899 &bull; Đại diện pháp lý: Ban Quản lý Vận hành</div>
            </div>
          </div>

          <div>
            <strong className="block text-slate-900 font-bold uppercase text-[12px]">BÊN THUÊ XE (BÊN B):</strong>
            <div className="mt-1 pl-3 space-y-0.5 text-slate-700">
              <div>Họ và tên: <strong>{customer?.full_name || 'Khách thuê xe'}</strong></div>
              <div>Số Căn cước công dân (CCCD): <strong>{(processState?.variables?.extracted_id_number as string) || '079095012345 (Đã định danh AI OCR)'}</strong></div>
              <div>Hạng Giấy phép lái xe: <strong>{(processState?.variables?.extracted_license_class as string) || 'A1'}</strong></div>
              <div>Số điện thoại liên hệ: <strong>{customer?.phone || '0908 123 456'}</strong></div>
              <div>Địa chỉ thường trú: <strong>{(processState?.variables?.extracted_address as string) || 'TP. Hồ Chí Minh'}</strong></div>
            </div>
          </div>
        </div>

        {/* Điều khoản 1: Đối tượng & Thời gian */}
        <div className="space-y-2 font-sans text-xs text-slate-800">
          <strong className="block font-bold text-slate-900 text-[12px]">ĐIỀU 1: ĐỐI TƯỢNG VÀ THỜI HẠN THUÊ</strong>
          <div className="pl-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div>- Phương tiện: <strong>{vehicle ? `${vehicle.model} (Biển số: ${vehicle.plate})` : 'Phân khúc xe máy Moto Care'}</strong></div>
              <div>- Thời gian nhận xe: <strong>{formatDateTime(request.start_at)}</strong></div>
              <div>- Thời gian trả xe dự kiến: <strong>{formatDateTime(request.end_at)}</strong></div>
            </div>
            {vehicle && (
              <div className="w-24 h-16 rounded-xl bg-slate-50 border border-slate-200/80 p-1 shrink-0 overflow-hidden flex items-center justify-center">
                <img
                  src={getVehicleImageUrl(vehicle.model)}
                  alt={vehicle.model}
                  className="h-full w-full object-contain"
                />
              </div>
            )}
          </div>
        </div>

        {/* Điều khoản 2: Giá trị và thanh toán */}
        <div className="space-y-2 font-sans text-xs text-slate-800">
          <strong className="block font-bold text-slate-900 text-[12px]">ĐIỀU 2: GIÁ THUÊ VÀ TIỀN ĐẶT CỌC</strong>
          <div className="pl-3 space-y-1">
            <div>- Đơn giá thuê: <strong>{formatCurrency(vehicle?.daily_price || 120000)} / ngày</strong></div>
            <div>- Tổng tiền thuê dự tính: <strong>{formatCurrency(request.total_price)}</strong></div>
            <div>
              - Tiền đặt cọc bảo chứng hợp đồng (30%): <strong className="text-amber-700">{formatCurrency(request.deposit_amount)}</strong> (Đã đối soát thanh toán).
            </div>
          </div>
        </div>

        {/* Điều khoản 3: Quyền và nghĩa vụ */}
        <div className="space-y-2 font-sans text-xs text-slate-700 text-justify">
          <strong className="block font-bold text-slate-900 text-[12px]">ĐIỀU 3: QUYỀN VÀ TRÁCH NHIỆM</strong>
          <div className="pl-3 space-y-1">
            <div>1. Bên B có trách nhiệm kiểm tra hiện trạng xe khi nhận, tuân thủ Luật Giao thông đường bộ và giữ gìn xe trong suốt thời gian thuê.</div>
            <div>2. Trong trường hợp xảy ra sự cố ngoài ý muốn hoặc hư hỏng kỹ thuật, Bên B kích hoạt tính năng cứu hộ (SP2) trên ứng dụng để được hỗ trợ kịp thời.</div>
            <div>3. Tiền cọc sẽ được hoàn trả 100% khi thanh lý hợp đồng nếu xe được trả đúng hiện trạng ban đầu.</div>
          </div>
        </div>

        {/* Chữ ký hai bên */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-center font-sans text-xs">
          <div>
            <div className="font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN A</div>
            <div className="text-[11px] text-slate-500 italic mt-0.5">Đã ký số điện tử</div>
            <div className="h-16 flex items-center justify-center">
              <span className="font-serif italic font-bold text-brand-700 text-sm border-2 border-brand-600 px-3 py-1 rounded-lg rotate-[-3deg] shadow-xs">
                MOTO CARE CO., LTD
              </span>
            </div>
          </div>

          <div>
            <div className="font-bold uppercase text-slate-800">ĐẠI DIỆN BÊN B</div>
            <div className="text-[11px] text-slate-500 italic mt-0.5">Khách thuê xe</div>
            <div className="h-16 flex items-center justify-center">
              {isSigned ? (
                <div className="text-center">
                  <span className="font-serif italic font-bold text-emerald-700 text-sm">
                    {customer?.full_name}
                  </span>
                  <div className="text-[10px] text-emerald-600 font-mono">Đã xác nhận ký điện tử</div>
                </div>
              ) : (
                <span className="text-slate-400 italic text-xs">(Chưa ký)</span>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* KHU VỰC KÝ CHỮ KÝ SỐ (Dành cho khách hàng) */}
      {!isSigned && !isExpired && (
        <Card className="p-6 border-slate-200/80 space-y-4 glass-surface shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <PenTool className="w-5 h-5 text-brand-600" />
                Ký xác nhận hợp đồng điện tử
              </h3>
              <p className="text-xs text-slate-500">
                Lựa chọn vẽ chữ ký trực tiếp hoặc nhập họ tên để hoàn tất cam kết.
              </p>
            </div>

            {/* Toggle chế độ ký */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setSignMode('draw')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  signMode === 'draw'
                    ? 'bg-white text-brand-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <PenTool className="w-3.5 h-3.5" />
                  Vẽ chữ ký
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSignMode('type')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  signMode === 'type'
                    ? 'bg-white text-brand-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Type className="w-3.5 h-3.5" />
                  Nhập họ tên
                </span>
              </button>
            </div>
          </div>

          {/* Ô ký dạng vẽ Canvas */}
          {signMode === 'draw' ? (
            <div className="space-y-2">
              <div className="border-2 border-dashed border-slate-300 rounded-2xl bg-white overflow-hidden relative shadow-inner">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={160}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-40 cursor-crosshair touch-none"
                />

                {isCanvasEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                    Dùng chuột hoặc ngón tay để vẽ chữ ký của bạn vào đây
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  Xóa vẽ lại
                </Button>
              </div>
            </div>
          ) : (
            /* Ô ký dạng gõ tên */
            <div className="space-y-2">
              <Input
                label="Họ và tên người ký"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Nhập đầy đủ họ tên như trên CCCD"
                required
              />
              <div className="p-3 bg-slate-50 rounded-xl text-center font-serif italic text-base text-brand-800 border border-slate-200">
                {typedName.trim() || 'Chữ ký điện tử mô phỏng'}
              </div>
            </div>
          )}

          {/* Nút gửi chữ ký trên desktop */}
          <div className="pt-3 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="lg"
              data-testid="node-M_WaitSign"
              loading={signing}
              onClick={handleSignContract}
              className="hidden sm:flex items-center justify-center gap-2 shadow-md"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Xác nhận ký hợp đồng (M_WaitSign)</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Sticky Bottom CTA Bar cho Mobile */}
      {!isSigned && !isExpired && (
        <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-30 shadow-lg">
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            data-testid="node-M_WaitSign"
            loading={signing}
            onClick={handleSignContract}
            className="flex items-center justify-center gap-2 shadow-md"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Xác nhận ký hợp đồng</span>
          </Button>
        </div>
      )}
    </div>
  );
}
