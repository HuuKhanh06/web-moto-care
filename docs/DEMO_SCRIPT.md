# KỊCH BẢN THUYẾT TRÌNH & DEMO HỆ THỐNG MOTO CARE (10 PHÚT)

> **Dự án**: Hệ thống quản lý quy trình nghiệp vụ cho thuê xe máy du lịch & công tác Moto Care  
> **Kiến trúc**: BPMN Engine chạy 100% Client-side (FE-only SPA) với Reactive Database (Dexie/IndexedDB), AI Agent OCR (Google Gemini + Hybrid Rule Verification), VietQR & EmailJS.  
> **Thời lượng**: 10 phút (5 phút luồng chính + 5 phút cho 2 kịch bản ngoại lệ sâu sắc).

---

## 1. BẢNG TÀI KHOẢN & VAI TRÒ DEMO

| Vai trò | Tên đăng nhập | Mật khẩu mẫu | Chức năng demo chính |
| :--- | :--- | :--- | :--- |
| **Khách hàng** (`CUSTOMER`) | `khachhang1` | `Customer@123456` | Đặt xe, tải CCCD/GPLX, thanh toán VietQR, ký số, nhận xe, báo sự cố, duyệt bảng kê |
| **Nhân viên** (`STAFF`) | `nhanvien1` | `Staff@123456` | Kiểm tra kỹ thuật, chụp ảnh bàn giao, nhận xe trả, xác minh hư hỏng |
| **Quản lý** (`MANAGER`) | `quanly1` | `Manager@123456` | Theo dõi AI OCR, điều phối sự cố, hòa giải khiếu nại bảng kê, duyệt hoàn cọc |

> 💡 **Mẹo trình diễn**:
> - Hệ thống có sẵn nút **Chuyển vai trò nhanh** trên thanh Header (Khách / Nhân viên / Quản lý) hoặc dùng **DevPanel** ở góc dưới màn hình.
> - Nếu muốn khởi tạo trạng thái sạch trước buổi diễn, mở **DevPanel** -> bấm **"Khôi phục dữ liệu gốc (Reset)"**.

---

## 2. KỊCH BẢN 1: LUỒNG CHÍNH TIÊU BIỂU (HAPPY PATH - 5 PHÚT)
*Từ gửi yêu cầu thuê, AI OCR bóc tách giấy tờ, cọc VietQR, ký hợp đồng số, kỹ thuật kiểm tra và bàn giao xe.*

| Thời gian | Vai trò | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **00:00 - 00:45** | Khách hàng | **KH-01: Gửi yêu cầu** (`/kh-01`) | - Chọn loại xe: **Xe số** (`xe_so`).<br>- Chọn nhận xe ngày mai, trả sau 3 ngày.<br>- Nhấn **"Gửi yêu cầu thuê xe"** (`data-testid="node-M_START"`). | - Hệ thống tự động phân bổ xe phù hợp (`M_G01`).<br>- Tự chuyển sang màn hình **KH-02**.<br>- Trạng thái hồ sơ: `CHO_XAC_NHAN`. |
| **00:45 - 01:45** | Khách hàng | **KH-02: Báo giá & Hồ sơ** (`/kh-02`) | - Xem bảng báo giá chi tiết, tiền cọc 30%.<br>- Nhấn nút **"Tải ảnh mẫu CCCD & GPLX"** (tích hợp sẵn trong màn hình).<br>- Nhấn **"Gửi thẩm định hồ sơ (AI OCR)"** (`data-testid="node-M_CheckDocs"`). | - **AI Agent OCR** chạy trực tiếp:<br>  + Nhận diện độ tin cậy > 85% (X=85%).<br>  + Tự động điền Số CCCD, Họ tên, Hạng GPLX.<br>- Hồ sơ đạt chuẩn, hệ thống tự động duyệt sang bước cọc (`M_CreateDeposit`). |
| **01:45 - 02:45** | Khách hàng | **KH-03: Thanh toán cọc** (`/kh-03`) | - Xem mã **VietQR** chuẩn ngân hàng và đồng hồ đếm ngược 30 phút.<br>- Nhấn nút **"Mở Giả lập Ngân hàng"**.<br>- Giữ nguyên số tiền cọc đề xuất, nhấn **"Xác nhận chuyển khoản"**. | - Hệ thống đối soát giao dịch thành công trong 1 giây (`M_VerifyDeposit`).<br>- Tự động kích hoạt thông báo email xác nhận cọc.<br>- Chuyển ngay sang màn hình **KH-04: Ký hợp đồng số**. |
| **02:45 - 03:30** | Khách hàng | **KH-04: Ký hợp đồng** (`/kh-04`) | - Xem điều khoản hợp đồng điện tử tự sinh.<br>- Nhập họ tên hoặc ký chuột vào khung chữ ký.<br>- Nhấn **"Ký hợp đồng điện tử"** (`data-testid="node-M_SignOnline"`). | - Hợp đồng chuyển sang trạng thái `DA_KY_DIEN_TU`.<br>- Hệ thống cấp mã hồ sơ chính thức và mở quy trình bàn giao xe tại điểm. |
| **03:30 - 04:15** | Nhân viên | **NV-03 & NV-04: Bàn giao xe** (`/nv-03`, `/nv-04`) | - Trên thanh Header chuyển sang vai trò **Nhân viên**.<br>- Mở **NV-03: Kiểm tra kỹ thuật**: tick đạt tất cả các mục (phanh, đèn, lốp, còi), bấm Xác nhận.<br>- Sang **NV-04: Chụp ảnh hiện trạng**: bấm "Nạp 5 góc ảnh mẫu", bấm Gửi ảnh. | - Checklist kỹ thuật được lưu vào cơ sở dữ liệu (`M_Inspect`).<br>- Biên bản bàn giao đính kèm ảnh 5 góc được lập tức truyền tới khách hàng (`M_CreateHandoverDoc`). |
| **04:15 - 05:00** | Khách hàng & Nhân viên | **KH-05 & NV-05: Nhận xe** (`/kh-05`, `/nv-05`) | - Chuyển sang Khách hàng: xem ảnh hiện trạng, bấm **"Đồng ý nhận xe"** (`data-testid="node-M_ApproveState"`).<br>- Chuyển sang Nhân viên: giao chìa khóa, 2 mũ bảo hiểm, bấm **"Hoàn tất giao xe"** (`data-testid="node-M_Deliver"`). | - Trạng thái hồ sơ chuyển sang **`DANG_THUE`**.<br>- Xe chính thức lăn bánh, cổng sự kiện kích hoạt chờ: Gia hạn / Sự cố / Trả xe. |

