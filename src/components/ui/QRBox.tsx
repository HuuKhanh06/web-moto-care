// src/components/ui/QRBox.tsx
// Hiển thị mã QR động tạo từ qr_ref bằng thư viện qrcode kèm số tiền thanh toán

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/format';
import { Copy, Check, Download, QrCode } from 'lucide-react';
import { Button } from './Button';

export interface QRBoxProps {
  qrRef: string;
  amount?: number;
  title?: string;
  description?: string;
  accountName?: string;
  bankName?: string;
  className?: string;
  size?: number;
}

export function QRBox({
  qrRef,
  amount,
  title = 'Quét mã QR để thanh toán',
  description = 'Sử dụng ứng dụng ngân hàng hoặc ví điện tử để quét mã',
  accountName = 'MOTO CARE VIET NAM',
  bankName = 'MB BANK (Napas 247)',
  className,
  size = 220,
}: QRBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !qrRef) return;

    QRCode.toCanvas(
      canvasRef.current,
      qrRef,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#0B3D26', // brand-900 cho nét QR
          light: '#FFFFFF',
        },
      },
      (err) => {
        if (err) {
          console.error('Lỗi sinh mã QR:', err);
          setError('Không thể tạo mã QR');
        } else {
          setError(null);
        }
      }
    );
  }, [qrRef, size]);

  const handleCopyRef = async () => {
    try {
      await navigator.clipboard.writeText(qrRef);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Không thể sao chép:', err);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `QRCode_${qrRef}.png`;
    a.click();
  };

  return (
    <div
      className={cn(
        'flex flex-col items-center p-6 rounded-2xl bg-white border border-slate-200 shadow-sm text-center max-w-sm mx-auto',
        className
      )}
    >
      <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
        <QrCode className="w-5 h-5" />
      </div>
      <h3 className="text-base font-bold text-slate-800">{title}</h3>
      <p className="text-xs text-slate-500 mt-0.5 mb-4">{description}</p>

      {/* Khung Canvas QR */}
      <div className="relative p-3 bg-brand-50/50 rounded-2xl border border-brand-100 shadow-inner flex items-center justify-center">
        {error ? (
          <div className="w-[200px] h-[200px] flex items-center justify-center text-xs text-red-500 bg-red-50 rounded-xl">
            {error}
          </div>
        ) : (
          <canvas ref={canvasRef} className="rounded-xl shadow-sm" />
        )}
      </div>

      {/* Thông tin số tiền */}
      {typeof amount === 'number' && (
        <div className="mt-4 text-center">
          <div className="text-xs text-slate-400 font-medium">Số tiền cần thanh toán</div>
          <div className="text-2xl font-extrabold text-brand-700 tracking-tight mt-0.5">
            {formatCurrency(amount)}
          </div>
        </div>
      )}

      {/* Chi tiết tài khoản */}
      <div className="w-full mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-left space-y-1.5">
        <div className="flex justify-between">
          <span className="text-slate-400">Ngân hàng:</span>
          <span className="font-semibold text-slate-700">{bankName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-400">Chủ tài khoản:</span>
          <span className="font-semibold text-slate-700">{accountName}</span>
        </div>
        <div className="flex justify-between items-center pt-1 border-t border-slate-200">
          <span className="text-slate-400">Nội dung CK:</span>
          <span className="font-mono font-semibold text-brand-700 truncate max-w-[170px]" title={qrRef}>
            {qrRef}
          </span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-4 w-full">
        <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={handleCopyRef}>
          {copied ? <Check className="w-3.5 h-3.5 text-brand-600 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
          {copied ? 'Đã sao chép' : 'Sao chép mã'}
        </Button>
        <Button variant="outline" size="sm" className="text-xs px-2.5" onClick={handleDownload} title="Tải ảnh QR">
          <Download className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

