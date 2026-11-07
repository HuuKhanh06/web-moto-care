export class OcrError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'OcrError';
  }
}

// Không ghi error thô của provider: có thể chứa khóa, ảnh hoặc nội dung giấy tờ.
export function safeOcrError(error: unknown): OcrError {
  return error instanceof OcrError ? error : new OcrError(
    'PROCESSING_ERROR', 'Không thể xử lý giấy tờ. Vui lòng thử lại hoặc nhập thông tin thủ công.',
  );
}
