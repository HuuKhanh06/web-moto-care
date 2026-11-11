import { describe, expect, it, vi } from 'vitest';
import { createOcrHandler } from '../../supabase/functions/document-ocr/handler';

const values: Record<string, string> = {
  OCR_ALLOWED_ORIGINS: 'https://example.test', GEMINI_API_KEY: 'server-only-test-key',
  SUPABASE_URL: 'https://project.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service-key',
};
const image = 'data:image/jpeg;base64,YWJj';
const payload = { requestId: 'test-request', images: [image, image, image] };
const req = (body = payload, origin = 'https://example.test') => new Request('https://project.test/functions/v1/document-ocr', {
  method: 'POST', headers: { Origin: origin, Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const auth = () => new Response(JSON.stringify({ id: '11111111-1111-4111-8111-111111111111' }));
const quota = () => new Response('true');
const success = () => new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({
  request_id: 'test-request', documents: { cccd: {}, gplx: {} }, checks: {}, routing: {},
}) }] } }] }));

describe('OCR backend trust boundary (synthetic payloads only)', () => {
  it('handles CORS before auth and rejects unlisted origins', async () => {
    const fetcher = vi.fn(); const handler = createOcrHandler(key => values[key], fetcher);
    expect((await handler(req(payload, 'https://evil.test'))).status).toBe(403);
    const preflight = await handler(new Request('https://project.test', { method: 'OPTIONS', headers: { Origin: 'https://example.test' } }));
    expect(preflight.status).toBe(204); expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects invalid tokens before forwarding images', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
    expect((await createOcrHandler(key => values[key], fetcher)(req())).status).toBe(401);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('enforces server quota before calling Gemini', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(auth()).mockResolvedValueOnce(new Response('false'));
    const response = await createOcrHandler(key => values[key], fetcher)(req());
    expect(response.status).toBe(429); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects malformed image payloads', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(auth()).mockResolvedValueOnce(quota());
    expect((await createOcrHandler(key => values[key], fetcher)(req({ ...payload, images: ['https://evil.test/image'] }))).status).toBe(400);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps key server-side, uses fixed schema and returns no-store results', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(auth()).mockResolvedValueOnce(quota()).mockResolvedValueOnce(success());
    const response = await createOcrHandler(key => values[key], fetcher)(req());
    expect(response.status).toBe(200); expect(response.headers.get('Cache-Control')).toBe('no-store');
    const result = await response.json(); expect(result.model_version).toBe('gemini-3.5-flash');
    const [url, options] = fetcher.mock.calls[2];
    expect(url).not.toContain(values.GEMINI_API_KEY);
    expect(options.headers['x-goog-api-key']).toBe(values.GEMINI_API_KEY);
    expect(JSON.parse(options.body).generationConfig.responseSchema).toBeDefined();
    expect(JSON.stringify(result)).not.toContain(values.GEMINI_API_KEY);
  });
  it('retries 5xx once and never exposes provider error bodies', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(auth()).mockResolvedValueOnce(quota())
      .mockResolvedValueOnce(new Response('private provider error', { status: 503 })).mockResolvedValueOnce(success());
    expect((await createOcrHandler(key => values[key], fetcher)(req())).status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('does not retry quota/auth errors or accept mismatched results', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(auth()).mockResolvedValueOnce(quota()).mockResolvedValueOnce(new Response('secret detail', { status: 429 }));
    const response = await createOcrHandler(key => values[key], fetcher)(req());
    expect(response.status).toBe(429); expect(await response.text()).not.toContain('secret detail');
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
