// src/ai/routingEngine.ts
// Bộ định tuyến phân luồng thẩm định hồ sơ theo bảng ngưỡng nghiêm ngặt (P0)
// Hàm thuần túy (Pure Function), có test bao phủ 100% các nhánh

import { z } from 'zod';

export const UnifiedExtractedFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  source: z.enum(['QR', 'AI', 'MANUAL']).optional(),
});
export type UnifiedExtractedField = z.infer<typeof UnifiedExtractedFieldSchema>;

export const UnifiedCccdDocSchema = z.object({
  full_name: UnifiedExtractedFieldSchema,
  date_of_birth: UnifiedExtractedFieldSchema,
  id_number: UnifiedExtractedFieldSchema,
  gender: UnifiedExtractedFieldSchema.optional(),
  address: UnifiedExtractedFieldSchema.optional(),
  issue_date: UnifiedExtractedFieldSchema.optional(),
});
export type UnifiedCccdDoc = z.infer<typeof UnifiedCccdDocSchema>;

export const UnifiedGplxDocSchema = z.object({
  full_name: UnifiedExtractedFieldSchema,
  license_class: UnifiedExtractedFieldSchema,
  expiry_date: UnifiedExtractedFieldSchema.optional(),
});
export type UnifiedGplxDoc = z.infer<typeof UnifiedGplxDocSchema>;

export const UnifiedChecksSchema = z.object({
  image_quality: z.enum(['PASS', 'FAIL', 'BLURRY']),
  required_fields_present: z.boolean(),
  name_consistency: z.enum(['PASS', 'MISMATCH', 'NOT_APPLICABLE']).optional(),
});
export type UnifiedChecks = z.infer<typeof UnifiedChecksSchema>;

export const UnifiedThresholdsSchema = z.object({
  X: z.number().default(0.95),
  Y: z.number().default(0.80),
});
export type UnifiedThresholds = z.infer<typeof UnifiedThresholdsSchema>;

export const UnifiedRoutingActionSchema = z.enum([
  'PREFILL_FOR_RULES', // m >= X: Tự động chạy tiếp các quy tắc nghiệp vụ
  'MANUAL_REVIEW',     // Y <= m < X hoặc sai định dạng: Nhân viên rà soát thủ công
  'REQUEST_REUPLOAD',  // m < Y hoặc ảnh mờ/thiếu trường bắt buộc: Yêu cầu chụp lại
  'FALLBACK_MANUAL',   // Dịch vụ AI lỗi hoặc quá hạn 20s: Nhân viên nhập thủ công
]);
export type UnifiedRoutingAction = z.infer<typeof UnifiedRoutingActionSchema>;

export const UnifiedRoutingDecisionSchema = z.object({
  action: UnifiedRoutingActionSchema,
  reason_codes: z.array(z.string()),
  next_step: z.string(),
  business_rule_status: z.enum(['EVALUATED', 'NOT_EVALUATED']).default('NOT_EVALUATED'),
});
export type UnifiedRoutingDecision = z.infer<typeof UnifiedRoutingDecisionSchema>;

// Unified JSON Output Schema phiên bản 1.0
export const UnifiedOcrResponseSchema = z.object({
  schema_version: z.literal('1.0'),
  request_id: z.string(),
  documents: z.object({
    cccd: UnifiedCccdDocSchema.optional(),
    gplx: UnifiedGplxDocSchema.optional(),
  }),
  checks: UnifiedChecksSchema,
  thresholds: UnifiedThresholdsSchema,
  minimum_required_confidence: z.number().nullable(),
  routing: UnifiedRoutingDecisionSchema,
});
export type UnifiedOcrResponse = z.infer<typeof UnifiedOcrResponseSchema>;

export interface RoutingEvaluationInput {
  isServiceError?: boolean;
  isAiTimeout?: boolean;
  imageQuality?: 'PASS' | 'FAIL' | 'BLURRY';
  cccd?: Partial<UnifiedCccdDoc> | null;
  gplx?: Partial<UnifiedGplxDoc> | null;
  isFormatInvalid?: boolean;
  thresholds?: { X: number; Y: number };
}

export interface RoutingEvaluationResult {
  action: UnifiedRoutingAction;
  reason_codes: string[];
  next_step: string;
  minimum_required_confidence: number | null;
  required_fields_present: boolean;
}

/**
 * Tính toán minimum_required_confidence (m) từ các trường bắt buộc:
 * CCCD: full_name, date_of_birth, id_number
 * GPLX: full_name, license_class
 */
export function calculateMinimumConfidence(
  cccd?: Partial<UnifiedCccdDoc> | null,
  gplx?: Partial<UnifiedGplxDoc> | null
): { m: number | null; hasAllRequired: boolean } {
  // Kiểm tra sự hiện diện của giá trị (value) các trường bắt buộc
  const cccdName = Boolean(cccd?.full_name?.value);
  const cccdDob = Boolean(cccd?.date_of_birth?.value);
  const cccdId = Boolean(cccd?.id_number?.value);
  const gplxName = Boolean(gplx?.full_name?.value);
  const gplxClass = Boolean(gplx?.license_class?.value);

  const hasAllRequired = cccdName && cccdDob && cccdId && gplxName && gplxClass;
  if (!hasAllRequired) {
    return { m: null, hasAllRequired: false };
  }

  // Lấy điểm tin cậy của từng trường bắt buộc
  const confs: number[] = [
    typeof cccd?.full_name?.confidence === 'number' ? cccd.full_name.confidence : 0,
    typeof cccd?.date_of_birth?.confidence === 'number' ? cccd.date_of_birth.confidence : 0,
    typeof cccd?.id_number?.confidence === 'number' ? cccd.id_number.confidence : 0,
    typeof gplx?.full_name?.confidence === 'number' ? gplx.full_name.confidence : 0,
    typeof gplx?.license_class?.confidence === 'number' ? gplx.license_class.confidence : 0,
  ];

  const minVal = Math.min(...confs);
  return { m: Math.round(minVal * 1000) / 1000, hasAllRequired: true };
}

