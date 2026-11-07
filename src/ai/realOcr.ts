import { imageRefToDataUrl } from './images';
import { OcrError } from './errors';
import { withOcrDeadline } from './timeout';
import { tesseractLanguageUrl } from './ocrLanguages';
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

// Nhãn họ tên: "Họ và tên", "Họ tên", CCCD mới "Họ, chữ đệm và tên khai sinh", "Full name"; chịu được OCR mất dấu.
const NAME_LABEL = /(?:H[oọóò0]\s*,?\s*(?:ch[uữư]\s*[dđ][eệê]m\s*)?(?:v[aàá]\s*)?t[eêé]n(?:\s*khai\s*sinh)?|Full\s*name)\s*[:：.;]?\s*/giu;
const NOT_A_NAME = /date|birth|sinh|qu[oố]c\s*t[iị]ch|nationality|gi[oớ]i\s*t[ií]nh|sex|full\s*name|h[oọ]\s*t[eê]n/i;

function cleanName(raw: string): string {
  return raw.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '').replace(/\s+/g, ' ').trim();
}

function isName(candidate: string): boolean {
  if (!/^[\p{L}][\p{L} .'-]{2,60}$/u.test(candidate) || NOT_A_NAME.test(candidate)) return false;
  if (candidate.split(' ').length < 2) return false; // họ tên luôn có ít nhất 2 từ
  // Họ tên trên giấy tờ in HOA; cho phép vài ký tự OCR đọc thành chữ thường.
  const letters = candidate.replace(/[^\p{L}]/gu, '');
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  return upper / letters.length >= 0.8;
}

function readName(text: string): string | undefined {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].match(NAME_LABEL)) continue;
    // Giá trị nằm cùng dòng sau nhãn, hoặc ở 1–2 dòng kế tiếp (không nối nhiều dòng để tránh nuốt địa chỉ/ngày sinh).
    const candidates = [lines[i].split(NAME_LABEL).at(-1) || '', lines[i + 1] || '', lines[i + 2] || ''].map(cleanName);
    const found = candidates.find(isName);
    if (found) return found.toUpperCase();
  }
  return undefined;
}

// Ký tự OCR hay đọc nhầm với chữ số trong dãy số CCCD.
const DIGIT_LOOKALIKE: Record<string, string> = {
  O: '0', o: '0', D: '0', Q: '0', U: '0', I: '1', i: '1', l: '1', '|': '1', '!': '1', Z: '2', z: '2', S: '5', s: '5', B: '8', G: '6', b: '6', g: '9', q: '9',
};

function readIdNumber(text: string): string | undefined {
  const exact = text.match(/\b(0\d{11})\b/)?.[1];
  if (exact) return exact;
  // Dãy số bị tách bởi khoảng trắng/dấu chấm: "001 203 004 567".
  for (const match of text.matchAll(/(?<![\d])0(?:[ .]?\d){11}(?![\d])/g)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length === 12) return digits;
  }
  // Dãy 12 ký tự lẫn vài chữ cái giống số (O→0, l→1...). Bắt buộc phần lớn là chữ số thật để không đoán mò.
  for (const match of text.matchAll(/(?<![0-9A-Za-z])[0-9ODQUIilZzSsBGbgq|!]{12}(?![0-9A-Za-z])/g)) {
    if ((match[0].match(/\d/g)?.length || 0) < 9) continue;
    const digits = [...match[0]].map(char => DIGIT_LOOKALIKE[char] ?? char).join('');
    if (/^0\d{11}$/.test(digits)) return digits;
  }
  return undefined;
}

function readDob(text: string): string | undefined {
  // Chỉ lấy ngày nằm sau nhãn ngày sinh (cho phép xuống dòng), tránh nhầm ngày cấp/ngày hết hạn.
  const date = text.match(/(?:ng[aà]y\s*sinh|n[aă]m\s*sinh|date\s*of\s*birth|birth)[^\d]{0,20}?([0-3]?\d)\s*[/.\-,]\s*([01]?\d)\s*[/.\-,]\s*((?:19|20)\d{2})/i);
  if (!date) return undefined;
  const iso = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso ? iso : undefined;
}

