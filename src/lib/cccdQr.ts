// src/lib/cccdQr.ts
// Module chuyên trách giải mã mã QR trên Căn cước công dân (CCCD) gắn chip Việt Nam
// Chạy hoàn toàn trên Client bằng jsQR và BarcodeDetector (nếu có), KHÔNG dùng AI

import jsQR from 'jsqr';

export interface ExtractedFieldItem {
  value: string | null;
  confidence: number | null;
  source: 'QR' | 'AI' | 'MANUAL';
}

export interface ObservedFieldStructure {
  index: number;
  length: number;
  type: '12_DIGITS' | '9_DIGITS' | '8_DIGITS' | 'DIGITS' | 'GENDER' | 'TEXT' | 'EMPTY';
}

export interface CccdCrossCheckResult {
  passed: boolean;
  reason?: 'MATCH' | 'GENDER_MISMATCH' | 'YEAR_MISMATCH' | 'INVALID_CCCD_FORMAT' | 'INVALID_DOB_FORMAT' | 'INVALID_GENDER_FORMAT';
  observedStructure?: ObservedFieldStructure[];
}

export interface ParsedCccdData {
  id_number: ExtractedFieldItem;
  old_id_number?: ExtractedFieldItem;
  full_name: ExtractedFieldItem;
  date_of_birth: ExtractedFieldItem;
  gender: ExtractedFieldItem;
  address: ExtractedFieldItem;
  issue_date: ExtractedFieldItem;
  raw_qr?: string;
  is_consistent?: boolean;
  cross_check_reason?: string;
  observed_structure?: ObservedFieldStructure[];
}

export interface DecodeQrResult {
  success: boolean;
  rawString?: string;
  maskedRawString?: string;
  data?: ParsedCccdData;
  error?: string;
  crossCheck?: CccdCrossCheckResult;
}

/**
 * Che số CCCD 12 số hoặc CMND 9 số dạng 079***8888
 */
