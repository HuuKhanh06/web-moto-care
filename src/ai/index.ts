import Dexie from 'dexie';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import type { AiAgentInput, AiOcrResponse } from './types';
import type { CustomerDocument } from '@/db/types';
import { MockAiProvider } from './mock';
import { GeminiAiProvider } from './gemini';
import { LocalOcrProvider } from './local';
import { getAiConfig, saveAiConfig, type AiConfig } from '@/config/ai';
import { OcrError, safeOcrError } from './errors';
import { validateOcrResponse } from './validation';
import { withOcrDeadline } from './timeout';

const snapshot = (docs: CustomerDocument[]) => JSON.stringify(docs.map(d => [d.id, d.doc_type, d.file_url]).sort((a, b) => a[0].localeCompare(b[0])));

class AiService {
  private mockProvider = new MockAiProvider();
  private geminiProvider = new GeminiAiProvider();
  private localProvider = new LocalOcrProvider();
  private jobs = new Map<string, { key: string; controller: AbortController; promise: Promise<AiOcrResponse> }>();

  public getConfig(): AiConfig { return getAiConfig(); }
  public updateConfig(patch: Partial<AiConfig>): AiConfig { return saveAiConfig(patch); }

  /** Single-flight theo hồ sơ + bộ ảnh. Ảnh mới hủy job cũ, không để kết quả cũ ghi đè. */
  public processOcr(input: AiAgentInput): Promise<AiOcrResponse> {
    const config = this.getConfig();
    const key = JSON.stringify([input.requestId, input.cccdImageRef, input.cccdBackImageRef, input.gplxImageRef,
      input.selectedVehicleType, input.supplementCount, input.policyVersion, input.scenarioPreset, config]);
    const existing = this.jobs.get(input.requestId);
    if (existing?.key === key) return existing.promise;
    existing?.controller.abort();
    const controller = new AbortController();
    const promise = this.run(input, config, controller.signal).finally(() => {
      if (this.jobs.get(input.requestId)?.promise === promise) this.jobs.delete(input.requestId);
    });
    this.jobs.set(input.requestId, { key, controller, promise });
    return promise;
  }

