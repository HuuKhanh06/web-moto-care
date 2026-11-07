// Tiền xử lý ảnh giấy tờ trước khi đưa vào Tesseract (hàm thuần, chạy được trong worker và unit test).
// Mục tiêu: chữ đủ lớn (~30px chiều cao), nền sáng đều, nét chữ rõ cho ảnh chụp mờ/tối/lóa.

export interface GrayImage { data: Uint8ClampedArray; width: number; height: number }

const TARGET_LONG_SIDE = 2000;
const MAX_LONG_SIDE = 2600;
const MAX_UPSCALE = 2.5;

/** Tỷ lệ phóng: ảnh nhỏ được phóng to (chữ nhỏ là nguyên nhân OCR sai phổ biến nhất), ảnh quá lớn được thu lại cho nhanh. */
export function targetScale(width: number, height: number): number {
  const longSide = Math.max(width, height);
  if (!longSide) return 1;
  if (longSide < TARGET_LONG_SIDE * 0.8) return Math.min(MAX_UPSCALE, TARGET_LONG_SIDE / longSide);
  if (longSide > MAX_LONG_SIDE) return MAX_LONG_SIDE / longSide;
  return 1;
}

export function toGray(rgba: Uint8ClampedArray, width: number, height: number): GrayImage {
  const data = new Uint8ClampedArray(width * height);
  for (let i = 0, p = 0; p < data.length; i += 4, p++) {
    data[p] = (rgba[i] * 299 + rgba[i + 1] * 587 + rgba[i + 2] * 114) / 1000;
  }
  return { data, width, height };
}

/** Kéo giãn tương phản theo phân vị 1%–99% (bỏ qua điểm lóa/đen tuyệt đối). */
export function stretchContrast(img: GrayImage): GrayImage {
  const hist = new Uint32Array(256);
  for (const v of img.data) hist[v]++;
  const total = img.data.length;
  let low = 0, high = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { low = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { high = v; break; } }
  if (high - low < 10) return img; // ảnh gần như một màu: không khuếch đại nhiễu
  const range = high - low;
  const data = new Uint8ClampedArray(img.data.length);
  for (let p = 0; p < data.length; p++) data[p] = ((img.data[p] - low) * 255) / range;
  return { data, width: img.width, height: img.height };
}

/**
 * Lọc trung vị 3x3: xóa nhiễu hạt (ảnh chụp thiếu sáng, ISO cao) nhưng giữ cạnh nét chữ.
 * Phải chạy ở độ phân giải gốc, TRƯỚC khi phóng to/làm nét, nếu không nhiễu bị khuếch đại thành
 * hàng nghìn đốm khiến Tesseract vừa chậm (hàng chục giây) vừa đọc sai.
 */
export function median3(img: GrayImage): GrayImage {
  const { width: w, height: h, data: src } = img;
  const data = new Uint8ClampedArray(src);
  const win = new Uint8Array(9);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) win[k++] = src[(y + dy) * w + x + dx];
      // Sắp xếp chèn 9 phần tử: nhanh hơn Array.sort cho mảng cố định nhỏ.
      for (let i = 1; i < 9; i++) { const v = win[i]; let j = i - 1; while (j >= 0 && win[j] > v) { win[j + 1] = win[j]; j--; } win[j + 1] = v; }
      data[y * w + x] = win[4];
    }
  }
  return { data, width: w, height: h };
}

/** Làm nét nhẹ (unsharp 3x3) cho ảnh hơi mờ do rung tay/lấy nét chưa chuẩn. */
export function sharpen(img: GrayImage, amount = 0.4): GrayImage {
  const { width: w, height: h, data: src } = img;
  const data = new Uint8ClampedArray(src);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const laplacian = 4 * src[p] - src[p - 1] - src[p + 1] - src[p - w] - src[p + w];
      data[p] = src[p] + amount * laplacian;
    }
  }
  return { data, width: w, height: h };
}

/**
 * Nhị phân hóa thích ứng (trung bình cục bộ qua ảnh tích phân).
 * Xử lý được ảnh có bóng đổ, ánh sáng lệch một bên hoặc nền giấy tờ có hoa văn nhạt.
 */
export function adaptiveThreshold(img: GrayImage, offset = 12): GrayImage {
  const { width: w, height: h, data: src } = img;
  const radius = Math.max(7, Math.round(Math.min(w, h) / 30));
  const integral = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      rowSum += src[y * w + x];
      integral[(y + 1) * (w + 1) + x + 1] = integral[y * (w + 1) + x + 1] + rowSum;
    }
  }
  const data = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
      const sum = integral[y1 * (w + 1) + x1] - integral[y0 * (w + 1) + x1] - integral[y1 * (w + 1) + x0] + integral[y0 * (w + 1) + x0];
      const mean = sum / ((x1 - x0) * (y1 - y0));
      data[y * w + x] = src[y * w + x] < mean - offset ? 0 : 255;
    }
  }
  return { data, width: w, height: h };
}

export function writeGray(img: GrayImage, rgba: Uint8ClampedArray): void {
  for (let i = 0, p = 0; p < img.data.length; i += 4, p++) {
    rgba[i] = rgba[i + 1] = rgba[i + 2] = img.data[p];
    rgba[i + 3] = 255;
  }
}

export type PreprocessMode = 'enhanced' | 'binary';

/**
 * Ước lượng nhiễu hạt: trung vị |Laplacian| trên lưới mẫu. Vùng nền phẳng chiếm đa số ảnh giấy tờ,
 * nên ảnh sạch (kể cả nhiễu nén JPEG) cho giá trị nhỏ, ảnh nhiễu hạt cho giá trị lớn.
 */
export function estimateNoise(img: GrayImage): number {
  const { width: w, height: h, data } = img;
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 20000)));
  const samples: number[] = [];
  for (let y = 1; y < h - 1; y += step) {
    for (let x = 1; x < w - 1; x += step) {
      const p = y * w + x;
      samples.push(Math.abs(4 * data[p] - data[p - 1] - data[p + 1] - data[p - w] - data[p + w]));
    }
  }
  if (!samples.length) return 0;
  samples.sort((a, b) => a - b);
  return samples[samples.length >> 1];
}

/** Ngưỡng nhiễu để bật lọc trung vị; dưới ngưỡng thì giữ nguyên nét chữ mảnh. */
export const NOISE_THRESHOLD = 12;

/** Giai đoạn 1 (độ phân giải gốc): thang xám + khử nhiễu nếu ảnh có nhiễu hạt. */
export function denoise(rgba: Uint8ClampedArray, width: number, height: number): void {
  const gray = toGray(rgba, width, height);
  writeGray(estimateNoise(gray) > NOISE_THRESHOLD ? median3(gray) : gray, rgba);
}

/** Giai đoạn 2 (sau khi phóng to): tăng tương phản, làm nét nhẹ, tùy chọn nhị phân hóa. */
export function preprocess(rgba: Uint8ClampedArray, width: number, height: number, mode: PreprocessMode): void {
  const gray = stretchContrast(toGray(rgba, width, height));
  // Ảnh nhị phân không cần làm nét: làm nét trước ngưỡng chỉ tạo thêm viền nhiễu.
  writeGray(mode === 'binary' ? adaptiveThreshold(gray) : sharpen(gray), rgba);
}