/**
 * HÀM ĐỊNH TUYẾN THEO BẢNG NGƯỠNG (HÀM THUẦN)
 * Thứ tự ưu tiên (xét từ trên xuống, dừng ở dòng đầu tiên khớp):
 * 1. Dịch vụ AI lỗi hoặc quá thời gian -> FALLBACK_MANUAL
 * 2. Ảnh thiếu/mờ hoặc thiếu trường bắt buộc -> REQUEST_REUPLOAD
 * 3. Định dạng không hợp lệ -> MANUAL_REVIEW
 * 4. m >= X (0.95) -> PREFILL_FOR_RULES
 * 5. Y (0.80) <= m < X -> MANUAL_REVIEW
 * 6. m < Y -> REQUEST_REUPLOAD
 */
export function evaluateRoutingTable(input: RoutingEvaluationInput): RoutingEvaluationResult {
  const X = input.thresholds?.X ?? 0.95;
  const Y = input.thresholds?.Y ?? 0.80;

  // Dòng 1: Dịch vụ AI lỗi hoặc quá thời gian
  if (input.isServiceError || input.isAiTimeout) {
    return {
      action: 'FALLBACK_MANUAL',
      reason_codes: ['AI_SERVICE_ERROR_OR_TIMEOUT'],
      next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
      minimum_required_confidence: null,
      required_fields_present: false,
    };
  }

  // Tính m và kiểm tra đủ trường bắt buộc
  const { m, hasAllRequired } = calculateMinimumConfidence(input.cccd, input.gplx);
  const isImageFail = input.imageQuality === 'FAIL' || input.imageQuality === 'BLURRY';

  // Dòng 2: Ảnh thiếu/mờ hoặc thiếu trường bắt buộc
  if (isImageFail || !hasAllRequired) {
    const reasons: string[] = [];
    if (isImageFail) reasons.push('IMAGE_BLURRY_OR_UNREADABLE');
    if (!hasAllRequired) reasons.push('MISSING_REQUIRED_FIELDS');

    return {
      action: 'REQUEST_REUPLOAD',
      reason_codes: reasons,
      next_step: 'M_AskDocs',
      minimum_required_confidence: m,
      required_fields_present: false,
    };
  }

  // Dòng 3: Định dạng không hợp lệ
  if (input.isFormatInvalid) {
    return {
      action: 'MANUAL_REVIEW',
      reason_codes: ['INVALID_DATA_FORMAT'],
      next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
      minimum_required_confidence: m,
      required_fields_present: true,
    };
  }

  // Dòng 4: m >= X (0.95)
  if (m !== null && m >= X) {
    return {
      action: 'PREFILL_FOR_RULES',
      reason_codes: ['CONFIDENCE_MEETS_THRESHOLD_X'],
      next_step: 'M_EvaluateRules',
      minimum_required_confidence: m,
      required_fields_present: true,
    };
  }

  // Dòng 5: Y (0.80) <= m < X (0.95)
  if (m !== null && m >= Y && m < X) {
    return {
      action: 'MANUAL_REVIEW',
      reason_codes: ['CONFIDENCE_BETWEEN_Y_AND_X'],
      next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
      minimum_required_confidence: m,
      required_fields_present: true,
    };
  }

  // Dòng 6: m < Y (0.80)
  return {
    action: 'REQUEST_REUPLOAD',
    reason_codes: ['CONFIDENCE_BELOW_Y'],
    next_step: 'M_AskDocs',
    minimum_required_confidence: m,
    required_fields_present: true,
  };
}

/**
 * Xây dựng toàn bộ đối tượng UnifiedOcrResponse chuẩn v1.0
 */
export function buildUnifiedOcrResponse(params: {
  requestId: string;
  cccd?: Partial<UnifiedCccdDoc> | null;
  gplx?: Partial<UnifiedGplxDoc> | null;
  imageQuality?: 'PASS' | 'FAIL' | 'BLURRY';
  isServiceError?: boolean;
  isAiTimeout?: boolean;
  isFormatInvalid?: boolean;
  thresholds?: { X: number; Y: number };
}): UnifiedOcrResponse {
  const X = params.thresholds?.X ?? 0.95;
  const Y = params.thresholds?.Y ?? 0.80;

  const routingRes = evaluateRoutingTable({
    isServiceError: params.isServiceError,
    isAiTimeout: params.isAiTimeout,
    imageQuality: params.imageQuality ?? 'PASS',
    cccd: params.cccd,
    gplx: params.gplx,
    isFormatInvalid: params.isFormatInvalid,
    thresholds: { X, Y },
  });

  const cccdDoc: UnifiedCccdDoc | undefined = params.cccd?.full_name ? (params.cccd as UnifiedCccdDoc) : undefined;
  const gplxDoc: UnifiedGplxDoc | undefined = params.gplx?.full_name ? (params.gplx as UnifiedGplxDoc) : undefined;

  return {
    schema_version: '1.0',
    request_id: params.requestId,
    documents: {
      cccd: cccdDoc,
      gplx: gplxDoc,
    },
    checks: {
      image_quality: params.imageQuality ?? 'PASS',
      required_fields_present: routingRes.required_fields_present,
    },
    thresholds: { X, Y },
    minimum_required_confidence: routingRes.minimum_required_confidence,
    routing: {
      action: routingRes.action,
      reason_codes: routingRes.reason_codes,
      next_step: routingRes.next_step,
      business_rule_status: 'NOT_EVALUATED',
    },
  };
}
