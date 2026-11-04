# MOTO CARE - HỆ THỐNG QUẢN LÝ QUY TRÌNH CHO THUÊ XE MÁY TRỰC TUYẾN

> **Đồ án môn học:** Quản lý Quy trình Kinh doanh (Business Process Management - BPMN)  
> **Kiến trúc hệ thống:** 100% Frontend-Only SPA (Single Page Application)  
> **Quy trình chuẩn hóa:** 110 phần tử BPMN To-Be (Bao gồm Main Process và 2 Sub-processes: SP1 Gia hạn, SP2 Sự cố)  
> **Công nghệ lõi:** React 18, TypeScript, Tailwind CSS, Dexie.js (IndexedDB), Web Crypto API (PBKDF2), Google Gemini AI Agent, VietQR API, EmailJS, Vitest & Playwright.

---

## 1. GIỚI THIỆU DỰ ÁN & BẢN SẮC THIẾT KẾ

**MOTO CARE** là ứng dụng chuyển đổi số toàn diện quy trình cho thuê xe máy du lịch & công tác. Dự án được phát triển theo mô hình BPMN To-Be đã chuẩn hóa, áp dụng nghiêm ngặt các nguyên lý tách biệt giữa **BPMN State Machine Engine** và **Presentation Layer (React Components)**.

### Bản sắc thiết kế (Design Tokens)
- **Tông màu chủ đạo:** Xanh lá hiện đại (Eco-green: `#00A651`, `#00803F`), mang thông điệp di chuyển thông minh, an toàn và thân thiện môi trường.
- **Thành phần UI:** Bộ linh kiện tùy biến riêng trong `src/components/ui/` (Button, Input, Modal, Badge, Stepper, Table, Toast, QRBox, FileUpload).
- **Phông chữ:** `Be Vietnam Pro` đóng gói cục bộ thông qua `@fontsource`, hỗ trợ hoạt động offline hoàn toàn.
- **Tương thích:** Thiết kế theo triết lý **Mobile-First**, co giãn hoàn hảo từ màn hình điện thoại thông minh (375px) đến máy tính bảng và desktop.
- **Định dạng chuẩn:** Tiếng Việt, tiền tệ VND (`100.000 đ`), định dạng ngày giờ chuẩn Việt Nam (`DD/MM/YYYY HH:mm`).

---

## 2. BẢNG TÀI KHOẢN MẪU & PHÂN QUYỀN TRUY CẬP

Hệ thống tích hợp cơ chế xác thực phía Client nghiêm túc với **Web Crypto API (PBKDF2 + muối ngẫu nhiên)**, giới hạn 5 lần đăng nhập sai (khóa tạm 1 phút) và phân định 3 vai trò tương ứng với các Pool/Lane trong BPMN:

| Vai trò (Role) | Tên đăng nhập | Mật khẩu mẫu | Lane trong BPMN | Quyền hạn nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **Khách hàng** (`CUSTOMER`) | `khachhang1` | `Customer@123456` | Khách thuê xe | Đặt thuê (KH-01), nộp hồ sơ (KH-02), cọc VietQR (KH-03), ký số (KH-04), nhận xe (KH-05), theo dõi & báo sự cố (KH-06, KH-08), duyệt bảng kê (KH-09), nhận hoàn cọc (KH-10). |
| **Nhân viên** (`STAFF`) | `nhanvien1` | `Staff@123456` | Bộ phận Điều phối & Kỹ thuật | Kiểm tra kỹ thuật (NV-03), chụp ảnh giao xe (NV-04), bàn giao chìa khóa (NV-05), nhận xe trả (NV-06), xác minh hư hỏng (NV-07), đánh giá xe (NV-09). |
| **Quản lý** (`MANAGER`) | `quanly1` | `Manager@123456` | Bộ phận Quản lý & Vận hành | Điều phối cứu hộ/đổi xe (NV-10), hòa giải tranh chấp bảng kê (QL-01), duyệt hoàn cọc đặc biệt (QL-02), giám sát nhật ký AI và tích hợp (`/ai-log`, `/integration-log`). |

> 💡 **Thao tác nhanh cho Hội đồng chấm thi / Giảng viên:**
> - Trên thanh Header có sẵn **Menu chọn vai trò nhanh** (Khách / Nhân viên / Quản lý) để chuyển đổi tức thời không cần đăng xuất/đăng nhập lại.
> - Bảng điều khiển kiểm thử ngầm (**DevPanel**) ở góc dưới màn hình cho phép xem trạng thái tiến trình, nhảy nhanh bước và Reset cơ sở dữ liệu về ban đầu.

---

## 3. CÔNG CỤ MÔ PHỎNG & ĐIỀU KHIỂN DEMO (DEMO CONTROLS)

Nhằm đảm bảo buổi thuyết trình diễn ra liền mạch **100% không phụ thuộc Internet**, hệ thống trang bị sẵn các công cụ giả lập:

