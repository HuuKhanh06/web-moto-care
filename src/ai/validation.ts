import { AiOcrResponseSchema } from './types';
import type { AiOcrResponse } from './types';
import { OcrError } from './errors';

export function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date.getTime() <= Date.now();
}

export function validateOcrResponse(value: unknown, requestId: string): AiOcrResponse {
  const parsed = AiOcrResponseSchema.safeParse(value);
  if (!parsed.success || parsed.data.request_id !== requestId) {
    throw new OcrError('INVALID_RESPONSE', 'AI trả dữ liệu sai định dạng hoặc sai mã hồ sơ. Vui lòng thử lại.');
  }
  const result = parsed.data;
  const cccd = result.documents.cccd;
  const gplx = result.documents.gplx;
  for (const [field, valid] of [
    [cccd?.id_number, /^0\d{11}$/.test(cccd?.id_number.value || '')],
    [cccd?.date_of_birth, isValidBirthDate(cccd?.date_of_birth.value || '')],
  ] as const) {
    if (field?.value && !valid) {
      field.value = null; field.confidence = null;
      result.routing.reason_codes.push('INVALID_FIELD_FORMAT');
    }
  }
  const required = [cccd?.full_name, cccd?.id_number, cccd?.date_of_birth, gplx?.full_name, gplx?.license_class];
  const complete = required.every(field => Boolean(field?.value?.trim()) && field?.confidence != null);
  result.checks.required_fields_present = complete;
  if (complete) {
    result.minimum_required_confidence = Math.min(...required.map(field => field!.confidence!));
    const normalize = (name: string) => name.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();
    result.checks.name_consistency = normalize(cccd!.full_name.value!) === normalize(gplx!.full_name.value!) ? 'PASS' : 'MISMATCH';
    if (result.checks.name_consistency === 'MISMATCH' && result.routing.action === 'PREFILL_FOR_RULES') {
      result.routing.action = 'MANUAL_REVIEW';
      result.routing.reason_codes.push('NAME_MISMATCH_BETWEEN_DOCS');
    }
  }
  if (!complete) {
    result.checks.required_fields_present = false;
    result.minimum_required_confidence = null;
    if (result.routing.action !== 'FALLBACK_MANUAL') {
      result.routing.action = 'REQUEST_REUPLOAD';
      result.routing.next_step = 'M_AskDocs';
      result.routing.business_rule_status = 'NOT_EVALUATED';
      result.routing.reason_codes.push('MISSING_OR_UNREADABLE_FIELDS');
    }
  }
  return result;
}
