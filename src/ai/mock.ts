// src/ai/mock.ts
// Hiện thực Mock AI Provider phục vụ kiểm thử và chạy offline (không cần mạng/khóa API)

import type { IAiProvider, AiAgentInput, AiOcrResponse } from './types';
import { getAiConfig } from '@/config/ai';

export class MockAiProvider implements IAiProvider {
  async processOcr(input: AiAgentInput): Promise<AiOcrResponse> {
    if (!input.scenarioPreset) throw new Error('Mock OCR chỉ được dùng với kịch bản thử nghiệm rõ ràng.');
    const config = getAiConfig();
    const X = config.thresholdX; // 0.95
    const Y = config.thresholdY; // 0.80

    // Giả lập độ trễ nhận diện quang học ~150ms
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Kịch bản lỗi mạng mô phỏng
    if (input.scenarioPreset === 'NETWORK_ERROR') {
      throw new Error('503 Service Unavailable: Dịch vụ AI OCR tạm thời không thể truy cập');
    }

    // 1. Kịch bản ảnh mờ / hỏng (BLURRY_IMAGE)
    if (input.scenarioPreset === 'BLURRY_IMAGE') {
      return {
        schema_version: '1.0',
        request_id: input.requestId,
        model_version: 'ocr-mock-v1',
        documents: {},
        checks: {
          image_quality: 'BLURRY',
          required_fields_present: false,
          name_consistency: 'NOT_APPLICABLE',
        },
        thresholds: { X, Y },
        minimum_required_confidence: null,
        routing: {
          action: 'REQUEST_REUPLOAD',
          reason_codes: ['IMAGE_BLURRY_UNREADABLE'],
          next_step: 'M_AskDocs',
          business_rule_status: 'NOT_EVALUATED',
        },
      };
    }

    // 2. Kịch bản độ tin cậy thấp (LOW_CONFIDENCE: m < Y = 0.80)
    if (input.scenarioPreset === 'LOW_CONFIDENCE') {
      return {
        schema_version: '1.0',
        request_id: input.requestId,
        model_version: 'ocr-mock-v1',
        documents: {
          cccd: {
            full_name: { value: 'TRAN VAN B', confidence: 0.72 },
            date_of_birth: { value: '1998-05-20', confidence: 0.75 },
            id_number: { value: '079098001234', confidence: 0.68 },
          },
          gplx: {
            full_name: { value: 'TRAN VAN B', confidence: 0.70 },
            license_class: { value: 'A1', confidence: 0.65 },
            expiry_date: { value: null, confidence: null },
          },
        },
        checks: {
          image_quality: 'PASS',
          required_fields_present: true,
          name_consistency: 'PASS',
        },
        thresholds: { X, Y },
        minimum_required_confidence: 0.65, // m = 0.65 < Y (0.80)
        routing: {
          action: 'REQUEST_REUPLOAD',
          reason_codes: ['CONFIDENCE_BELOW_Y'],
          next_step: 'M_AskDocs',
          business_rule_status: 'NOT_EVALUATED',
        },
      };
    }

    // 3. Kịch bản tên mâu thuẫn giữa 2 giấy tờ (NAME_MISMATCH)
    if (input.scenarioPreset === 'NAME_MISMATCH') {
      return {
        schema_version: '1.0',
        request_id: input.requestId,
        model_version: 'ocr-mock-v1',
        documents: {
          cccd: {
            full_name: { value: 'NGUYEN VAN A', confidence: 0.98 },
            date_of_birth: { value: '2000-01-01', confidence: 0.97 },
            id_number: { value: '079200001111', confidence: 0.96 },
          },
          gplx: {
            full_name: { value: 'NGUYEN VAN B', confidence: 0.98 }, // Lệch tên
            license_class: { value: 'A1', confidence: 0.97 },
            expiry_date: { value: null, confidence: null },
          },
        },
        checks: {
          image_quality: 'PASS',
          required_fields_present: true,
          name_consistency: 'MISMATCH',
        },
        thresholds: { X, Y },
        minimum_required_confidence: 0.96,
        routing: {
          action: 'MANUAL_REVIEW',
          reason_codes: ['NAME_MISMATCH_BETWEEN_DOCS'],
          next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
          business_rule_status: 'NOT_EVALUATED',
        },
      };
    }

    // 4. Kịch bản độ tin cậy trung bình (MEDIUM_CONFIDENCE: Y <= m < X, đúng ví dụ đặc tả của Trang)
    if (input.scenarioPreset === 'MEDIUM_CONFIDENCE') {
      return {
        schema_version: '1.0',
        request_id: input.requestId,
        model_version: 'ocr-mock-v1',
        documents: {
          cccd: {
            full_name: { value: 'NGUYEN VAN A', confidence: 0.99 },
            date_of_birth: { value: '2003-08-15', confidence: 0.98 },
            id_number: { value: '079203009999', confidence: 0.97 },
          },
          gplx: {
            full_name: { value: 'NGUYEN VAN A', confidence: 0.98 },
            license_class: { value: 'A1', confidence: 0.87 }, // m = 0.87 (0.80 <= m < 0.95)
            expiry_date: { value: null, confidence: null },
          },
        },
        checks: {
          image_quality: 'PASS',
          required_fields_present: true,
          name_consistency: 'PASS',
        },
        thresholds: { X, Y },
        minimum_required_confidence: 0.87,
        routing: {
          action: 'MANUAL_REVIEW',
          reason_codes: ['GPLX_CLASS_BELOW_X'],
          next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
          business_rule_status: 'NOT_EVALUATED',
        },
      };
    }

    // 5. Kịch bản độ tin cậy cao (HIGH_CONFIDENCE: m >= X = 0.95 - Mặc định Happy Path)
    const cccdName = 'NGUYEN VAN A';
    const cccdDob = '2001-10-10';
    const cccdId = '079201008888';
    const gplxClass = 'A1';

    return {
      schema_version: '1.0',
      request_id: input.requestId,
      model_version: 'ocr-mock-v1',
      documents: {
        cccd: {
          full_name: { value: cccdName, confidence: cccdName ? 0.99 : null },
          date_of_birth: { value: cccdDob, confidence: cccdDob ? 0.98 : null },
          id_number: { value: cccdId, confidence: cccdId ? 0.97 : null },
        },
        gplx: {
          full_name: { value: cccdName, confidence: cccdName ? 0.99 : null },
          license_class: { value: gplxClass, confidence: gplxClass ? 0.96 : null },
          expiry_date: { value: null, confidence: null },
        },
      },
      checks: {
        image_quality: 'PASS',
        required_fields_present: true,
        name_consistency: 'PASS',
      },
      thresholds: { X, Y },
      minimum_required_confidence: 0.96, // m = 0.96 >= X (0.95)
      routing: {
        action: 'PREFILL_FOR_RULES',
        reason_codes: ['ALL_CHECKS_PASSED_HIGH_CONFIDENCE'],
        next_step: 'BUSINESS_RULES_AT_M_CheckDocs',
        business_rule_status: 'EVALUATED',
      },
    };
  }
}

