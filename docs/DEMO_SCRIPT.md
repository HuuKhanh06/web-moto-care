# KỊCH BẢN THUYẾT TRÌNH & DEMO HỆ THỐNG MOTO CARE (10 PHÚT)

> **Dự án**: Hệ thống quản lý quy trình nghiệp vụ cho thuê xe máy du lịch & công tác Moto Care  
> **Kiến trúc**: BPMN Engine chạy 100% Client-side (FE-only SPA) với Reactive Database (Dexie/IndexedDB), AI Agent OCR (Google Gemini hoặc OCR trên thiết bị), VietQR & EmailJS.  
> **Thời lượng**: 10 phút (5 phút luồng chính + 5 phút cho 2 kịch bản ngoại lệ).  
> **Cập nhật**: tên nút, tài khoản và thứ tự bước đã được đối chiếu với giao diện hiện tại của app.

---

## 0. CHUẨN BỊ TRƯỚC BUỔI DEMO (5 PHÚT, LÀM TRƯỚC GIỜ TRÌNH BÀY)

1. Chạy web: mở terminal tại thư mục dự án, chạy `npm run dev`, mở `http://localhost:5173/`.
2. **Làm mới dữ liệu**: bấm `Ctrl + Shift + D` để mở DevPanel → bấm **"Nạp Data"** → bấm nút đặt lại giờ (**"Đặt lại về thời gian thực"**). Không bấm "Xóa Data" (nút đó xóa cả xe và tài khoản mẫu).
3. **Tạo tài khoản khách hàng**: dữ liệu mẫu không có tài khoản khách. Trên trang đăng nhập, chuyển sang phần tạo tài khoản và đăng ký một tài khoản khách mới.
4. **Mở 3 tab, mỗi tab một vai trò** (tiết kiệm thời gian đăng xuất/đăng nhập):
   - Mở mỗi tab bằng `Ctrl + T` rồi gõ `localhost:5173`. Không nhân bản tab, vì tab nhân bản dùng chung phiên đăng nhập với tab gốc.
   - Tab 1: đăng nhập **Khách hàng** (tài khoản vừa đăng ký).
   - Tab 2: đăng nhập **Nhân viên**.
   - Tab 3: đăng nhập **Quản lý**.
   - Phải dùng **cùng một trình duyệt**. Dữ liệu lưu trong trình duyệt, nên trình duyệt khác hoặc tab ẩn danh sẽ không thấy đơn thuê.
   - Khi chuyển sang tab khác mà màn hình chưa cập nhật, bấm `F5` để tải lại.
5. **Chọn chế độ đọc giấy tờ** (trong `.env` hoặc hộp "Cấu hình AI" ở trang `/ai-log`):
   - `LIVE` (Gemini): đọc chính xác nhất, mất khoảng 15 giây mỗi lần, cần mạng. Ảnh sẽ được gửi lên Google, nên **chỉ dùng ảnh giấy tờ mẫu**.
   - `LOCAL`: đọc ngay trên máy, không gửi ảnh đi. Lần đầu cần mạng để tải dữ liệu nhận dạng chữ.
6. Chuẩn bị sẵn 3 ảnh: **CCCD mặt trước, CCCD mặt sau, GPLX mặt trước** (ảnh mẫu, chụp thẳng, đủ sáng).

---

## 1. BẢNG TÀI KHOẢN & VAI TRÒ DEMO

| Vai trò | Email đăng nhập | Mật khẩu | Chức năng demo chính |
| :--- | :--- | :--- | :--- |
| **Khách hàng** (`khach_hang`) | Tự đăng ký trước buổi demo | Tự đặt | Đặt xe, tải CCCD/GPLX, đặt cọc VietQR, ký hợp đồng, nhận xe, báo sự cố, trả xe, xác nhận/khiếu nại bảng kê, nhận hoàn cọc |
| **Nhân viên** (`nhan_vien`) | `nhanvien1@motocare.vn` | `password123` | Kiểm tra xe, chụp ảnh bàn giao, giao xe, xác nhận sự cố, nhận xe trả, xác minh hư hỏng, đánh giá xe |
| **Quản lý** (`quan_ly`) | `admin@motocare.vn` | `password123` | Hòa giải khiếu nại bảng kê, giám sát nhật ký AI (`/ai-log`) và nhật ký tích hợp (`/integration-log`) |

> 💡 **Nhân viên tìm hồ sơ ở đâu?** Màn hình **NV-01** (trang đầu sau khi nhân viên đăng nhập) liệt kê các việc đang chờ. Bấm vào một việc để mở đúng màn hình xử lý (NV-03, NV-04, NV-05…).

---

