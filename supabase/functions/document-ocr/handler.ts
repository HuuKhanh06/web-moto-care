import { AI_OCR_SYSTEM_PROMPT, GEMINI_OCR_SCHEMA } from '../_shared/ocrContract.ts';

type Env = (key: string) => string | undefined;
const MAX_BODY_BYTES = 7 * 1024 * 1024;
const labels = ['CCCD mặt trước', 'CCCD mặt sau', 'GPLX mặt trước'];

// Bound the actual stream, not just a caller-supplied Content-Length header.
async function readBody(request: Request, signal: AbortSignal): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks: Uint8Array[] = [];
  let size = 0;
  const cancel = () => { void reader.cancel(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
  while (true) {
    if (signal.aborted) throw new Error('timeout');
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new Error('size'); }
    chunks.push(value);
  }
  if (signal.aborted) throw new Error('timeout');
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
  } finally { signal.removeEventListener('abort', cancel); reader.releaseLock(); }
}

export function createOcrHandler(env: Env, requestFetch: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin') || '';
    const allowed = (env('OCR_ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
    const headers = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : 'null',
      'Access-Control-Allow-Headers': 'authorization, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    };
    const reply = (status: number, code: string, extra: Record<string, string> = {}) => new Response(JSON.stringify({ error: code }), { status, headers: { ...headers, ...extra } });
    if (!allowed.includes(origin)) return reply(403, 'ORIGIN_DENIED');
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return reply(405, 'METHOD_NOT_ALLOWED');
    const key = env('GEMINI_API_KEY');
    const base = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const model = env('GEMINI_MODEL') || 'gemini-3.5-flash';
    if (!key || !base || !serviceKey || !/^gemini-[\w.-]+$/.test(model)) return reply(503, 'SERVER_CONFIG');
    const token = request.headers.get('authorization');
    if (!token?.startsWith('Bearer ')) return reply(401, 'AUTH_REQUIRED');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    request.signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, 95000);
    const signal = controller.signal;
    try {
      const auth = await requestFetch(`${base}/auth/v1/user`, {
        headers: { apikey: serviceKey, Authorization: token }, signal,
      });
      if (!auth.ok) return reply(401, 'AUTH_REQUIRED');
      const user = await auth.json();
      if (typeof user.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(user.id)) return reply(401, 'AUTH_REQUIRED');
      const quota = await requestFetch(`${base}/rest/v1/rpc/consume_ocr_quota`, {
        method: 'POST', signal,
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ caller: user.id }),
      });
      if (!quota.ok) return reply(503, 'QUOTA_UNAVAILABLE');
      if (await quota.json() !== true) return reply(429, 'RATE_LIMIT', { 'Retry-After': '300' });
      if (!request.headers.get('content-type')?.includes('application/json')) return reply(400, 'INVALID_BODY');
      if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) return reply(413, 'BODY_TOO_LARGE');
      let body;
      try { body = await readBody(request, signal) as { requestId?: unknown; images?: unknown }; }
      catch (e) { return reply(signal.aborted ? 504 : e instanceof Error && e.message === 'size' ? 413 : 400, 'INVALID_BODY'); }
      if (typeof body.requestId !== 'string' || !/^[\w-]{1,100}$/.test(body.requestId) ||
        !Array.isArray(body.images) || body.images.length !== 3 ||
        !body.images.every(image => typeof image === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(image) && image.length <= 2_300_000)) return reply(400, 'INVALID_IMAGES');
      const parts: unknown[] = [{ text: `request_id=${body.requestId}. X=0.95, Y=0.80. Ảnh có thể xoay ngang; đọc theo đúng hướng chữ.` }];
      body.images.forEach((image: string, i: number) => {
        const [header, data] = image.split(',');
        parts.push({ text: labels[i] }, { inlineData: { mimeType: header.slice(5, header.indexOf(';')), data } });
      });
      // One retry only for transient provider errors, within the same total deadline.
      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await requestFetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST', signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: AI_OCR_SYSTEM_PROMPT }] }, contents: [{ role: 'user', parts }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: GEMINI_OCR_SCHEMA,
              ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
            },
          }),
        });
        if (!response.ok) {
          await response.body?.cancel();
          if (attempt === 0 && response.status >= 500) continue;
          return reply(response.status === 429 ? 429 : 503, 'PROVIDER_UNAVAILABLE');
        }
        const raw = await response.json();
        const candidate = raw?.candidates?.[0];
        if (candidate?.finishReason !== 'STOP') return reply(502, 'INCOMPLETE_RESULT');
        const text = candidate.content?.parts?.filter((p: { text?: string; thought?: boolean }) => !p.thought && typeof p.text === 'string').map((p: { text: string }) => p.text).join('');
        let output;
        try { output = JSON.parse(text); } catch { return reply(502, 'INVALID_RESULT'); }
        if (output?.request_id !== body.requestId || !output.documents?.cccd || !output.documents?.gplx || !output.checks || !output.routing) return reply(502, 'INVALID_RESULT');
        // Server owns provenance, thresholds and rule routing; model output remains a proposal.
        output.model_version = model;
        output.thresholds = { X: 0.95, Y: 0.80 };
        output.routing.business_rule_status = 'NOT_EVALUATED';
        return new Response(JSON.stringify(output), { headers });
      }
      return reply(503, 'PROVIDER_UNAVAILABLE');
    } catch {
      // Never return raw exceptions, provider payloads, keys or identity images.
      return reply(signal.aborted ? 504 : 503, signal.aborted ? 'TIMEOUT' : 'SERVICE_UNAVAILABLE');
    } finally {
      clearTimeout(timer);
      request.signal.removeEventListener('abort', cancel);
    }
  };
}