1. **Bank Simulator (Giả lập thanh toán Ngân hàng):**
   - Tự động mở khi quét VietQR tại các bước: Cọc 30% (`KH-03`), Phí gia hạn (`KH-07`), Quyết toán bù tiền (`KH-10`).
   - Cho phép nhập số tiền thực chuyển, nội dung chuyển khoản để thử nghiệm nhánh đối soát Đạt (`M_VerifyDeposit`) hoặc Lệch tiền (`Gateway_1t3i23e`).
2. **DT-01 Simulator (Giả lập đối tác cứu hộ ngoại tuyến):**
   - Hỗ trợ mô phỏng đối tác nhận yêu cầu cứu hộ, báo khoảng cách di chuyển, và trả kết quả: Sửa tại chỗ thành công hoặc Đề xuất cấp xe thay thế (`SC_Dispatch`).
3. **AI Agent Simulator & Real Gemini Switcher:**
   - Cung cấp nút chuyển đổi giữa `MOCK` (trả kết quả định sẵn theo kịch bản) và `LIVE` (gọi Google Gemini REST API).
   - Có sẵn bộ nút nạp nhanh ảnh mẫu CCCD/GPLX chuẩn để AI OCR tự động trích xuất thông tin.

---

## 4. TÍCH HỢP AI AGENT & TÍCH HỢP BÊN NGOÀI

### 4.1. AI Agent Thẩm định Hồ sơ OCR (`M_CheckDocs`)
- **Kiến trúc Hybrid:** Kết hợp AI trích xuất thực thể (Gemini 1.5 Flash / Flash-Lite) với bộ quy tắc thẩm định doanh nghiệp cứng (Zod Rule Engine).
- **Phân loại ngưỡng độ tin cậy kép (Dual-Threshold X/Y):**
  - **Ngưỡng X = 85%:** Độ tin cậy $\ge 85\%$ và đủ giấy tờ hợp lệ $\rightarrow$ Tự động phê duyệt hồ sơ và chuyển sang bước cọc (`M_CreateDeposit`).
  - **Ngưỡng Y = 60%:** $60\% \le \text{Độ tin cậy} < 85\%$ $\rightarrow$ Gửi cảnh báo yêu cầu bổ sung giấy tờ (`M_AskDocs`, tối đa 3 lần).
  - **Dưới Y (< 60%):** Từ chối hồ sơ trực tiếp do tài liệu không hợp lệ hoặc giả mạo.
- **Màn hình giám sát AI (`/ai-log`):** Bảng điều khiển phân tích chi tiết thời gian phản hồi, prompt, JSON trích xuất và kết quả thẩm định.

### 4.2. Tích hợp bên ngoài (External Integrations)
1. **VietQR API:** Sinh mã QR thanh toán Napas 24/7 theo chuẩn EMVCo quốc gia.
2. **EmailJS Notification:** Gửi email thông báo thật đến khách hàng khi có biến cố hợp đồng hoặc yêu cầu bổ sung giấy tờ.
3. **No-Code Webhook Hook:** Kích hoạt Webhook (n8n / Make) phục vụ tự động hóa quy trình mở rộng.

---

## 5. HƯỚNG DẪN CÀI ĐẶT & CHẠY DỰ ÁN CỤC BỘ

### Yêu cầu tiên quyết
- **Node.js:** v18.0.0 trở lên (khuyến nghị v20+)
- **NPM:** v9.0.0 trở lên

### Cài đặt và khởi chạy
```bash
# 1. Cài đặt các gói phụ thuộc
npm install

# 2. Khởi chạy máy chủ phát triển
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:5173/`

### Các lệnh kiểm thử & bảo đảm chất lượng (QA Scripts)
```bash
# Kiểm tra lỗi cú pháp TypeScript
npm run typecheck

# Kiểm tra quy chuẩn mã nguồn ESLint
npm run lint

# Chạy toàn bộ 67 kiểm thử đơn vị & kiểm thử quy trình
npm run test

# Chạy kiểm thử tự động giao diện E2E bằng Playwright
npm run test:e2e

# Đóng gói sản phẩm sản xuất (Production Build)
npm run build

# Xem trước bản đóng gói
npm run preview
```

---

## 6. HƯỚNG DẪN TRIỂN KHAI TĨNH (STATIC DEPLOYMENT)

Ứng dụng là Frontend SPA thuần túy (Static Files HTML/JS/CSS), có thể triển khai miễn phí lên bất kỳ nền tảng tĩnh nào:

### Triển khai lên Vercel
Dự án đã có sẵn tệp cấu hình `vercel.json` phục vụ SPA rewrite:
```bash
# Cách 1: Sử dụng Vercel CLI
npx vercel

# Cách 2: Kết nối trực tiếp kho mã nguồn GitHub/GitLab vào Dashboard Vercel:
# - Framework Preset: Vite
# - Build Command: npm run build
# - Output Directory: dist
```

### Triển khai lên Netlify
Dự án đã có sẵn tệp cấu hình `netlify.toml`:
```bash
# Kết nối repository vào Netlify Dashboard:
# - Build command: npm run build
# - Publish directory: dist
```

