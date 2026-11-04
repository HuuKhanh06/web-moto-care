// src/config/rules.ts
// Các cấu hình nghiệp vụ mặc định có thể tinh chỉnh tại một nơi duy nhất

export const BUSINESS_RULES = {
  // 1. Tỷ lệ tiền cọc mặc định (30% tổng tiền thuê)
  DEPOSIT_RATE: 0.3,

  // 2. Giấy tờ bắt buộc cần có để hồ sơ hợp lệ (M_CheckDocs)
  REQUIRED_DOCUMENT_TYPES: ['CCCD_TRUOC', 'CCCD_SAU', 'BANG_LAI_TRUOC'] as const,

  // 3. Phí trễ hạn mỗi giờ phát sinh (10% giá thuê theo ngày)
  LATE_FEE_PER_HOUR_RATE: 0.1,

  // 4. Số lần tối đa được yêu cầu bổ sung hồ sơ (Gateway_0x0p273: > 3 lần tức lần thứ 4 thì hủy)
  MAX_DOC_REQUEST_COUNT: 3,

  // 5. Cấu hình Timer (tính theo phút)
  TIMERS: {
    DEPOSIT_MINUTES: 30,       // M_BoundDeposit: 30 phút
    SIGN_HOURS: 24,            // M_BoundSign: 24 giờ
    EXTRA_PAYMENT_MINUTES: 30, // M_BoundExtra: 30 phút
    EXTENSION_OFFER_HOURS: 2,  // GH_Timer (2B): 2 giờ
    EXTENSION_PAY_MINUTES: 30, // GH_TimerPay (2B): 30 phút
    DISPATCH_ACK_MINUTES: 15,  // SC_AckTimer (2B): 15 phút
    INCIDENT_SLA_HOURS: 2,     // SC_ResultTimer (2B): 2 giờ
  },

  // 6. Quy tắc thanh toán lại (Repayment rule):
  // Khi quay lại bước thanh toán (M_G03b "Chưa", M_GExtraDecision "Tiếp tục thanh toán"):
  // Đánh dấu bản ghi thanh toán cũ là EXPIRED, sinh bản ghi mới kèm QR mới hạn 30 phút.
  REPAYMENT_EXPIRY_MINUTES: 30,
};