## 2. KỊCH BẢN 1: LUỒNG CHÍNH (HAPPY PATH - 5 PHÚT)
*Từ gửi yêu cầu thuê, AI đọc giấy tờ, đặt cọc VietQR, ký hợp đồng, kiểm tra kỹ thuật và bàn giao xe.*

| Thời gian | Vai trò (tab) | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **00:00 - 00:45** | Khách hàng | **KH-01: Chọn xe** (`/kh/01`) | - Trên header bấm **Dòng xe → Xe số** (trang chỉ hiện dòng Xe số kèm danh sách mẫu xe còn trống).<br>- Chọn nhận xe ngày mai, trả sau 3 ngày.<br>- Chỉ cho hội đồng dòng **"Dự kiến xe … · giá/ngày"** và tổng tiền ước tính.<br>- Bấm **"Tiếp tục"** (`data-testid="node-M_START"`). | - Hệ thống tự gán một xe còn trống (`M_CheckFleet` → `M_G01`).<br>- Chuyển sang **KH-02**. |
| **00:45 - 01:45** | Khách hàng | **KH-02: Giấy tờ** (`/kh/02`) | - Xem báo giá và tiền cọc 30%.<br>- Tải lên 3 ảnh: CCCD mặt trước, CCCD mặt sau, GPLX mặt trước. AI tự đọc ngay sau khi tải.<br>- Kiểm tra họ tên, số CCCD, ngày sinh, hạng GPLX được điền sẵn; sửa nếu sai.<br>- Tick xác nhận thông tin đúng, bấm **"Đặt cọc"** (`data-testid="node-M_CheckDocs"`). | - Thông tin được tự điền từ ảnh.<br>- Gemini: tự duyệt khi mọi trường có độ tin cậy từ **95%** trở lên; từ 80% đến dưới 95% thì cần đối chiếu; dưới 80% thì yêu cầu chụp lại.<br>- Chế độ LOCAL: luôn yêu cầu khách đối chiếu thông tin trước khi tiếp tục.<br>- Chuyển sang **KH-03**. |
| **01:45 - 02:45** | Khách hàng | **KH-03: Đặt cọc** (`/kh/03`) | - Xem mã **VietQR** và đồng hồ đếm ngược 30 phút.<br>- Bấm **"Tôi đã chuyển khoản"** để mở hộp giả lập ngân hàng.<br>- Bấm **"Đúng số tiền"**, rồi **"Xác nhận thanh toán"**. | - Hệ thống đối soát thành công (`M_CheckDeposit` → `M_G03` = Đủ).<br>- Báo "Đã nhận đủ tiền cọc", chuyển sang **KH-04**. |
| **02:45 - 03:30** | Khách hàng | **KH-04: Ký hợp đồng** (`/kh/04`) | - Xem điều khoản hợp đồng điện tử.<br>- Ký vào khung chữ ký.<br>- Bấm **"Ký hợp đồng"** (`data-testid="node-M_WaitSign"`). | - Hợp đồng được ký, lịch xe được khóa (`M_SaveBooking`).<br>- Hồ sơ chuyển sang chờ bàn giao (`CHO_BAN_GIAO`). |
| **03:30 - 04:15** | Nhân viên | **NV-03 & NV-04** (`/nv/03`, `/nv/04`) | - Chuyển sang tab **Nhân viên**, ở **NV-01** bấm việc "Kiểm tra xe".<br>- **NV-03**: tick đạt các mục kiểm tra, bấm **"Đạt & Chụp ảnh bàn giao"**.<br>- **NV-04**: bấm **"Nạp ảnh mẫu nhanh"**, rồi **"Gửi khách duyệt tình trạng xe"**. | - Kết quả kiểm tra được lưu (`M_InspectPre` → `M_G04` = Đạt).<br>- Ảnh tình trạng xe được gửi cho khách (`M_Photo` → `Activity_0w8x12e`). |
| **04:15 - 05:00** | Khách hàng → Nhân viên | **KH-05 & NV-05** (`/kh/05`, `/nv/05`) | - Tab **Khách hàng**: mở **KH-05**, xem ảnh xe, bấm **"Xác nhận nhận xe"** (`data-testid="node-Gateway_0ixde68"`).<br>- Tab **Nhân viên**: mở **NV-05**, bấm **"Xác nhận bàn giao xe & Phụ kiện"** (`data-testid="node-M_Handover"`). | - Hồ sơ chuyển sang **`DANG_THUE`** (`M_SetRented`).<br>- Hệ thống chờ một trong ba sự kiện: Trả xe / Gia hạn / Sự cố (`M_EG`). |

> ⚠️ Nút **"Xác nhận nhận xe"** ở KH-05 chỉ bấm được sau khi nhân viên làm xong NV-03 và NV-04.

---

