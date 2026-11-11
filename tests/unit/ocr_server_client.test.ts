import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const auth = vi.hoisted(() => ({ getSession: vi.fn(), signInAnonymously: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth } }));
import { processServerOcr } from '@/ai/server';
import { getAiConfig } from '@/config/ai';

const image = 'data:image/jpeg;base64,YWJj';
const input = { requestId: 'test-request', cccdImageRef: image, cccdBackImageRef: image, gplxImageRef: image };
beforeEach(() => {
  vi.stubEnv('VITE_OCR_ENDPOINT', 'https://project.test/functions/v1/document-ocr');
  sessionStorage.clear(); localStorage.clear();
  auth.getSession.mockResolvedValue({ data: { session: { access_token: 'test-user-token' } } });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

describe('Online OCR client', () => {
  it('overrides stale LOCAL settings and removes browser keys', () => {
    sessionStorage.setItem('motocare_ai_config', JSON.stringify({ mode: 'LOCAL', apiKey: 'old-private-key', timeoutMs: 500 }));
    expect(getAiConfig()).toMatchObject({ mode: 'LIVE', apiKey: '', timeoutMs: 110000 });
  });
  it('sends only images/request ID with user JWT and reports server quota', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429 })); vi.stubGlobal('fetch', fetcher);
    await expect(processServerOcr(input)).rejects.toThrow('giới hạn');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://project.test/functions/v1/document-ocr');
    expect(options.headers.Authorization).toBe('Bearer test-user-token');
    expect(JSON.parse(options.body)).toEqual({ requestId: 'test-request', images: [image, image, image] });
    expect(options.headers['x-goog-api-key']).toBeUndefined();
  });
  it('creates a Supabase anonymous session when no session exists', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ data: { session: { access_token: 'anonymous-token' } }, error: null });
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 503 })); vi.stubGlobal('fetch', fetcher);
    await expect(processServerOcr(input)).rejects.toThrow('chưa sẵn sàng');
    expect(auth.signInAnonymously).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer anonymous-token');
  });
  it('never calls OCR when session creation fails', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInAnonymously.mockResolvedValue({ data: { session: null }, error: new Error('disabled') });
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    await expect(processServerOcr(input)).rejects.toThrow('Anonymous Sign-ins');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects incomplete documents before authentication', async () => {
    await expect(processServerOcr({ ...input, cccdBackImageRef: undefined })).rejects.toThrow('ba ảnh');
    expect(auth.getSession).not.toHaveBeenCalled();
  });
});
