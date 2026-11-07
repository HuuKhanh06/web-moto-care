import type { AiAgentInput, AiOcrResponse, ExtractedField, IAiProvider } from './types';
import { extractDataFromImages } from './realOcr';
import { getAiConfig } from '@/config/ai';

export class LocalOcrProvider implements IAiProvider {
  async processOcr(input: AiAgentInput, signal?: AbortSignal): Promise<AiOcrResponse> {
    const config = getAiConfig();
    const data = await extractDataFromImages(input.cccdImageRef, input.cccdBackImageRef, input.gplxImageRef, config.timeoutMs, signal);
    const field = (value: string | undefined, confidence: number): ExtractedField => ({
      value: value || null, confidence: value ? confidence : null,
    });
    const complete = Boolean(data.fullName && data.idNumber && data.dob && data.licenseName && data.licenseClass);
    const normalize = (name: string) => name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Đ/g, 'D').replace(/\s+/g, ' ').trim();
    const consistency = data.fullName && data.licenseName
      ? normalize(data.fullName) === normalize(data.licenseName) ? 'PASS' : 'MISMATCH'
      : 'NOT_APPLICABLE';
    return {
      schema_version: '1.0', request_id: input.requestId, model_version: 'tesseract-7-eng-vie',
      documents: {
        cccd: {
          full_name: field(data.fullName, data.cccdConfidence),
          id_number: field(data.idNumber, data.cccdConfidence),
          date_of_birth: field(data.dob, data.cccdConfidence),
        },
        gplx: {
          full_name: field(data.licenseName, data.gplxConfidence),
          license_class: field(data.licenseClass, data.gplxConfidence),
          expiry_date: { value: null, confidence: null },
        },
      },
      checks: { image_quality: complete ? 'PASS' : 'BLURRY', required_fields_present: complete, name_consistency: consistency },
      thresholds: { X: config.thresholdX, Y: config.thresholdY },
      minimum_required_confidence: complete ? Math.min(data.cccdConfidence, data.gplxConfidence) : null,
      // Confidence của Tesseract là theo trang, không phải từng field: luôn cần người đối chiếu.
      routing: {
        action: complete ? 'MANUAL_REVIEW' : 'REQUEST_REUPLOAD',
        reason_codes: complete ? [consistency === 'MISMATCH' ? 'NAME_MISMATCH_BETWEEN_DOCS' : 'LOCAL_OCR_REQUIRES_REVIEW'] : ['MISSING_OR_UNREADABLE_FIELDS'],
        next_step: complete ? 'HUMAN_VERIFICATION_AT_M_CheckDocs' : 'M_AskDocs',
        business_rule_status: 'NOT_EVALUATED',
      },
    };
  }
}
