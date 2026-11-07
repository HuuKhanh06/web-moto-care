import { describe, expect, it } from 'vitest';
import { parseOcrPages } from '@/ai/realOcr';
import { adaptiveThreshold, stretchContrast, targetScale, type GrayImage } from '@/ai/ocrPreprocess';

describe('OCR parsing chịu lỗi cho ảnh chất lượng kém', () => {
  it('sửa ký tự giống số trong số CCCD khi phần lớn là chữ số thật', () => {
    expect(parseOcrPages({ text: 'Số / No.: 0012O30O4567', confidence: 0.6 }).idNumber).toBe('001203004567');
    expect(parseOcrPages({ text: 'So: 0l2345678901', confidence: 0.6 }).idNumber).toBe('012345678901');
  });
  it('ghép số CCCD bị tách bởi khoảng trắng', () => {
    expect(parseOcrPages({ text: 'Số: 001 203 004 567', confidence: 0.7 }).idNumber).toBe('001203004567');
  });
  it('không đoán số CCCD từ chuỗi chủ yếu là chữ', () => {
    expect(parseOcrPages({ text: 'SOLOISOBOOGO', confidence: 0.7 }).idNumber).toBeUndefined();
  });
  it('đọc nhãn CCCD mẫu mới và họ tên ở dòng dưới', () => {
    const parsed = parseOcrPages({ text: 'Họ, chữ đệm và tên khai sinh / Full name:\nNGUYỄN VĂN AN\nNgày, tháng, năm sinh / Date of birth:\n15/04/1998', confidence: 0.7 });
    expect(parsed).toMatchObject({ fullName: 'NGUYỄN VĂN AN', dob: '1998-04-15' });
  });
  it('bỏ ký tự nhiễu quanh họ tên và chấp nhận ngày có khoảng trắng', () => {
    const parsed = parseOcrPages({ text: 'Ho va ten: | TRAN THI BINH ,\nNgay sinh: 03 / 07 / 2001', confidence: 0.6 });
    expect(parsed).toMatchObject({ fullName: 'TRAN THI BINH', dob: '2001-07-03' });
  });
  it('không lấy dòng chữ thường hoặc một từ làm họ tên', () => {
    expect(parseOcrPages({ text: 'Họ và tên:\nNam\nQuốc tịch: Việt Nam', confidence: 0.6 }).fullName).toBeUndefined();
    expect(parseOcrPages({ text: 'Full name: cong hoa xa hoi', confidence: 0.6 }).fullName).toBeUndefined();
  });
  const licenseClass = (text: string) => parseOcrPages({ text: 'x', confidence: 0.9 }, undefined, { text, confidence: 0.7 }).licenseClass;
  it('sửa hạng GPLX bị đọc thành Al / BI / AT / A]', () => {
    expect(licenseClass('Hạng / Class: Al')).toBe('A1');
    expect(licenseClass('Class: BI')).toBe('B1');
    expect(licenseClass('Hạng/Class: AT')).toBe('A1');
    expect(licenseClass('Hạng/Class: A]')).toBe('A1');
  });
  it('đọc hạng GPLX khi bị tách, có ngoặc, xuống dòng hoặc nhãn đọc lệch', () => {
    expect(licenseClass('Hạng / Class: A 1')).toBe('A1');
    expect(licenseClass('Hạng (Class): B2')).toBe('B2');
    expect(licenseClass('Hạng / Class:\nA2')).toBe('A2');
    expect(licenseClass('Hanq / Ciass: A1')).toBe('A1');
    expect(licenseClass('C1ass A1')).toBe('A1');
    // Giá trị in ở cột riêng: Tesseract giữ nguyên khoảng trắng dài giữa nhãn và giá trị.
    expect(licenseClass(`Hạng / Class:${' '.repeat(25)}A1`)).toBe('A1');
    expect(licenseClass('Hạng / Class:\n\nNgày cấp / Date: 01/01/2020')).toBeUndefined();
  });
  it('nhận đủ hạng GPLX mới (Luật 2024) và hạng cũ', () => {
    expect(licenseClass('Hạng / Class: A')).toBe('A');
    expect(licenseClass('Hạng / Class: C1E')).toBe('C1E');
    expect(licenseClass('Hạng / Class: BE')).toBe('BE');
    expect(licenseClass('Hạng / Class: FC')).toBe('FC');
    expect(licenseClass('Class: C')).toBe('C');
  });
  it('dùng dòng đứng riêng khi nhãn bị đọc hỏng, nhưng không đoán từ chữ cái đơn lẻ', () => {
    expect(licenseClass('GIAY PHEP LAI XE\nH@#g / C#@ss\nA1\nNgay cap')).toBe('A1');
    expect(licenseClass('GIAY PHEP LAI XE\nA\nB')).toBeUndefined();
    expect(licenseClass('Hạng / Class: B2X')).toBeUndefined();
    expect(licenseClass('Hạng xe được điều khiển')).toBeUndefined();
  });
  it('gộp trường từ nhiều lượt đọc và dùng confidence của lượt cung cấp trường', () => {
    const parsed = parseOcrPages([
      { text: 'Họ và tên: LE VAN KHAC\n001203004567', confidence: 0.9 },
      { text: 'Ngày sinh: 01/02/1990', confidence: 0.7 },
    ]);
    expect(parsed).toMatchObject({ fullName: 'LE VAN KHAC', idNumber: '001203004567', dob: '1990-02-01', cccdConfidence: 0.7 });
  });
  it('đọc số định danh từ MRZ CCCD chuẩn (số thẻ + số kiểm tra + 12 số)', () => {
    const parsed = parseOcrPages({ text: '', confidence: 0.5 }, { text: 'IDVNM2030045675001203004567<<1\nNGUYEN<<VAN<AN', confidence: 0.8 });
    expect(parsed).toMatchObject({ idNumber: '001203004567', fullName: 'NGUYEN VAN AN' });
  });
});

describe('Tiền xử lý ảnh', () => {
  const image = (values: number[], width: number): GrayImage => ({ data: Uint8ClampedArray.from(values), width, height: values.length / width });
  it('phóng to ảnh nhỏ, thu nhỏ ảnh quá lớn', () => {
    expect(targetScale(800, 500)).toBe(2.5);
    expect(targetScale(1280, 800)).toBeCloseTo(1.5625);
    expect(targetScale(2000, 1200)).toBe(1);
    expect(targetScale(5200, 3000)).toBe(0.5);
  });
  it('kéo giãn tương phản ảnh tối/nhạt', () => {
    const out = stretchContrast(image([100, 110, 120, 130, 140, 150], 6));
    expect(out.data[0]).toBe(0); expect(out.data[5]).toBe(255);
  });
  it('nhị phân hóa thích ứng giữ được chữ trong vùng tối', () => {
    // Nền tối dần (bóng đổ) với một điểm chữ tối hơn nền xung quanh.
    const w = 30, values = Array.from({ length: w * w }, (_, p) => 200 - (p % w) * 4);
    values[15 * w + 25] = 20;
    const out = adaptiveThreshold(image(values, w));
    expect(out.data[15 * w + 25]).toBe(0);
    expect(out.data[15 * w + 5]).toBe(255);
  });
});