---

## 3. KỊCH BẢN 2: NGOẠI LỆ 1 - XỬ LÝ SỰ CỐ & ĐỔI XE THAY THẾ (2.5 PHÚT)
*Minh họa sức mạnh xử lý quy trình con (Sub-process SP2: Incident Handling), tích hợp đối tác cứu hộ và duy trì trải nghiệm liền mạch cho khách hàng.*

| Thời gian | Vai trò | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **05:00 - 05:45** | Khách hàng | **KH-06 & KH-08: Báo sự cố** (`/kh-06`, `/kh-08`) | - Tại trang chủ Khách hàng (`/kh-06`), bấm **"Báo sự cố"**.<br>- Chọn sự cố: **"Thủng lốp / Hỏng xích giữa đường"**.<br>- Điền tọa độ GPS tự động, đính kèm ảnh hiện trường.<br>- Nhấn **"Gửi yêu cầu trợ giúp cứu hộ"** (`data-testid="node-SC_Create"`). | - Hồ sơ khoá các nhánh khác để tập trung giải quyết sự cố (`SC_GateAction`).<br>- Bộ đếm giờ SLA cứu hộ 60 phút được kích hoạt.<br>- Màn hình hiển thị trạng thái "Đang tìm đối tác cứu hộ gần nhất". |
| **05:45 - 06:45** | Quản lý / Đối tác | **NV-10: Cứu hộ & Đổi xe** (`/nv-10`) | - Chuyển sang vai trò **Quản lý**.<br>- Bấm **"Mở Giả lập Đối tác Cứu hộ (DT-01)"**.<br>- Chọn: Đối tác nhận việc -> Đến hiện trường -> Kết luận "Không thể sửa tại chỗ, cần đổi xe".<br>- Quản lý chọn xe thay thế sẵn có trong kho và bấm **"Cấp xe đổi & Hoàn tất cứu hộ"** (`data-testid="node-SC_Dispatch"`). | - Hệ thống tự động thu hồi xe cũ, gán xe thay thế mới vào hợp đồng hiện hành.<br>- Chi phí cứu hộ được ghi nhận vào hồ sơ. |
| **06:45 - 07:30** | Khách hàng | **KH-08: Nhận xe đổi & Tiếp tục** (`/kh-08`) | - Khách hàng kiểm tra thông tin xe thay thế (biển số mới, ảnh bàn giao mới).<br>- Bấm **"Xác nhận nhận xe thay thế & Tiếp tục hành trình"** (`data-testid="node-SC_SendContinue"`). | - Quy trình con sự cố đóng lại thành công.<br>- Hồ sơ trở về trạng thái **`DANG_THUE`** với xe mới mà không làm gián đoạn hợp đồng ban đầu. |

