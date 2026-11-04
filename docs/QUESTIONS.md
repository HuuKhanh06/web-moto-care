# Danh Sách Câu Hỏi & Điểm Cần Làm Rõ (BPMN / Nghiệp Vụ)

Tài liệu này dùng để ghi nhận các điểm mâu thuẫn, chưa rõ ràng hoặc thiếu sót trong tài liệu BPMN To-Be (`docs/process-graph.json`, `docs/mapping.csv`, `docs/data-model.csv`, `docs/screens.csv`, `docs/message-flows.csv`) để xin ý kiến phản hồi từ Product Owner/Giáo viên hướng dẫn.

---

### GIAI ĐOẠN 2A: QUY TRÌNH CHÍNH & PROCESS ENGINE

1. **Vòng lặp khiếu nại bảng kê (`M_GDispute` -> `M_Resolve` -> `M_ApproveAdjustment`):**
   - *Hiện trạng:* Trên mô hình BPMN To-Be, luồng khiếu nại bảng kê chi tiết giữa khách hàng (`KH-09`) và quản lý (`QL-01`) tạo thành một vòng lặp không có điều kiện dừng giới hạn số lần lặp.
   - *Giải pháp tạm thời:* Không tự ý thêm nhánh dừng ngoài BPMN; engine chỉ ghi nhận số lần lặp (`dispute_count`) vào `process_state.loop_counters` và nhật ký `process_events` để phục vụ thống kê.
   - *Câu hỏi cho nhóm:* Nhóm có quy định số lần khiếu nại tối đa (ví dụ 3 lần) trước khi chuyển thẳng lên chủ cơ sở giải quyết tranh chấp hay không?

2. **Trạng thái xe tại sự kiện kết thúc công nợ (`M_END_DEBT`):**
   - *Hiện trạng:* Khi khách không thanh toán tiếp khoản thu thêm (`M_GExtraDecision` -> "Không"), quy trình kết thúc tại `M_END_DEBT` (`rental_requests.status = CONG_NO`). Tuy nhiên nhánh này không đi qua các bước đánh giá xe `M_CheckReady` (T09) hay bảo dưỡng `M_Maintenance` (T11), dẫn đến xe không được tự động chuyển về `SAN_SANG`.
   - *Giải pháp tạm thời:* Giữ nguyên trạng thái xe hiện tại; đưa hồ sơ vào danh sách công nợ chờ nhân viên kỹ thuật thao tác thủ công ngoài luồng.
   - *Câu hỏi cho nhóm:* Khi khách dính công nợ, xe đã được trả về bãi có cần kích hoạt luồng đánh giá xe riêng không?

3. **Mâu thuẫn loại phần tử tại `Activity_0d0qzp6` (Nhận phản hồi từ khách):**
   - *Hiện trạng:* File BPMN khai báo `type: serviceTask`, nhưng theo bản vẽ và bảng mapping, đây là hành động phản hồi ("Đồng ý nhận xe" hoặc "Không đồng ý") đến từ phía Khách hàng (`KH-05`).
   - *Giải pháp trong Engine:* Engine xử lý `Activity_0d0qzp6` như một **Điểm chờ (Wait Point / User Interaction)** do khách hàng hoàn tất qua `engine.complete()`.
