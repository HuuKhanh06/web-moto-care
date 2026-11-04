# BẢNG ĐÁNH GIÁ TIÊU CHÍ HOÀN THÀNH (DOD CHECKLIST)

> **Dự án:** MOTO CARE - Hệ Thống Thuê Xe Máy Trực Tuyến  
> **Tài liệu:** Definition of Done (DoD) Checklist theo 6 yêu cầu kỹ thuật tối thiểu của đề bài  
> **Kết quả thẩm định:** **6/6 yêu cầu ĐẠT 100%**  

---

## 1. Yêu cầu 1: Xác thực & 3 vai trò phản ánh đúng các Lane BPMN

- **Mô tả:** Hệ thống phân quyền chặt chẽ theo 3 vai trò nghiệp vụ:
  1. `khach_hang`: Khách hàng thuê xe (Lane Khách hàng).
  2. `nhan_vien`: Nhân viên kỹ thuật & vận hành (Lane Nhân viên).
  3. `quan_ly`: Quản lý cơ sở & giải quyết khiếu nại/sự cố (Lane Quản lý).
- **Cơ chế kỹ thuật:**
  - Băm mật khẩu Web Crypto API: thuật toán chuẩn **PBKDF2-HMAC-SHA256 (100.000 vòng) với Salt 16 bytes ngẫu nhiên** (`src/features/auth/authStore.ts`). Không bao giờ lưu mật khẩu dạng thô.
  - Khóa tài khoản tạm thời 1 phút nếu nhập sai quá 5 lần liên tiếp.
  - Route Guard (`src/features/auth/ProtectedRoute.tsx`): Kiểm tra quyền trước mọi tuyến đường; truy cập trái phép bị chặn và điều hướng an toàn kèm thông báo.
  - Phân quyền gán chặt vai trò: Đăng ký mới chỉ cấp quyền `khach_hang`, không cho phép tự leo thang đặc quyền.
- **Bằng chứng:**
  - File mã nguồn: [`src/features/auth/authStore.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/auth/authStore.ts), [`src/features/auth/ProtectedRoute.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/auth/ProtectedRoute.tsx), [`src/app/router.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/app/router.tsx).
  - File kiểm thử: [`tests/unit/auth_router.test.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/auth_router.test.tsx) (8 test cases).
  - Lệnh kiểm tra: `npx vitest run tests/unit/auth_router.test.tsx`.
- **Trạng thái:** **ĐẠT**

---

## 2. Yêu cầu 2: Tối thiểu 10 luồng phê duyệt / rẽ nhánh đúng cổng XOR BPMN

