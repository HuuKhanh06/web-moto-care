// @ts-nocheck
// supabase/functions/ocr-gplx/index.ts
// Supabase Edge Function: Trích xuất thông tin Giấy phép lái xe (GPLX) bằng AI Vision
// Tuân thủ bảo mật P0: API Key lưu trữ trong Edge Function Secrets, không lộ ra frontend

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface GplxFieldOutput {
  value: string | null;
  confidence: number | null;
  source: 'AI';
}

interface EdgeGplxResponse {
  schema_version: '1.0';
  request_id: string;
  document_type: 'GPLX';
  documents: {
    gplx: {
      full_name: GplxFieldOutput;
      license_class: GplxFieldOutput;
      expiry_date: GplxFieldOutput;
    };
  };
  checks: {
    image_quality: 'PASS' | 'FAIL';
    image_quality_reason?: string;
    required_fields_present: boolean;
  };
  error?: string;
}

serve(async (req) => {
  // 1. Xử lý preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let requestId = 'unknown';

  try {
    const payload = await req.json().catch(() => ({}));
    requestId = payload.requestId || crypto.randomUUID();
    const documentType = (payload.documentType as 'GPLX' | undefined) || 'GPLX';
    const imageUrl = payload.imageUrl || payload.imageRef;
    const imageBase64 = payload.imageBase64;

    if (!imageUrl && !imageBase64) {
      return new Response(
        JSON.stringify({
          schema_version: '1.0',
          request_id: requestId,
          document_type: documentType,
          checks: { image_quality: 'FAIL', image_quality_reason: 'Thiếu đường dẫn hoặc dữ liệu ảnh', required_fields_present: false },
          error: 'MISSING_IMAGE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Lấy API Key từ Secret của Edge Function (Vault)
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('AI_API_KEY');
    
    // Nếu chưa cấu hình Key trên Supabase Secret, trả về FALLBACK rõ ràng
    if (!geminiApiKey) {
      console.warn('[ocr-gplx] GEMINI_API_KEY secret chưa được cấu hình trong Supabase Edge Functions');
      return new Response(
        JSON.stringify({
          schema_version: '1.0',
          request_id: requestId,
          document_type: 'GPLX',
          checks: { image_quality: 'PASS', required_fields_present: false },
          error: 'API_KEY_NOT_CONFIGURED',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Chuẩn bị ảnh gửi đến Gemini Vision API
    let inlineDataPart: { mimeType: string; data: string } | null = null;

    if (imageBase64) {
      const match = imageBase64.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        inlineDataPart = { mimeType: match[1], data: match[2] };
      } else {
        inlineDataPart = { mimeType: 'image/jpeg', data: imageBase64 };
      }
    } else if (imageUrl && (imageUrl.startsWith('http://') || imageUrl.startsWith('https://'))) {
      // Tải ảnh từ signed URL
      const imgRes = await fetch(imageUrl);
      if (imgRes.ok) {
        const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
        const buffer = await imgRes.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        inlineDataPart = { mimeType, data: base64 };
      }
    }

    if (!inlineDataPart) {
      return new Response(
        JSON.stringify({
          schema_version: '1.0',
          request_id: requestId,
          document_type: 'GPLX',
          checks: { image_quality: 'FAIL', image_quality_reason: 'Không thể tải ảnh từ URL cung cấp', required_fields_present: false },
          error: 'CANNOT_LOAD_IMAGE',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Gọi mô hình Gemini 1.5 Flash Vision với Timeout 20s
    const systemPrompt = `Bạn là chuyên gia thị giác máy tính bóc tách dữ liệu từ Giấy phép lái xe (GPLX) Việt Nam.
Chỉ đọc những gì nhìn thấy trên thẻ. Trường không đọc được hoặc không có trả null, tuyệt đối không suy đoán hay điền thiếu; trả CHỈ JSON, không kèm chữ markdown hay giải thích nào khác.

Schema JSON bắt buộc:
{
  "full_name": string | null (Họ và tên in hoa trên GPLX),
  "license_class": string | null (Hạng bằng lái: A1, A2, A3, A4, B1, B2, C, D, E, F),
  "expiry_date": string | null (Ngày hết hạn theo ISO YYYY-MM-DD, nếu ghi "KHÔNG THỜI HẠN" hoặc vô thời hạn thì trả null),
  "confidence": {
    "full_name": number 0.0 - 1.0,
    "license_class": number 0.0 - 1.0,
    "expiry_date": number 0.0 - 1.0
  },
  "image_quality": "PASS" | "FAIL",
  "image_quality_reason": string (nếu FAIL ghi rõ lý do: mờ, lóa sáng, mất góc, không phải bằng lái)
}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 19000); // Ngắt trước 20s

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`;

    const geminiBody = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: systemPrompt },
            { inlineData: inlineDataPart },
            { text: 'Hãy trích xuất thông tin GPLX này theo đúng schema JSON.' },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
    };

    const aiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error('[ocr-gplx] Gemini API error:', errText);
      return new Response(
        JSON.stringify({
          schema_version: '1.0',
          request_id: requestId,
          document_type: 'GPLX',
          checks: { image_quality: 'PASS', required_fields_present: false },
          error: `AI_SERVICE_ERROR: HTTP ${aiRes.status}`,
        }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiRes.json();
    const rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const parsedAi = JSON.parse(rawContent);

    // 5. Kiểm tra & chuẩn hóa dữ liệu đầu ra theo schema
    const fullNameVal = parsedAi.full_name ? String(parsedAi.full_name).trim() : null;
    let licenseClassVal = parsedAi.license_class ? String(parsedAi.license_class).trim().toUpperCase() : null;
    if (licenseClassVal && !/^(A1|A2|A3|A4|B1|B2|C|D|E|F)$/i.test(licenseClassVal)) {
      licenseClassVal = null; // Định dạng không hợp lệ để null
    }

    const expiryDateVal = parsedAi.expiry_date ? String(parsedAi.expiry_date).trim() : null;

    const nameConf = typeof parsedAi.confidence?.full_name === 'number' ? parsedAi.confidence.full_name : (fullNameVal ? 0.9 : null);
    const classConf = typeof parsedAi.confidence?.license_class === 'number' ? parsedAi.confidence.license_class : (licenseClassVal ? 0.9 : null);
    const expConf = typeof parsedAi.confidence?.expiry_date === 'number' ? parsedAi.confidence.expiry_date : (expiryDateVal ? 0.9 : null);

    const isQualityPass = parsedAi.image_quality !== 'FAIL';
    const requiredPresent = Boolean(fullNameVal && licenseClassVal);

    const responseBody: EdgeGplxResponse = {
      schema_version: '1.0',
      request_id: requestId,
      document_type: documentType,
      documents: {
        gplx: {
          full_name: { value: fullNameVal, confidence: nameConf, source: 'AI' },
          license_class: { value: licenseClassVal, confidence: classConf, source: 'AI' },
          expiry_date: { value: expiryDateVal, confidence: expConf, source: 'AI' },
        },
      },
      checks: {
        image_quality: isQualityPass ? 'PASS' : 'FAIL',
        image_quality_reason: parsedAi.image_quality_reason,
        required_fields_present: requiredPresent,
      },
    };

    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const isTimeout = err instanceof Error && err.name === 'AbortError';
    const errMsg = isTimeout ? 'GPLX OCR timeout after 20 seconds' : (err instanceof Error ? err.message : String(err));
    console.error('[ocr-gplx] Error:', errMsg);

    return new Response(
      JSON.stringify({
        schema_version: '1.0',
        request_id: requestId,
        document_type: 'GPLX',
        checks: { image_quality: 'FAIL', required_fields_present: false },
        error: isTimeout ? 'TIMEOUT_20S' : errMsg,
      }),
      { status: 504, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
