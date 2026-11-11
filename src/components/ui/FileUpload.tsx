// src/components/ui/FileUpload.tsx
// Hỗ trợ tải ảnh lên, xem trước và nén về tối đa 1280px, dung lượng ~300KB theo luật dự án

import React, { useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { UploadCloud, Image as ImageIcon, X, Check, Loader2 } from 'lucide-react';

export interface FileUploadResult {
  blob: Blob;
  previewUrl: string;
  originalSize: number;
  compressedSize: number;
  fileName: string;
}

export interface FileUploadProps {
  label?: string;
  error?: string;
  helperText?: string;
  maxDimension?: number; // mặc định 1280px
  maxSizeKB?: number;    // mục tiêu ~300KB
  onFileSelect?: (result: FileUploadResult | null) => void;
  className?: string;
  disabled?: boolean;
}

export function FileUpload({
  label,
  error,
  helperText,
  maxDimension = 1280,
  maxSizeKB = 300,
  onFileSelect,
  className,
  disabled,
}: FileUploadProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FileUploadResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Nén ảnh qua Canvas HTML5
   */
  const compressImage = async (file: File): Promise<FileUploadResult> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          let { width, height } = img;

          // Thu nhỏ tỷ lệ nếu chiều lớn nhất vượt maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Không thể khởi tạo Canvas 2D'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          // Nén chất lượng JPEG
          let quality = 0.85;
          const attemptCompression = () => {
            canvas.toBlob(
              (blob) => {
                if (!blob) {
                  reject(new Error('Lỗi nén ảnh'));
                  return;
                }

                // Nếu ảnh vẫn > maxSizeKB và quality > 0.4 thì thử nén tiếp
                if (blob.size > maxSizeKB * 1024 && quality > 0.4) {
                  quality -= 0.15;
                  attemptCompression();
                  return;
                }

                // Consumers persist this field in cloud records: a blob: URL is local to one browser.
                const persistedReader = new FileReader();
                persistedReader.onerror = () => reject(new Error('Không thể lưu dữ liệu ảnh đã nén'));
                persistedReader.onload = () => resolve({
                  blob,
                  previewUrl: String(persistedReader.result),
                  originalSize: file.size,
                  compressedSize: blob.size,
                  fileName: file.name,
                });
                persistedReader.readAsDataURL(blob);
              },
              'image/jpeg',
              quality
            );
          };

          attemptCompression();
        };
        img.onerror = () => reject(new Error('Không đọc được tệp hình ảnh'));
      };
      reader.onerror = () => reject(new Error('Lỗi đọc tệp'));
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const res = await compressImage(file);
      setResult(res);
      onFileSelect?.(res);
    } catch (err) {
      console.error('Lỗi nén ảnh:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    setResult(null);
    onFileSelect?.(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const formatKB = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

  return (
    <div className={cn('w-full', className)}>
      {label && <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        disabled={disabled || loading}
        className="hidden"
      />

      {!result ? (
        <div
          onClick={() => !disabled && !loading && inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl cursor-pointer transition-all',
            'border-slate-300 bg-slate-50/60 hover:bg-slate-50 hover:border-brand-500',
            disabled && 'opacity-60 cursor-not-allowed',
            error && 'border-red-400 bg-red-50/20'
          )}
        >
          {loading ? (
            <div className="flex flex-col items-center text-brand-600 py-3">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <span className="text-xs font-medium">Đang xử lý & nén ảnh...</span>
            </div>
          ) : (
            <>
              <div className="w-10 h-10 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <UploadCloud className="w-5 h-5" />
              </div>
              <span className="text-sm font-semibold text-slate-700">Tải ảnh lên hoặc bấm để chọn</span>
              <span className="text-xs text-slate-400 mt-1">Hỗ trợ JPG, PNG (tự động nén tối đa 1280px, ~300KB)</span>
            </>
          )}
        </div>
      ) : (
        <div className="relative rounded-2xl border border-slate-200 p-3 bg-white flex items-center gap-3 shadow-sm">
          <img
            src={result.previewUrl}
            alt="Preview"
            className="w-16 h-16 rounded-xl object-cover border border-slate-100 flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <ImageIcon className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="text-sm font-medium text-slate-800 truncate">{result.fileName}</span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span>Gốc: {formatKB(result.originalSize)}</span>
              <span>•</span>
              <span className="text-brand-700 font-medium flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Nén: {formatKB(result.compressedSize)}
              </span>
            </div>
          </div>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helperText && !error && <p className="mt-1 text-xs text-slate-500">{helperText}</p>}
    </div>
  );
}

