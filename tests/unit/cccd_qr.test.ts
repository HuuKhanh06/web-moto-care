// tests/unit/cccd_qr.test.ts
import { describe, it, expect } from 'vitest';
import {
  parseCccdQrString,
  maskRawQrString,
  maskCccd,
  maskName,
  parseDateDdMmYyyyToIso,
} from '@/lib/cccdQr';

describe('BƯỚC 1: Mô-đun Giải mã QR CCCD (src/lib/cccdQr.ts)', () => {
  describe('1. Kiểm tra mặt nạ bảo mật P0 (Masking PII)', () => {
    it('Che số CCCD 12 số chuẩn dạng 079***8888', () => {
      expect(maskCccd('079201008888')).toBe('079***8888');
      expect(maskCccd('048098001234')).toBe('048***1234');
    });

    it('Che số CMND 9 số dạng 024***456', () => {
      expect(maskCccd('024123456')).toBe('024***456');
    });

    it('Che họ tên thật', () => {
      expect(maskName('NGUYỄN VĂN AN')).toBe('NGUYỄN *** AN');
      expect(maskName('LÊ BÌNH')).toBe('LÊ ***');
      expect(maskName('TRẦN')).toBe('T***');
    });

    it('Che chuỗi QR thô đầy đủ không làm lộ PII', () => {
      const raw = '079201008888|024123456|NGUYỄN VĂN AN|12051995|Nam|123 Lê Lợi, Hải Châu, Đà Nẵng|15082021';
      const masked = maskRawQrString(raw);
      expect(masked).not.toContain('079201008888');
      expect(masked).not.toContain('024123456');
      expect(masked).not.toContain('NGUYỄN VĂN AN');
      expect(masked).toContain('079***8888');
      expect(masked).toContain('024***456');
      expect(masked).toContain('NGUYỄN *** AN');
      expect(masked).toContain('12051995');
      expect(masked).toContain('Nam');
    });
  });

  describe('2. Chuyển đổi ngày ddMMyyyy sang ISO yyyy-MM-dd', () => {
    it('Chuyển đúng ngày hợp lệ', () => {
      expect(parseDateDdMmYyyyToIso('12051995')).toBe('1995-05-12');
      expect(parseDateDdMmYyyyToIso('01012000')).toBe('2000-01-01');
      expect(parseDateDdMmYyyyToIso('29022020')).toBe('2020-02-29'); // Năm nhuận
    });

    it('Từ chối ngày không hợp lệ và trả về null', () => {
      expect(parseDateDdMmYyyyToIso('32011995')).toBeNull(); // Ngày 32
      expect(parseDateDdMmYyyyToIso('12131995')).toBeNull(); // Tháng 13
      expect(parseDateDdMmYyyyToIso('29022021')).toBeNull(); // 2021 không nhuận
      expect(parseDateDdMmYyyyToIso('120595')).toBeNull(); // Sai độ dài
      expect(parseDateDdMmYyyyToIso('')).toBeNull();
    });
  });

  describe('3. Phân tích chuỗi QR CCCD 7 trường chuẩn Bộ Công An', () => {
    it('Bóc tách thành công chuỗi 7 trường đầy đủ (có CMND cũ)', () => {
      const raw = '079201008888|024123456|NGUYỄN VĂN A|12051995|Nam|123 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh|15082021';
      const parsed = parseCccdQrString(raw);

      expect(parsed.id_number).toEqual({ value: '079201008888', confidence: 1.0, source: 'QR' });
      expect(parsed.old_id_number).toEqual({ value: '024123456', confidence: 1.0, source: 'QR' });
      expect(parsed.full_name).toEqual({ value: 'NGUYỄN VĂN A', confidence: 1.0, source: 'QR' });
      expect(parsed.date_of_birth).toEqual({ value: '1995-05-12', confidence: 1.0, source: 'QR' });
      expect(parsed.gender).toEqual({ value: 'Nam', confidence: 1.0, source: 'QR' });
      expect(parsed.address).toEqual({ value: '123 Nguyễn Huệ, Quận 1, TP Hồ Chí Minh', confidence: 1.0, source: 'QR' });
      expect(parsed.issue_date).toEqual({ value: '2021-08-15', confidence: 1.0, source: 'QR' });
    });

    it('Bóc tách thành công chuỗi 7 trường không có CMND cũ (trường trống ||)', () => {
      const raw = '048098001234||TRẦN THỊ MAI|08031998|Nữ|Tổ 4, Hải Châu, Đà Nẵng|10102022';
      const parsed = parseCccdQrString(raw);

      expect(parsed.id_number).toEqual({ value: '048098001234', confidence: 1.0, source: 'QR' });
      expect(parsed.old_id_number).toBeUndefined();
      expect(parsed.full_name).toEqual({ value: 'TRẦN THỊ MAI', confidence: 1.0, source: 'QR' });
      expect(parsed.date_of_birth).toEqual({ value: '1998-03-08', confidence: 1.0, source: 'QR' });
      expect(parsed.gender).toEqual({ value: 'Nữ', confidence: 1.0, source: 'QR' });
      expect(parsed.issue_date).toEqual({ value: '2022-10-10', confidence: 1.0, source: 'QR' });
    });
  });

  describe('4. Phân tích chuỗi QR CCCD 6 trường (bản không có trường CMND cũ)', () => {
    it('Bóc tách đúng thứ tự 6 trường', () => {
      const raw = '079201008888|PHẠM VĂN ĐỒNG|02091992|Nam|Hà Nội|01012020';
      const parsed = parseCccdQrString(raw);

      expect(parsed.id_number).toEqual({ value: '079201008888', confidence: 1.0, source: 'QR' });
      expect(parsed.full_name).toEqual({ value: 'PHẠM VĂN ĐỒNG', confidence: 1.0, source: 'QR' });
      expect(parsed.date_of_birth).toEqual({ value: '1992-09-02', confidence: 1.0, source: 'QR' });
      expect(parsed.gender).toEqual({ value: 'Nam', confidence: 1.0, source: 'QR' });
      expect(parsed.address).toEqual({ value: 'Hà Nội', confidence: 1.0, source: 'QR' });
      expect(parsed.issue_date).toEqual({ value: '2020-01-01', confidence: 1.0, source: 'QR' });
    });
  });

  describe('5. Xử lý dữ liệu sai định dạng / bất thường', () => {
    it('Số CCCD không đủ 12 chữ số -> value: null, confidence: null', () => {
      const raw = '12345||NGUYỄN VĂN A|12051995|Nam|Đà Nẵng|15082021';
      const parsed = parseCccdQrString(raw);
      expect(parsed.id_number).toEqual({ value: null, confidence: null, source: 'QR' });
    });

    it('Ngày sinh sai định dạng -> value: null, confidence: null', () => {
      const raw = '079201008888||NGUYỄN VĂN A|99999999|Nam|Đà Nẵng|15082021';
      const parsed = parseCccdQrString(raw);
      expect(parsed.date_of_birth).toEqual({ value: null, confidence: null, source: 'QR' });
    });

    it('Chuỗi QR thiếu trường (< 6 trường) -> toàn bộ trường trả null', () => {
      const raw = '079201008888|NGUYỄN VĂN A';
      const parsed = parseCccdQrString(raw);
      expect(parsed.id_number.value).toBeNull();
      expect(parsed.full_name.value).toBeNull();
      expect(parsed.date_of_birth.value).toBeNull();
    });
  });
});
