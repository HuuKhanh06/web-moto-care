// src/lib/format.ts
// Các tiện ích định dạng tiền tệ (VND), ngày giờ Việt Nam và trạng thái hồ sơ

import { format, parseISO, isValid } from 'date-fns';
import { vi } from 'date-fns/locale';

/**
 * Định dạng số tiền sang chuẩn Việt Nam Đồng (VND)
 * @example formatCurrency(120000) => "120.000 ₫"
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 ₫';
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Chuẩn hóa input date sang Date object
 */
function toDate(date: string | Date | null | undefined): Date | null {
  if (!date) return null;
  if (date instanceof Date) return isValid(date) ? date : null;
  try {
    const parsed = parseISO(date);
    return isValid(parsed) ? parsed : new Date(date);
  } catch {
    return null;
  }
}

/**
 * Định dạng ngày giờ: "dd/MM/yyyy HH:mm"
 * @example "15/11/2026 14:30"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '--/--/---- --:--';
  return format(d, 'dd/MM/yyyy HH:mm', { locale: vi });
}

/**
 * Định dạng ngày: "dd/MM/yyyy"
 * @example "15/11/2026"
 */
export function formatDate(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '--/--/----';
  return format(d, 'dd/MM/yyyy', { locale: vi });
}

/**
 * Định dạng giờ: "HH:mm"
 * @example "14:30"
 */
export function formatTime(date: string | Date | null | undefined): string {
  const d = toDate(date);
  if (!d) return '--:--';
  return format(d, 'HH:mm', { locale: vi });
}

/**
 * Bảng dịch nhãn trạng thái hồ sơ thuê xe (17 trạng thái theo data-model.csv)
 */
export const RENTAL_STATUS_LABELS: Record<string, string> = {
  MOI: 'Yêu cầu mới',
  YEU_CAU: 'Yêu cầu mới',
  CHO_HO_SO: 'Chờ thẩm định hồ sơ',
  CHO_DUYET: 'Chờ duyệt hồ sơ',
  CHO_COC: 'Chờ thanh toán cọc',
  CHO_KY: 'Chờ ký hợp đồng',
  CHO_BAN_GIAO: 'Chờ kiểm tra & bàn giao',
  CHO_GIAO_XE: 'Chờ kiểm tra & bàn giao',
  CHO_KHACH_NHAN: 'Chờ khách nhận xe',
  DANG_THUE: 'Đang thuê xe',
  DANG_GIA_HAN: 'Đang gia hạn hợp đồng',
  DANG_XU_LY_SU_CO: 'Đang xử lý sự cố',
  CHO_NHAN_XE_TRA: 'Chờ nhận xe trả',
  CHO_KHACH_XAC_NHAN_BANG_KE: 'Chờ khách xác nhận bảng kê',
  CHO_KHACH_DUYET_BANG_KE: 'Chờ duyệt bảng kê',
  DANG_KHIEU_NAI: 'Đang khiếu nại bảng kê',
  CHO_THU_THEM: 'Chờ thanh toán phát sinh',
  CHO_THANH_TOAN_HOAN_TAT: 'Chờ thanh toán hoàn tất',
  CONG_NO: 'Công nợ tồn đọng',
  CHO_DANH_GIA_XE: 'Chờ đánh giá chất lượng xe',
  DANG_GIAM_DINH: 'Đang giám định hư hỏng',
  HOAN_TAT: 'Đã hoàn tất',
  TU_CHOI: 'Từ chối dịch vụ',
  DA_HUY: 'Đã hủy',
};

export type BadgeVariant = 'processing' | 'waiting' | 'danger' | 'completed' | 'neutral';

/**
 * Lấy Badge Variant tương ứng cho trạng thái hồ sơ thuê xe
 */
export function getRentalStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'MOI':
    case 'YEU_CAU':
    case 'CHO_DUYET':
    case 'DANG_THUE':
    case 'DANG_GIA_HAN':
    case 'DANG_XU_LY_SU_CO':
    case 'DANG_GIAM_DINH':
      return 'processing'; // Xanh nhạt

    case 'CHO_HO_SO':
    case 'CHO_COC':
    case 'CHO_KY':
    case 'CHO_BAN_GIAO':
    case 'CHO_GIAO_XE':
    case 'CHO_KHACH_NHAN':
    case 'CHO_NHAN_XE_TRA':
    case 'CHO_KHACH_XAC_NHAN_BANG_KE':
    case 'CHO_KHACH_DUYET_BANG_KE':
    case 'DANG_KHIEU_NAI':
    case 'CHO_THU_THEM':
    case 'CHO_THANH_TOAN_HOAN_TAT':
    case 'CHO_DANH_GIA_XE':
      return 'waiting'; // Vàng

    case 'TU_CHOI':
    case 'DA_HUY':
    case 'CONG_NO':
      return 'danger'; // Đỏ

    case 'HOAN_TAT':
      return 'completed'; // Xanh đậm

    default:
      return 'neutral';
  }
}

/**
 * Bảng dịch nhãn trạng thái phương tiện
 */
export const VEHICLE_STATUS_LABELS: Record<string, string> = {
  SAN_SANG: 'Sẵn sàng',
  DANG_THUE: 'Đang cho thuê',
  BAO_TRI: 'Đang bảo dưỡng',
  SU_CO: 'Đang gặp sự cố',
};

export function getVehicleStatusBadgeVariant(status: string): BadgeVariant {
  switch (status) {
    case 'SAN_SANG':
      return 'completed';
    case 'DANG_THUE':
      return 'processing';
    case 'BAO_TRI':
      return 'waiting';
    case 'SU_CO':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const getStatusBadgeVariant = getRentalStatusBadgeVariant;
export function getStatusLabel(status: string): string { return RENTAL_STATUS_LABELS[status] || status; }

