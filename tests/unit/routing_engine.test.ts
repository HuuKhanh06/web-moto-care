// tests/unit/routing_engine.test.ts
import { describe, it, expect } from 'vitest';
import {
  evaluateRoutingTable,
  calculateMinimumConfidence,
  buildUnifiedOcrResponse,
  UnifiedOcrResponseSchema,
  type UnifiedCccdDoc,
  type UnifiedGplxDoc,
} from '@/ai/routingEngine';

describe('BƯỚC 2: Định Tuyến Theo Bảng Ngưỡng (src/ai/routingEngine.ts)', () => {
  const validCccd: UnifiedCccdDoc = {
    full_name: { value: 'NGUYỄN VĂN AN', confidence: 1.0, source: 'QR' },
    date_of_birth: { value: '1995-05-12', confidence: 1.0, source: 'QR' },
    id_number: { value: '079201008888', confidence: 1.0, source: 'QR' },
    gender: { value: 'Nam', confidence: 1.0, source: 'QR' },
    address: { value: 'Đà Nẵng', confidence: 1.0, source: 'QR' },
    issue_date: { value: '2021-08-15', confidence: 1.0, source: 'QR' },
  };

  const highGplx: UnifiedGplxDoc = {
    full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.98, source: 'AI' },
    license_class: { value: 'A1', confidence: 0.96, source: 'AI' },
    expiry_date: { value: null, confidence: null, source: 'AI' },
  };

  const mediumGplx: UnifiedGplxDoc = {
    full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.95, source: 'AI' },
    license_class: { value: 'A1', confidence: 0.85, source: 'AI' }, // m = 0.85
    expiry_date: { value: null, confidence: null, source: 'AI' },
  };

  const lowGplx: UnifiedGplxDoc = {
    full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.95, source: 'AI' },
    license_class: { value: 'A1', confidence: 0.72, source: 'AI' }, // m = 0.72
    expiry_date: { value: null, confidence: null, source: 'AI' },
  };

  describe('1. Kiểm thử 6 dòng trong Bảng Định Tuyến theo thứ tự ưu tiên', () => {
    it('Dòng 1: Dịch vụ AI lỗi hoặc quá thời gian -> FALLBACK_MANUAL', () => {
      // Dù ảnh nét và điểm cao, hễ AI lỗi là fallback nhân viên thủ công
      const res = evaluateRoutingTable({
        isServiceError: true,
        cccd: validCccd,
        gplx: highGplx,
      });
      expect(res.action).toBe('FALLBACK_MANUAL');
      expect(res.reason_codes).toContain('AI_SERVICE_ERROR_OR_TIMEOUT');
      expect(res.next_step).toBe('HUMAN_VERIFICATION_AT_M_CheckDocs');

      const resTimeout = evaluateRoutingTable({
        isAiTimeout: true,
        cccd: validCccd,
        gplx: highGplx,
      });
      expect(resTimeout.action).toBe('FALLBACK_MANUAL');
    });

    it('Dòng 2: Ảnh thiếu/mờ hoặc thiếu trường bắt buộc -> REQUEST_REUPLOAD', () => {
      // Trường hợp ảnh bị mờ
      const resBlurry = evaluateRoutingTable({
        imageQuality: 'FAIL',
        cccd: validCccd,
        gplx: highGplx,
      });
      expect(resBlurry.action).toBe('REQUEST_REUPLOAD');
      expect(resBlurry.reason_codes).toContain('IMAGE_BLURRY_OR_UNREADABLE');
      expect(resBlurry.next_step).toBe('M_AskDocs');

      // Trường hợp thiếu trường bắt buộc của GPLX (thiếu license_class)
      const incompleteGplx: UnifiedGplxDoc = {
        full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.98, source: 'AI' },
        license_class: { value: null, confidence: null, source: 'AI' },
      };
      const resMissing = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: incompleteGplx,
      });
      expect(resMissing.action).toBe('REQUEST_REUPLOAD');
      expect(resMissing.reason_codes).toContain('MISSING_REQUIRED_FIELDS');
    });

    it('Dòng 3: Định dạng không hợp lệ -> MANUAL_REVIEW', () => {
      const resFormat = evaluateRoutingTable({
        isFormatInvalid: true,
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: highGplx,
      });
      expect(resFormat.action).toBe('MANUAL_REVIEW');
      expect(resFormat.reason_codes).toContain('INVALID_DATA_FORMAT');
      expect(resFormat.next_step).toBe('HUMAN_VERIFICATION_AT_M_CheckDocs');
    });

    it('Dòng 4: m >= X (0.95) -> PREFILL_FOR_RULES', () => {
      const resHigh = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: highGplx, // m = min(1.0, 1.0, 1.0, 0.98, 0.96) = 0.96 >= 0.95
        thresholds: { X: 0.95, Y: 0.80 },
      });
      expect(resHigh.action).toBe('PREFILL_FOR_RULES');
      expect(resHigh.minimum_required_confidence).toBe(0.96);
      expect(resHigh.reason_codes).toContain('CONFIDENCE_MEETS_THRESHOLD_X');
      expect(resHigh.next_step).toBe('M_EvaluateRules');
    });

    it('Dòng 5: Y (0.80) <= m < X (0.95) -> MANUAL_REVIEW', () => {
      const resMedium = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: mediumGplx, // m = 0.85
        thresholds: { X: 0.95, Y: 0.80 },
      });
      expect(resMedium.action).toBe('MANUAL_REVIEW');
      expect(resMedium.minimum_required_confidence).toBe(0.85);
      expect(resMedium.reason_codes).toContain('CONFIDENCE_BETWEEN_Y_AND_X');
      expect(resMedium.next_step).toBe('HUMAN_VERIFICATION_AT_M_CheckDocs');
    });

    it('Dòng 6: m < Y (0.80) -> REQUEST_REUPLOAD', () => {
      const resLow = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: lowGplx, // m = 0.72 < 0.80
        thresholds: { X: 0.95, Y: 0.80 },
      });
      expect(resLow.action).toBe('REQUEST_REUPLOAD');
      expect(resLow.minimum_required_confidence).toBe(0.72);
      expect(resLow.reason_codes).toContain('CONFIDENCE_BELOW_Y');
      expect(resLow.next_step).toBe('M_AskDocs');
    });
  });

  describe('2. Kiểm thử các trường hợp biên m = 0.95 và m = 0.80', () => {
    it('Trường hợp biên m = 0.95 đúng bằng X -> PREFILL_FOR_RULES', () => {
      const edgeGplxX: UnifiedGplxDoc = {
        full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.95, source: 'AI' },
        license_class: { value: 'A1', confidence: 0.95, source: 'AI' }, // m = 0.95
      };
      const res = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: edgeGplxX,
        thresholds: { X: 0.95, Y: 0.80 },
      });
      expect(res.minimum_required_confidence).toBe(0.95);
      expect(res.action).toBe('PREFILL_FOR_RULES');
    });

    it('Trường hợp biên m = 0.80 đúng bằng Y -> MANUAL_REVIEW', () => {
      const edgeGplxY: UnifiedGplxDoc = {
        full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.95, source: 'AI' },
        license_class: { value: 'A1', confidence: 0.80, source: 'AI' }, // m = 0.80
      };
      const res = evaluateRoutingTable({
        imageQuality: 'PASS',
        cccd: validCccd,
        gplx: edgeGplxY,
        thresholds: { X: 0.95, Y: 0.80 },
      });
      expect(res.minimum_required_confidence).toBe(0.8);
      expect(res.action).toBe('MANUAL_REVIEW');
    });
  });

  describe('3. Kiểm thử tính m (calculateMinimumConfidence)', () => {
    it('Trả về null khi thiếu bất kỳ trường bắt buộc nào', () => {
      const { m, hasAllRequired } = calculateMinimumConfidence(validCccd, {
        full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.95, source: 'AI' },
        // Thiếu license_class
      });
      expect(m).toBeNull();
      expect(hasAllRequired).toBe(false);
    });

    it('Tính đúng min confidence khi đầy đủ 5 trường bắt buộc', () => {
      const { m, hasAllRequired } = calculateMinimumConfidence(validCccd, {
        full_name: { value: 'NGUYỄN VĂN AN', confidence: 0.91, source: 'AI' },
        license_class: { value: 'A1', confidence: 0.89, source: 'AI' },
      });
      expect(hasAllRequired).toBe(true);
      expect(m).toBe(0.89);
    });
  });

  describe('4. Xác thực định dạng JSON Unified đầu ra (schema_version "1.0")', () => {
    it('Khớp 100% với UnifiedOcrResponseSchema', () => {
      const response = buildUnifiedOcrResponse({
        requestId: 'req-test-123',
        cccd: validCccd,
        gplx: highGplx,
        imageQuality: 'PASS',
      });

      // Kiểm tra Zod schema parse thành công
      const parsed = UnifiedOcrResponseSchema.safeParse(response);
      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.schema_version).toBe('1.0');
        expect(parsed.data.request_id).toBe('req-test-123');
        expect(parsed.data.documents.cccd?.full_name.value).toBe('NGUYỄN VĂN AN');
        expect(parsed.data.documents.gplx?.license_class.value).toBe('A1');
        expect(parsed.data.routing.action).toBe('PREFILL_FOR_RULES');
      }
    });

    it('Xác thực thất bại nếu sai schema_version', () => {
      const invalidResponse = {
        schema_version: '2.0', // Sai version
        request_id: 'req-1',
        documents: {},
        checks: { image_quality: 'PASS', required_fields_present: false },
        thresholds: { X: 0.95, Y: 0.80 },
        minimum_required_confidence: null,
        routing: {
          action: 'FALLBACK_MANUAL',
          reason_codes: [],
          next_step: 'step',
        },
      };

      const parsed = UnifiedOcrResponseSchema.safeParse(invalidResponse);
      expect(parsed.success).toBe(false);
    });
  });
});