### Triển khai lên GitHub Pages
```bash
# Dự án dùng HashRouter, hoàn toàn tương thích với GitHub Pages mà không gặp lỗi 404 khi F5 tải lại trang.
npm run build
# Tải toàn bộ thư mục dist/ lên nhánh gh-pages
```

---

## 7. BẢN ĐỒ TÀI LIỆU KỸ THUẬT (DOCS DIRECTORY)

Để phục vụ công tác chấm thi và đánh giá chuyên sâu, toàn bộ tài liệu kỹ thuật được lưu trữ chi tiết trong thư mục `docs/`:

1. [`docs/TRACEABILITY.md`](docs/TRACEABILITY.md)  
   **Ma trận đối chiếu toàn diện 110/110 phần tử BPMN To-Be** với mã nguồn hiện thực, file kiểm thử và mã màn hình. Đạt tỉ lệ phủ 100%.
2. [`docs/DOD_CHECKLIST.md`](docs/DOD_CHECKLIST.md)  
   **Bằng chứng kiểm tra 6 tiêu chí kỹ thuật tối thiểu** của đề tài (Phân quyền 3 vai trò, 20 cổng rẽ nhánh XOR, bộ lưu trữ IndexedDB, tích hợp VietQR/EmailJS, bộ test tự động và lịch sử commit).
3. [`docs/SECURITY_CHECKLIST.md`](docs/SECURITY_CHECKLIST.md)  
   **Báo cáo đánh giá an toàn thông tin**: Kiểm soát khóa API, mã hóa mật khẩu PBKDF2, chống brute-force, lọc tấn công XSS, và các khuyến nghị kiến trúc Production.
4. [`docs/CODE_GUIDE.md`](docs/CODE_GUIDE.md)  
   **Cẩm nang kiến trúc và mã nguồn cốt lõi**: Sơ đồ cấu trúc, cơ chế vòng đời tiến trình, giải thích chi tiết Top 10 đoạn mã quan trọng nhất bằng tiếng Việt.
5. [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md)  
   **Kịch bản thuyết trình 10 phút chuẩn hội đồng**: 1 luồng chính tiêu biểu (Happy Path) và 2 luồng ngoại lệ đặc sắc (Cứu hộ đổi xe và Hòa giải tranh chấp bảng kê).
6. [`docs/AI_LOG.md`](docs/AI_LOG.md)  
   **Nhật ký phát triển cùng AI Agent**: Chi tiết các quyết định thiết kế, prompt kỹ thuật, lược đồ schema và lịch sử cải tiến qua từng giai đoạn.

---

## 8. CẤU TRÚC ÁNH XẠ KIẾN TRÚC: BACKEND $\rightarrow$ FRONTEND-ONLY

Do đề bài yêu cầu không dùng Backend truyền thống (NodeJS/Java/Python server hay BaaS Firebase/Supabase), kiến trúc hệ thống đã được thiết kế tinh tế để thay thế tương đương hoàn chỉnh:

| Thành phần Backend truyền thống | Giải pháp Frontend-Only trong MOTO CARE | Vị trí mã nguồn |
| :--- | :--- | :--- |
| **Cơ sở dữ liệu quan hệ (SQL Database)** | **Dexie.js / IndexedDB** (Reactive DB với đầy đủ chỉ mục, quan hệ khóa ngoại và giao dịch ACID) | `src/db/index.ts`, `src/db/types.ts` |
| **BPMN Workflow Orchestrator (Camunda/Activiti)** | **Process State Engine** tự viết (Event-driven finite state machine, đồ thị quan hệ node cha-con) | `src/engine/engine.ts`, `src/engine/graph.ts` |
| **Scheduled Cron Jobs / Timers** | **Virtual Timer Manager** (Sử dụng `setInterval`, bộ đếm ảo với cơ chế bù giờ khi chuyển tab hoặc ngủ máy) | `src/engine/timers.ts` |
| **Xác thực & Mật khẩu (Auth Service)** | **Web Crypto API (SubtleCrypto)** băm mật khẩu PBKDF2 với 100.000 vòng lặp + salt ngẫu nhiên | `src/features/auth/services/crypto.ts` |
| **Thanh toán Webhook / IPN** | **Bank Simulator + VietQR EMVCo Decoder** đối soát giao dịch thời gian thực | `src/features/partner-sim/`, `src/features/customer/KH03Page.tsx` |
| **Dịch vụ thông báo (Email Worker)** | **EmailJS Browser Client** + `MockNotifier` dự phòng khi ngoại tuyến | `src/integrations/notifier/` |
| **Dịch vụ OCR AI (Microservice AI)** | **Google Gemini Direct REST Client** + `MockAiProvider` với bộ xác thực Zod | `src/ai/` |

---

> [!NOTE]
> Dự án được xây dựng và hoàn thiện bởi nhóm tác giả với mục tiêu chuẩn mực hóa kỹ thuật phần mềm, quản lý quy trình BPMN và trải nghiệm người dùng thực tế. Mọi đóng góp và phản hồi xin gửi về hòm thư hỗ trợ của nhóm.
