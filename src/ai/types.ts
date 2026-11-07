// src/ai/types.ts
// Zod Schema & TypeScript types cho AI Agent OCR tại M_CheckDocs

import { z } from 'zod';

// Schema trường dữ liệu kèm điểm tin cậy
export const ExtractedFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type ExtractedField = z.infer<typeof ExtractedFieldSchema>;

// Schema tài liệu CCCD
export const CccdDocumentSchema = z.object({
  full_name: ExtractedFieldSchema,
  date_of_birth: ExtractedFieldSchema,
  id_number: ExtractedFieldSchema,
});
export type CccdDocument = z.infer<typeof CccdDocumentSchema>;

// Schema tài liệu GPLX
export const GplxDocumentSchema = z.object({
  full_name: ExtractedFieldSchema,
  license_class: ExtractedFieldSchema,
  expiry_date: ExtractedFieldSchema,
});
export type GplxDocument = z.infer<typeof GplxDocumentSchema>;

// Schema kiểm tra chất lượng & nhất quán
export const QualityChecksSchema = z.object({
  image_quality: z.enum(['PASS', 'FAIL', 'BLURRY']),
  required_fields_present: z.boolean(),
  name_consistency: z.enum(['PASS', 'MISMATCH', 'NOT_APPLICABLE']),
});
export type QualityChecks = z.infer<typeof QualityChecksSchema>;

// Schema ngưỡng tin cậy
export const ThresholdsSchema = z.object({
  X: z.number(), // Mặc định 0.95
  Y: z.number(), // Mặc định 0.80
});
export type Thresholds = z.infer<typeof ThresholdsSchema>;

// Schema điều hướng quyết định
export const RoutingActionSchema = z.enum([
  'PREFILL_FOR_RULES', // m >= X: Tự động chạy Business Rules
  'MANUAL_REVIEW',     // Y <= m < X hoặc mâu thuẫn: Người xác minh thủ công
  'REQUEST_REUPLOAD',  // m < Y hoặc ảnh mờ: Yêu cầu tải lại ảnh
  'FALLBACK_MANUAL',   // Lỗi kỹ thuật / Timeout: Nhân viên nhập thủ công
]);
export type RoutingAction = z.infer<typeof RoutingActionSchema>;

export const RoutingDecisionSchema = z.object({
  action: RoutingActionSchema,
  reason_codes: z.array(z.string()),
  next_step: z.string(),
  business_rule_status: z.enum(['EVALUATED', 'NOT_EVALUATED']),
});
export type RoutingDecision = z.infer<typeof RoutingDecisionSchema>;

// TOÀN BỘ JSON ĐẦU RA CỦA AI AGENT OCR (Khớp 100% với đặc tả)
export const AiOcrResponseSchema = z.object({
  schema_version: z.string().default('1.0'),
  request_id: z.string(),
  model_version: z.string().default('ocr-proposal-v1'),
  documents: z.object({
    cccd: CccdDocumentSchema.optional(),
    gplx: GplxDocumentSchema.optional(),
  }),
  checks: QualityChecksSchema,
  thresholds: ThresholdsSchema,
  minimum_required_confidence: z.number().min(0).max(1).nullable(), // Điểm m
  routing: RoutingDecisionSchema,
});
export type AiOcrResponse = z.infer<typeof AiOcrResponseSchema>;

// Đầu vào cho AI Agent
export interface AiAgentInput {
  requestId: string;
  cccdImageRef?: string;
  cccdBackImageRef?: string;
  gplxImageRef?: string;
  selectedVehicleType?: string;
  supplementCount?: number;
  policyVersion?: string;
  scenarioPreset?: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'BLURRY_IMAGE' | 'NAME_MISMATCH' | 'NETWORK_ERROR';
}

// Giao diện chung cho AiProvider
export interface IAiProvider {
  processOcr(input: AiAgentInput, signal?: AbortSignal): Promise<AiOcrResponse>;
}