## 3. KỊCH BẢN 2: NGOẠI LỆ 1 - SỰ CỐ DỌC ĐƯỜNG & CỨU HỘ (2.5 PHÚT)
*Minh họa quy trình con SP2 (Hỗ trợ sự cố): hệ thống tự điều phối đối tác cứu hộ, đối tác phản hồi, nhân viên chốt chi phí và cho khách tiếp tục hành trình.*

| Thời gian | Vai trò (tab) | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **05:00 - 05:45** | Khách hàng | **KH-06 → KH-08: Báo sự cố** (`/kh/06`, `/kh/08`) | - Ở **KH-06** (Chuyến đi của tôi), bấm **"Báo sự cố"** ở chuyến đang thuê.<br>- Chọn loại sự cố, ví dụ **"Thủng lốp / Xịt lốp"**, nhập mô tả và vị trí, đính kèm ảnh nếu có.<br>- Bấm **"Gửi yêu cầu cứu hộ khẩn cấp"** (`data-testid="node-SC_Create"`). | - Phiếu sự cố được tạo (`SC_Create`).<br>- Hệ thống tự chọn đối tác theo vùng và gửi yêu cầu (`SC_Select` → `SC_Dispatch`).<br>- KH-08 hiện khung **"Tiến độ cứu hộ"**. |
| **05:45 - 06:30** | Nhân viên hoặc Quản lý | **DT-01: Giả lập đối tác cứu hộ** (`/dt/01`) | - Mở trang `/dt/01` (đóng vai đối tác cứu hộ).<br>- Bấm **"Tiếp nhận cứu hộ"**.<br>- Nhập ghi chú kết quả, bấm **"Báo kết quả cứu hộ hoàn tất"**. | - Đối tác đã nhận việc (`SC_ReceiveAck` → `SC_GAccept` = Có).<br>- Kết quả cứu hộ được ghi nhận (`SC_ReceiveResult`). |
| **06:30 - 07:30** | Nhân viên | **NV-10: Xác nhận sự cố & ghi phí** (`/nv/10`) | - Kiểm tra chi phí thực tế (mặc định 150.000 ₫, sửa được).<br>- Bấm **"Tiếp tục cho thuê"**. | - Chi phí sự cố được ghi nhận (`SC_Log`).<br>- Khách được thông báo tiếp tục hành trình (`SC_SettleDecision` → `SC_SendContinue`).<br>- Hồ sơ trở về **`DANG_THUE`**. |

> 💡 **Nhánh khác có thể kể thêm**: nếu đối tác bấm **"Từ chối tiếp nhận"**, hệ thống tìm đối tác khác (`SC_TryNext`). Nếu ở NV-10 nhân viên chọn **"Trả xe sớm"**, khách được hướng dẫn trả xe trước hạn (`SC_NotifyEarly`).  
> ⚠️ Bản hiện tại **không có bước cấp xe thay thế** trong luồng sự cố, và mỗi chuyến chỉ báo được **một** sự cố. Trang cứu hộ chỉ mở cho chuyến đã nhận xe.

---

## 4. KỊCH BẢN 3: NGOẠI LỆ 2 - TRẢ XE CÓ HƯ HỎNG, KHIẾU NẠI & HÒA GIẢI (2.5 PHÚT)
*Minh họa đối chiếu ảnh giao/trả, lập bảng kê, xử lý tranh chấp và quyết toán hoàn cọc.*

