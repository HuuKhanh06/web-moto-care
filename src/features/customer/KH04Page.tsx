// src/features/customer/KH04Page.tsx
// Màn hình 4: Ký hợp đồng điện tử

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
  Input,
  toast,
  BookingProgress,
  StatusChip,
  StickyBottomBar,
} from '@/components/ui';
import { formatCurrency, formatDateTime } from '@/lib/format';
import {
  Clock,
  Printer,
  PenTool,
  CheckCircle2,
  ShieldAlert,
  Eraser,
  Type,
  FileCheck,
} from 'lucide-react';
import { COPY } from '@/copy';

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
  const [remainingSeconds, setRemainingSeconds] = useState<number>(86400);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);

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

  // Đồng hồ đếm ngược 24h
  useEffect(() => {
    if (!contract || !contract.expires_at) return;

    const updateTimer = () => {
      const now = clock.now();
      const expire = new Date(contract.expires_at || '');
      const diffSec = Math.max(0, Math.floor((expire.getTime() - now.getTime()) / 1000));
      setRemainingSeconds(diffSec);

      if (diffSec <= 0) {
        loadData();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [contract, loadData]);

  // Khởi tạo Canvas vẽ chữ ký
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
    ctx.strokeStyle = '#0f766e';
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

  const handleSignContract = async () => {
    if (!requestId || !contract || !currentActor) return;

    let signatureData = '';
    if (signMode === 'draw') {
      if (isCanvasEmpty) {
        toast.warning('Vui lòng vẽ chữ ký của bạn trước khi xác nhận');
        return;
      }
      signatureData = canvasRef.current?.toDataURL('image/png') || 'signature_drawn';
    } else {
      if (!typedName.trim()) {
        toast.warning('Vui lòng nhập đầy đủ họ tên để ký số');
        return;
      }
      signatureData = `Chữ ký số: ${typedName.trim()}`;
    }

    setSigning(true);
    try {
      await engine.complete(
        requestId,
        'M_WaitSign',
        {
          signature_url: signatureData,
        },
        currentActor
      );

      toast.success('Ký hợp đồng thành công! Lịch thuê đã được xác nhận.');
      navigate(`/kh/05?requestId=${requestId}`);
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
      <div className="max-w-2xl mx-auto py-16 text-center text-slate-500">
        <FileCheck className="w-8 h-8 mx-auto animate-pulse text-teal-600 mb-2" />
        <span className="text-sm font-normal">Đang tạo văn bản hợp đồng...</span>
      </div>
    );
  }

  if (!request) return null;

  const isExpired = request.status === 'DA_HUY' && request.closed_reason === 'QUA_HAN_KY';
  const isSigned = contract?.status === 'SIGNED' || ['CHO_BAN_GIAO', 'CHO_KHACH_NHAN', 'DANG_THUE'].includes(request.status);

  const hours = Math.floor(remainingSeconds / 3600);
  const minutes = Math.floor((remainingSeconds % 3600) / 60);
  const seconds = remainingSeconds % 60;
  const timerStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const cccdNumber = String(processState?.variables?.customer_id_number || '079095012345');
  const licenseClass = String(processState?.variables?.customer_license_class || 'A1');

  return (
    <div className="space-y-6 max-w-2xl mx-auto pb-24 md:pb-8">
      {/* 4 Bước tiến trình */}
      <BookingProgress currentStep={4} />

      {/* Tiêu đề trang */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl md:text-3xl font-semibold text-slate-900 tracking-tight">
          {COPY.TITLES.CONTRACT}
        </h1>
        <div className="flex items-center gap-2">
          <StatusChip
            status={isSigned ? 'success' : isExpired ? 'error' : 'pending'}
            label={isSigned ? 'Đã ký hợp lệ' : isExpired ? 'Quá hạn ký' : 'Chờ ký số'}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="hidden sm:inline-flex"
            title="In hoặc tải PDF"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            <span>In PDF</span>
          </Button>
        </div>
      </div>

      {isExpired && (
        <Card className="p-4 md:p-6 border border-rose-200 bg-rose-50 text-rose-900 space-y-2 rounded-xl">
          <div className="flex items-center gap-2 font-semibold text-base text-rose-800">
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
            <span>Hợp đồng đã quá hạn 24 giờ</span>
          </div>
          <p className="text-sm text-rose-700">
            Yêu cầu đã tự động kết thúc và tiền cọc được hoàn về tài khoản của bạn.
          </p>
        </Card>
      )}

      {isSigned && (
        <Card className="p-4 md:p-6 border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between rounded-xl">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Hợp đồng đã được ký kết thành công!</span>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate(`/kh/05?requestId=${requestId}`)}
          >
            Nhận xe
          </Button>
        </Card>
      )}

      {!isSigned && !isExpired && (
        <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 flex items-center justify-between text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>Thời hạn hoàn tất ký hợp đồng:</span>
          </div>
          <span className="font-mono font-semibold text-amber-950">
            {timerStr}
          </span>
        </div>
      )}

      {/* BẢN TÓM TẮT HỢP ĐỒNG THƯƠNG MẠI */}
      <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
        <div className="border-b border-slate-100 pb-3 text-center">
          <span className="text-[13px] font-semibold text-teal-700 uppercase tracking-wider block">
            CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
          </span>
          <h2 className="text-lg font-semibold text-slate-900 mt-1">
            HỢP ĐỒNG THUÊ XE MÁY ĐIỆN TỬ
          </h2>
          <span className="text-[13px] text-slate-500">Mã hợp đồng: #{contract?.id.slice(-8).toUpperCase()}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm divide-y sm:divide-y-0 divide-slate-100">
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-900 block">BÊN CHO THUÊ (BÊN A)</span>
            <p className="text-slate-700">Công ty Cổ phần MotoCare Đà Nẵng</p>
            <p className="text-[13px] text-slate-500">Hotline hỗ trợ: 1900 6868</p>
          </div>

          <div className="space-y-1.5 pt-2 sm:pt-0">
            <span className="font-semibold text-slate-900 block">BÊN THUÊ XE (BÊN B)</span>
            <p className="text-slate-800 font-semibold">{customer?.full_name || 'Khách hàng'}</p>
            <p className="text-[13px] text-slate-500">CCCD: {cccdNumber} · Hạng bằng: {licenseClass}</p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Phương tiện:</span>
            <span className="font-semibold text-slate-900">{vehicle?.model} ({vehicle?.plate})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Thời gian thuê:</span>
            <span className="font-semibold text-slate-900">{formatDateTime(request.start_at)} đến {formatDateTime(request.end_at)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Tổng tiền thuê:</span>
            <span className="font-semibold text-slate-900">{formatCurrency(request.total_price || 0)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2">
            <span className="text-slate-700 font-semibold">Tiền cọc đã thanh toán:</span>
            <span className="font-semibold text-teal-700">{formatCurrency(request.deposit_amount || 0)}</span>
          </div>
        </div>

        <div className="text-[13px] text-slate-500 leading-normal space-y-1">
          <p>• Bên B cam kết điều khiển phương tiện đúng luật giao thông và hoàn trả xe đúng hẹn.</p>
          <p>• Tiền cọc được hoàn trả ngay khi hoàn tất bàn giao xe và kiểm tra không có hư hại phát sinh.</p>
        </div>
      </Card>

      {/* KHUNG KÝ CHỮ KÝ SỐ */}
      {!isSigned && !isExpired && (
        <Card className="p-4 md:p-6 border border-slate-200 bg-white rounded-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-semibold text-slate-900">Ký xác nhận hợp đồng</h2>
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg text-sm">
              <button
                type="button"
                onClick={() => setSignMode('draw')}
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                  signMode === 'draw' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
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
                className={`px-3 py-1 rounded-md text-sm font-semibold transition-all cursor-pointer ${
                  signMode === 'type' ? 'bg-white text-teal-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Type className="w-3.5 h-3.5" />
                  Gõ họ tên
                </span>
              </button>
            </div>
          </div>

          {signMode === 'draw' ? (
            <div className="space-y-2">
              <div className="border border-slate-300 rounded-xl bg-white overflow-hidden relative">
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={150}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-36 cursor-crosshair touch-none"
                />
                {isCanvasEmpty && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-sm">
                    Dùng ngón tay hoặc chuột vẽ chữ ký vào đây
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="flex items-center gap-1 text-[13px] text-slate-500 hover:text-rose-600 cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>Xóa vẽ lại</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                label="Họ và tên người ký"
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder="Nhập họ và tên như trên CCCD"
                required
              />
              <div className="p-3 bg-slate-50 rounded-xl text-center italic text-base text-teal-800 border border-slate-200">
                {typedName.trim() || 'Chữ ký điện tử'}
              </div>
            </div>
          )}

          {/* Nút hành động Desktop */}
          <div className="hidden md:flex justify-end pt-2">
            <Button
              type="button"
              variant="primary"
              size="md"
              data-testid="node-M_WaitSign"
              loading={signing}
              onClick={handleSignContract}
              className="px-8 min-w-[200px]"
            >
              <span>{COPY.ACTION.SIGN_CONTRACT}</span>
            </Button>
          </div>
        </Card>
      )}

      {/* Sticky Bottom Bar trên Mobile */}
      {!isSigned && !isExpired && (
        <StickyBottomBar className="md:hidden">
          <Button
            type="button"
            variant="primary"
            size="md"
            fullWidth
            data-testid="node-M_WaitSign"
            loading={signing}
            onClick={handleSignContract}
          >
            <span>{COPY.ACTION.SIGN_CONTRACT}</span>
          </Button>
        </StickyBottomBar>
      )}
    </div>
  );
}
