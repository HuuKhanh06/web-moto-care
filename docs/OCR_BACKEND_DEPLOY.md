# Triển khai quét giấy tờ online

## Đã chuẩn bị

Frontend → Supabase Edge Function `document-ocr` → Gemini → biểu mẫu để khách đối chiếu.
Khóa Gemini chỉ ở server. Function không ghi ảnh hay nội dung giấy tờ vào log/database.
Frontend vẫn lưu ảnh/kết quả theo cơ chế hồ sơ hiện có của ứng dụng; thay đổi này không xóa dữ liệu hồ sơ.
Chưa triển khai lên dịch vụ thật và chưa gửi ba ảnh cá nhân dùng thử sang Google.

## Cấu hình một lần

1. Trong Supabase Dashboard, Authentication → Providers → Anonymous Sign-ins: bật anonymous sign-ins.
   Phiên này phục vụ xác thực dịch vụ OCR, không thay thế hệ thống tài khoản tự quản lý hiện có.
   Bật CAPTCHA cho anonymous sign-ins cần bổ sung giao diện CAPTCHA tương ứng trước khi sử dụng.
2. Trong GitHub repository → Settings → Secrets and variables → Actions (hoặc environment `github-pages`), thêm secrets:
   - `SUPABASE_ACCESS_TOKEN`: access token tài khoản có quyền triển khai project.
   - `SUPABASE_DB_PASSWORD`: mật khẩu database của project.
   - `GEMINI_API_KEY`: khóa Gemini dùng riêng trên server, có quota/billing phù hợp.
   Không dùng tên `VITE_GEMINI_API_KEY` cho khóa production.
3. Thêm repository variables:
   - `SUPABASE_PROJECT_REF`: project ref của Supabase đang dùng, ví dụ `cvgbgwuzhkuinwzlyijt` (kiểm tra đúng project trước khi chạy).
   - `SUPABASE_POOLER_HOST`: hostname trong Supabase → Connect → Session pooler. Chỉ sao chép host kết thúc `.pooler.supabase.com`, không có mật khẩu, username, port hay `postgresql://`. Không đoán host từ region: mỗi vùng có thể có nhiều pooler cluster.
   - `OCR_ALLOWED_ORIGINS`: `https://huukhanh06.github.io` (origin không có `/web-moto-care/`). Nhiều origin phân cách dấu phẩy.
   - `GEMINI_MODEL`: mặc định `gemini-3.5-flash`.
4. Đưa mã nguồn lên GitHub rồi chạy Actions → **Deploy OCR backend** → Run workflow.
   Workflow áp dụng migration quota và triển khai function. Cần duyệt migration trước khi chạy vì `db push` áp dụng các migration chưa chạy trong thư mục.
   Workflow dùng Supabase CLI v3, kết nối Session pooler port 5432 qua IPv4 và đọc mật khẩu từ `SUPABASE_DB_PASSWORD`. Không dùng direct connection IPv6 hoặc transaction pooler port 6543.
5. Sau khi backend triển khai thành công, đặt repository variable:
   `VITE_OCR_ENDPOINT=https://<project-ref>.supabase.co/functions/v1/document-ocr`
6. Chạy lại **Deploy to GitHub Pages**. Frontend tự chuyển sang backend; cấu hình LOCAL cũ trong trình duyệt không ghi đè được.

Không đặt `VITE_OCR_ENDPOINT` trước khi backend sẵn sàng.

## Kiểm tra sau triển khai

- Mở trang bằng phiên trình duyệt mới, tải ba ảnh và đồng ý gửi đến Google Gemini.
- Network chỉ có yêu cầu OCR tới `/functions/v1/document-ocr`; không có khóa Gemini trong browser bundle/request.
- Kết quả tự điền, khách đối chiếu rồi xác nhận. Không tự xác nhận tính thật/giả của thẻ.
- Kiểm tra lỗi mất mạng, giới hạn lượt và thử lại. Ảnh không phải tải lại khi quét lỗi.
- Không chụp/đưa ảnh giấy tờ, kết quả cá nhân hoặc khóa API vào issue/log công khai.

## Giới hạn và timeout

- 5 lượt / phiên / 5 phút và 100 lượt toàn hệ thống / 5 phút, kiểm tra nguyên tử trên database.
  Phiên ẩn danh không tương đương tài khoản khách; hạn mức tổng giúp giới hạn lạm dụng bằng cách tạo lại phiên.
- Tổng thời gian backend 95 giây, frontend 110 giây (không còn giới hạn LOCAL 60 giây).
- Thử lại tối đa một lần khi Gemini trả HTTP 5xx; không lặp lại khi hết quota, sai khóa hay ảnh không hợp lệ.
- Đây là request đồng bộ có giới hạn, chưa phải hàng đợi tác vụ nền. Vẫn có thể timeout khi mạng/provider lỗi;
  không có bảo đảm quét thành công mọi ảnh. Nếu thực tế thường xuyên vượt 95 giây, cần triển khai worker/queue bền vững.
- Backend không lưu thêm ảnh. Chính sách lưu/xóa của Google và thời gian lưu hồ sơ trong ứng dụng cần được chủ dự án quyết định trước khi dùng production.

## Chạy local

Đặt server secrets trong file riêng không commit, dùng Supabase CLI để serve function và áp dụng migration.
Trong `.env.local`, đặt `VITE_OCR_ENDPOINT=http://127.0.0.1:54321/functions/v1/document-ocr` và cấu hình Supabase local tương ứng.
Thêm `http://127.0.0.1:5173` vào `OCR_ALLOWED_ORIGINS` của server local.
Không dùng dữ liệu giấy tờ thật cho kiểm thử tự động.
