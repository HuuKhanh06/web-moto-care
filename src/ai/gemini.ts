import type { IAiProvider, AiAgentInput, AiOcrResponse } from './types';
import { getAiConfig, AI_OCR_SYSTEM_PROMPT } from '@/config/ai';
import { imageRefToDataUrl } from './images';
import { withOcrDeadline } from './timeout';
import { OcrError } from './errors';
import { validateOcrResponse } from './validation';

const enumString = (values: string[]) => ({ type: 'STRING', enum: values });
const fieldSchema = {
  type: 'OBJECT', required: ['value', 'confidence'],
  properties: { value: { type: 'STRING', nullable: true }, confidence: { type: 'NUMBER', nullable: true, minimum: 0, maximum: 1 } },
};
const documentSchema = (fields: string[]) => ({ type: 'OBJECT', required: fields, properties: Object.fromEntries(fields.map(key => [key, fieldSchema])) });
export const GEMINI_OCR_SCHEMA = {
  type: 'OBJECT', required: ['schema_version', 'request_id', 'model_version', 'documents', 'checks', 'thresholds', 'minimum_required_confidence', 'routing'],
  properties: {
    schema_version: { type: 'STRING' }, request_id: { type: 'STRING' }, model_version: { type: 'STRING' },
    documents: { type: 'OBJECT', required: ['cccd', 'gplx'], properties: {
      cccd: documentSchema(['full_name', 'date_of_birth', 'id_number']),
      gplx: documentSchema(['full_name', 'license_class', 'expiry_date']),
    } },
    checks: { type: 'OBJECT', required: ['image_quality', 'required_fields_present', 'name_consistency'], properties: {
      image_quality: enumString(['PASS', 'FAIL', 'BLURRY']), required_fields_present: { type: 'BOOLEAN' },
      name_consistency: enumString(['PASS', 'MISMATCH', 'NOT_APPLICABLE']),
    } },
    thresholds: { type: 'OBJECT', required: ['X', 'Y'], properties: { X: { type: 'NUMBER' }, Y: { type: 'NUMBER' } } },
    minimum_required_confidence: { type: 'NUMBER', nullable: true, minimum: 0, maximum: 1 },
    routing: { type: 'OBJECT', required: ['action', 'reason_codes', 'next_step', 'business_rule_status'], properties: {
      action: enumString(['PREFILL_FOR_RULES', 'MANUAL_REVIEW', 'REQUEST_REUPLOAD', 'FALLBACK_MANUAL']),
      reason_codes: { type: 'ARRAY', items: { type: 'STRING' } }, next_step: { type: 'STRING' },
      business_rule_status: enumString(['EVALUATED', 'NOT_EVALUATED']),
    } },
  },
};

function httpError(status: number): OcrError {
  if (status === 401 || status === 403) return new OcrError('PROVIDER_AUTH', 'Gemini từ chối xác thực. Vui lòng kiểm tra khóa và quyền truy cập.');
  if (status === 404) return new OcrError('PROVIDER_MODEL', 'Không tìm thấy mô hình Gemini đã cấu hình. Vui lòng cập nhật tên mô hình.');
  if (status === 429) return new OcrError('PROVIDER_RATE_LIMIT', 'Gemini đang giới hạn yêu cầu. Vui lòng thử lại sau.');
  return new OcrError('PROVIDER_HTTP', `Gemini phản hồi lỗi HTTP ${status}. Vui lòng thử lại sau.`);
}

export class GeminiAiProvider implements IAiProvider {
  async processOcr(input: AiAgentInput, parentSignal?: AbortSignal): Promise<AiOcrResponse> {
    const config = getAiConfig();
    if (!config.apiKey?.trim()) throw new OcrError('PROVIDER_CONFIG', 'Chưa cấu hình khóa Gemini. Vui lòng nhập khóa trong Cấu hình AI hoặc chọn OCR trên thiết bị.');
    if (!/^gemini-[\w.-]+$/.test(config.model)) throw new OcrError('PROVIDER_CONFIG', 'Tên mô hình Gemini không hợp lệ.');
    if (!input.cccdImageRef || !input.gplxImageRef) throw new OcrError('INVALID_FILE', 'Thiếu ảnh CCCD hoặc bằng lái.');

    return withOcrDeadline(async signal => {
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{
        text: `Đọc hồ sơ request_id=${input.requestId}. Ngưỡng X=${config.thresholdX}, Y=${config.thresholdY}. Trích xuất từ ảnh thực tế, không suy đoán.`,
      }];
      for (const [label, ref] of [
        ['CCCD mặt trước', input.cccdImageRef], ['CCCD mặt sau', input.cccdBackImageRef], ['GPLX mặt trước', input.gplxImageRef],
      ]) {
        if (!ref) continue;
        const url = await imageRefToDataUrl(ref, signal);
        const [header, data] = url.split(',');
        parts.push({ text: label! }, { inlineData: { mimeType: header.slice(5, header.indexOf(';')), data } });
      }
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent`;
      for (let attempt = 0; attempt < 2; attempt++) {
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST', signal,
            // Không đưa khóa vào URL/log.
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.apiKey! },
            body: JSON.stringify({
              systemInstruction: { parts: [{ text: AI_OCR_SYSTEM_PROMPT }] },
              contents: [{ role: 'user', parts }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: GEMINI_OCR_SCHEMA,
                temperature: 0.1,
                thinkingConfig: { thinkingBudget: 0 },
              },
            }),
          });
        } catch {
          if (signal.aborted) throw new OcrError('CANCELLED', 'Đã dừng yêu cầu Gemini.');
          if (attempt === 0) { await retryDelay(500, signal); continue; }
          throw new OcrError('PROVIDER_NETWORK', 'Không kết nối được Gemini. Kiểm tra mạng và thử lại.');
        }
        if (!response.ok) {
          // Không đọc/lưu payload lỗi có thể chứa dữ liệu giấy tờ hoặc khóa.
          void response.body?.cancel().catch(() => {});
          if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
            const retryAfter = Number(response.headers.get('retry-after'));
            await retryDelay(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 3000) : 500, signal);
            continue;
          }
          throw httpError(response.status);
        }
        try {
          const raw = await response.json();
          const candidate = raw?.candidates?.[0];
          if (candidate?.finishReason && candidate.finishReason !== 'STOP') throw new Error('Incomplete response');
          const text = candidate?.content?.parts?.filter((part: { text?: string; thought?: boolean }) => !part.thought && typeof part.text === 'string').map((part: { text: string }) => part.text).join('');
          if (!text) throw new Error('Empty response');
          return validateOcrResponse(JSON.parse(text), input.requestId);
        } catch (error) {
          if (error instanceof OcrError) throw error;
          throw new OcrError('INVALID_RESPONSE', 'Gemini không trả kết quả JSON hợp lệ hoặc kết quả bị chặn/chưa hoàn tất. Vui lòng thử lại.');
        }
      }
      throw new OcrError('PROVIDER_NETWORK', 'Không kết nối được Gemini.');
    }, config.timeoutMs, parentSignal);
  }
}

function retryDelay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new OcrError('CANCELLED', 'Đã dừng yêu cầu Gemini.')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
  });
}
