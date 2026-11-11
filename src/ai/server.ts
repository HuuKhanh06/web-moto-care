import { supabase } from '@/lib/supabase';
import { getAiConfig } from '@/config/ai';
import type { AiAgentInput, AiOcrResponse } from './types';
import { imageRefToDataUrl } from './images';
import { withOcrDeadline } from './timeout';
import { validateOcrResponse } from './validation';
import { OcrError } from './errors';

let anonymousLogin: Promise<string> | undefined;
async function accessToken(): Promise<string> {
  if (!supabase) throw new OcrError('PROVIDER_CONFIG', 'Chưa cấu hình kết nối dịch vụ quét giấy tờ.');
  const { data: { session } } = await supabase.auth.getSession();
  if (session) return session.access_token;
  anonymousLogin ??= supabase.auth.signInAnonymously().then(({ data, error }) => {
    if (error || !data.session) throw new OcrError('PROVIDER_AUTH', 'Không tạo được phiên quét. Quản trị viên cần bật Anonymous Sign-ins trong Supabase.');
    return data.session.access_token;
  }).finally(() => { anonymousLogin = undefined; });
  return anonymousLogin;
}

export async function processServerOcr(input: AiAgentInput, parentSignal?: AbortSignal): Promise<AiOcrResponse> {
  const config = getAiConfig();
  const endpoint = import.meta.env.VITE_OCR_ENDPOINT;
  if (!endpoint || (!endpoint.startsWith('https://') && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(endpoint))) {
    throw new OcrError('PROVIDER_CONFIG', 'Địa chỉ dịch vụ OCR không hợp lệ.');
  }
  if (!input.cccdImageRef || !input.cccdBackImageRef || !input.gplxImageRef) throw new OcrError('INVALID_FILE', 'Cần đủ ba ảnh giấy tờ.');
  return withOcrDeadline(async signal => {
    const token = await accessToken();
    const images = await Promise.all([input.cccdImageRef!, input.cccdBackImageRef!, input.gplxImageRef!].map(ref => imageRefToDataUrl(ref, signal)));
    let response: Response;
    try {
      response = await fetch(endpoint, { method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ requestId: input.requestId, images }),
      });
    } catch {
      throw new OcrError('PROVIDER_NETWORK', 'Không kết nối được dịch vụ quét. Vui lòng kiểm tra mạng và thử lại.');
    }
    if (!response.ok) {
      const messages: Record<number, string> = {
        401: 'Phiên quét không hợp lệ. Vui lòng tải lại trang.',
        403: 'Website chưa được cấp phép gọi dịch vụ quét.',
        413: 'Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn.',
        429: 'Đã đạt giới hạn lượt quét. Vui lòng thử lại sau ít phút.',
        503: 'Dịch vụ quét chưa sẵn sàng. Vui lòng thử lại sau.',
        504: 'Dịch vụ quét đang xử lý chậm. Bạn có thể thử lại; không cần tải lại ảnh.',
      };
      throw new OcrError(response.status === 504 ? 'TIMEOUT' : 'PROVIDER_HTTP', messages[response.status] || 'Dịch vụ chưa đọc được giấy tờ. Vui lòng thử lại.');
    }
    try { return validateOcrResponse(await response.json(), input.requestId); }
    catch { throw new OcrError('INVALID_RESPONSE', 'Dịch vụ trả kết quả không hợp lệ. Vui lòng thử lại.'); }
  }, config.timeoutMs, parentSignal);
}