// Hạng GPLX hợp lệ: theo Luật TTATGTĐB 2024 (từ 01/01/2025) và các hạng cũ vẫn còn hiệu lực.
const LICENSE_CLASSES = new Set([
  'A1', 'A', 'B1', 'B', 'C1', 'C', 'D1', 'D2', 'D', 'BE', 'C1E', 'CE', 'D1E', 'D2E', 'DE',
  'A2', 'A3', 'A4', 'B2', 'E', 'FB2', 'FC', 'FD', 'FE',
]);
// Nhãn "Hạng / Class" chịu được OCR đọc lệch: Hang, Hạnq, Ciass, C1ass, Clas...
const CLASS_LABEL = /(?:h[aạáàả]n[gq]|c[lI1i|]ass?)/i;
// Sau chữ cái đầu của hạng, các ký tự này gần như chắc chắn là số 1 bị đọc nhầm.
const ONE_LOOKALIKE = /[lI|!\]Ti]/g;

/** Chuẩn hóa một cụm ký tự thành hạng GPLX hợp lệ (ưu tiên khớp dài nhất), hoặc undefined. */
function normalizeLicenseClass(raw: string): string | undefined {
  const compact = raw.replace(/\s+/g, '');
  if (!compact) return undefined;
  const fixed = (compact[0] + compact.slice(1).replace(ONE_LOOKALIKE, '1')).toUpperCase();
  for (let length = Math.min(3, fixed.length); length >= 1; length--) {
    const candidate = fixed.slice(0, length);
    // Không cắt ngang một cụm dài hơn (vd "B2X" không được hiểu thành "B2").
    if (LICENSE_CLASSES.has(candidate) && !/[A-Z0-9]/.test(fixed[length] ?? '')) return candidate;
  }
  return undefined;
}

function readLicenseClass(text: string): string | undefined {
  // 1) Sau nhãn Hạng/Class: cho phép ngoặc, dấu "/", nhãn thứ hai và xuống dòng xen giữa; hạng có thể bị tách "A 1".
  // Khoảng cách tới 60 ký tự: trên thẻ, giá trị thường in ở cột riêng, Tesseract giữ nguyên hàng chục dấu cách ở giữa.
  const gap = '[^A-Za-z0-9]{0,60}';
  const labelled = new RegExp(`${CLASS_LABEL.source}${gap}(?:${CLASS_LABEL.source}${gap})?([A-F](?:\\s?[0-9A-Za-z|!\\]]){0,2})`, 'gi');
  for (const match of text.matchAll(labelled)) {
    const value = normalizeLicenseClass(match[1]);
    if (value) return value;
  }
  // 2) Không thấy nhãn (OCR đọc hỏng nhãn): chỉ nhận một dòng đứng riêng là hạng có chữ số, vd "A1", "B2".
  // Không nhận chữ cái đơn lẻ ("A", "B") vì quá dễ trùng chữ thường gặp trên giấy tờ.
  for (const line of text.split(/\r?\n/)) {
    const value = /^[A-F]\s?[0-9lI|!\]]\s?E?$/.test(line.trim()) ? normalizeLicenseClass(line.trim()) : undefined;
    if (value && /\d/.test(value)) return value;
  }
  return undefined;
}

function readMrz(text: string): { id?: string; name?: string } {
  const compact = text.replace(/ /g, '');
  // MRZ CCCD: IDVNM + 9 số cuối (số thẻ) + 1 số kiểm tra + 12 số định danh. Hỗ trợ cả dạng rút gọn IDVNM<12 số>.
  const full = compact.match(/IDVNM(\d{9})\d(0\d{11})/i);
  const id = full && full[2].endsWith(full[1]) ? full[2] : compact.match(/IDVNM(0\d{11})(?!\d)/i)?.[1];
  const name = compact.match(/^([A-Z]+<<[A-Z<]+)$/m)?.[1].replace(/<+/g, ' ').trim();
  return { id, name };
}

type Pages = OcrPage | OcrPage[] | undefined;

/** Các lượt đọc của một ảnh, lượt tin cậy cao nhất trước. */
const variants = (pages: Pages): OcrPage[] => (pages ? (Array.isArray(pages) ? [...pages] : [pages]) : []).sort((a, b) => b.confidence - a.confidence);

/**
 * Dưới mức này Tesseract gần như chỉ đọc ra ký tự rác; một dãy số "khớp mẫu" từ đó thường là số sai
 * (đã gặp khi thử: ảnh nhỏ + mờ + nhiễu cho số CCCD lệch 3 chữ số ở confidence 0.28). Thà yêu cầu chụp lại.
 */
const MIN_PAGE_CONFIDENCE = 0.4;

/**
 * Chọn giá trị một trường từ các lượt đọc của cùng một ảnh.
 * Giá trị được ≥2 lượt đọc (biến thể ảnh khác nhau) cùng cho ra được ưu tiên; nếu không có đồng thuận,
 * lấy lượt tin cậy cao nhất. Confidence đi kèm là của lượt đọc cung cấp giá trị.
 */
