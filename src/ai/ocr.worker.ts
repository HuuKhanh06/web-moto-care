// Worker bao ngoài cho phép terminate ngay cả khi Tesseract đang khởi tạo.
// Chỉ một Tesseract worker đọc lần lượt các ảnh, không tạo worker cho từng mặt.
import { createWorker } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerScriptUrl from 'tesseract.js/dist/worker.min.js?url';
import coreScriptUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';
import simdCoreScriptUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js?url';
import { simd } from 'wasm-feature-detect';
import { denoise, preprocess, targetScale, type PreprocessMode } from './ocrPreprocess';

export interface OcrPage { text: string; confidence: number }
export interface OcrWorkerInput {
  images: string[];
  /** Chỉ truyền mã ngôn ngữ; tesseract.js 7.0.0 lỗi khi nhận object {code, data}. */
  languages: string[];
  origin: string;
  /** Ngân sách thời gian (ms) cho các lượt đọc bổ sung; hết ngân sách thì chỉ đọc một lượt/ảnh. */
  budgetMs?: number;
}
/** Mỗi ảnh trả về một hoặc nhiều lượt đọc (biến thể tiền xử lý khác nhau). */
export type OcrWorkerResult = { pages: OcrPage[][] } | { error: true };

/** Lượt đọc đạt ngưỡng này thì không cần thử biến thể khác. */
const GOOD_CONFIDENCE = 0.85;

async function decode(image: string): Promise<ImageBitmap | null> {
  if (typeof OffscreenCanvas === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    return await createImageBitmap(await (await fetch(image)).blob());
  } catch {
    return null;
  }
}

function context(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d context unavailable');
  return ctx;
}

/** Khử nhiễu ở độ phân giải gốc (làm một lần cho mỗi ảnh). */
function denoised(bitmap: ImageBitmap): OffscreenCanvas {
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = context(canvas);
  ctx.drawImage(bitmap, 0, 0);
  const pixels = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  denoise(pixels.data, bitmap.width, bitmap.height);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

async function render(source: OffscreenCanvas, mode: PreprocessMode): Promise<Blob> {
  const scale = targetScale(source.width, source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  const ctx = context(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  preprocess(pixels.data, width, height, mode);
  ctx.putImageData(pixels, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}

async function recognize(worker: TesseractWorker, input: Blob | string): Promise<OcrPage> {
  const { data } = await worker.recognize(input, { rotateAuto: true });
  return { text: data.text, confidence: data.confidence / 100 };
}

const OUT_OF_TIME = Symbol('out-of-time');

/** Lượt đọc bổ sung có giới hạn cứng: quá hạn thì trả OUT_OF_TIME (người gọi phải terminate worker). */
function recognizeWithin(worker: TesseractWorker, input: Blob, ms: number): Promise<OcrPage | typeof OUT_OF_TIME> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    recognize(worker, input),
    new Promise<typeof OUT_OF_TIME>(resolve => { timer = setTimeout(() => resolve(OUT_OF_TIME), Math.max(0, ms)); }),
  ]).finally(() => clearTimeout(timer));
}

function prepare(bitmap: ImageBitmap | null): OffscreenCanvas | null {
  if (!bitmap) return null;
  try { return denoised(bitmap); } catch { return null; } finally { bitmap.close(); }
}

const best = (pages: OcrPage[]) => Math.max(0, ...pages.map(page => page.confidence));

self.onmessage = async (event: MessageEvent<OcrWorkerInput>) => {
  let worker: TesseractWorker | undefined;
  try {
    const deadline = Date.now() + (event.data.budgetMs ?? 30000);
    const { images } = event.data;
    // Passing a .js corePath disables Tesseract's automatic SIMD selection.
    // Select explicitly while keeping a fallback for older browsers.
    const selectedCoreUrl = await simd() ? simdCoreScriptUrl : coreScriptUrl;
    worker = await createWorker(event.data.languages, 1, {
      workerPath: new URL(workerScriptUrl, event.data.origin).href,
      corePath: new URL(selectedCoreUrl, event.data.origin).href,
      workerBlobURL: false,
      // Lưu dữ liệu ngôn ngữ vào IndexedDB để các lần sau chạy được cả khi offline.
      cacheMethod: 'write',
      errorHandler: () => { self.postMessage({ error: true } satisfies OcrWorkerResult); },
    });
    // Ảnh chụp điện thoại thường thiếu thông tin DPI; đặt cố định để Tesseract không ước lượng sai cỡ chữ.
    await worker.setParameters({ user_defined_dpi: '300', preserve_interword_spaces: '1' });
    // Lượt 1: ảnh gốc cho mọi ảnh, luôn có kết quả nền (không bao giờ kém hơn đọc một lượt).
    const pages: OcrPage[][] = [];
    for (const image of images) pages.push([await recognize(worker, image)]);
    // Lượt bổ sung chỉ cho ảnh đọc kém: ảnh tăng cường, rồi ảnh nhị phân thích ứng (bóng đổ/lóa).
    const prepared = new Map<number, OffscreenCanvas | null>();
    rounds: for (const mode of ['enhanced', 'binary'] as const) {
      for (let i = 0; i < images.length; i++) {
        if (best(pages[i]) >= GOOD_CONFIDENCE) continue;
        if (Date.now() >= deadline) break rounds;
        if (!prepared.has(i)) prepared.set(i, prepare(await decode(images[i])));
        const source = prepared.get(i);
        if (!source) continue;
        let input: Blob;
        try { input = await render(source, mode); } catch { continue; }
        const page = await recognizeWithin(worker, input, deadline - Date.now());
        if (page === OUT_OF_TIME) {
          // Tesseract không hủy được một lượt đang chạy: dừng hẳn worker và trả các kết quả đã có.
          await worker.terminate();
          worker = undefined;
          break rounds;
        }
        pages[i].push(page);
      }
    }
    self.postMessage({ pages } satisfies OcrWorkerResult);
  } catch {
    self.postMessage({ error: true } satisfies OcrWorkerResult);
  } finally {
    await worker?.terminate();
  }
};
