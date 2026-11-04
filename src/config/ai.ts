// src/config/ai.ts
// Cấu hình AI Agent OCR cho hoạt động M_CheckDocs (Theo bản đặc tả)

export interface AiConfig {
  mode: 'MOCK' | 'LIVE';
  provider: 'gemini' | 'mock';
  apiKey?: string;
  model: string;
  thresholdX: number; // Ngưỡng X (m >= 0.95 -> PREFILL_FOR_RULES tự động)
  thresholdY: number; // Ngưỡng Y (0.80 <= m < 0.95 -> MANUAL_REVIEW)
  timeoutMs: number;
}

const STORAGE_KEY = 'motocare_ai_config';

export const DEFAULT_AI_CONFIG: AiConfig = {
  mode: (import.meta.env.VITE_AI_MODE as 'MOCK' | 'LIVE') || 'MOCK',
  provider: 'gemini',
  apiKey: import.meta.env.VITE_GEMINI_API_KEY || '',
  model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-1.5-flash',
  thresholdX: 0.95, // 95% theo đặc tả
  thresholdY: 0.80, // 80% theo đặc tả
  timeoutMs: 8000,
};

/**
 * Lấy cấu hình AI hiện tại (ưu tiên sessionStorage/localStorage ghi đè)
 */
export function getAiConfig(): AiConfig {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return { ...DEFAULT_AI_CONFIG };
}

/**
 * Cập nhật cấu hình AI (lưu sessionStorage để an toàn)
 */
export function saveAiConfig(cfg: Partial<AiConfig>): AiConfig {
  const current = getAiConfig();
  const next = { ...current, ...cfg };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // fallback
  }
  return next;
}

/**
 * System Prompt chuẩn hóa cho AI Agent OCR trích xuất CCCD và GPLX
 */
export const AI_OCR_SYSTEM_PROMPT = `Bạn là AI Agent OCR chuyên dụng của hệ thống cho thuê xe máy MOTO CARE (theo mô hình BPMN To-Be tại bước M_CheckDocs).
Nhiệm vụ của bạn là nhận dạng ký tự quang học và trích xuất dữ liệu có cấu trúc từ ảnh chụp Căn cước công dân (CCCD) và Giấy phép lái xe (GPLX) của khách hàng.

QUY TẮC BẮT BUỘC:
1. KHÔNG tự bịa, đoán mò hoặc điền khống thông tin nếu ảnh mờ hoặc không đọc được. Trường nào không đọc được phải trả về null kèm confidence null.
2. Với mỗi trường dữ liệu trích xuất, phải kèm theo điểm tin cậy confidence (từ 0.00 đến 1.00).
3. Các trường bắt buộc cần trích xuất:
   - CCCD: full_name (họ và tên có dấu viết HOA), date_of_birth (YYYY-MM-DD), id_number (số CCCD/định danh).
   - GPLX: full_name (họ và tên có dấu viết HOA), license_class (hạng bằng lái: A1, A2, B1...), expiry_date (YYYY-MM-DD hoặc null nếu không thời hạn).
4. Kiểm tra tính nhất quán họ tên (name_consistency: 'PASS' hoặc 'MISMATCH').
5. Điểm phân nhánh m (minimum_required_confidence) là giá trị nhỏ nhất của các điểm confidence của những trường bắt buộc đã trích xuất.
6. Xác định routing.action dựa trên 2 ngưỡng X = 0.95 và Y = 0.80:
   - Nếu ảnh hỏng, mờ, mất vùng thông tin hoặc m < 0.80: routing.action = "REQUEST_REUPLOAD".
   - Nếu 0.80 <= m < 0.95 hoặc có trường mâu thuẫn (name_consistency === 'MISMATCH'): routing.action = "MANUAL_REVIEW".
   - Nếu m >= 0.95 và tất cả kiểm tra đều 'PASS': routing.action = "PREFILL_FOR_RULES".
7. Bắt buộc phản hồi bằng ĐÚNG ĐỊNH DẠNG JSON duy nhất, không giải thích thêm.`;

