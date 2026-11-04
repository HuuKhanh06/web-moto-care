# LUẬT DỰ ÁN MOTO CARE

Tài liệu này là quy chuẩn và luật bất biến cho toàn bộ quá trình phát triển dự án MOTO CARE.

---

## 1. RÀNG BUỘC CỐT LÕI (Áp dụng cho mọi giai đoạn)
- **CHỈ làm web Frontend.** KHÔNG viết backend, KHÔNG dùng Supabase/Firebase/server. Mọi "Edge Function", "cron", "webhook", "RLS" trong tài liệu `docs/` phải được hiện thực hóa hoàn toàn phía trình duyệt.
- **Tuân thủ BPMN To-Be:** Ứng dụng phải bám sát mô hình BPMN To-Be đã đóng băng trong `docs/` (110 phần tử). Không tự ý thêm, bớt hay đổi luồng quy trình. Nếu thấy mâu thuẫn hoặc thiếu sót, ghi vào `docs/QUESTIONS.md` và xin ý kiến, tuyệt đối không tự quyết.
- **Ngôn ngữ:** Giao diện và toàn bộ nội dung hiển thị sử dụng TIẾNG VIỆT.

---

## 2. BẢNG QUY ĐỔI KIẾN TRÚC (Backend -> Frontend)
| Khái niệm trong tài liệu docs/ | Hiện thực hóa phía Frontend (Browser) |
| :--- | :--- |
| **Edge Function `fn_xxx`** | Hàm TypeScript thuần trong `src/engine/fn/`, giữ nguyên tên `fn_xxx`, thực thi trực tiếp trong trình duyệt. |
| **Database Postgres** | IndexedDB thông qua thư viện `Dexie`, tên bảng và tên trường tuân thủ đúng `docs/data-model.csv`. |
| **RLS / Phân quyền** | Route guard + kiểm tra quyền trong tầng repository (`src/db/repo/`); mỗi thao tác kiểm tra vai trò hiện tại và ném lỗi nếu không hợp lệ. |
| **Cron / Timer** | Hàm `sweepTimers()` trong `src/engine/timers.ts`, chạy định kỳ mỗi 5 giây và khi tab trình duyệt được focus, kết hợp đồng hồ demo tua nhanh thời gian. |
| **Webhook thanh toán / Đối tác** | Bảng điều khiển "Giả lập ngân hàng" và màn hình DT-01 do Quản lý thao tác. |
| **Storage ảnh / Hợp đồng** | Lưu dưới dạng `Blob` trong IndexedDB, nén ảnh về kích thước tối đa 1280px, dung lượng ~300KB trước khi lưu. |
| **Xác thực (Auth)** | Đăng nhập phía FE với mật khẩu băm: 3 vai trò `khach_hang`, `nhan_vien`, `quan_ly` (Đối tác KHÔNG đăng nhập). |

---

## 3. QUY ƯỚC LẬP TRÌNH & CHẤT LƯỢNG MÃ NGUỒN
- **TypeScript Strict:** Bật strict mode (`strict: true`), tuyệt đối không dùng kiểu `any`. Kiểm tra tính hợp lệ của dữ liệu vào (validation) bằng `Zod`.
- **Process Engine & Event Tracking:** Mọi bước chuyển đổi trạng thái hoặc tiến trình quy trình phải đi qua `src/engine` và được ghi nhận vào bảng `process_events` với `bpmn_node_id` tương ứng chính xác ID trong file BPMN.
- **data-testid quy chuẩn BPMN:** Mọi nút bấm, tương tác hoặc khu vực ứng với một phần tử BPMN phải có thuộc tính `data-testid="node-<ID phần tử>"` (ví dụ: `data-testid="node-M_G03b"`) phục vụ kiểm thử tự động.
- **Bảo mật:** Không commit khóa API hay thông tin nhạy cảm. Quản lý cấu hình qua `.env.local` (được gitignore) và mẫu biến môi trường tại `.env.example`.
- **Mã nguồn giải trình được:** Viết mã rõ ràng, đơn giản, hạn chế trừu tượng hóa quá mức. Bổ sung chú thích tiếng Việt ở các khối xử lý logic nghiệp vụ quan trọng.

