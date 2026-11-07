// Worker bao ngoài cho phép terminate ngay cả khi Tesseract đang khởi tạo.
// Chỉ một Tesseract worker đọc lần lượt các ảnh, không tạo worker cho từng mặt.
import { createWorker } from 'tesseract.js';
import type { Worker as TesseractWorker } from 'tesseract.js';
import workerScriptUrl from 'tesseract.js/dist/worker.min.js?url';
import coreScriptUrl from 'tesseract.js-core/tesseract-core-lstm.wasm.js?url';

export interface OcrPage { text: string; confidence: number }
export interface OcrWorkerInput {
  images: string[];
  languages: Array<{ code: string; data: Uint8Array }>;
  origin: string;
}
export type OcrWorkerResult = { pages: OcrPage[] } | { error: true };

self.onmessage = async (event: MessageEvent<OcrWorkerInput>) => {
  let worker: TesseractWorker | undefined;
  try {
    worker = await createWorker(event.data.languages, 1, {
      workerPath: new URL(workerScriptUrl, event.data.origin).href,
      corePath: new URL(coreScriptUrl, event.data.origin).href,
      workerBlobURL: false,
      cacheMethod: 'none',
      errorHandler: () => { self.postMessage({ error: true } satisfies OcrWorkerResult); },
    });
    const pages: OcrPage[] = [];
    for (const image of event.data.images) {
      const { data } = await worker.recognize(image);
      pages.push({ text: data.text, confidence: data.confidence / 100 });
    }
    self.postMessage({ pages } satisfies OcrWorkerResult);
  } catch {
    self.postMessage({ error: true } satisfies OcrWorkerResult);
  } finally {
    await worker?.terminate();
  }
};
