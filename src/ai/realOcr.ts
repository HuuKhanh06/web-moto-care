import { imageRefToDataUrl } from './images';
import { OcrError } from './errors';
import { withOcrDeadline } from './timeout';
import type { OcrPage, OcrWorkerInput, OcrWorkerResult } from './ocr.worker';

export interface ExtractedIdCardData {
  fullName?: string;
  idNumber?: string;
  dob?: string;
  licenseClass?: string;
  licenseName?: string;
  cccdConfidence: number;
  gplxConfidence: number;
}

function readName(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const label = /(?:H[oọ]\s*(?:v[aà]\s*)?t[eê]n|Full\s*name)\s*[:：]?\s*/i;
    if (!label.test(lines[i])) continue;
    // Không để \s nuốt các dòng địa chỉ/ngày sinh vào họ tên.
    const candidate = lines[i].split(label).at(-1)?.trim() || lines[i + 1] || '';
    if (/^[\p{L}][\p{L} .'-]{2,60}$/u.test(candidate) && !/date|birth|sinh|quốc tịch|nationality/i.test(candidate)) {
      return candidate.toUpperCase();
    }
  }
  return undefined;
}

export function parseOcrPages(front: OcrPage, back?: OcrPage, license?: OcrPage): ExtractedIdCardData {
  const result: ExtractedIdCardData = { cccdConfidence: front.confidence, gplxConfidence: license?.confidence || 0 };
  result.fullName = readName(front.text);
  result.idNumber = front.text.match(/\b(0\d{11})\b/)?.[1];
  // Chỉ lấy ngày nằm sau nhãn ngày sinh, tránh nhầm ngày cấp/ngày hết hạn.
  const date = front.text.match(/(?:ng[aà]y\s*sinh|date\s*of\s*birth|birth)\s*[:：]?\s*(\d{1,2})[/.-](\d{1,2})[/.-]((?:19|20)\d{2})/i);
  if (date) {
    const iso = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
    const parsed = new Date(`${iso}T00:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso) result.dob = iso;
  }
  if (back) {
    const mrzId = back.text.match(/IDVNM(\d{12})/i)?.[1];
    if (!result.idNumber && mrzId) {
      result.idNumber = mrzId;
      result.cccdConfidence = Math.min(front.confidence, back.confidence);
    }
    const mrzName = back.text.match(/^([A-Z]+<<[A-Z<]+)$/m)?.[1];
    if (!result.fullName && mrzName) {
      result.fullName = mrzName.replace(/<+/g, ' ').trim();
      result.cccdConfidence = Math.min(result.cccdConfidence, back.confidence);
    }
  }
  if (license) {
    result.licenseName = readName(license.text);
    result.licenseClass = license.text.match(/(?:h[aạ]ng|class)\s*[:：/]?\s*(A1|A2|A3|A4|A|B1|B2|B)\b/i)?.[1].toUpperCase();
  }
  return result;
}

/** OCR thật. Không trả object dở dang khi timeout; không nuốt lỗi worker. */
export async function extractDataFromImages(
  cccdFrontUrl?: string, cccdBackUrl?: string, gplxUrl?: string,
  timeoutMs = 60000, parentSignal?: AbortSignal,
): Promise<ExtractedIdCardData> {
  if (!cccdFrontUrl) throw new OcrError('INVALID_FILE', 'Thiếu ảnh mặt trước CCCD.');
  return withOcrDeadline(async signal => {
    const refs = [cccdFrontUrl, cccdBackUrl, gplxUrl].filter((ref): ref is string => Boolean(ref));
    let images: string[];
    let languages: OcrWorkerInput['languages'];
    try {
      [images, languages] = await Promise.all([
        Promise.all(refs.map(ref => imageRefToDataUrl(ref, signal))),
        Promise.all(['eng', 'vie'].map(async code => {
          const response = await fetch(`https://cdn.jsdelivr.net/npm/@tesseract.js-data/${code}@1.0.0/4.0.0_best_int/${code}.traineddata.gz`, { signal, cache: 'force-cache' });
          if (!response.ok) throw new Error('language unavailable');
          return { code, data: new Uint8Array(await response.arrayBuffer()) };
        })),
      ]);
    } catch (error) {
      if (error instanceof OcrError) throw error;
      throw new OcrError('OCR_ASSETS', 'Không tải được ảnh hoặc dữ liệu nhận diện. Kiểm tra kết nối mạng và thử lại.');
    }
    if (signal.aborted) throw new OcrError('CANCELLED', 'Đã dừng xử lý giấy tờ.');
    const pages = await new Promise<OcrPage[]>((resolve, reject) => {
      const worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' });
      const stop = () => { worker.terminate(); signal.removeEventListener('abort', abort); };
      const abort = () => { stop(); reject(new OcrError('CANCELLED', 'Đã dừng xử lý giấy tờ.')); };
      signal.addEventListener('abort', abort, { once: true });
      worker.onerror = () => { stop(); reject(new OcrError('OCR_WORKER', 'Không khởi chạy được bộ nhận diện giấy tờ. Vui lòng thử lại.')); };
      worker.onmessage = (event: MessageEvent<OcrWorkerResult>) => {
        stop();
        if ('error' in event.data) reject(new OcrError('OCR_WORKER', 'Không đọc được ảnh giấy tờ. Vui lòng tải ảnh rõ nét và thử lại.'));
        else resolve(event.data.pages);
      };
      worker.postMessage({ images, languages, origin: window.location.href } satisfies OcrWorkerInput);
    });
    let index = 1;
    return parseOcrPages(pages[0], cccdBackUrl ? pages[index++] : undefined, gplxUrl ? pages[index] : undefined);
  }, timeoutMs, parentSignal);
}
