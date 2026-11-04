// src/ai/gemini.ts
// Hiện thực kết nối trực tiếp Google Gemini API qua REST API từ trình duyệt

import type { IAiProvider, AiAgentInput, AiOcrResponse } from './types';
import { AiOcrResponseSchema } from './types';
import { getAiConfig, AI_OCR_SYSTEM_PROMPT } from '@/config/ai';

export class GeminiAiProvider implements IAiProvider {
  async processOcr(input: AiAgentInput): Promise<AiOcrResponse> {
    const config = getAiConfig();
    const apiKey = config.apiKey;

    if (!apiKey) {
      throw new Error('Chưa cấu hình API Key cho Gemini (Vui lòng nhập tại Cài đặt hoặc file .env)');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

    // Chuẩn bị payload gửi Gemini
    const contentsParts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];

    contentsParts.push({
      text: `Yêu cầu OCR hồ sơ thuê xe MotoCare.
Mã hồ sơ (request_id): ${input.requestId}
Loại xe khách thuê: ${input.selectedVehicleType || 'xe_so'}
Số lần bổ sung trước đó: ${input.supplementCount || 0}
Ngưỡng X (tự động): ${config.thresholdX}, Ngưỡng Y (xác minh): ${config.thresholdY}

Hãy trích xuất thông tin từ các ảnh giấy tờ sau và trả về định dạng JSON theo đúng schema:`,
    });

    // Nếu ảnh là dạng data URL base64, đính kèm vào inline_data
    if (input.cccdImageRef && input.cccdImageRef.startsWith('data:')) {
      const [header, base64Data] = input.cccdImageRef.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      contentsParts.push({
        inline_data: { mime_type: mime, data: base64Data },
      });
    }

    if (input.gplxImageRef && input.gplxImageRef.startsWith('data:')) {
      const [header, base64Data] = input.gplxImageRef.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      contentsParts.push({
        inline_data: { mime_type: mime, data: base64Data },
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs || 8000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: AI_OCR_SYSTEM_PROMPT }],
          },
          contents: [{ parts: contentsParts }],
          generationConfig: {
            response_mime_type: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API phản hồi lỗi ${response.status}: ${errorText}`);
      }

      const rawJson = await response.json();
      const contentText =
        rawJson?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!contentText) {
        throw new Error('Gemini không trả về nội dung văn bản hợp lệ');
      }

      const parsedData = JSON.parse(contentText);
      // Kiểm tra xác thực chặt chẽ qua Zod schema
      const validated = AiOcrResponseSchema.parse(parsedData);
      return validated;
    } catch (err: unknown) {
      clearTimeout(timeout);
      throw err;
    }
  }
}

