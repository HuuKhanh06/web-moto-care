// src/features/customer/constants.ts
// Các hằng số tiến trình khách hàng (Stepper)

export interface StepItem {
  id: string;
  title: string;
  description?: string;
}

export const CUSTOMER_RENTAL_STEPS: StepItem[] = [
  { id: 'request', title: 'Chọn xe', description: 'Gửi yêu cầu thuê' },
  { id: 'docs', title: 'Báo giá & Hồ sơ', description: 'Thẩm định điều kiện' },
  { id: 'deposit', title: 'Đặt cọc QR', description: '30% tiền cọc' },
  { id: 'contract', title: 'Ký hợp đồng', description: 'Ký số trực tuyến' },
  { id: 'handover', title: 'Nhận bàn giao', description: 'Kiểm tra & nhận xe' },
];

export const CUSTOMER_EXTENSION_STEPS: StepItem[] = [
  { id: 'select_time', title: 'Chọn thời gian', description: 'Ngày trả mới' },
  { id: 'review_offer', title: 'Xem đề xuất', description: 'Đếm ngược 2 giờ' },
  { id: 'pay_qr', title: 'Thanh toán QR', description: 'Nếu có phụ phí' },
  { id: 'done', title: 'Hoàn tất', description: 'Cập nhật thời hạn' },
];