function pick(pages: OcrPage[], read: (text: string) => string | undefined): { value?: string; confidence?: number } {
  const votes = new Map<string, { count: number; confidence: number }>();
  for (const page of pages) {
    if (page.confidence < MIN_PAGE_CONFIDENCE) continue;
    const value = read(page.text);
    if (!value) continue;
    const vote = votes.get(value) ?? { count: 0, confidence: 0 };
    votes.set(value, { count: vote.count + 1, confidence: Math.max(vote.confidence, page.confidence) });
  }
  let chosen: { value?: string; confidence?: number; count: number } = { count: 0 };
  for (const [value, vote] of votes) {
    if (vote.count > chosen.count || (vote.count === chosen.count && vote.confidence > (chosen.confidence ?? 0))) {
      chosen = { value, confidence: vote.confidence, count: vote.count };
    }
  }
  return chosen.value ? { value: chosen.value, confidence: chosen.confidence } : {};
}

function documentConfidence(pages: OcrPage[], fields: Array<{ confidence?: number }>): number {
  const used = fields.map(field => field.confidence).filter((value): value is number => value !== undefined);
  return used.length ? Math.min(...used) : pages[0]?.confidence || 0;
}

export function parseOcrPages(front: OcrPage | OcrPage[], back?: Pages, license?: Pages): ExtractedIdCardData {
  const frontPages = variants(front), backPages = variants(back), licensePages = variants(license);
  const name = pick(frontPages, readName);
  const id = pick(frontPages, readIdNumber);
  const dob = pick(frontPages, readDob);
  const cccdFields = [name, id, dob];
  if (backPages.length) {
    for (const [field, key] of [[id, 'id'], [name, 'name']] as const) {
      if (field.value) continue;
      const mrz = pick(backPages, text => readMrz(text)[key]);
      if (mrz.value) { field.value = mrz.value; cccdFields.push(mrz); }
    }
  }
  const licenseName = pick(licensePages, readName);
  const licenseClass = pick(licensePages, readLicenseClass);
  return {
    fullName: name.value, idNumber: id.value, dob: dob.value,
    licenseName: licenseName.value, licenseClass: licenseClass.value,
    cccdConfidence: documentConfidence(frontPages, cccdFields),
    gplxConfidence: licensePages.length ? documentConfidence(licensePages, [licenseName, licenseClass]) : 0,
  };
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
    const languages: OcrWorkerInput['languages'] = ['eng', 'vie'];
    try {
      [images] = await Promise.all([
        Promise.all(refs.map(ref => imageRefToDataUrl(ref, signal))),
        // Tải trước đúng URL mà Tesseract sẽ dùng để báo lỗi mạng sớm và làm nóng HTTP cache.
        // Không truyền dữ liệu {code, data} sang worker: tesseract.js 7.0.0 dùng nhầm `data`
        // làm tên ngôn ngữ khi khởi tạo ("Failed loading language '31,139,...'").
        Promise.all(languages.map(async code => {
          const response = await fetch(tesseractLanguageUrl(code), { signal, cache: 'force-cache' });
          if (!response.ok) throw new Error('language unavailable');
        })),
      ]);
    } catch (error) {
      if (error instanceof OcrError) throw error;
      throw new OcrError('OCR_ASSETS', 'Không tải được ảnh hoặc dữ liệu nhận diện. Kiểm tra kết nối mạng và thử lại.');
    }
    if (signal.aborted) throw new OcrError('CANCELLED', 'Đã dừng xử lý giấy tờ.');
    const pages = await new Promise<OcrPage[][]>((resolve, reject) => {
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
      // Dành ~55% thời gian cho các lượt đọc bổ sung, phần còn lại cho khởi tạo và lượt đọc cuối.
      worker.postMessage({ images, languages, origin: window.location.href, budgetMs: Math.round(timeoutMs * 0.55) } satisfies OcrWorkerInput);
    });
    // Chỉ khi `npm run dev`: in văn bản OCR thô để chẩn đoán trường không đọc được. Không có trong bản build.
    if (import.meta.env.DEV) console.debug('[OCR raw]', pages.map(variants => variants.map(page => ({ confidence: page.confidence, text: page.text }))));
    let index = 1;
    return parseOcrPages(pages[0], cccdBackUrl ? pages[index++] : undefined, gplxUrl ? pages[index] : undefined);
  }, timeoutMs, parentSignal);
}
