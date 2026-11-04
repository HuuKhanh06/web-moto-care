// tests/unit/phase8_ai_agent.test.ts
// Kiểm thử tự động Giai đoạn 8: AI Agent OCR (M_CheckDocs) theo đặc tả của Trang
// Kiểm tra 2 ngưỡng X = 0.95, Y = 0.80 và các nhánh PREFILL_FOR_RULES, MANUAL_REVIEW, REQUEST_REUPLOAD, FALLBACK_MANUAL

import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { aiService } from '@/ai';
import { fn_check_documents, eval_M_G02 } from '@/engine/fn';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import type { Actor } from '@/db/types';

describe('GIAI ĐOẠN 8: AI Agent OCR tại M_CheckDocs', () => {
  const customerActor: Actor = { id: SEED_USERS[3].id, role: 'khach_hang' };

  beforeEach(async () => {
    await db.clearAllTables();
    await seedDatabase();
    await db.ai_logs.clear();

    // Thiết lập cấu hình AI về MOCK và ngưỡng chuẩn của Trang
    aiService.updateConfig({
      mode: 'MOCK',
      thresholdX: 0.95,
      thresholdY: 0.80,
    });
  });

  describe('1. Kiểm thử phân nhánh theo Bảng ngưỡng X/Y', () => {
    it('Kịch bản 1: Ảnh đạt, m = 0.96 >= X (0.95) -> PREFILL_FOR_RULES, tự động hợp lệ', async () => {
      const requestId = 'TEST-REQ-AI-01';
      // Thêm hồ sơ giấy tờ
      await db.customer_documents.bulkAdd([
        { id: 'd1', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:cccd_front.jpg', is_valid: true },
        { id: 'd2', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:cccd_back.jpg', is_valid: true },
        { id: 'd3', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:gplx_front.jpg', is_valid: true },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'HIGH_CONFIDENCE');

      expect(res.allValid).toBe(true);
      expect(res.ocrResponse?.routing.action).toBe('PREFILL_FOR_RULES');
      expect(res.ocrResponse?.minimum_required_confidence).toBe(0.96);
      expect(eval_M_G02(res.allValid)).toBe('Có');

      // Kiểm tra lưu vết trong db.ai_logs
      const logs = await db.ai_logs.where('request_id').equals(requestId).toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].routing_action).toBe('PREFILL_FOR_RULES');
      expect(logs[0].confidence).toBe(0.96);

      // Kiểm tra cập nhật ai_result vào customer_documents
      const doc = await db.customer_documents.get('d1');
      expect(doc?.ai_result).toBeDefined();
      expect(doc?.ai_confidence).toBe(0.96);
      expect(doc?.ai_source).toBe('MOCK');
    });

    it('Kịch bản 2: Ảnh đạt, Y (0.80) <= m = 0.87 < X (0.95) -> MANUAL_REVIEW, chuyển sang xác minh thủ công', async () => {
      const requestId = 'TEST-REQ-AI-02';
      await db.customer_documents.bulkAdd([
        { id: 'd4', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:cccd.jpg', is_valid: false },
        { id: 'd5', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:cccd.jpg', is_valid: false },
        { id: 'd6', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:gplx.jpg', is_valid: false },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'MEDIUM_CONFIDENCE');

      // Khi m nằm giữa Y và X, action là MANUAL_REVIEW. Do chưa được người duyệt (is_valid !== true), allValid = false
      expect(res.ocrResponse?.routing.action).toBe('MANUAL_REVIEW');
      expect(res.ocrResponse?.minimum_required_confidence).toBe(0.87);
      expect(res.allValid).toBe(false);

      // Nhân viên kiểm tra đối chiếu và chấp thuận thủ công (Human-in-the-loop)
      await db.customer_documents.update('d4', { is_valid: true });
      await db.customer_documents.update('d5', { is_valid: true });
      await db.customer_documents.update('d6', { is_valid: true });

      // Chạy lại kiểm tra sau khi người đã xác nhận
      const resAfterHumanReview = await fn_check_documents(requestId, customerActor, 'MEDIUM_CONFIDENCE');
      expect(resAfterHumanReview.allValid).toBe(true);
      expect(eval_M_G02(resAfterHumanReview.allValid)).toBe('Có');
    });

    it('Kịch bản 3: m = 0.65 < Y (0.80) -> REQUEST_REUPLOAD, chuyển sang M_AskDocs', async () => {
      const requestId = 'TEST-REQ-AI-03';
      await db.customer_documents.bulkAdd([
        { id: 'd7', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:cccd.jpg', is_valid: true },
        { id: 'd8', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:cccd.jpg', is_valid: true },
        { id: 'd9', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:gplx.jpg', is_valid: true },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'LOW_CONFIDENCE');

      expect(res.ocrResponse?.routing.action).toBe('REQUEST_REUPLOAD');
      expect(res.ocrResponse?.minimum_required_confidence).toBe(0.65);
      expect(res.allValid).toBe(false);
      expect(eval_M_G02(res.allValid)).toBe('Không'); // Chuyển sang M_AskDocs
    });

    it('Kịch bản 4: Ảnh mờ (image_quality: BLURRY) -> REQUEST_REUPLOAD ngay lập tức', async () => {
      const requestId = 'TEST-REQ-AI-04';
      await db.customer_documents.bulkAdd([
        { id: 'd10', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:blurry.jpg', is_valid: true },
        { id: 'd11', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:blurry.jpg', is_valid: true },
        { id: 'd12', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:blurry.jpg', is_valid: true },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'BLURRY_IMAGE');

      expect(res.ocrResponse?.checks.image_quality).toBe('BLURRY');
      expect(res.ocrResponse?.routing.action).toBe('REQUEST_REUPLOAD');
      expect(res.allValid).toBe(false);
    });

    it('Kịch bản 5: Mâu thuẫn họ tên giữa CCCD và GPLX -> Bất kể m vẫn rơi vào MANUAL_REVIEW', async () => {
      const requestId = 'TEST-REQ-AI-05';
      await db.customer_documents.bulkAdd([
        { id: 'd13', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:cccd.jpg', is_valid: false },
        { id: 'd14', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:cccd.jpg', is_valid: false },
        { id: 'd15', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:gplx.jpg', is_valid: false },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'NAME_MISMATCH');

      expect(res.ocrResponse?.checks.name_consistency).toBe('MISMATCH');
      expect(res.ocrResponse?.routing.action).toBe('MANUAL_REVIEW');
      expect(res.ocrResponse?.routing.reason_codes).toContain('NAME_MISMATCH_BETWEEN_DOCS');
    });

    it('Kịch bản 6: Sự cố mạng / API thất bại -> Kích hoạt FALLBACK_MANUAL, không crash BPMN Engine', async () => {
      const requestId = 'TEST-REQ-AI-06';
      await db.customer_documents.bulkAdd([
        { id: 'd16', request_id: requestId, doc_type: 'CCCD_TRUOC', file_url: 'blob:cccd.jpg', is_valid: true },
        { id: 'd17', request_id: requestId, doc_type: 'CCCD_SAU', file_url: 'blob:cccd.jpg', is_valid: true },
        { id: 'd18', request_id: requestId, doc_type: 'BANG_LAI_TRUOC', file_url: 'blob:gplx.jpg', is_valid: true },
      ]);

      const res = await fn_check_documents(requestId, customerActor, 'NETWORK_ERROR');

      expect(res.ocrResponse?.routing.action).toBe('FALLBACK_MANUAL');
      expect(res.ocrResponse?.checks.image_quality).toBe('FAIL');

      // Vẫn ghi log đầy đủ thông tin sự cố
      const logs = await db.ai_logs.where('request_id').equals(requestId).toArray();
      expect(logs.length).toBe(1);
      expect(logs[0].routing_action).toBe('FALLBACK_MANUAL');
    });
  });

  describe('2. Kiểm thử Cấu hình & Chuyển đổi linh hoạt chế độ AI', () => {
    it('Cập nhật cấu hình ngưỡng X/Y và chuyển đổi MOCK <-> LIVE', () => {
      const cfg = aiService.updateConfig({
        thresholdX: 0.90,
        thresholdY: 0.75,
        mode: 'LIVE',
      });

      expect(cfg.thresholdX).toBe(0.90);
      expect(cfg.thresholdY).toBe(0.75);
      expect(cfg.mode).toBe('LIVE');

      // Khôi phục
      aiService.updateConfig({
        thresholdX: 0.95,
        thresholdY: 0.80,
        mode: 'MOCK',
      });
    });
  });
});