---

## 4. KỊCH BẢN 3: NGOẠI LỆ 2 - TRẢ XE PHÁT SINH HƯ HỎNG, KHIẾU NẠI & HÒA GIẢI (2.5 PHÚT)
*Minh họa quy trình đối chiếu ảnh giao/trả, lập bảng kê vi phạm, xử lý tranh chấp đa bên và quyết toán hoàn cọc minh bạch.*

| Thời gian | Vai trò | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **07:30 - 08:15** | Nhân viên | **NV-06 & NV-07: Kiểm tra trả xe** (`/nv-06`, `/nv-07`) | - Khách mang xe về trạm, bấm "Yêu cầu trả xe".<br>- Nhân viên mở **NV-06**: chụp ảnh trả xe đối chiếu với ảnh giao ban đầu.<br>- Mở **NV-07: Xác minh hư hỏng**: Nhân viên phát hiện và ghi nhận "Trầy xước bửng yếm bên phải", nhập chi phí đền bù **150.000 đ**.<br>- Nhấn **"Xác nhận & Lập bảng kê chi phí"** (`data-testid="node-M_VerifyDamage"`). | - Hệ thống tự động tổng hợp bảng kê: Tiền cọc giữ (1.000.000đ) - Tiền thuê còn lại - Phí hư hỏng (150.000đ).<br>- Tự động gửi thông báo bảng kê Version 1 đến khách (`M_SendStatement`). |
| **08:15 - 09:00** | Khách hàng & Quản lý | **KH-09 & QL-01: Khiếu nại & Hòa giải** (`/kh-09`, `/ql-01`) | - Chuyển sang **Khách hàng (KH-09)**: Khách xem bảng kê, thấy phí 150k quá cao -> Bấm **"Khiếu nại bảng kê"** (`data-testid="node-M_ReceiveReview"`), nhập lý do: "Vết xước nhẹ đã có từ trước, xin giảm 50%".<br>- Chuyển sang **Quản lý (QL-01)**: Quản lý xem đối chiếu 2 ảnh chụp, quyết định hỗ trợ khách: Giảm phí xuống còn **70.000 đ**.<br>- Nhấn **"Phê duyệt điều chỉnh & Ban hành Bảng kê v2"** (`data-testid="node-M_ApproveAdjustment"`). | - Bảng kê được tăng lên Version 2 (`statement_version: 2`).<br>- Khách hàng mở lại KH-09, thấy biểu phí đã giảm hợp lý -> Bấm **"Đồng ý bảng kê v2"**. |
| **09:00 - 10:00** | Khách hàng & Quản lý | **KH-10 & NV-09: Quyết toán & Lưu hồ sơ** (`/kh-10`, `/nv-09`) | - Sang **KH-10: Hoàn cọc**: Số tiền hoàn lại là 930.000 đ. Khách bấm "Xác nhận đã nhận hoàn cọc qua tài khoản".<br>- Nhân viên mở **NV-09: Đánh giá xe sau trả**: xếp loại xe cần vệ sinh/bảo dưỡng nhẹ.<br>- Quản lý bấm **"Lưu trữ & Đóng hồ sơ vĩnh viễn"** (`data-testid="node-M_Archive"`). | - Hồ sơ chuyển trạng thái cuối: **`HOAN_TAT_LUU_TRU`**.<br>- Vòng đời BPMN đạt mốc 100% hoàn thành trọn vẹn.<br>- Trình diễn màn hình **Nhật ký AI & Lịch sử tích hợp** (`/ai-log`, `/integrations-log`) để tổng kết toàn bộ bằng chứng vận hành. |

---

## 5. CÁC TÍNH NĂNG VƯỢT TRỘI NÊN NHẤN MẠNH VỚI HỘI ĐỒNG
1. **Tuân thủ BPMN chuẩn mực**: Mọi nút bấm, cổng rẽ nhánh đều có định danh chuẩn hóa theo sơ đồ To-Be (110 phần tử được kiểm chứng 100% qua `docs/TRACEABILITY.md`).
2. **AI Agent Hybrid thực chiến**: Tự động nhận diện giấy tờ với ngưỡng tin cậy X/Y phân định rõ ràng giữa tự động phê duyệt và chuyển nhân viên xử lý ngoại lệ.
3. **Mô phỏng ngân hàng & đối tác không cần phụ thuộc mạng thật**: Giám khảo có thể tắt Wi-Fi hoàn toàn, hệ thống vẫn chạy trơn tru mượt mà từ đầu đến cuối nhờ công nghệ Web Cryptography, IndexedDB và Mock Providers.

