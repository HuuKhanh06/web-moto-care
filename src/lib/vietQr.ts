// src/lib/vietQr.ts
// Tiện ích sinh chuỗi mã VietQR chuẩn EMVCo Napas 24/7 và thông tin tài khoản thụ hưởng mặc định

export const VIETQR_BENEFICIARY = {
  bankName: 'Vietcombank (Napas 247)',
  bankBin: '970436', // Mã BIN Vietcombank chuẩn Napas
  accountNo: '9911120060',
  accountName: 'NGUYEN HUU KHANH',
  cardImageUrl: '/images/vietqr-nguyen-huu-khanh.jpg',
} as const;

/**
 * Tính checksum CRC-16 CCITT (polynomial 0x1021, init 0xFFFF) theo đặc tả EMVCo
 */
export function crc16Ccitt(str: string): string {
  let crc = 0xffff;
  for (let c = 0; c < str.length; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface BuildVietQrPayloadParams {
  accountNo: string;
  bankBin: string;
  amount?: number;
  description?: string;
}

/**
 * Tạo chuỗi dữ liệu mã VietQR chuẩn EMVCo (Napas 247)
 * Tương thích 100% với ứng dụng các ngân hàng tại Việt Nam (Vietcombank, MB, Techcombank, ...)
 */
export function buildVietQrPayload(params: BuildVietQrPayloadParams): string {
  const { accountNo, bankBin, amount, description } = params;

  // Tag 38: Consumer Account Information (Định danh tài khoản thụ hưởng)
  const guid = '0010A000000727'; // GUID Napas
  const sub00 = '00' + String(bankBin.length).padStart(2, '0') + bankBin;
  const sub01 = '01' + String(accountNo.length).padStart(2, '0') + accountNo;
  const paymentNet = '01' + String((sub00 + sub01).length).padStart(2, '0') + sub00 + sub01;
  const serviceCode = '0208QRIBFTTA'; // Chuyển nhanh Napas 247 tới số tài khoản
  const tag38Value = guid + paymentNet + serviceCode;
  const tag38 = '38' + String(tag38Value.length).padStart(2, '0') + tag38Value;

  // 010212 = Dynamic QR (khi có số tiền cụ thể), 010211 = Static QR
  const pointOfInitiation = amount && amount > 0 ? '010212' : '010211';
  let payload = '000201' + pointOfInitiation + tag38 + '5303704';

  // Tag 54: Số tiền thanh toán (VND)
  if (amount && amount > 0) {
    const amtStr = String(Math.round(amount));
    payload += '54' + String(amtStr.length).padStart(2, '0') + amtStr;
  }

  // Tag 58: Mã quốc gia (VN)
  payload += '5802VN';

  // Tag 62: Additional Data Field (Nội dung chuyển khoản / Mã hóa đơn)
  if (description && description.trim()) {
    const cleanDesc = description.trim();
    const sub08 = '08' + String(cleanDesc.length).padStart(2, '0') + cleanDesc;
    payload += '62' + String(sub08.length).padStart(2, '0') + sub08;
  }

  // Tag 63: Checksum CRC
  payload += '6304';
  payload += crc16Ccitt(payload);

  return payload;
}
