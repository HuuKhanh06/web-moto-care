import { OcrError } from './errors';
import { withOcrDeadline } from './timeout';

export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/bmp'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export function validateImageFile(file: File): void {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type)) {
    throw new OcrError('INVALID_FILE', 'Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc BMP. Vui lòng chuyển PDF/HEIC sang ảnh.');
  }
  if (!file.size || file.size > MAX_IMAGE_BYTES) {
    throw new OcrError('INVALID_FILE', 'Ảnh phải có dung lượng từ 1 byte đến 10 MB.');
  }
}

export async function imageRefToDataUrl(ref: string, signal: AbortSignal): Promise<string> {
  if (ref.startsWith('data:')) {
    if (ref.length > MAX_IMAGE_BYTES * 1.4 || !/^data:image\/(jpeg|png|webp|bmp);base64,[A-Za-z0-9+/]+={0,2}$/.test(ref)) {
      throw new OcrError('INVALID_FILE', 'Dữ liệu ảnh không hợp lệ hoặc vượt quá 10 MB.');
    }
    return ref;
  }
  // Chỉ đọc ảnh của ứng dụng; không gửi đường dẫn rỗng hay blob mẫu đến AI.
  if (!ref.startsWith('blob:') && !/^https?:\/\//.test(ref)) throw new OcrError('INVALID_FILE', 'Đường dẫn ảnh không hợp lệ.');
  const response = await fetch(ref, { signal });
  if (!response.ok) throw new OcrError('IMAGE_LOAD', 'Không thể tải ảnh giấy tờ. Vui lòng tải lại ảnh.');
  const blob = await response.blob();
  validateImageFile(new File([blob], 'document', { type: blob.type }));
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const abort = () => { reader.abort(); reject(new OcrError('CANCELLED', 'Đã dừng tải ảnh.')); };
    signal.addEventListener('abort', abort, { once: true });
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new OcrError('IMAGE_LOAD', 'Không thể đọc ảnh.'));
    reader.onloadend = () => signal.removeEventListener('abort', abort);
    if (signal.aborted) { abort(); return; }
    reader.readAsDataURL(blob);
  });
}

export async function compressImageToDataUrl(file: File, timeoutMs = 15000): Promise<string> {
  validateImageFile(file);
  return withOcrDeadline(signal => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    const img = new Image();
    const abort = () => { reader.abort(); img.src = ''; };
    const finish = (error?: Error, data?: string) => {
      signal.removeEventListener('abort', abort);
      if (error) reject(error);
      else resolve(data!);
    };
    signal.addEventListener('abort', abort, { once: true });
    reader.onerror = () => finish(new OcrError('IMAGE_LOAD', 'Không thể đọc tệp ảnh.'));
    img.onerror = () => finish(new OcrError('INVALID_FILE', 'Tệp tải lên không phải ảnh hợp lệ hoặc ảnh đã hỏng.'));
    reader.onload = () => { if (!signal.aborted) img.src = String(reader.result); };
    img.onload = () => {
      if (signal.aborted) return;
      try {
        if (!img.width || !img.height || img.width * img.height > 40_000_000) {
          throw new OcrError('INVALID_FILE', 'Ảnh không hợp lệ hoặc vượt quá 40 triệu điểm ảnh.');
        }
        // Giữ 2000px cho ảnh giấy tờ: thu nhỏ hơn làm chữ trên CCCD/GPLX quá bé để OCR đọc đúng.
        const scale = Math.min(1, 2000 / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new OcrError('IMAGE_DECODE', 'Thiết bị không hỗ trợ xử lý ảnh.');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/jpeg', 0.9);
        if (!data.startsWith('data:image/jpeg;base64,')) throw new OcrError('IMAGE_DECODE', 'Không thể chuyển đổi ảnh.');
        finish(undefined, data);
      } catch (error) {
        finish(error instanceof OcrError ? error : new OcrError('IMAGE_DECODE', 'Không thể xử lý tệp ảnh.'));
      }
    };
    reader.readAsDataURL(file);
  }), timeoutMs);
}
