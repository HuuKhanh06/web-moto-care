# Reset dữ liệu người dùng cho lần ra mắt

Thao tác phá hủy dữ liệu do chủ dự án yêu cầu. Không chạy lại sau khi website bắt đầu có khách mới.
Script quản trị không nằm trong thư mục migrations và không tự chạy cùng deploy.

## Phạm vi

- Xóa tài khoản/hồ sơ khách, đơn thuê, CCCD/GPLX đã lưu trong bảng, thanh toán, hợp đồng,
  lịch xe, kiểm tra/bàn giao, sự cố, bảo trì, thông báo, process state, timers, audit/AI/integration logs và quota cũ.
- Xóa Supabase Auth users/sessions cũ (ba tài khoản ứng dụng là tài khoản tự quản lý trong `public.auth_accounts`).
- Tạo lại đúng ba tài khoản ứng dụng với password `password123`: `admin@motocare.vn`, `nhanvien1@motocare.vn`, `nhanvien2@motocare.vn`.
- Giữ xe, đối tác, schema, khóa cấu hình, Edge Function OCR. Xe đang thuê được chuyển về sẵn sàng.
- Thêm trigger chặn ghi từ phiên bản ứng dụng cũ để outbox cũ không tự nạp lại dữ liệu.
  Đây chỉ là kiểm tra phiên bản dữ liệu, không thay thế RLS/xác thực.

## Thứ tự bắt buộc

1. Đóng các tab website hiện có. Không thao tác nghiệp vụ trong thời gian reset.
2. Nếu các bucket `documents`, `handovers`, `incidents` có file, xóa file trong Storage Dashboard hoặc Storage API trước.
   Không xóa `storage.objects` bằng SQL. Script kiểm tra và dừng toàn bộ giao dịch nếu còn file.
3. Mở SQL Editor của **cvgbgwuzhkuinwzlyijt**, tạo query mới, dán toàn bộ `supabase/admin/reset-for-launch.sql`, Run.
   Kiểm tra kết quả có đúng 3 email, `customer_accounts=0`, `rental_requests=0`.
4. Chỉ sau SQL thành công mới triển khai bản frontend có `DATA_EPOCH=motocare-fresh-20261111-1`
   và Dexie DB version 2. Bản frontend mới xóa cache tài khoản/hồ sơ cũ, session và outbox khi người dùng mở lại.
5. Đợi GitHub Pages deploy xong, Ctrl+F5, đăng nhập lại bằng một trong ba tài khoản nội bộ.

Nếu SQL báo lỗi, không triển khai frontend reset, gửi nguyên thông báo lỗi để xử lý.
Giao dịch SQL rollback nếu lỗi; phần xóa file Storage đã thực hiện trước đó không thể rollback.

## Giới hạn cần hiểu

- Không thể xóa từ xa dữ liệu trên thiết bị đang offline hoặc chưa mở lại phiên bản mới.
  Trigger chặn phiên bản cũ ghi dữ liệu trở lại; dữ liệu cục bộ được dọn khi mở bản mới.
- Không xóa bản backup/export do người dùng đã tải xuống, log hạ tầng do nhà cung cấp lưu,
  hoặc dữ liệu đã gửi tới bên thứ ba. Không coi reset ứng dụng là cam kết xóa mọi bản sao bên ngoài hệ thống.
- Sau khi sử dụng OCR, Supabase có thể tạo lại anonymous Auth users. Chúng không phải tài khoản đăng nhập khách trong `public.auth_accounts`.
