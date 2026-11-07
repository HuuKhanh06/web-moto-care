// src/ai/realOcr.ts
// Nhận diện ký tự quang học (OCR) thực tế từ ảnh chụp CCCD & GPLX của khách hàng

import Tesseract from 'tesseract.js';

export interface ExtractedIdCardData {
  fullName?: string;
  idNumber?: string;
  dob?: string;
  licenseClass?: string;
  rawText?: string;
}

/**
 * Trích xuất thông tin thực tế từ các tệp ảnh CCCD mặt trước, mặt sau và GPLX
 * Sử dụng Tesseract.js chạy trực tiếp trên trình duyệt kèm cơ chế Timeout an toàn
 */
export async function extractDataFromImages(
  cccdFrontUrl?: string,
  cccdBackUrl?: string,
  gplxUrl?: string,
  timeoutMs: number = 7000
): Promise<ExtractedIdCardData> {
  const result: ExtractedIdCardData = {};

  const processRecognition = async () => {
    // 1. Quét Căn cước công dân (Mặt trước)
    if (cccdFrontUrl && (cccdFrontUrl.startsWith('data:') || cccdFrontUrl.startsWith('blob:'))) {
      try {
        const ocr = await Tesseract.recognize(cccdFrontUrl, 'eng', {
          logger: () => {},
        });
        const text = ocr.data.text || '';
        result.rawText = (result.rawText || '') + '\n' + text;

        // Trích xuất số CCCD (12 chữ số bắt đầu bằng số 0)
        const idMatch = text.match(/\b(0\d{11})\b/);
        if (idMatch) {
          result.idNumber = idMatch[1];
        }

        // Trích xuất Ngày sinh (DD/MM/YYYY hoặc DD-MM-YYYY)
        const dobMatch = text.match(/\b([0-3]?[0-9][/.-][0-1]?[0-9][/.-](?:19|20)[0-9]{2})\b/);
        if (dobMatch) {
          const parts = dobMatch[1].split(/[/.-]/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            result.dob = `${year}-${month}-${day}`;
          }
        }

        // Trích xuất Họ và tên
        const nameMatch = text.match(/(?:H[oọ]\s*v[aà]\s*t[eê]n|Full\s*name|H[oọ]\s*t[eê]n)[:\s\n]+([A-ZÀ-Ỹ\s]{3,35})/i);
        if (nameMatch && nameMatch[1].trim().length >= 3) {
          result.fullName = nameMatch[1].trim();
        }
      } catch (err) {
        console.warn('[realOcr] Lỗi nhận diện CCCD mặt trước:', err);
      }
    }

    // 2. Quét Căn cước công dân (Mặt sau - MRZ)
    if (cccdBackUrl && (cccdBackUrl.startsWith('data:') || cccdBackUrl.startsWith('blob:'))) {
      try {
        const ocr = await Tesseract.recognize(cccdBackUrl, 'eng', {
          logger: () => {},
        });
        const text = ocr.data.text || '';
        result.rawText = (result.rawText || '') + '\n' + text;

        // Mã định danh MRZ: IDVNM...
        const mrzId = text.match(/IDVNM(\d{12})/i);
        if (mrzId && !result.idNumber) {
          result.idNumber = mrzId[1];
        }

        // Tên dạng MRZ: NGUYEN<<VAN<A...
        const mrzName = text.match(/([A-Z]+<+[A-Z<]+)/);
        if (mrzName && !result.fullName) {
          const clean = mrzName[1].replace(/<+/g, ' ').trim();
          if (clean.length >= 3) {
            result.fullName = clean;
          }
        }
      } catch (err) {
        console.warn('[realOcr] Lỗi nhận diện CCCD mặt sau:', err);
      }
    }

    // 3. Quét Bằng lái xe (Hạng GPLX)
    if (gplxUrl && (gplxUrl.startsWith('data:') || gplxUrl.startsWith('blob:'))) {
      try {
        const ocr = await Tesseract.recognize(gplxUrl, 'eng', {
          logger: () => {},
        });
        const text = ocr.data.text || '';
        result.rawText = (result.rawText || '') + '\n' + text;

        const classMatch = text.match(/\b(A1|A2|A3|A4|B1|B2)\b/i);
        if (classMatch) {
          result.licenseClass = classMatch[1].toUpperCase();
        }
      } catch (err) {
        console.warn('[realOcr] Lỗi nhận diện GPLX:', err);
      }
    }

    return result;
  };

  // Áp dụng Timeout an toàn để không bao giờ bị đơ giao diện
  try {
    const timeoutPromise = new Promise<ExtractedIdCardData>((resolve) => {
      setTimeout(() => resolve(result), timeoutMs);
    });
    return await Promise.race([processRecognition(), timeoutPromise]);
  } catch {
    return result;
  }
}