export function maskCccd(id: string): string {
  if (!id) return '';
  const trimmed = id.trim();
  if (trimmed.length === 12) {
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-4)}`;
  }
  if (trimmed.length === 9) {
    return `${trimmed.slice(0, 3)}***${trimmed.slice(-3)}`;
  }
  if (trimmed.length > 4) {
    return `${trimmed.slice(0, 2)}***${trimmed.slice(-2)}`;
  }
  return '***';
}

/**
 * Che họ và tên để đảm bảo tính riêng tư (VD: NGUYỄN VĂN AN -> NGUYỄN *** AN)
 */
export function maskName(name: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return `${name.slice(0, 1)}***`;
  if (parts.length === 2) return `${parts[0]} ***`;
  return `${parts[0]} *** ${parts[parts.length - 1]}`;
}

/**
 * Che địa chỉ để bảo mật
 */
export function maskAddress(address: string): string {
  if (!address) return '';
  const parts = address.split(',');
  if (parts.length <= 2) return `${address.slice(0, 5)}...`;
  return `${parts[0].slice(0, 6)}... , ${parts[parts.length - 1].trim()}`;
}

/**
 * Che chuỗi QR thô để in ra debug an toàn theo tiêu chuẩn bảo mật P0
 */
export function maskRawQrString(raw: string): string {
  if (!raw) return '';
  const tokens = raw.split('|');
  if (tokens.length >= 6) {
    // 7 trường: [CCCD, CMND_CŨ, HỌ_TÊN, NGÀY_SINH, GIỚI_TÍNH, ĐỊA_CHỈ, NGÀY_CẤP]
    // Hoặc 6 trường nếu không có CMND cũ
    const isSeven = tokens.length >= 7;
    const cccdIdx = 0;
    const oldIdIdx = isSeven ? 1 : -1;
    const nameIdx = isSeven ? 2 : 1;
    const addrIdx = isSeven ? 5 : 4;

    const maskedTokens = [...tokens];
    maskedTokens[cccdIdx] = maskCccd(tokens[cccdIdx]);
    if (oldIdIdx !== -1 && tokens[oldIdIdx]) {
      maskedTokens[oldIdIdx] = maskCccd(tokens[oldIdIdx]);
    }
    maskedTokens[nameIdx] = maskName(tokens[nameIdx]);
    maskedTokens[addrIdx] = maskAddress(tokens[addrIdx]);

    return maskedTokens.join('|');
  }

  // Fallback che các dãy 9-12 số
  return raw.replace(/\b\d{9,12}\b/g, (match) => maskCccd(match));
}

/**
 * Chuyển chuỗi ngày ddMMyyyy sang ISO yyyy-MM-dd
 */
export function parseDateDdMmYyyyToIso(dateStr: string): string | null {
  if (!dateStr || dateStr.length !== 8 || !/^\d{8}$/.test(dateStr)) {
    return null;
  }
  const day = parseInt(dateStr.slice(0, 2), 10);
  const month = parseInt(dateStr.slice(2, 4), 10);
  const year = parseInt(dateStr.slice(4, 8), 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) {
    return null;
  }

  // Kiểm tra ngày hợp lệ theo tháng
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return null;
  }

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Kiểm tra chéo tính nhất quán giữa Số CCCD (12 số) với Năm sinh và Giới tính
 * Theo quy chuẩn định danh cá nhân Việt Nam (Bộ Công An):
 * - Ký tự 4 (cccd[3]): Giới tính & Thế kỷ
 *   + Thế kỷ 20 (1900-1999): Nam = 0, Nữ = 1
 *   + Thế kỷ 21 (2000-2099): Nam = 2, Nữ = 3
 *   + Thế kỷ 22 (2100-2199): Nam = 4, Nữ = 5
 * - Ký tự 5 và 6 (cccd[4..5]): 2 chữ số cuối của năm sinh
 * Nếu không khớp: coi là đọc sai (QR_INCONSISTENT), KHÔNG tự đổi thứ tự trường theo cách đoán.
 */
export function verifyCccdConsistency(
  cccdId: string | null | undefined,
  dobIso: string | null | undefined,
  gender: string | null | undefined,
  rawParts?: string[]
): CccdCrossCheckResult {
  // Trích xuất cấu trúc quan sát được để báo cáo an toàn (tuyệt đối không để lộ PII)
  const observedStructure: ObservedFieldStructure[] = (rawParts || []).map((part, idx) => {
    const trimmed = part.trim();
    let type: ObservedFieldStructure['type'] = 'TEXT';
    if (trimmed.length === 0) {
      type = 'EMPTY';
    } else if (/^\d{12}$/.test(trimmed)) {
      type = '12_DIGITS';
    } else if (/^\d{9}$/.test(trimmed)) {
      type = '9_DIGITS';
    } else if (/^\d{8}$/.test(trimmed)) {
      type = '8_DIGITS';
    } else if (/^\d+$/.test(trimmed)) {
      type = 'DIGITS';
    } else if (/^(nam|nữ|nu|male|female|m|f)$/i.test(trimmed)) {
      type = 'GENDER';
    }
    return {
      index: idx,
      length: trimmed.length,
      type,
    };
  });

  if (!cccdId || !/^\d{12}$/.test(cccdId)) {
    return { passed: false, reason: 'INVALID_CCCD_FORMAT', observedStructure };
  }

  if (!dobIso || !/^\d{4}-\d{2}-\d{2}$/.test(dobIso)) {
    return { passed: false, reason: 'INVALID_DOB_FORMAT', observedStructure };
  }

  if (!gender || (gender !== 'Nam' && gender !== 'Nữ')) {
    return { passed: false, reason: 'INVALID_GENDER_FORMAT', observedStructure };
  }

  const birthYear = parseInt(dobIso.slice(0, 4), 10);
  const birthYearLast2 = dobIso.slice(2, 4);
  const cccdYearDigits = cccdId.slice(4, 6);

  // 1. Kiểm tra 2 số cuối của năm sinh (vị trí ký tự thứ 5 và 6 của CCCD)
  if (cccdYearDigits !== birthYearLast2) {
    return { passed: false, reason: 'YEAR_MISMATCH', observedStructure };
  }

  // 2. Kiểm tra thế kỷ và giới tính (vị trí ký tự thứ 4 của CCCD)
  const genderDigit = cccdId[3];
  let expectedGenderDigit: string | null = null;

  if (birthYear >= 1900 && birthYear <= 1999) {
    expectedGenderDigit = gender === 'Nam' ? '0' : '1';
  } else if (birthYear >= 2000 && birthYear <= 2099) {
    expectedGenderDigit = gender === 'Nam' ? '2' : '3';
  } else if (birthYear >= 2100 && birthYear <= 2199) {
    expectedGenderDigit = gender === 'Nam' ? '4' : '5';
  } else if (birthYear >= 2200 && birthYear <= 2299) {
    expectedGenderDigit = gender === 'Nam' ? '6' : '7';
  } else if (birthYear >= 2300 && birthYear <= 2399) {
    expectedGenderDigit = gender === 'Nam' ? '8' : '9';
  }

  if (!expectedGenderDigit || genderDigit !== expectedGenderDigit) {
    return { passed: false, reason: 'GENDER_MISMATCH', observedStructure };
  }

  return { passed: true, reason: 'MATCH', observedStructure };
}

/**
 * Phân tích chuỗi QR thô của CCCD Việt Nam thành các trường có cấu trúc
 * Định dạng chuẩn Bộ Công An:
 * 7 trường: <Số CCCD 12 số>|<Số CMND cũ>|<Họ và tên>|<Ngày sinh ddMMyyyy>|<Giới tính>|<Địa chỉ>|<Ngày cấp ddMMyyyy>
 * Hoặc 6 trường (nếu không có trường CMND cũ ngăn cách)
 */
export function parseCccdQrString(rawString: string): ParsedCccdData {
  const parts = rawString.trim().split('|');

  let idNumRaw = '';
  let oldIdRaw = '';
  let nameRaw = '';
  let dobRaw = '';
  let genderRaw = '';
  let addrRaw = '';
  let issueDateRaw = '';

  if (parts.length >= 7) {
    // Chuẩn 7 trường phổ biến nhất
    idNumRaw = parts[0]?.trim() || '';
    oldIdRaw = parts[1]?.trim() || '';
    nameRaw = parts[2]?.trim() || '';
    dobRaw = parts[3]?.trim() || '';
    genderRaw = parts[4]?.trim() || '';
    addrRaw = parts[5]?.trim() || '';
    issueDateRaw = parts[6]?.trim() || '';
  } else if (parts.length === 6) {
    // Chuẩn 6 trường
    idNumRaw = parts[0]?.trim() || '';
    nameRaw = parts[1]?.trim() || '';
    dobRaw = parts[2]?.trim() || '';
    genderRaw = parts[3]?.trim() || '';
    addrRaw = parts[4]?.trim() || '';
    issueDateRaw = parts[5]?.trim() || '';
  } else {
    // Định dạng không khớp
    return {
      id_number: { value: null, confidence: null, source: 'QR' },
      full_name: { value: null, confidence: null, source: 'QR' },
      date_of_birth: { value: null, confidence: null, source: 'QR' },
      gender: { value: null, confidence: null, source: 'QR' },
      address: { value: null, confidence: null, source: 'QR' },
      issue_date: { value: null, confidence: null, source: 'QR' },
      raw_qr: rawString,
    };
  }

  // 1. Kiểm tra số CCCD (12 chữ số)
  const isIdValid = /^\d{12}$/.test(idNumRaw);
  const idField: ExtractedFieldItem = isIdValid
    ? { value: idNumRaw, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 2. Họ và tên
  const isNameValid = nameRaw.length >= 2;
  const nameField: ExtractedFieldItem = isNameValid
    ? { value: nameRaw, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 3. Ngày sinh (đổi sang ISO yyyy-MM-dd)
  const isoDob = parseDateDdMmYyyyToIso(dobRaw);
  const dobField: ExtractedFieldItem = isoDob
    ? { value: isoDob, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 4. Giới tính (Nam / Nữ)
  let normalizedGender: string | null = null;
  const lowerGender = genderRaw.toLowerCase();
  if (lowerGender === 'nam' || lowerGender === 'male' || lowerGender === 'm') {
    normalizedGender = 'Nam';
  } else if (lowerGender === 'nữ' || lowerGender === 'nu' || lowerGender === 'female' || lowerGender === 'f') {
    normalizedGender = 'Nữ';
  }
  const genderField: ExtractedFieldItem = normalizedGender
    ? { value: normalizedGender, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 5. Địa chỉ
  const isAddrValid = addrRaw.length >= 3;
  const addrField: ExtractedFieldItem = isAddrValid
    ? { value: addrRaw, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 6. Ngày cấp
  const isoIssueDate = parseDateDdMmYyyyToIso(issueDateRaw);
  const issueDateField: ExtractedFieldItem = isoIssueDate
    ? { value: isoIssueDate, confidence: 1.0, source: 'QR' }
    : { value: null, confidence: null, source: 'QR' };

  // 7. Kiểm tra chéo tính nhất quán bảo vệ (Cơ chế bảo vệ quy chuẩn CCCD Việt Nam)
  const crossCheck = verifyCccdConsistency(
    idField.value,
    dobField.value,
    genderField.value,
    parts
  );

  // Nếu kiểm tra chéo không khớp: coi là đọc sai (QR_INCONSISTENT), KHÔNG tự đổi thứ tự trường theo cách đoán
  if (!crossCheck.passed) {
    return {
      id_number: { value: null, confidence: null, source: 'QR' },
      full_name: { value: null, confidence: null, source: 'QR' },
      date_of_birth: { value: null, confidence: null, source: 'QR' },
      gender: { value: null, confidence: null, source: 'QR' },
      address: { value: null, confidence: null, source: 'QR' },
      issue_date: { value: null, confidence: null, source: 'QR' },
      raw_qr: rawString,
      is_consistent: false,
      cross_check_reason: crossCheck.reason,
      observed_structure: crossCheck.observedStructure,
    };
  }

  const result: ParsedCccdData = {
    id_number: idField,
    full_name: nameField,
    date_of_birth: dobField,
    gender: genderField,
    address: addrField,
    issue_date: issueDateField,
    raw_qr: rawString,
    is_consistent: true,
    cross_check_reason: 'MATCH',
    observed_structure: crossCheck.observedStructure,
  };

  if (oldIdRaw) {
    const isOldIdValid = /^\d{9}$/.test(oldIdRaw);
    result.old_id_number = isOldIdValid
      ? { value: oldIdRaw, confidence: 1.0, source: 'QR' }
      : { value: null, confidence: null, source: 'QR' };
  }

  return result;
}

/**
 * Đọc ảnh từ Blob, File hoặc string data/blob URL vào Canvas
 */
function loadImageElement(source: Blob | File | string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (typeof source === 'string' && (source.startsWith('http://') || source.startsWith('https://'))) {
      img.crossOrigin = 'anonymous';
    }

    let objectUrl: string | null = null;
    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      resolve(img);
    };

    img.onerror = (e) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Không thể tải tệp ảnh để đọc QR: ' + String(e)));
    };
  });
}

/**
 * Tiền xử lý Canvas và thử giải mã QR với nhiều phương pháp:
 * - Native BarcodeDetector (nếu có)
 * - jsQR với ảnh gốc
 * - jsQR với thang xám (Grayscale) & tăng tương phản (High contrast)
 * - jsQR xoay ảnh 0°, 90°, 180°, 270°
 * - jsQR cắt vùng góc phải trên cùng (nơi đặt QR của CCCD)
 * - jsQR đa kích thước (thu nhỏ/phóng to)
 */
async function scanCanvasForQr(sourceCanvas: HTMLCanvasElement): Promise<string | null> {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (width === 0 || height === 0) return null;

  // 1. Thử BarcodeDetector native (siêu nhanh trong Chromium / Edge / Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const barcodes = await detector.detect(sourceCanvas);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch {
      // BarcodeDetector không hỗ trợ hoặc lỗi, tiếp tục fallback jsQR
    }
  }

  const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  // 2. Thử jsQR trên toàn bộ ảnh gốc
  const originalImageData = ctx.getImageData(0, 0, width, height);
  const codeDirect = jsQR(originalImageData.data, width, height, {
    inversionAttempts: 'attemptBoth',
  });
  if (codeDirect && codeDirect.data) {
    return codeDirect.data;
  }

  // 3. Thử cắt vùng góc phải trên cùng (Top-Right quadrant) - Vị trí tiêu chuẩn của QR trên thẻ CCCD
  // Vùng: x từ 50% đến 100%, y từ 0% đến 60%
  const cropX = Math.floor(width * 0.48);
  const cropY = 0;
  const cropW = width - cropX;
  const cropH = Math.floor(height * 0.65);

  if (cropW > 50 && cropH > 50) {
    const croppedData = ctx.getImageData(cropX, cropY, cropW, cropH);
    const codeCropped = jsQR(croppedData.data, cropW, cropH, {
      inversionAttempts: 'attemptBoth',
    });
    if (codeCropped && codeCropped.data) {
      return codeCropped.data;
    }
  }

  // 4. Thử xoay ảnh (90, 180, 270 độ) và quét
  const rotations = [90, 180, 270];
  for (const angle of rotations) {
    const rotCanvas = document.createElement('canvas');
    const isSideways = angle === 90 || angle === 270;
    rotCanvas.width = isSideways ? height : width;
    rotCanvas.height = isSideways ? width : height;
    const rotCtx = rotCanvas.getContext('2d');
    if (!rotCtx) continue;

    rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
    rotCtx.rotate((angle * Math.PI) / 180);
    rotCtx.drawImage(sourceCanvas, -width / 2, -height / 2);

    const rotData = rotCtx.getImageData(0, 0, rotCanvas.width, rotCanvas.height);
    const codeRot = jsQR(rotData.data, rotCanvas.width, rotCanvas.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (codeRot && codeRot.data) {
      return codeRot.data;
    }
  }

  // 5. Thử tiền xử lý thang xám + tăng độ tương phản (Binarization filter)
  const enhancedData = ctx.createImageData(width, height);
  const src = originalImageData.data;
  const dst = enhancedData.data;

  // Tính trung bình độ sáng
  let sumLum = 0;
  for (let i = 0; i < src.length; i += 4) {
    sumLum += (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
  }
  const avgLum = sumLum / (src.length / 4);

  // Tăng tương phản mạnh quanh ngưỡng trung bình
  for (let i = 0; i < src.length; i += 4) {
    const lum = (src[i] * 299 + src[i + 1] * 587 + src[i + 2] * 114) / 1000;
    const v = lum > avgLum * 0.95 ? 255 : 0;
    dst[i] = v;
    dst[i + 1] = v;
    dst[i + 2] = v;
    dst[i + 3] = 255;
  }

  const codeEnhanced = jsQR(dst, width, height, { inversionAttempts: 'attemptBoth' });
  if (codeEnhanced && codeEnhanced.data) {
    return codeEnhanced.data;
  }

  // 6. Thử thu nhỏ nếu ảnh kích thước quá lớn (> 1200px)
  if (width > 1200 || height > 1200) {
    const scale = 800 / Math.max(width, height);
    const scaledCanvas = document.createElement('canvas');
    scaledCanvas.width = Math.floor(width * scale);
    scaledCanvas.height = Math.floor(height * scale);
    const sCtx = scaledCanvas.getContext('2d');
    if (sCtx) {
      sCtx.drawImage(sourceCanvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
      const sData = sCtx.getImageData(0, 0, scaledCanvas.width, scaledCanvas.height);
      const codeScaled = jsQR(sData.data, scaledCanvas.width, scaledCanvas.height, {
        inversionAttempts: 'attemptBoth',
      });
      if (codeScaled && codeScaled.data) {
        return codeScaled.data;
      }
    }
  }

  return null;
}

/**
 * HÀM THUẦN CHÍNH: decodeAndParse
 * Giải mã ảnh CCCD và trả về dữ liệu chuẩn
 */
export async function decodeAndParse(
  imageSource: Blob | File | string
): Promise<DecodeQrResult> {
  try {
    if (typeof window === 'undefined') {
      return { success: false, error: 'Chỉ hỗ trợ môi trường trình duyệt/canvas' };
    }

    const img = await loadImageElement(imageSource);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, error: 'Không thể khởi tạo 2D context' };
    }
    ctx.drawImage(img, 0, 0);

    const rawQr = await scanCanvasForQr(canvas);
    if (!rawQr) {
      return {
        success: false,
        error: 'Không tìm thấy mã QR trên ảnh. Vui lòng chụp rõ góc phải của CCCD.',
      };
    }

    const masked = maskRawQrString(rawQr);
    // In debug an toàn KHÔNG để lộ PII
    console.info('[cccdQr] Đã đọc QR CCCD thành công:', masked);

    const parsedData = parseCccdQrString(rawQr);

    if (parsedData.is_consistent === false) {
      return {
        success: false,
        rawString: rawQr,
        maskedRawString: masked,
        data: parsedData,
        error: `QR_INCONSISTENT: Số CCCD không khớp giới tính hoặc năm sinh đọc được (${parsedData.cross_check_reason})`,
        crossCheck: {
          passed: false,
          reason: parsedData.cross_check_reason as CccdCrossCheckResult['reason'],
          observedStructure: parsedData.observed_structure,
        },
      };
    }

    return {
      success: true,
      rawString: rawQr,
      maskedRawString: masked,
      data: parsedData,
      crossCheck: {
        passed: true,
        reason: 'MATCH',
        observedStructure: parsedData.observed_structure,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[cccdQr] Lỗi khi giải mã ảnh CCCD:', msg);
    return {
      success: false,
      error: msg,
    };
  }
}

/**
 * Quét cả 2 ảnh CCCD (mặt trước và mặt sau) và trả về kết quả hợp lệ đầu tiên
 */
export async function decodeCccdFrontOrBack(
  frontSource?: Blob | File | string | null,
  backSource?: Blob | File | string | null
): Promise<DecodeQrResult> {
  if (frontSource) {
    const resFront = await decodeAndParse(frontSource);
    if (resFront.success && resFront.data?.id_number.value) {
      return resFront;
    }
  }

  if (backSource) {
    const resBack = await decodeAndParse(backSource);
    if (resBack.success && resBack.data?.id_number.value) {
      return resBack;
    }
  }

  return {
    success: false,
    error: 'Không tìm thấy mã QR hợp lệ ở cả mặt trước và mặt sau CCCD',
  };
}