---

## 4. QUY CHUẨN THIẾT KẾ GIAO DIỆN (Design System)
- **Tông màu chủ đạo:** Tông XANH LÁ phong cách hiện đại, thân thiện (lấy cảm hứng từ phong cách xe điện Xanh SM: nền sáng, nhấn xanh lá, tinh gọn). Tuyệt đối không dùng logo/tên/hình ảnh thuộc bản quyền thương hiệu khác.
- **Bảng màu Design Token (`tailwind.config.js`):**
  - `brand-50`: `#ECFAF2`
  - `brand-100`: `#D3F3E2`
  - `brand-300`: `#7ADDAB`
  - `brand-500`: `#00A651` (Xanh chính: icon, viền, progress bar, nền nhạt)
  - `brand-600`: `#00914A`
  - `brand-700`: `#00803F` (Nền nút chính, chữ xanh trên nền trắng - đạt chuẩn tương phản WCAG AA >= 4.5:1)
  - `brand-900`: `#0B3D26` (Tiêu đề trên nền xanh nhạt)
  - **Màu chức năng:** Trung tính dùng `slate`; Cảnh báo: `#F59E0B`; Lỗi: `#DC2626`; Thông tin: `#0EA5E9`.
- **Quy tắc thành phần:**
  - Card: bo góc lớn `rounded-2xl`, đổ bóng nhẹ `shadow-sm`.
  - Nút bấm & Ô nhập liệu: bo góc `rounded-xl`.
  - Mobile-first: nút hành động chính full width trên điện thoại; thanh điều hướng dưới (bottom nav) cho khách hàng trên mobile.
  - Font chữ: Cài đặt và sử dụng `@fontsource/be-vietnam-pro` cục bộ (đảm bảo ứng dụng chạy offline).
  - Không viết mã màu cứng (hardcode color hex/rgb) trong component, luôn sử dụng tailwind token.
- **Quy ước Badge trạng thái hồ sơ:**
  - Đang xử lý: Xanh nhạt (`bg-brand-50 text-brand-700 border-brand-200`)
  - Chờ khách / Chờ việc: Vàng (`bg-amber-50 text-amber-700 border-amber-200`)
  - Từ chối / Hủy / Lỗi: Đỏ (`bg-red-50 text-red-700 border-red-200`)
  - Hoàn tất: Xanh đậm (`bg-brand-100 text-brand-900 border-brand-300`)

---

## 5. QUY TRÌNH LÀM VIỆC & QUẢN LÝ PHIÊN BẢN (Git & AI Log)
- **Lập kế hoạch trước khi làm:** Luôn trình bày kế hoạch và danh mục công việc trước khi viết mã, chờ phê duyệt trước khi tiến hành; không sửa đổi ngoài phạm vi giai đoạn được giao.
- **Kiểm tra chất lượng liên tục:** Chạy `npm run lint`, `npm run typecheck`, `npm run test` sau mỗi công việc quan trọng.
- **Quy chuẩn Git Commit:** Commit nhỏ, thông điệp rõ ràng theo định dạng `feat(phase-N): ...`, `fix: ...`, `test: ...`, `docs: ...`. Mỗi giai đoạn đảm bảo tối thiểu 3 commits.
- **Nhật ký AI Log:** Cập nhật `docs/AI_LOG.md` ở cuối mỗi giai đoạn:
  - Mục tiêu giai đoạn
  - Prompt đã sử dụng
  - Kết quả đạt được
  - Sai sót/điểm cần chỉnh sửa và nguyên nhân, cách khắc phục (ghi trung thực)