| Thời gian | Vai trò (tab) | Màn hình | Thao tác thực hiện | Kết quả kỳ vọng trên màn hình |
| :--- | :--- | :--- | :--- | :--- |
| **07:30 - 08:15** | Khách hàng → Nhân viên | **KH-06 → NV-06 → NV-07** (`/kh/06`, `/nv/06`, `/nv/07`) | - Tab **Khách hàng**: ở **KH-06** bấm **"Trả xe"**.<br>- Tab **Nhân viên**: **NV-06** bấm **"Xác nhận đã nhận xe"**, sau đó trong bảng đối chiếu ghi chú sai lệch ở một mục (ví dụ "Trầy xước yếm bên phải"), bấm **"Hoàn tất kiểm tra đối chiếu"**.<br>- **NV-07**: kiểm tra hư hỏng, nhập chi phí đền bù (ví dụ **150.000 ₫**), bấm **"Xác nhận hư hỏng & Gửi bảng kê"**. | - Phát hiện sai lệch giữa ảnh giao và trả (`M_DigitalCompare` → `M_GDamage` = Có).<br>- Hệ thống tự tính phí (`M_CalcFees`) và gửi bảng kê cho khách (`M_SendStatement`). |
| **08:15 - 09:00** | Khách hàng → Quản lý | **KH-09 & QL-01: Khiếu nại & hòa giải** (`/kh/09`, `/ql/01`) | - Tab **Khách hàng**: ở **KH-09** nhập lý do (ví dụ "Vết xước nhẹ đã có từ trước, xin giảm phí"), bấm **"Gửi khiếu nại"**.<br>- Tab **Quản lý**: ở **QL-01** xem bằng chứng, điều chỉnh phí (ví dụ giảm còn **70.000 ₫**), bấm **"Duyệt phương án & Gửi lại bảng kê"**.<br>- Tab **Khách hàng**: mở lại **KH-09**, bấm **"Xác nhận bảng kê"**. | - Khiếu nại chuyển cho quản lý (`M_GDispute` = Không → `M_Resolve`).<br>- Bảng kê mới được gửi lại cho khách (`M_ApproveAdjustment` → `M_SendStatement`).<br>- Khách đồng ý, hệ thống đối trừ tiền cọc (`M_NetDeposit`). |
| **09:00 - 10:00** | Khách hàng → Nhân viên | **KH-10 & NV-09: Hoàn cọc & lưu hồ sơ** (`/kh/10`, `/nv/09`) | - Tab **Khách hàng**: ở **KH-10** xem số tiền hoàn cọc do hệ thống tự tính, bấm **"Xác nhận đã nhận tiền"**.<br>- Tab **Nhân viên**: ở **NV-09** đánh giá tình trạng xe sau trả, bấm **"Xác nhận đánh giá & Lưu hồ sơ"**.<br>- Tab **Quản lý**: mở **`/ai-log`** và **`/integration-log`** để tổng kết. | - Quyết toán hoàn tất (`M_ConfirmRefund` → `M_Settle`), hồ sơ chuyển sang **`HOAN_TAT`**.<br>- Xe đạt thì về trạng thái sẵn sàng (`M_MarkReady`); cần bảo trì thì vào bảo trì (`M_Maintenance`). Hồ sơ được lưu tự động (`M_Archive`).<br>- Hai trang nhật ký cho thấy lịch sử AI và các lần gọi tích hợp. |

> 💡 Nếu phí phát sinh lớn hơn tiền cọc, KH-10 sẽ hiện bước **thu thêm** thay vì hoàn cọc; khách bấm **"Xác nhận đã chuyển khoản"**.

---

## 5. ĐIỂM NHẤN NÊN TRÌNH BÀY VỚI HỘI ĐỒNG
1. **Tuân thủ BPMN**: mỗi nút bấm và cổng rẽ nhánh đều gắn với mã phần tử trong sơ đồ To-Be (đối chiếu trong `docs/TRACEABILITY.md`).
2. **AI đọc giấy tờ**: tự điền thông tin từ ảnh CCCD/GPLX, phân nhánh theo ngưỡng tin cậy (tự duyệt / cần đối chiếu / yêu cầu chụp lại).
3. **Chống trùng xe**: một xe đã gán cho đơn đang xử lý thì không được gán cho đơn khác trong cùng khung giờ; hết xe thì khách được báo ngay ở KH-01.
4. **Mô phỏng ngân hàng và đối tác**: giả lập chuyển khoản VietQR và đối tác cứu hộ, demo được cả nhánh thành công lẫn nhánh lỗi (chuyển thiếu, sai nội dung, đối tác từ chối).
5. **Chạy không cần mạng** khi chọn chế độ OCR trên thiết bị (`LOCAL`) hoặc giả lập (`MOCK`); chế độ Gemini (`LIVE`) cần mạng.

---

## 6. NHÁNH LỖI CÓ THỂ DEMO THÊM (NẾU CÒN THỜI GIAN)
| Muốn minh họa | Thao tác |
| :--- | :--- |
| Chuyển thiếu tiền cọc | KH-03 → "Tôi đã chuyển khoản" → **"Chuyển thiếu"** → "Xác nhận thanh toán". Hồ sơ chuyển nhân viên đối soát ở **NV-02**. |
| Sai nội dung chuyển khoản | KH-03 → **"Sai nội dung"** → "Xác nhận thanh toán". |
| Xe kiểm tra chưa đạt | NV-03 → **"Chưa đạt (Khắc phục)"** → ghi chú khắc phục hoặc chọn xe thay thế còn trống → kiểm tra lại. |
| Khách chưa đồng ý nhận xe | KH-05 → nhập lý do → **"Yêu cầu kiểm tra lại"**. Hồ sơ quay về NV-03. |
| Hết xe | KH-01 chọn khung giờ mà dòng xe đã hết xe trống: ô ước tính hiện **"Hết xe"**. |
| Hết hạn đặt cọc | Khi hồ sơ đang chờ cọc, mở DevPanel (`Ctrl + Shift + D`) → bấm **"+2h"** (hạn cọc là 30 phút). Hệ thống tự kích hoạt hẹn giờ quá hạn và từ chối hồ sơ. |
