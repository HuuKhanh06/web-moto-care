import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/db';
import { aiService } from '@/ai';
import { LocalOcrProvider } from '@/ai/local';
import { GeminiAiProvider } from '@/ai/gemini';
import { parseOcrPages, extractDataFromImages } from '@/ai/realOcr';
import { validateImageFile, imageRefToDataUrl, compressImageToDataUrl } from '@/ai/images';
import { withOcrDeadline } from '@/ai/timeout';
import { validateOcrResponse } from '@/ai/validation';
import type { AiAgentInput, AiOcrResponse } from '@/ai/types';

const image = 'data:image/png;base64,YQ==';
const input: AiAgentInput = { requestId: 'pipeline', cccdImageRef: image, cccdBackImageRef: image, gplxImageRef: image };
function validResult(): AiOcrResponse {
  return {
    request_id: 'pipeline', schema_version: '1.0', model_version: 'controlled-test',
    documents: {
      cccd: { full_name: { value: 'TRAN THI TEST', confidence: 0.98 }, id_number: { value: '048098001234', confidence: 0.97 }, date_of_birth: { value: '1998-05-20', confidence: 0.98 } },
      gplx: { full_name: { value: 'TRAN THI TEST', confidence: 0.98 }, license_class: { value: 'A2', confidence: 0.96 }, expiry_date: { value: null, confidence: null } },
    },
    checks: { image_quality: 'PASS', required_fields_present: true, name_consistency: 'PASS' },
    thresholds: { X: 0.95, Y: 0.8 }, minimum_required_confidence: 0.96,
    routing: { action: 'PREFILL_FOR_RULES', reason_codes: [], next_step: 'M_CheckDocs', business_rule_status: 'NOT_EVALUATED' },
  };
}
function geminiResponse(data: unknown = validResult()): Response {
  return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(data) }] } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(async () => {
  vi.restoreAllMocks(); sessionStorage.clear(); localStorage.clear();
  await db.clearAllTables();
  aiService.updateConfig({ mode: 'LOCAL', timeoutMs: 1000 });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('File handling and deadlines', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp', 'image/bmp'])('accepts supported MIME %s', type => {
    expect(() => validateImageFile(new File(['image'], 'photo', { type }))).not.toThrow();
  });
  it.each(['application/pdf', 'image/heic', 'text/plain'])('rejects unsupported MIME %s', type => {
    expect(() => validateImageFile(new File(['x'], 'invalid', { type }))).toThrow('Chỉ hỗ trợ');
  });
  it('rejects empty/oversized before decoding', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL');
    await expect(compressImageToDataUrl(new File([], 'empty', { type: 'image/png' }))).rejects.toThrow('10 MB');
    await expect(compressImageToDataUrl(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge', { type: 'image/png' }))).rejects.toThrow('10 MB');
    expect(read).not.toHaveBeenCalled();
  });
  it('rejects invalid data URLs and missing blob before OCR', async () => {
    await expect(imageRefToDataUrl('data:application/pdf;base64,YQ==', new AbortController().signal)).rejects.toThrow('không hợp lệ');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    await expect(imageRefToDataUrl('blob:missing', new AbortController().signal)).rejects.toThrow('tải ảnh');
  });
  it('converts a fetched blob to actual inline bytes', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob(['abc'], { type: 'image/png' }) }));
    await expect(imageRefToDataUrl('blob:photo', new AbortController().signal)).resolves.toBe('data:image/png;base64,YWJj');
  });
  it('bounds a never-resolving operation and aborts its signal', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const result = withOcrDeadline(s => { signal = s; return new Promise(() => {}); }, 50);
    const rejected = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(51); await rejected;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a parent signal, with no leftover deadline timer', async () => {
    vi.useFakeTimers();
    const parent = new AbortController();
    const result = withOcrDeadline(() => new Promise(() => {}), 500, parent.signal);
    const rejected = expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
    parent.abort(); await rejected; expect(vi.getTimerCount()).toBe(0);
  });
  it('settles when canvas conversion throws, instead of hanging the upload', async () => {
    const read = vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(function (this: FileReader) {
      this.onload?.({ target: { result: image } } as unknown as ProgressEvent<FileReader>);
    });
    vi.stubGlobal('Image', class {
      width = 100; height = 100;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => { throw new Error('canvas unavailable'); });
    await expect(compressImageToDataUrl(new File(['x'], 'image', { type: 'image/png' }))).rejects.toThrow('xử lý tệp ảnh');
    expect(read).toHaveBeenCalledTimes(1);
  });
});