- **Mô tả:** Hệ thống hiện thực hóa **19 cổng rẽ nhánh XOR** (vượt xa chỉ tiêu 10 luồng), mã hóa bằng các hàm thuần túy (pure functions) và điều hướng bởi BPMN Process Engine:
  1. `M_G01`: Tra cứu xe (Có xe -> Báo giá / Hết xe -> Từ chối `M_RejectNoVehicle`).
  2. `M_G02`: Hồ sơ hợp lệ? (Có -> Tạo cọc / Không -> Yêu cầu bổ sung `M_AskDocs`).
  3. `Gateway_0x0p273`: Yêu cầu bổ sung > 3 lần? (Có -> Hủy đơn `M_EndCancel` / Không -> Kiểm tra lại).
  4. `M_G03`: Đối soát cọc ngân hàng (ĐỦ -> Ký hợp đồng / THIẾU, SAI -> Ngoại lệ `M_ManualDeposit`).
  5. `M_G03b`: Quyết định xử lý cọc ngoại lệ của Nhân viên (Có -> Tiếp tục ký / Chưa -> Yêu cầu cọc lại).
  6. `M_G04`: Kiểm tra kỹ thuật xe giao (Đạt -> Chụp ảnh / Chưa đạt -> Khắc phục `M_Rework`).
  7. `Gateway_0ixde68`: Khách nhận xe chấp thuận tình trạng? (Đồng ý -> Bàn giao xe / Không đồng ý -> Sửa lại).
  8. `GH_Check` (`GH_GEligible`): Kiểm tra gia hạn (Đủ điều kiện -> Gửi báo giá / Trùng lịch -> Giữ hạn cũ).
  9. `GH_GAccept`: Khách chấp nhận đề xuất gia hạn? (Đồng ý -> Đóng phụ phí / Từ chối -> Giữ hạn cũ).
  10. `SC_GAccept`: Đối tác cứu hộ tiếp nhận? (Có -> Tiến hành / Không -> Thử đối tác tiếp theo).
  11. `SC_GRetry`: Thử đối tác kế tiếp? (Còn đối tác -> Điều phối tiếp / Hết -> Leo thang Quản lý).
  12. `SC_GResolve`: Quản lý có phương án cứu hộ? (Có -> Nghiệm thu phí / Không -> Trả xe sớm `SC_END_EARLY`).
  13. `SC_SettleDecision`: Nhân viên kết luận sự cố (Tiếp tục thuê / Hướng dẫn trả xe sớm).
  14. `M_GDamage`: Đối chiếu ảnh xe trả có sai lệch hư hỏng? (Có -> Xác minh chi phí / Không -> Lập bảng kê).
  15. `M_GDispute`: Khách hàng xem bảng kê (Chấp thuận -> Quyết toán / Khiếu nại -> Quản lý phân giải).
  16. `M_GBalance`: Cân đối tiền cọc (Hoàn dư cọc / Cân bằng bù trừ / Thu thêm phụ phí).
  17. `M_GExtra`: Đối soát thu thêm (ĐỦ -> Quyết toán / THIẾU, SAI -> Ngoại lệ thu thêm).
  18. `M_GExtraDecision`: Quyết định thu thêm chưa trả (Tiếp tục thanh toán / Không -> Ghi công nợ `M_RecordDebt`).
  19. `M_GReady`: Đánh giá xe sau trả (Đạt -> Xe sẵn sàng / Cần bảo trì -> Lập phiếu sửa chữa `M_Maintenance`).
- **Bằng chứng:**
  - File mã nguồn: [`src/engine/fn/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/engine/fn/index.ts), [`src/engine/fn/sp.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/engine/fn/sp.ts), [`src/engine/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/engine/index.ts).
  - File kiểm thử: [`tests/unit/engine.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/engine.test.ts), [`tests/unit/engine_sp.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/engine_sp.test.ts), [`tests/unit/phase6_return_settle.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/phase6_return_settle.test.ts).
- **Trạng thái:** **ĐẠT**

---

## 3. Yêu cầu 3: Lưu trữ dữ liệu bền vững (Persistence Storage)

- **Mô tả:**
  - Sử dụng Dexie IndexedDB quản lý bền vững **19 bảng dữ liệu nghiệp vụ** từ `docs/data-model.csv` và **5 bảng phụ Client-side** (`process_state`, `timers`, `auth_accounts`, `integration_logs`, `ai_logs`).
  - Toàn bộ thay đổi dữ liệu tồn tại vĩnh viễn trong Local Database trình duyệt, không mất đi khi tải lại trang (`F5`).
  - Hỗ trợ đầy đủ chức năng **Sao lưu cơ sở dữ liệu (Export JSON)** và **Khôi phục cơ sở dữ liệu (Import JSON)** kèm xác thực toàn vẹn bằng Zod schemas (`src/db/backup.ts`).
  - Cơ chế ghi nhật ký bất biến: hàm `logEvent` ghi chép mọi dấu vết chuyển trạng thái vào bảng `process_events`.
