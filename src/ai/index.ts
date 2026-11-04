// src/ai/index.ts
// Bộ điều phối trung tâm AI Agent OCR (Facade Service)

import { db } from '@/db';
import { clock } from '@/lib/clock';
import type { IAiProvider, AiAgentInput, AiOcrResponse } from './types';
import { MockAiProvider } from './mock';
import { GeminiAiProvider } from './gemini';
import { getAiConfig, saveAiConfig, type AiConfig } from '@/config/ai';

class AiService {
  private mockProvider = new MockAiProvider();
  private geminiProvider = new GeminiAiProvider();

  public getConfig(): AiConfig {
    return getAiConfig();
  }

  public updateConfig(patch: Partial<AiConfig>): AiConfig {
    return saveAiConfig(patch);
  }

  private getActiveProvider(): IAiProvider {
    const config = this.getConfig();
    if (config.mode === 'LIVE' && config.apiKey) {
      return this.geminiProvider;
    }
    return this.mockProvider;
  }

  /**
   * Gọi AI Agent OCR xử lý ảnh giấy tờ CCCD/GPLX kèm ghi nhận nhật ký và an toàn tuyệt đối
   */
  public async processOcr(input: AiAgentInput): Promise<AiOcrResponse> {
    const config = this.getConfig();
    const provider = this.getActiveProvider();
    const startTime = Date.now();

    try {
      const response = await provider.processOcr(input);

      // Ghi nhận nhật ký vào db.ai_logs
      await db.ai_logs.add({
        request_id: input.requestId,
        bpmn_node_id: 'M_CheckDocs',
        scenario_preset: input.scenarioPreset,
        input_summary: `CCCD: ${input.cccdImageRef ? 'Có ảnh' : 'Thiếu'}, GPLX: ${input.gplxImageRef ? 'Có ảnh' : 'Thiếu'}, Loại xe: ${input.selectedVehicleType || 'N/A'}`,
        output: response as unknown as Record<string, unknown>,
        confidence: response.minimum_required_confidence,
        routing_action: response.routing.action,
        is_overridden: false,
        created_at: clock.nowISO(),
      });

      // Cập nhật trường ai_* vào bảng customer_documents
      await this.persistDocAiFields(input.requestId, response, config.mode === 'LIVE' ? 'GEMINI' : 'MOCK');

      return response;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Lỗi không xác định khi gọi AI Agent';
      console.warn('[AiService] Lỗi khi xử lý OCR, tự động kích hoạt FALLBACK_MANUAL:', errMsg);

      // Khi lỗi mạng/quá hạn/sai định dạng: Fallback an toàn về nhánh thủ công
      const fallbackResponse: AiOcrResponse = {
        schema_version: '1.0',
        request_id: input.requestId,
        model_version: 'fallback-rules-v1',
        documents: {},
        checks: {
          image_quality: 'FAIL',
          required_fields_present: false,
          name_consistency: 'NOT_APPLICABLE',
        },
        thresholds: { X: config.thresholdX, Y: config.thresholdY },
        minimum_required_confidence: null,
        routing: {
          action: 'FALLBACK_MANUAL',
          reason_codes: [`AI_ERROR: ${errMsg}`],
          next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs',
          business_rule_status: 'NOT_EVALUATED',
        },
      };

      await db.ai_logs.add({
        request_id: input.requestId,
        bpmn_node_id: 'M_CheckDocs',
        scenario_preset: input.scenarioPreset,
        input_summary: `Lỗi gọi AI: ${errMsg}`,
        output: fallbackResponse as unknown as Record<string, unknown>,
        confidence: null,
        routing_action: 'FALLBACK_MANUAL',
        is_overridden: false,
        override_note: `Tự động fallback do lỗi: ${errMsg} (${Date.now() - startTime}ms)`,
        created_at: clock.nowISO(),
      });

      return fallbackResponse;
    }
  }

  /**
   * Cập nhật ai_result, ai_confidence, ai_source cho các bản ghi customer_documents
   */
  private async persistDocAiFields(
    requestId: string,
    ocrRes: AiOcrResponse,
    source: 'GEMINI' | 'MOCK' | 'MANUAL'
  ): Promise<void> {
    try {
      const docs = await db.customer_documents.where('request_id').equals(requestId).toArray();
      for (const d of docs) {
        if (d.doc_type.includes('CCCD') && ocrRes.documents.cccd) {
          await db.customer_documents.update(d.id, {
            ai_result: ocrRes.documents.cccd as unknown as Record<string, unknown>,
            ai_confidence: ocrRes.minimum_required_confidence,
            ai_source: source,
          });
        } else if (d.doc_type.includes('BANG_LAI') && ocrRes.documents.gplx) {
          await db.customer_documents.update(d.id, {
            ai_result: ocrRes.documents.gplx as unknown as Record<string, unknown>,
            ai_confidence: ocrRes.minimum_required_confidence,
            ai_source: source,
          });
        }
      }
    } catch (err) {
      console.warn('[AiService] Không thể cập nhật ai_* vào customer_documents:', err);
    }
  }
}

export const aiService = new AiService();