describe('Real OCR parsing and worker cancellation', () => {
  it('parses actual text per document and never copies CCCD name into GPLX', () => {
    const parsed = parseOcrPages({ text: 'Họ và tên: TRẦN THỊ TEST\nNgày sinh: 20/05/1998\n048098001234\nNgày cấp: 01/01/2020', confidence: 0.9 }, undefined,
      { text: 'Full name: LE VAN KHAC\nClass: A2', confidence: 0.8 });
    expect(parsed).toMatchObject({ fullName: 'TRẦN THỊ TEST', idNumber: '048098001234', dob: '1998-05-20', licenseName: 'LE VAN KHAC', licenseClass: 'A2' });
  });
  it('does not invent fields, treat issue date as DOB, or accept impossible dates', () => {
    expect(parseOcrPages({ text: 'Ngay cap: 01/01/2020', confidence: 0.2 }).dob).toBeUndefined();
    const parsed = parseOcrPages({ text: 'Date of birth: 31/02/2000', confidence: 0.8 });
    expect(parsed.dob).toBeUndefined(); expect(parsed.fullName).toBeUndefined(); expect(parsed.licenseClass).toBeUndefined();
  });
  it('terminates the outer worker when initialization/recognition never responds', async () => {
    vi.useFakeTimers();
    const terminate = vi.fn(); const postMessage = vi.fn();
    vi.stubGlobal('Worker', class { terminate = terminate; postMessage = postMessage; });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array([31, 139, 0]))));
    const result = extractDataFromImages(image, image, image, 50);
    const rejected = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(51); await rejected;
    expect(postMessage).toHaveBeenCalledTimes(1); expect(terminate).toHaveBeenCalledTimes(1);
  });
  it('handles worker asset errors as failure, without empty successful output', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('private network error')));
    await expect(extractDataFromImages(image)).rejects.toMatchObject({ code: 'OCR_ASSETS' });
  });
});

describe('Gemini REST integration (controlled fetch, not real provider)', () => {
  beforeEach(() => { aiService.updateConfig({ mode: 'LIVE', apiKey: 'test-secret-only', timeoutMs: 1000 }); });
  it('sends all 3 image bytes with labels and schema, key only in header', async () => {
    const fetcher = vi.fn().mockResolvedValue(geminiResponse()); vi.stubGlobal('fetch', fetcher);
    const result = await new GeminiAiProvider().processOcr(input);
    expect(result.documents.cccd?.id_number.value).toBe('048098001234');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).not.toContain('test-secret-only');
    expect(options.headers['x-goog-api-key']).toBe('test-secret-only');
    const body = JSON.parse(options.body);
    expect(body.contents[0].parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(3);
    expect(body.generationConfig.responseSchema.properties.documents).toBeDefined();
  });
  it.each([401, 403, 404, 400])('does not retry permanent HTTP %s or echo its body', async status => {
    const fetcher = vi.fn().mockResolvedValue(new Response('test-secret-only sensitive content', { status })); vi.stubGlobal('fetch', fetcher);
    await expect(new GeminiAiProvider().processOcr(input)).rejects.toThrow(/Gemini/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([429, 503])('retries HTTP %s only once, then succeeds', async status => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status })).mockResolvedValueOnce(geminiResponse()); vi.stubGlobal('fetch', fetcher);
    const result = new GeminiAiProvider().processOcr(input);
    await vi.advanceTimersByTimeAsync(501);
    await expect(result).resolves.toHaveProperty('request_id', 'pipeline');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bounds repeated rate limits/network failure to two requests', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockRejectedValue(new TypeError('contains test-secret-only')); vi.stubGlobal('fetch', fetcher);
    const result = new GeminiAiProvider().processOcr(input);
    const rejected = expect(result).rejects.toMatchObject({ code: 'PROVIDER_NETWORK' });
    await vi.advanceTimersByTimeAsync(501); await rejected;
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps deadline active while response body is hung', async () => {
    vi.useFakeTimers(); aiService.updateConfig({ timeoutMs: 50 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) }));
    const result = new GeminiAiProvider().processOcr(input);
    const rejected = expect(result).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(51); await rejected;
  });
  it.each([{ broken: true }, { ...validResult(), request_id: 'another-request' }])('rejects invalid schema or wrong request ID', async result => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiResponse(result)));
    await expect(new GeminiAiProvider().processOcr(input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects non-JSON or blocked/truncated candidates', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{broken' }] } }] }))));
    await expect(new GeminiAiProvider().processOcr(input)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('rejects incomplete data even if AI asserts high confidence success', () => {
    const result = validResult(); result.documents.cccd!.id_number.value = null;
    expect(validateOcrResponse(result, 'pipeline').routing.action).toBe('REQUEST_REUPLOAD');
  });
});

