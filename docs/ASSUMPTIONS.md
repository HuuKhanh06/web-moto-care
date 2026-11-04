# CÁC GIẢ ĐỊNH NGHIỆP VỤ (ASSUMPTIONS) - MOTO CARE

Tài liệu này ghi nhận các giá trị mặc định và quy tắc nghiệp vụ do đội ngũ kỹ sư đề xuất để hoàn thiện việc hiện thực hóa mô hình BPMN To-Be khi tài liệu gốc chưa định lượng chi tiết:

---

## 1. Công thức tính tiền thuê và tiền cọc
- **Giá thuê (`total_price`):** `daily_price * số ngày thuê` (làm tròn lên theo đơn vị ngày, tối thiểu 1 ngày).
- **Tiền cọc (`deposit_amount`):** Mặc định bằng `30%` của `total_price` (cấu hình tại `BUSINESS_RULES.DEPOSIT_RATE`).

## 2. Giấy tờ bắt buộc (`M_CheckDocs`)
- Hồ sơ được tính là hợp lệ (`is_valid = true`) khi khách hàng đã tải lên đủ 3 loại giấy tờ:
  1. `CCCD_TRUOC` (Mặt trước CCCD)
  2. `CCCD_SAU` (Mặt sau CCCD)
  3. `BANG_LAI_TRUOC` (Mặt trước GPLX còn hạn)

## 3. Ngưỡng bổ sung hồ sơ (`Gateway_0x0p273`)
- Cổng `Gateway_0x0p273` kiểm tra `doc_request_count > 3`.
- Nghĩa là khách hàng được phép bổ sung tối đa 3 lần. Nếu lần kiểm tra thứ 4 vẫn không đạt (`doc_request_count > 3`), yêu cầu sẽ bị hủy tự động và chuyển sang `M_EndCancel` với lý do `HO_SO_KHONG_DAT`.

## 4. Phí trễ hạn khi trả xe (`M_CalcFees`)
- Nếu khách trả xe sau thời điểm `end_at` trong hợp đồng, phí trễ hạn được tính bằng `10% giá ngày` cho mỗi giờ bắt đầu trễ (`BUSINESS_RULES.LATE_FEE_PER_HOUR_RATE`).

## 5. Quy tắc thanh toán lại (Repayment)
- Khi nhân viên xác nhận cọc "Chưa xác nhận" (`M_G03b`) hoặc khách chọn "Tiếp tục thanh toán" thu thêm (`M_GExtraDecision`):
  - Bản ghi `payments` cũ đổi trạng thái sang `EXPIRED` và được giữ lại trong IndexedDB làm lịch sử đối soát.
  - Sinh một bản ghi `payments` mới với mã `qr_ref` mới và thời hạn hiệu lực 30 phút.

## 6. Trạng thái xe ở nhánh công nợ (`M_END_DEBT`)
- Khi kết thúc ở `M_END_DEBT`, hồ sơ chuyển sang trạng thái `CONG_NO`. Do luồng BPMN To-Be ở nhánh này không đi qua các bước đánh giá/bảo dưỡng sau trả (T09/T10), xe sẽ được giữ nguyên trạng thái hiện tại chờ nhân viên/quản lý can thiệp thủ công.

