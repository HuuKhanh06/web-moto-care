// tests/unit/vietqr_beneficiary.test.ts
// Kiểm tra tính toàn vẹn và chuẩn xác của mã VietQR thụ hưởng chính chủ NGUYEN HUU KHANH

import { describe, it, expect } from 'vitest';
import {
  VIETQR_BENEFICIARY,
  crc16Ccitt,
  buildVietQrPayload,
} from '@/lib/vietQr';

describe('VietQR Beneficiary & EMVCo Standard', () => {
  it('Thông tin tài khoản thụ hưởng khớp 100% với thẻ Vietcombank của Nguyễn Hữu Khánh', () => {
    expect(VIETQR_BENEFICIARY.bankName).toContain('Vietcombank');
    expect(VIETQR_BENEFICIARY.bankBin).toBe('970436');
    expect(VIETQR_BENEFICIARY.accountNo).toBe('9911120060');
    expect(VIETQR_BENEFICIARY.accountName).toBe('NGUYEN HUU KHANH');
    expect(VIETQR_BENEFICIARY.cardImageUrl).toBe('/images/vietqr-nguyen-huu-khanh.jpg');
  });

  it('Chuỗi mã QR tĩnh khớp chính xác 100% với mã QR giải mã từ ảnh thẻ thực tế', () => {
    const rawQrFromPhoto = '00020101021138540010A00000072701240006970436011099111200600208QRIBFTTA53037045802VN63048A31';

    const generatedStatic = buildVietQrPayload({
      accountNo: VIETQR_BENEFICIARY.accountNo,
      bankBin: VIETQR_BENEFICIARY.bankBin,
    });

    expect(generatedStatic).toBe(rawQrFromPhoto);
  });

  it('Chuỗi mã QR động sinh đúng cấu trúc Napas 24/7 kèm số tiền và mã đơn', () => {
    const amount = 144000;
    const ref = 'MC_DEP_f0d24684_7589';

    const dynamicQr = buildVietQrPayload({
      accountNo: VIETQR_BENEFICIARY.accountNo,
      bankBin: VIETQR_BENEFICIARY.bankBin,
      amount,
      description: ref,
    });

    // Tag 01: 0212 (Dynamic QR)
    expect(dynamicQr).toContain('010212');
    // Tag 38: Vietcombank BIN + Account No
    expect(dynamicQr).toContain('0006970436');
    expect(dynamicQr).toContain('01109911120060');
    // Tag 54: Amount 144000
    expect(dynamicQr).toContain('5406144000');
    // Tag 62: Transfer description
    expect(dynamicQr).toContain(ref);
    // Tag 63: CRC 4 ký tự cuối
    expect(dynamicQr).toMatch(/6304[0-9A-F]{4}$/);

    // Kiểm tra tính hợp lệ của CRC checksum
    const bodyWithoutCrc = dynamicQr.slice(0, -4);
    const expectedCrc = crc16Ccitt(bodyWithoutCrc);
    expect(dynamicQr.endsWith(expectedCrc)).toBe(true);
  });
});
