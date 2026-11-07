import { OcrError } from './errors';

// Deadline bao phủ cả tải dữ liệu, khởi tạo OCR và đọc response body.
export async function withOcrDeadline<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  parentSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const deadline = new Promise<never>((_, reject) => {
    cancel = () => {
      reject(new OcrError('CANCELLED', 'Đã dừng xử lý giấy tờ.'));
      controller.abort();
    };
    if (parentSignal?.aborted) { cancel(); return; }
    parentSignal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      reject(new OcrError('TIMEOUT', 'OCR quá thời gian xử lý. Vui lòng thử lại hoặc nhập thông tin thủ công.'));
      controller.abort();
    }, timeoutMs);
  });
  try {
    if (controller.signal.aborted) return await deadline;
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