  private async run(input: AiAgentInput, config: AiConfig, signal: AbortSignal): Promise<AiOcrResponse> {
    const source = config.mode === 'LIVE' ? 'GEMINI' : config.mode === 'MOCK' && input.scenarioPreset ? 'MOCK' : 'LOCAL';
    const provider = source === 'GEMINI' ? this.geminiProvider : source === 'MOCK' ? this.mockProvider : this.localProvider;
    const started = Date.now();
    console.info('[OCR]', { requestId: input.requestId, provider: source, status: 'PROCESSING' });
    const initialDocs = await withOcrDeadline(() => db.customer_documents.where('request_id').equals(input.requestId).toArray(), 10000, signal)
      .catch(() => { throw new OcrError('STORAGE_ERROR', 'Không đọc được ảnh giấy tờ đã lưu. Vui lòng thử lại.'); });
    if (source !== 'MOCK' && initialDocs.length > 0) {
      for (const [type, ref] of [['CCCD_TRUOC', input.cccdImageRef], ['CCCD_SAU', input.cccdBackImageRef], ['BANG_LAI_TRUOC', input.gplxImageRef]]) {
        if (ref && initialDocs.find(doc => doc.doc_type === type)?.file_url !== ref) {
          throw new OcrError('STALE_DOCUMENTS', 'Ảnh đã thay đổi. Vui lòng quét lại bộ ảnh mới.');
        }
      }
    }
    let response: AiOcrResponse;
    try {
      response = await withOcrDeadline(async activeSignal => validateOcrResponse(await provider.processOcr(input, activeSignal), input.requestId), config.timeoutMs, signal);
      if (source === 'GEMINI' && response.routing.action !== 'FALLBACK_MANUAL') {
        const m = response.minimum_required_confidence;
        const reupload = !response.checks.required_fields_present || response.checks.image_quality !== 'PASS' || m === null || m < config.thresholdY;
        response.thresholds = { X: config.thresholdX, Y: config.thresholdY };
        response.routing.action = reupload ? 'REQUEST_REUPLOAD' : response.checks.name_consistency === 'MISMATCH' || m! < config.thresholdX ? 'MANUAL_REVIEW' : 'PREFILL_FOR_RULES';
        response.routing.next_step = reupload ? 'M_AskDocs' : response.routing.action === 'MANUAL_REVIEW' ? 'HUMAN_VERIFICATION_AT_M_CheckDocs' : 'BUSINESS_RULES_AT_M_CheckDocs';
        response.routing.business_rule_status = 'NOT_EVALUATED';
      }
    } catch (error) {
      const safe = safeOcrError(error);
      const message = safe.code === 'TIMEOUT'
        ? source === 'LOCAL'
          ? 'OCR trên thiết bị quá thời gian xử lý (chưa dùng Gemini). Vui lòng thử lại với ảnh giấy tờ xoay đúng chiều, hoặc nhập thông tin thủ công.'
          : 'Gemini quá thời gian phản hồi. Vui lòng thử lại hoặc nhập thông tin thủ công.'
        : safe.message;
      response = {
        schema_version: '1.0', request_id: input.requestId, model_version: 'fallback-rules-v1', documents: {},
        checks: { image_quality: 'FAIL', required_fields_present: false, name_consistency: 'NOT_APPLICABLE' },
        thresholds: { X: config.thresholdX, Y: config.thresholdY }, minimum_required_confidence: null,
        routing: {
          action: 'FALLBACK_MANUAL', reason_codes: [`AI_ERROR: ${safe.code}: ${message}`],
          next_step: 'HUMAN_VERIFICATION_AT_M_CheckDocs', business_rule_status: 'NOT_EVALUATED',
        },
      };
    }
    if (signal.aborted) throw new OcrError('CANCELLED', 'Ảnh đã thay đổi; kết quả OCR cũ đã được hủy.');

    try {
      await withOcrDeadline(async storageSignal => db.transaction('rw', db.customer_documents, db.ai_logs, async () => {
        const transaction = Dexie.currentTransaction!;
        const abort = () => transaction.abort();
        if (storageSignal.aborted) throw new OcrError('CANCELLED', 'Đã dừng lưu OCR.');
        storageSignal.addEventListener('abort', abort, { once: true });
        try {
          const docs = await db.customer_documents.where('request_id').equals(input.requestId).toArray();
          if (snapshot(docs) !== snapshot(initialDocs)) throw new OcrError('STALE_DOCUMENTS', 'Ảnh giấy tờ đã thay đổi. Vui lòng quét lại bộ ảnh mới.');
          for (const doc of docs) {
            const result = doc.doc_type.includes('CCCD') ? response.documents.cccd : doc.doc_type.includes('BANG_LAI') ? response.documents.gplx : undefined;
            // Xóa kết quả cũ cả khi lần xử lý mới thất bại.
            await db.customer_documents.update(doc.id, {
              ai_result: result ? result as unknown as Record<string, unknown> : null,
              ai_confidence: response.minimum_required_confidence, ai_source: source,
            });
          }
          await db.ai_logs.add({
            request_id: input.requestId, bpmn_node_id: 'M_CheckDocs', scenario_preset: input.scenarioPreset,
            input_summary: `Provider: ${source}; CCCD: ${input.cccdImageRef ? 'Có' : 'Thiếu'}; GPLX: ${input.gplxImageRef ? 'Có' : 'Thiếu'}`,
            output: response as unknown as Record<string, unknown>, confidence: response.minimum_required_confidence,
            routing_action: response.routing.action, is_overridden: false, created_at: clock.nowISO(),
            override_note: response.routing.action === 'FALLBACK_MANUAL' ? `FAILED (${Date.now() - started}ms)` : undefined,
          });
        } finally {
          storageSignal.removeEventListener('abort', abort);
        }
      }), 10000, signal);
    } catch (error) {
      console.warn('[OCR]', { requestId: input.requestId, provider: source, status: 'FAILED', code: error instanceof OcrError ? error.code : 'STORAGE_ERROR' });
      if (error instanceof OcrError && ['STALE_DOCUMENTS', 'CANCELLED'].includes(error.code)) throw error;
      throw new OcrError('STORAGE_ERROR', 'Không lưu được kết quả OCR. Vui lòng thử lại; thông tin chưa được xác nhận.');
    }
    console.info('[OCR]', { requestId: input.requestId, provider: source, status: response.routing.action === 'FALLBACK_MANUAL' ? 'FAILED' : 'COMPLETED', action: response.routing.action, durationMs: Date.now() - started });
    return response;
  }
}

export const aiService = new AiService();
