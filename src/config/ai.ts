// src/config/ai.ts
// Cấu hình AI Agent OCR cho hoạt động M_CheckDocs (Theo bản đặc tả)

import { OcrError } from '@/ai/errors';

export interface AiConfig {
  mode: 'LOCAL' | 'MOCK' | 'LIVE';
  provider: 'gemini' | 'mock' | 'local';
  apiKey?: string;
  model: string;
  thresholdX: number; // Ngưỡng X (m >= 0.95 -> PREFILL_FOR_RULES tự động)
  thresholdY: number; // Ngưỡng Y (0.80 <= m < 0.95 -> MANUAL_REVIEW)
  timeoutMs: number;
}

const STORAGE_KEY = 'motocare_ai_config';

export const DEFAULT_AI_CONFIG: AiConfig = {
  mode: import.meta.env.VITE_OCR_ENDPOINT ? 'LIVE' : (import.meta.env.VITE_AI_MODE as AiConfig['mode']) || 'LOCAL',
  provider: 'gemini',
  apiKey: import.meta.env.DEV ? import.meta.env.VITE_GEMINI_API_KEY || '' : '',
  model: import.meta.env.VITE_GEMINI_MODEL || 'gemini-3.5-flash',
  thresholdX: 0.95, // 95% theo đặc tả
  thresholdY: 0.80, // 80% theo đặc tả
  timeoutMs: import.meta.env.VITE_OCR_ENDPOINT ? 110000 : 60000,
};

/**
 * Lấy cấu hình AI hiện tại (ưu tiên sessionStorage/localStorage ghi đè)
 */
export function getAiConfig(): AiConfig {
  let config = { ...DEFAULT_AI_CONFIG };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (raw) {
      config = { ...DEFAULT_AI_CONFIG, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  // A deployed backend owns the provider configuration, including old browser overrides.
  if (import.meta.env.VITE_OCR_ENDPOINT) {
    config.mode = 'LIVE';
    config.apiKey = '';
    config.timeoutMs = 110000;
    config.thresholdX = 0.95;
    config.thresholdY = 0.80;
  }
  if (!['LOCAL', 'MOCK', 'LIVE'].includes(config.mode) || !Number.isFinite(config.timeoutMs) || config.timeoutMs <= 0 || config.timeoutMs > 120000 ||
    !Number.isFinite(config.thresholdX) || !Number.isFinite(config.thresholdY) || config.thresholdY < 0 || config.thresholdX > 1 || config.thresholdX < config.thresholdY ||
    typeof config.model !== 'string' || (config.apiKey != null && typeof config.apiKey !== 'string')) {
    throw new OcrError('PROVIDER_CONFIG', 'Cấu hình OCR không hợp lệ. Kiểm tra thời gian xử lý và ngưỡng tin cậy.');
  }
  return config;
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
export { AI_OCR_SYSTEM_PROMPT } from '../../supabase/functions/_shared/ocrContract';
