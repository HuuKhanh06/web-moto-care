// src/ai/gplxClient.ts
// Client gọi Supabase Edge Function 'ocr-gplx' để đọc thông tin Giấy phép lái xe (GPLX)
// Tuân thủ bảo mật P0: Không lưu API key ở client; Timeout cứng 20 giây

import { supabase } from '@/lib/supabase';
import type { UnifiedGplxDoc } from './routingEngine';

export interface GplxExtractionResult {
  success: boolean;
  doc?: UnifiedGplxDoc;
  imageQuality?: 'PASS' | 'FAIL' | 'BLURRY';
  isServiceError?: boolean;
  error?: string;
}

/**
 * Trích xuất thông tin GPLX qua Supabase Edge Function
 * Thời gian chờ tối đa 7 giây; quá hạn hoặc lỗi trả về trạng thái rõ ràng, không treo
 */
export async function extractGplxFromEdgeFunction(
  imageSource: string,
  requestId: string
): Promise<GplxExtractionResult> {
  const timeoutMs = 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (!supabase) {
      console.warn('[gplxClient] Supabase client chưa được cấu hình, kích hoạt FALLBACK_MANUAL');
      clearTimeout(timer);
      return {
        success: false,
        isServiceError: true,
        error: 'SUPABASE_CLIENT_NOT_CONFIGURED',
      };
    }

    const isDataUrl = imageSource.startsWith('data:');
    const isHttpUrl = imageSource.startsWith('http://') || imageSource.startsWith('https://');

    const invokePromise = supabase.functions.invoke('ocr-gplx', {
      body: {
        requestId,
        documentType: 'GPLX',
        imageBase64: isDataUrl ? imageSource : undefined,
        imageUrl: isHttpUrl ? imageSource : undefined,
      },
    });

    // Bọc trong Promise.race với timeout 7s
    const timeoutPromise = new Promise<{ data: null; error: Error }>((_, reject) => {
      setTimeout(() => reject(new Error('GPLX_TIMEOUT_7S')), timeoutMs);
    });

    const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: any;
      error: Error | null;
    };
    clearTimeout(timer);

    if (error || !data) {
      console.warn('[gplxClient] Lỗi khi gọi Edge Function ocr-gplx:', error);
      return {
        success: false,
        isServiceError: true,
        error: error?.message || 'EDGE_FUNCTION_INVOKE_FAILED',
      };
    }

    const gplxData = data.documents?.gplx;
    if (!gplxData) {
      return {
        success: false,
        imageQuality: data.checks?.image_quality || 'PASS',
        isServiceError: false,
        error: 'NO_GPLX_DATA_RETURNED',
      };
    }

    const doc: UnifiedGplxDoc = {
      full_name: {
        value: gplxData.full_name?.value || null,
        confidence: gplxData.full_name?.confidence ?? null,
        source: 'AI',
      },
      license_class: {
        value: gplxData.license_class?.value || null,
        confidence: gplxData.license_class?.confidence ?? null,
        source: 'AI',
      },
      expiry_date: {
        value: gplxData.expiry_date?.value || null,
        confidence: gplxData.expiry_date?.confidence ?? null,
        source: 'AI',
      },
    };

    return {
      success: true,
      doc,
      imageQuality: data.checks?.image_quality || 'PASS',
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && (err.name === 'AbortError' || err.message.includes('TIMEOUT'));
    console.warn('[gplxClient] Lỗi hoặc quá hạn khi quét GPLX:', err);
    return {
      success: false,
      isServiceError: true,
      error: isTimeout ? 'GPLX_TIMEOUT_20S' : String(err),
    };
  }
}
