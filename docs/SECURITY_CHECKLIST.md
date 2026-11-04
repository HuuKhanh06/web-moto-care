# BẢNG KIỂM TRA AN TOÀN BẢO MẬT PHÍA FRONTEND (SECURITY CHECKLIST)

> **Dự án:** MOTO CARE - Hệ Thống Thuê Xe Máy Trực Tuyến  
> **Kiến trúc:** Frontend-Only (Trình duyệt web kết hợp IndexedDB & Web Crypto)  
> **Mục đích:** Báo cáo kiểm định an ninh ứng dụng phục vụ đồ án môn học  

---

## 1. Kết quả kiểm tra các hạng mục bảo mật bắt buộc

| STT | Tiêu chí bảo mật | Hiện thực kỹ thuật | Bằng chứng kiểm tra | Đánh giá |
|:---:|:---|:---|:---|:---:|
| **1** | **Không lưu khóa API trong mã nguồn & Git** | Khóa API chỉ đọc qua biến môi trường `import.meta.env.VITE_*` (nạp từ `.env.local` đã nằm trong `.gitignore`) hoặc cấu hình qua giao diện và chỉ lưu tạm trong `sessionStorage`. Cấm commit file `.env.local` hoặc secret keys. | Quét mã nguồn bằng lệnh:<br>`Select-String -Pattern "AIzaSy[0-9A-Za-z]" -Path src/*`<br>-> **Không có khóa thật** (chỉ có chuỗi placeholder giao diện). | **ĐẠT** |
| **2** | **Băm mật khẩu Web Crypto API** | Mật khẩu tài khoản được băm bằng thuật toán **PBKDF2-HMAC-SHA256 với 100.000 vòng lặp và Salt ngẫu nhiên 16 bytes** sinh từ `crypto.getRandomValues`. Tuyệt đối không lưu mật khẩu thô trong IndexedDB. | File [`src/features/auth/authStore.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/auth/authStore.ts)<br>Test [`tests/unit/auth_router.test.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/auth_router.test.tsx) test case 1. | **ĐẠT** |
| **3** | **Giới hạn đăng nhập sai liên tiếp (Anti-Brute Force)** | Tự động đếm `failed_attempts`. Nếu nhập sai quá 5 lần liên tiếp, tài khoản bị khóa tạm thời 1 phút (`locked_until`), từ chối mọi yêu cầu đăng nhập trong thời gian khóa. | File [`src/features/auth/authStore.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/auth/authStore.ts)<br>Test [`tests/unit/auth_router.test.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/auth_router.test.tsx) test case 2. | **ĐẠT** |
| **4** | **Phân quyền Route Guard theo vai trò** | Bộ điều hướng `ProtectedRoute` kiểm tra vai trò người dùng hiện tại (`khach_hang`, `nhan_vien`, `quan_ly`). Mọi cố gắng truy cập trái quyền bị chặn tức thì và điều hướng về trang chủ tương ứng. | File [`src/features/auth/ProtectedRoute.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/auth/ProtectedRoute.tsx)<br>Test [`tests/unit/auth_router.test.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/auth_router.test.tsx) test case 4. | **ĐẠT** |
| **5** | **Kiểm tra quyền Actor tại Tầng Repository & Engine** | Mỗi tác vụ người (`User Task`) và hành động thay đổi dữ liệu đều xác minh `actor.role` qua `TASK_ROLE_MAP`. Gọi sai quyền sẽ bị từ chối với lỗi `Actor ... không có quyền`. | File [`src/engine/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/engine/index.ts)<br>Test [`tests/unit/database.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/database.test.ts) test case 4. | **ĐẠT** |
| **6** | **Xác thực dữ liệu đầu vào bằng Zod Schema** | Toàn bộ dữ liệu nhập liệu từ người dùng, file backup phục hồi và phản hồi từ AI Agent OCR đều bắt buộc đi qua Zod Schema xác thực kiểu và định dạng trước khi lưu vào IndexedDB. | File [`src/ai/types.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/ai/types.ts), [`src/db/backup.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/db/backup.ts). | **ĐẠT** |
| **7** | **Phòng chống tấn công XSS (Cross-Site Scripting)** | Ứng dụng **hoàn toàn không sử dụng `dangerouslySetInnerHTML`**; React tự động escape HTML khi render dữ liệu. | Quét mã nguồn:<br>`Get-ChildItem -Path src -Filter *.tsx \| Select-String "dangerouslySetInnerHTML"`<br>-> **0 kết quả**. | **ĐẠT** |
| **8** | **Kiểm soát tệp tải lên (File Upload Validation)** | Giới hạn định dạng tải lên chỉ nhận hình ảnh hợp lệ (`image/jpeg`, `image/png`, `image/webp`). Tự động nén ảnh qua HTML5 Canvas với độ phân giải tối đa 1280px và dung lượng dưới 300KB trước khi lưu. | File [`src/components/ui/FileUpload.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/components/ui/FileUpload.tsx). | **ĐẠT** |

---

## 2. Hạn Chế Đã Biết Của Kiến Trúc Frontend-Only (Security Limitations)

> [!WARNING]
> **CẢNH BÁO BẢO MẬT & ĐỐI TRỪ RỦI RO (DÀNH CHO ĐỒ ÁN MÔN HỌC):**
> 
> 1. **Môi trường thực thi trong trình duyệt:**
>    - Do đồ án tuân thủ nghiêm ngặt ràng buộc kiến trúc **Frontend-Only** (không triển khai máy chủ Backend hay Database Server bên ngoài), toàn bộ mã nguồn JavaScript, cơ sở dữ liệu IndexedDB và logic xác thực đều chạy trên thiết bị của người dùng (Client-Side).
>    - Một người dùng có kiến thức kỹ thuật có thể mở trình duyệt DevTools (`F12`), kiểm tra bộ nhớ `sessionStorage`/`IndexedDB` hoặc chỉnh sửa mã JavaScript tại chỗ.
> 2. **Bảo mật khóa API tích hợp (EmailJS / Gemini / VietQR):**
>    - Các khóa API cấu hình trên ứng dụng frontend nằm trong tầm quan sát của trình duyệt. Vì vậy, ứng dụng được thiết kế hoạt động mặc định ở chế độ **MOCK** (không cần kết nối mạng hoặc khóa API).
>    - Khi cần chạy chế độ **LIVE** để demo, người dùng chỉ nên sử dụng các khóa API có quyền hạn giới hạn (ví dụ EmailJS Public Key hoặc Gemini API key có quota thử nghiệm miễn phí).
> 3. **Khuyến nghị cho môi trường sản xuất (Production):**
>    - Trong một hệ thống thương mại thực tế, kiến trúc bắt buộc phải bổ sung tầng **Backend API Gateway / Backend-For-Frontend (BFF)**.
>    - Toàn bộ cơ chế băm mật khẩu, phân quyền Role-Based Access Control (RBAC), lưu trữ khóa bí mật (Secret Keys) và gọi API thứ ba phải được chuyển hoàn toàn về phía máy chủ để bảo đảm an toàn dữ liệu và quyền riêng tư của khách hàng.

