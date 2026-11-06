// src/copy.ts
// Bộ từ điển ngôn ngữ hiển thị chuẩn hóa (Zero-Jargon) cho hệ sinh thái MotoCare Đà Nẵng
// Tuân thủ quy tắc: Ngắn gọn, đời thường, hướng hành động, không thuật ngữ kỹ thuật/nội bộ

export const COPY = {
  // Thương hiệu
  BRAND_NAME: 'MotoCare',
  SLOGAN: 'Thuê xe máy Đà Nẵng nhanh chóng & tin cậy',
  LOCATION_TAG: 'Đà Nẵng',

  // Nút hành động chính (1 - 2 từ, bắt đầu bằng động từ)
  ACTION: {
    SELECT_VEHICLE: 'Chọn xe',
    BOOK_NOW: 'Đặt xe',
    CONTINUE: 'Tiếp tục',
    BACK: 'Quay lại',
    DEPOSIT: 'Đặt cọc',
    CONFIRM: 'Xác nhận',
    REJECT: 'Từ chối',
    SIGN_CONTRACT: 'Ký hợp đồng',
    ACCEPT_VEHICLE: 'Nhận xe',
    RETURN_VEHICLE: 'Trả xe',
    EXTEND: 'Gia hạn',
    REPORT_ISSUE: 'Báo sự cố',
    CALL_SUPPORT: 'Gọi cứu hộ',
    PROCESS: 'Xử lý',
    SAVE: 'Lưu thay đổi',
    CANCEL: 'Hủy bỏ',
    AGREE: 'Đồng ý',
    RESOLVE: 'Giải quyết',
    UPDATE: 'Cập nhật',
    VIEW_DETAILS: 'Xem chi tiết',
    LOGOUT: 'Đăng xuất',
    LOGIN: 'Đăng nhập',
    REGISTER: 'Tạo tài khoản',
  },

  ACTIONS: {
    SELECT_VEHICLE: 'Chọn xe',
    BOOK_NOW: 'Đặt xe',
    CONTINUE: 'Tiếp tục',
    BACK: 'Quay lại',
    DEPOSIT: 'Đặt cọc',
    CONFIRM: 'Xác nhận',
    REJECT: 'Từ chối',
    SIGN_CONTRACT: 'Ký hợp đồng',
    ACCEPT_VEHICLE: 'Nhận xe',
    RETURN_VEHICLE: 'Trả xe',
    EXTEND: 'Gia hạn',
    REPORT_ISSUE: 'Báo sự cố',
    CALL_SUPPORT: 'Gọi cứu hộ',
    PROCESS: 'Xử lý',
    SAVE: 'Lưu thay đổi',
    CANCEL: 'Hủy bỏ',
    AGREE: 'Đồng ý',
    RESOLVE: 'Giải quyết',
    UPDATE: 'Cập nhật',
    VIEW_DETAILS: 'Xem chi tiết',
    LOGOUT: 'Đăng xuất',
    LOGIN: 'Đăng nhập',
    REGISTER: 'Tạo tài khoản',
  },

  // Nhãn trạng thái (Ngắn, thân thiện, đời thường)
  STATUS: {
    // 4 Nhóm trạng thái chính
    SUCCESS: 'Đã xong',
    PENDING: 'Đang chờ',
    ERROR: 'Đã hủy',
    INACTIVE: 'Tạm dừng',
    ACTIVE: 'Đang thuê',
    DONE: 'Đã xong',

    // Trạng thái cụ thể trong luồng
    WAIT_DOCS: 'Chờ giấy tờ',
    WAIT_DEPOSIT: 'Chờ thanh toán cọc',
    WAIT_SIGN: 'Chờ ký hợp đồng',
    WAIT_HANDOVER: 'Chờ nhận xe',
    RENTING: 'Đang thuê',
    WAIT_RETURN: 'Đang kiểm tra trả xe',
    WAIT_SETTLE: 'Chờ quyết toán',
    COMPLETED: 'Hoàn tất chuyến đi',
    CANCELLED: 'Đã hủy yêu cầu',
    OVERDUE_DEPOSIT: 'Hết hạn đặt cọc',
    OVERDUE_SIGN: 'Hết hạn ký hợp đồng',
    DEBT: 'Chờ thanh toán phí',

    // Trạng thái xe
    VEHICLE_AVAILABLE: 'Sẵn sàng',
    VEHICLE_RENTED: 'Đang có khách thuê',
    VEHICLE_MAINTENANCE: 'Đang bảo dưỡng định kỳ',
  },

  // 4 Bước luồng đặt thuê xe thương mại
  BOOKING_STEPS: [
    { id: 'step-1', number: 1, title: 'Chọn xe' },
    { id: 'step-2', number: 2, title: 'Giấy tờ' },
    { id: 'step-3', number: 3, title: 'Đặt cọc' },
    { id: 'step-4', number: 4, title: 'Nhận xe' },
  ],

  // Phân loại xe dễ hiểu
  VEHICLE_CATEGORIES: {
    all: 'Tất cả xe',
    xe_so: 'Xe số',
    tay_ga: 'Xe tay ga',
    xe_con: 'Xe côn tay',
  },

  // Tiêu đề các màn hình (1 - 3 từ, không phụ đề)
  TITLES: {
    HOME: 'Thuê xe máy',
    FLEET: 'Danh sách xe',
    BOOKING_INFO: 'Thông tin thuê',
    PAYMENT_DEPOSIT: 'Đặt cọc',
    CONTRACT: 'Hợp đồng',
    HANDOVER: 'Nhận xe',
    MY_TRIP: 'Hành trình của bạn',
    TRIPS: 'Chuyến đi của bạn',
    EXTEND_TRIP: 'Gia hạn thuê',
    EXTEND: 'Gia hạn thuê xe',
    INCIDENT: 'Hỗ trợ sự cố',
    RETURN_SETTLEMENT: 'Biên bản trả xe',
    RETURN: 'Bảng kê trả xe',
    FINAL_SETTLEMENT: 'Hoàn tất chuyến đi',
    SETTLEMENT: 'Quyết toán cọc',

    // Phân hệ Nhân viên
    STAFF_TASKS: 'Việc cần làm',
    STAFF_INSPECT_PRE: 'Kiểm tra xe',
    STAFF_PHOTO_PRE: 'Ảnh bàn giao',
    STAFF_HANDOVER: 'Giao xe & khóa',
    STAFF_RECEIVE_RETURN: 'Tiếp nhận xe trả',
    STAFF_DAMAGE_REPORT: 'Biên bản hư hại',
    STAFF_EXTRA_FEE: 'Thu phí phát sinh',
    STAFF_CHECK_READY: 'Đưa xe vào bãi',
    STAFF_LOG_INCIDENT: 'Tiếp nhận sự cố',

    // Phân hệ Quản lý
    MANAGER_DASHBOARD: 'Bảng điều hành',
    MANAGER_TIMELINE: 'Lịch trình đội xe',
    MANAGER_RESOLVE: 'Xử lý khiếu nại',
    MANAGER_ESCALATE: 'Điều phối cứu hộ',
    MANAGER_FLEET: 'Quản lý đội xe',
    MANAGER_PARTNERS: 'Đối tác cứu hộ',
    MANAGER_SETTINGS: 'Cài đặt hệ thống',
  },

  // Màn hình trống (Tối đa 1 câu hoặc 3 - 5 chữ)
  EMPTY: {
    NO_TASKS: 'Hiện không có việc nào cần xử lý.',
    NO_VEHICLES: 'Không tìm thấy xe phù hợp.',
    NO_RENTALS: 'Bạn chưa có chuyến đi nào.',
    NO_TRIPS: 'Bạn chưa có chuyến đi nào.',
    NO_NOTIFICATIONS: 'Không có thông báo mới.',
    NO_INCIDENTS: 'Không có sự cố nào đang chờ giải quyết.',
  },

  // Định dạng hiển thị
  FORMAT: {
    PRICE_PER_DAY: (price: number) => `${price.toLocaleString('vi-VN')} ₫ / ngày`,
    TOTAL_PRICE: (price: number) => `${price.toLocaleString('vi-VN')} ₫`,
    DEPOSIT_NOTE: 'Đặt cọc 30% giá trị đơn, hoàn lại ngay khi trả xe.',
    DATE_TIME: (dateStr: string) => {
      try {
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month} · ${hours}:${mins}`;
      } catch {
        return dateStr;
      }
    },
  },
} as const;