describe('Facade persistence and single-flight (controlled providers, real test DB)', () => {
  beforeEach(async () => {
    await db.customer_documents.bulkAdd([
      { id: 'p-front', request_id: 'pipeline', doc_type: 'CCCD_TRUOC', file_url: image },
      { id: 'p-back', request_id: 'pipeline', doc_type: 'CCCD_SAU', file_url: image },
      { id: 'p-license', request_id: 'pipeline', doc_type: 'BANG_LAI_TRUOC', file_url: image },
    ]);
  });
  it('single-flights concurrent duplicate inputs, persists real source and result once', async () => {
    const provider = vi.spyOn(LocalOcrProvider.prototype, 'processOcr').mockResolvedValue(validResult());
    const results = await Promise.all([aiService.processOcr(input), aiService.processOcr({ ...input })]);
    expect(results[0]).toEqual(results[1]); expect(provider).toHaveBeenCalledTimes(1);
    expect(await db.ai_logs.count()).toBe(1);
    expect(await db.customer_documents.get('p-front')).toMatchObject({ ai_source: 'LOCAL', ai_confidence: 0.96 });
  });
  it('LIVE without key fails honestly and never switches to mock', async () => {
    aiService.updateConfig({ mode: 'LIVE', apiKey: '' });
    const local = vi.spyOn(LocalOcrProvider.prototype, 'processOcr');
    const result = await aiService.processOcr(input);
    expect(result.routing.action).toBe('FALLBACK_MANUAL'); expect(result.documents).toEqual({});
    expect(result.routing.reason_codes.join()).toContain('PROVIDER_CONFIG'); expect(local).not.toHaveBeenCalled();
    expect((await db.ai_logs.toArray())[0].routing_action).toBe('FALLBACK_MANUAL');
  });
  it('rolls back doc updates and reports storage failure when AI log write fails', async () => {
    vi.spyOn(LocalOcrProvider.prototype, 'processOcr').mockResolvedValue(validResult());
    vi.spyOn(db.ai_logs, 'add').mockRejectedValue(new Error('disk failed'));
    await expect(aiService.processOcr(input)).rejects.toMatchObject({ code: 'STORAGE_ERROR' });
    expect((await db.customer_documents.get('p-front'))?.ai_result).toBeUndefined();
  });
  it('rejects stale provider completion if an image changes during processing', async () => {
    let finish!: (value: AiOcrResponse) => void;
    const provider = vi.spyOn(LocalOcrProvider.prototype, 'processOcr').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const result = aiService.processOcr(input);
    await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(1));
    await db.customer_documents.update('p-front', { file_url: 'data:image/png;base64,Yg==' });
    finish(validResult());
    await expect(result).rejects.toMatchObject({ code: 'STALE_DOCUMENTS' });
    expect(await db.ai_logs.count()).toBe(0);
  });
  it('rejects inputs already stale before calling the provider', async () => {
    const provider = vi.spyOn(LocalOcrProvider.prototype, 'processOcr');
    await expect(aiService.processOcr({ ...input, cccdImageRef: 'data:image/png;base64,Yg==' })).rejects.toMatchObject({ code: 'STALE_DOCUMENTS' });
    expect(provider).not.toHaveBeenCalled();
  });
});
