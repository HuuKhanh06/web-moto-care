// src/components/ui/QRBox.tsx
// Hiển thị mã QR chuẩn Napas 24/7 (VietQR) và thẻ Vietcombank thụ hưởng chính chủ

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { Copy, Check, Download, QrCode, CreditCard, Sparkles } from 'lucide-react';
import { Button } from './Button';
import { buildVietQrPayload, VIETQR_BENEFICIARY } from '@/lib/vietQr';

export interface QRBoxProps {
  qrRef: string;
  amount?: number;
  title?: string;
  description?: string;
  accountName?: string;
  accountNo?: string;
  bankName?: string;
  bankBin?: string;
  cardImageUrl?: string;
  className?: string;
  size?: number;
}

export function QRBox({
  qrRef,
  amount,
  title = 'Quét mã QR để thanh toán',
  description = 'Sử dụng ứng dụng ngân hàng hoặc ví điện tử để quét mã',
  accountName = VIETQR_BENEFICIARY.accountName,
  accountNo = VIETQR_BENEFICIARY.accountNo,
  bankName = VIETQR_BENEFICIARY.bankName,
  bankBin = VIETQR_BENEFICIARY.bankBin,
  cardImageUrl = VIETQR_BENEFICIARY.cardImageUrl,
  className,
  size = 220,
}: QRBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'dynamic' | 'card'>('dynamic');

  // Sinh mã VietQR chuẩn EMVCo Napas 24/7 (tự động nhận diện tài khoản, số tiền và nội dung chuyển khoản)
  useEffect(() => {
    if (viewMode !== 'dynamic' || !canvasRef.current || !qrRef) return;

    try {
      const payload = buildVietQrPayload({
        accountNo,
        bankBin,
        amount,
        description: qrRef,
      });

      QRCode.toCanvas(
        canvasRef.current,
        payload,
        {
          width: size,
          margin: 2,
          color: {
            dark: '#005A3C', // Tông xanh lá Vietcombank / Moto Care
            light: '#FFFFFF',
          },
        },
        (err) => {
          if (err) {
            console.error('Lỗi sinh mã QR Vietcombank:', err);
            setError('Không thể tạo mã QR');
          } else {
            setError(null);
          }
        }
      );
    } catch (err) {
      console.error('Lỗi chuẩn bị dữ liệu VietQR:', err);
      setError('Dữ liệu VietQR không hợp lệ');
    }
  }, [qrRef, amount, accountNo, bankBin, size, viewMode]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Không thể sao chép:', err);
    }
  };

  const handleDownload = () => {
    if (viewMode === 'card') {
      const a = document.createElement('a');
      a.href = cardImageUrl;
      a.download = `Vietcombank_Card_${accountNo}.jpg`;
      a.target = '_blank';
      a.click();
      return;
    }

    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `VietQR_Vietcombank_${accountNo}_${qrRef}.png`;
    a.click();
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center p-5 rounded-2xl bg-white border border-slate-200 shadow-sm text-center max-w-sm mx-auto transition-all',
        className
      )}
    >
      {/* Icon đầu trang */}
      <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mb-2 shadow-xs">
        <QrCode className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-3">{description}</p>

      {/* Nút chuyển đổi giữa QR Động và Thẻ QR Gốc */}
      <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 mb-3 text-xs">
        <button
          type="button"
          onClick={() => setViewMode('dynamic')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer',
            viewMode === 'dynamic'
              ? 'bg-white text-emerald-800 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>Mã QR động (tự điền tiền)</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('card')}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer',
            viewMode === 'card'
              ? 'bg-white text-emerald-800 font-semibold shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          )}
        >
          <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
          <span>Thẻ QR Vietcombank</span>
        </button>
      </div>

      {/* Khung hiển thị QR */}
      <div className="relative p-3 bg-emerald-50/40 rounded-2xl border border-emerald-100 shadow-inner flex items-center justify-center min-h-[220px]">
        {viewMode === 'dynamic' ? (
          error ? (
            <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-red-500 bg-red-50 rounded-xl">
              {error}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <canvas ref={canvasRef} className="rounded-xl shadow-xs" />
              <div className="flex items-center gap-1 mt-1 text-[11px] text-emerald-800 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Chuẩn Napas 24/7 (VietQR)</span>
              </div>
            </div>
          )
        ) : (
          <div className="flex flex-col items-center">
            <img
              src={cardImageUrl}
              alt="Mã QR Vietcombank NGUYEN HUU KHANH"
              className="max-h-[260px] w-auto rounded-xl shadow-xs object-contain"
            />
          </div>
        )}
      </div>

      {/* Thông tin số tiền */}
      {typeof amount === 'number' && (
        <div className="mt-4 text-center">
          <div className="text-xs text-slate-400 font-medium">Số tiền cần thanh toán</div>
          <div className="text-2xl font-extrabold text-emerald-700 tracking-tight mt-0.5">
            {formatCurrency(amount)}
          </div>
        </div>
      )}

      {/* Chi tiết tài khoản thụ hưởng */}
      <div className="w-full mt-4 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-left space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-slate-500">Ngân hàng:</span>
          <span className="font-semibold text-slate-800">{bankName}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-slate-500">Chủ tài khoản:</span>
          <span className="font-semibold text-slate-800">{accountName}</span>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
          <span className="text-slate-500">Số tài khoản:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
              {accountNo}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(accountNo, 'acc')}
              className="p-1 rounded text-slate-400 hover:text-emerald-700 cursor-pointer transition-colors"
              title="Sao chép số tài khoản"
            >
              {copiedKey === 'acc' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
          <span className="text-slate-500">Nội dung CK:</span>
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 truncate max-w-[140px]" title={qrRef}>
              {qrRef}
            </span>
            <button
              type="button"
              onClick={() => handleCopy(qrRef, 'ref')}
              className="p-1 rounded text-slate-400 hover:text-emerald-700 cursor-pointer transition-colors"
              title="Sao chép nội dung chuyển khoản"
            >
              {copiedKey === 'ref' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-4 w-full">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          onClick={() => handleCopy(qrRef, 'ref_btn')}
        >
          {copiedKey === 'ref_btn' ? <Check className="w-3.5 h-3.5 text-emerald-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copiedKey === 'ref_btn' ? 'Đã sao chép' : 'Sao chép nội dung'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-xs px-2.5"
          onClick={handleDownload}
          title="Tải ảnh mã QR"
        >
          <Download className="w-3.5 h-3.5 mr-1" />
          <span>Tải QR</span>
        </Button>
      </div>
    </div>
  );
}