- **Bằng chứng:**
  - File mã nguồn: [`src/db/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/db/index.ts), [`src/db/types.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/db/types.ts), [`src/db/backup.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/db/backup.ts), [`src/db/seed.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/db/seed.ts).
  - File kiểm thử: [`tests/unit/database.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/database.test.ts) (8 test cases).
  - Lệnh kiểm tra: `npx vitest run tests/unit/database.test.ts`.
- **Trạng thái:** **ĐẠT**

---

## 4. Yêu cầu 4: Tích hợp bên ngoài (External Integrations)

- **Mô tả:** Triển khai đầy đủ **cả 3 phương án tích hợp bên ngoài** quy định trong đề bài:
  1. **A. Dịch vụ gửi thông báo (Notifier):** Tích hợp EmailJS REST API gửi email trực tiếp từ trình duyệt khi phát sinh sự kiện quan trọng (`M_SendTerms`, `M_AskDocs`, `M_SendStatement`, `M_Refund`...). Có `MockNotifier` chạy offline.
  2. **B. Chuẩn thanh toán VietQR (Payment API):** Sinh mã QR theo chuẩn Napas 24/7 (QuickLink `https://img.vietqr.io` và chuỗi EMVCo) cho cọc (`M_CreateDeposit`), phí gia hạn (`GH_CreateQR`), thu thêm (`M_PayExtra`). Fallback sang thư viện `qrcode` Canvas cục bộ.
  3. **C. Gọi lại workflow No-Code (WorkflowHook):** Gửi HTTP POST JSON payload tới Webhook n8n/Make/Zapier khi có sự kiện quy trình (`M_START`, `M_Archive`...).
  - **Graceful Degradation:** Toàn bộ lệnh gọi ngoài bọc qua `safeExecuteWithRetry` (timeout 5s, tối đa 2 lần thử lại). Khi mạng lỗi hoặc bên thứ ba sập, hệ thống ghi log vào `db.integration_logs` và **quy trình BPMN vẫn tiếp tục vận hành trơn tru**.
  - **Màn hình Quản trị `/integration-log`:** Thống kê tỷ lệ, độ trễ, các nút test nhanh và cài đặt tham số.
- **Bằng chứng:**
  - File mã nguồn: [`src/integrations/client.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/integrations/client.ts), [`src/integrations/notifier/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/integrations/notifier/index.ts), [`src/integrations/qr/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/integrations/qr/index.ts), [`src/integrations/webhook/index.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/integrations/webhook/index.ts), [`src/features/manager/IntegrationLogPage.tsx`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/src/features/manager/IntegrationLogPage.tsx).
  - File kiểm thử: [`tests/unit/phase7_integrations.test.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit/phase7_integrations.test.ts) (9 test cases), [`tests/e2e/phase7_integrations.spec.ts`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/e2e/phase7_integrations.spec.ts).
  - Lệnh kiểm tra: `npx vitest run tests/unit/phase7_integrations.test.ts`.
- **Trạng thái:** **ĐẠT**

---

## 5. Yêu cầu 5: Bộ kiểm thử tự động (Automated Test Suite)

- **Mô tả:** Hệ thống sở hữu bộ kiểm thử tự động toàn diện hai tầng (Unit Tests với Vitest và E2E Tests với Playwright):
  - **Vitest Unit Tests:** **67/67 bài kiểm thử đạt chuẩn 100%** qua 10 test suites bao phủ toàn bộ các pha quy trình:
    - `auth_router.test.tsx`: Băm mật khẩu, khóa tạm, phân quyền Route Guard.
    - `database.test.ts`: Ràng buộc dữ liệu, đồng hồ mô phỏng, sao lưu & khôi phục.
    - `engine.test.ts`: Luồng chính (Happy Path), các cổng M_G01, M_G02, M_G03, timer M_BoundDeposit, M_BoundSign.
    - `engine_sp.test.ts`: Tiểu quy trình SP1 (Gia hạn) và SP2 (Sự cố) cùng timers SLA.
    - `phase4_booking_to_handover.test.ts`: Chu trình từ đặt thuê đến bàn giao xe lăn bánh.
    - `phase5_rental_events.test.ts`: Các sự kiện cạnh tranh tại cổng `M_EG`.
    - `phase6_return_settle.test.ts`: Trả xe, đối chiếu hư hại, bảng kê thanh lý, quyết toán và lưu hồ sơ.
    - `phase7_integrations.test.ts`: Cơ chế Retry, Timeout, Logging, Graceful Degradation của Notifier, VietQR, Webhook.
    - `phase8_ai_agent.test.ts`: AI Agent OCR, 2 ngưỡng X/Y (95%/80%), các nhánh tự động, thủ công, tải lại và fallback.
  - **Playwright E2E Tests:** Các bài test luồng trên trình duyệt thật cho toàn bộ màn hình Khách hàng, Nhân viên, Quản lý, Nhật ký tích hợp và Nhật ký AI.
  - **Đảm bảo chất lượng mã nguồn:** `npm run typecheck` (0 lỗi TypeScript strict), `npm run lint` (0 lỗi ESLint).
- **Bằng chứng:**
  - Thư mục kiểm thử: [`tests/unit/`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/unit), [`tests/e2e/`](file:///c:/Users/USER/Downloads/WEB%20MOTO%20CARE/WEB%20MOTO%20CARE/tests/e2e).
  - Lệnh kiểm tra: `npm run test` (67/67 tests passing).
- **Trạng thái:** **ĐẠT**

---

## 6. Yêu cầu 6: Tối thiểu 15 Commit rõ ràng trên Git

- **Mô tả:** Lịch sử Git của dự án đã ghi nhận **34 commits** (gấp hơn 2 lần yêu cầu tối thiểu 15 commit). Tất cả commit đều tuân thủ quy chuẩn Conventional Commits (`feat(...)`, `test(...)`, `fix(...)`, `docs(...)`) với thông điệp rõ ràng theo từng giai đoạn.
- **Bằng chứng:**
  - Lệnh kiểm tra: `git rev-list --count HEAD` -> Kết quả: `34`.
  - Danh sách rút gọn các commits gần nhất:
    - `3bb36bc`: `test(phase-8): add unit and e2e tests for AI agent OCR, update env example and AI_LOG`
    - `5e407e7`: `feat(phase-8): integrate AI OCR into M_CheckDocs and KH-02, and add AI log screen`
    - `eb1271c`: `feat(phase-8): implement AI Agent OCR architecture with Gemini and Mock providers, schemas and config`
    - `8aa1a34`: `test(phase-7): add unit and e2e tests for external integrations, update env example and AI_LOG`
    - `f5d2db6`: `feat(phase-7): wire integrations into process engine and provide integration log screen`
    - `7c727c9`: `feat(phase-7): implement integration architecture with Notifier, VietQR and WorkflowHook services`
    - `7a1aed0`: `test(phase-6): add comprehensive unit and e2e test suite for return and settlement flows and update AI_LOG`
    - `eee6b4a`: `feat(phase-6): implement settlement KH-10, unpaid debt handling NV-08 and post-return evaluation NV-09`
    - `d12365e`: `feat(phase-6): implement return settlement statement KH-09 and dispute resolution QL-01`
    - `f79eb52`: `feat(phase-6): implement return inspection NV-06 and damage verification NV-07`
    - `4ca0df8`: `test(phase-5): add unit and e2e tests for SP1 extension and SP2 incident flows and update AI_LOG`
    - `4728514`: `feat(phase-5): implement SP2 incident sub-process with DT-01, QL-02 and NV-10 screens`
    - `b884d53`: `feat(phase-5): implement customer rental dashboard KH-06 and SP1 extension sub-process KH-07`
    - `91ecde2`: `test(phase-4): add comprehensive unit and e2e test suite for booking-to-handover flows and update AI_LOG`
    - ... cùng các commits hoàn thiện từ Giai đoạn 0 đến Giai đoạn 3.
- **Trạng thái:** **ĐẠT**

