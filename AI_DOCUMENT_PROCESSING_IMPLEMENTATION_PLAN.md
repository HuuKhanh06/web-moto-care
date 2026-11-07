# Điều tra và sửa luồng AI xử lý giấy tờ

Ngày: 2026-11-07 (Asia/Saigon). Baseline: `ffa74bd33881b00077e2229aabaf4095a7a4284a`, nhánh `main`.

## Phạm vi và hiện trạng công việc

Yêu cầu mới nhất: điều tra → lập kế hoạch → tự triển khai → kiểm thử → báo cáo, không chờ duyệt từng bước. Không commit, không truy cập dữ liệu production, không thay đổi BPMN hoặc tạo backend/queue/migration. Git ban đầu sạch; trước lần gián đoạn có hai helper do chính lượt làm việc này tạo (`src/ai/images.ts`, `src/ai/timeout.ts`), chưa tích hợp. Không có thay đổi của người dùng bị ghi đè. Chỉ có `.env.example`, chưa có thông tin xác thực Gemini cho kiểm thử thật. Việc cài dependency bị gián đoạn cần hoàn tất trước khi chạy kiểm thử.

## 1. Kiến trúc thực tế

- React 18 + TypeScript strict, Vite 6; HashRouter tại `src/app/providers.tsx`; Zustand quản lý phiên ở `src/features/auth/authStore.ts`; route guard ở `src/app/ProtectedRoute.tsx`.
- Upload KH-02 không gọi server: `src/features/customer/KH02Page.tsx:44` nén ảnh bằng FileReader/Image/Canvas; `handleRealFileSelect` tại dòng 256 ghi data URL vào `db.customer_documents`.
- `src/db/index.ts` dùng Dexie/IndexedDB; `CustomerDocument` tại `src/db/types.ts:71` có `file_url`, `is_valid`, `ai_result`, `ai_confidence`, `ai_source`. Không có upload route/controller/middleware server trong đường chạy này. Repo có Supabase cho tài khoản, realtime và adapter cloud (`src/app/providers.tsx`, `src/db/adapter.ts`, `src/features/auth/authStore.ts`), nhưng KH-02/OCR đọc ghi Dexie trực tiếp; không nhầm adapter cloud với backend OCR.
- `src/ai/index.ts`: facade chọn `GeminiAiProvider` hoặc `MockAiProvider`, ghi `ai_logs` và cập nhật trường `ai_*` của giấy tờ. `src/ai/types.ts` là contract Zod hiện có.
- `src/ai/realOcr.ts`: Tesseract.js 7 chạy trong browser. `src/ai/gemini.ts`: gọi REST generateContent trực tiếp, không có task polling/webhook. `src/config/ai.ts`: cấu hình MOCK/LIVE, ngưỡng X/Y, khóa tại session/environment, model mặc định `gemini-1.5-flash`, timeout 8 giây.
- `src/engine/fn/index.ts:196` (`fn_check_documents`) gọi cùng facade tại M_CheckDocs. `src/engine/index.ts:193` chạy lại bước kiểm tra khi tiếp tục sang cọc; NV-03 và hợp đồng sử dụng dữ liệu ai/process_state. Giữ nguyên routing hiện có (PREFILL_FOR_RULES / MANUAL_REVIEW / REQUEST_REUPLOAD / FALLBACK_MANUAL).

## 2. Luồng hiện tại và nơi dừng

1. File input `accept=image/*` → `compressImageToDataUrl` (không kiểm tra kích thước/định dạng rõ ràng, exception trong callback Canvas không reject promise).
2. Data URL → Dexie (`is_valid: true` ngay khi upload) → nạp lại giấy tờ.
3. Đủ ba ảnh → `triggerAutoOcr` (`KH02Page.tsx:121`) → bật `ocrLoading`.
4. `extractDataFromImages` quét ba ảnh lần lượt; mỗi ảnh dùng `Tesseract.recognize` tạo worker mới; `Promise.race` 7 giây trả object đang bị mutate, không dừng worker, nuốt lỗi.
5. Sau đó (không phải đồng thời như comment) gọi `aiService.processOcr` với preset HIGH_CONFIDENCE; mặc định MOCK có thể gọi OCR lần nữa 5 giây, vẫn giữ một số dữ liệu giả và routing thành công khi thiếu trường.
6. LIVE: chỉ data URL mới được đính kèm; bỏ blob/http và mặt sau CCCD; timer bị clear trước `response.json()`; schema Zod kiểm tra JSON nhưng prompt không mô tả toàn bộ envelope; response lỗi chứa nguyên nội dung từ provider có nguy cơ bị ghi log.
7. Service ghi Dexie, trả kết quả hoặc FALLBACK_MANUAL. KH-02 bỏ qua routing, trộn dữ liệu/account/default A1/Đà Nẵng rồi toast thành công.
8. `finally setOcrLoading(false)` làm đổi `triggerAutoOcr` → đổi `loadData` → effect gọi `loadData` → nếu chưa xác nhận process_state thì lại chạy OCR. Đây là vòng lặp ở UI, không phải polling server.

## 3. Root cause và phân loại bằng chứng

| ID | Phân loại | Vị trí baseline | Bằng chứng / kết luận |
|---|---|---|---|
| F1 | CONFIRMED (code); cần test tái hiện runtime | KH02Page.tsx:123,189,237,246,249 | Callback phụ thuộc `ocrLoading`; effect phụ thuộc callback; đủ ảnh chưa xác nhận thì mỗi lần false lại khởi chạy. Spinner xuất hiện liên tục dù từng promise kết thúc. |
| F2 | CONFIRMED | KH02Page.tsx:139-153; ai/mock.ts:149-171 | Hai lượt OCR nối tiếp trên cùng ảnh; preset thành công dùng trong luồng thật. |
| F3 | CONFIRMED | ai/realOcr.ts:30,67,95,111-121 | Worker không hủy khi timeout, trả dữ liệu dở dang như thành công và nuốt lỗi. Chỉ eng làm giảm đọc tiếng Việt. |
| F4 | CONFIRMED | ai/index.ts:25-28; ai/mock.ts:149-209; KH02Page.tsx:156-178 | LIVE thiếu key tự chuyển mock; profile/default và success không phụ thuộc kết quả thực tế. |
| F5 | CONFIRMED | ai/gemini.ts:35-47,70-80 | Blob/http bị bỏ qua, thiếu mặt sau; deadline không bao phủ đọc body; lỗi API có thể lộ nội dung nhạy cảm vào nhật ký. |
| F6 | CONFIRMED | KH02Page.tsx:44-81,222-229,265-277,331-354 | Không validate file trước decode, callback có thể throw không settle; dữ liệu DOB cứng khi phục hồi; thay ảnh không xóa xác nhận/kết quả cũ. |
| F7 | CONFIRMED | ai/index.ts:44-57,91-103,110-130 | Ghi log/persist không atomic; lỗi persist bị nuốt; thiếu guard trùng và kiểm tra ảnh còn hiện hành. |
| F8 | SUSPECTED | config/ai.ts:20-23; gemini.ts:52 | 8 giây quá ngắn cho cold OCR/ảnh; model cũ có thể bị ngừng. Cần kiểm tra tài liệu và response thực tế; không khẳng định đây là nguyên nhân runtime khi chưa có key. |
| F9 | UNVERIFIED | worker CDN/lang/core, Gemini endpoint | Chặn CDN/CORS, model/quyền/rate limit thực tế: cần browser/network logs; không có log phiên lỗi người dùng. |

Git: `4596e65` thêm upload và callback phụ thuộc loading; ở phiên bản đó ghi process_state tự động có thể chặn quét lại sau thành công. `ffa74bd` bỏ ghi process_state tự động để chờ khách xác nhận, khiến điều kiện tự quét vẫn luôn đúng; đồng thời thêm quét Tesseract ở trang và trong mock. `git show HEAD^:src/features/customer/KH02Page.tsx` xác nhận các thay đổi này. Không quy mọi lỗi cho prompt.

## 4. Giải pháp được chọn

Giữ luồng browser + IndexedDB, không thêm backend/queue/polling. Một provider thật cho mỗi bộ ảnh: LOCAL Tesseract khi không chọn LIVE; MOCK chỉ dùng khi yêu cầu preset mô phỏng rõ ràng. LIVE thiếu khóa phải FAILED, không tự trả mock. Giữ output contract Zod và routing để engine/NV-03 tiếp tục dùng. Bổ sung source LOCAL trong kiểu TypeScript (không migration IndexedDB).

UI hiển thị IDLE/PROCESSING/COMPLETED/FAILED, deadline hữu hạn; callback ổn định, ref khóa ngay khi gọi, guard snapshot bộ ảnh; cho retry chủ động sau FAILED, không tự lặp. Thay ảnh vô hiệu kết quả/xác nhận cũ, chặn upload đồng thời, hủy/ignore kết quả khi rời trang/chuyển hồ sơ. Thành công chỉ khi có dữ liệu thực; thiếu/không đọc được báo rõ, hỗ trợ nhập thủ công minh bạch, không mặc định DOB/CCCD/tên/hạng/địa chỉ.

Deadline phải bao trùm xử lý ảnh, khởi tạo worker, recognize, fetch/body và giải phóng tài nguyên. Reuse một Tesseract worker cho các ảnh, dùng eng+vie, terminate ở success/error/timeout; đóng worker cả khi init trả muộn. Ưu tiên phục vụ worker/core từ gói đã cài nếu phù hợp thay vì phụ thuộc CDN cho script. Retry tối đa một lần riêng lỗi mạng/429/5xx trong cùng deadline; 400/401/403/404, file/schema/config sai không retry. Không log ảnh, raw OCR, khóa, URL chứa khóa hoặc payload lỗi provider.

Gemini nhận bytes các mặt giấy tờ có nhãn, JSON schema/envelope phù hợp contract, validate request_id và required fields; không dùng routing từ AI để hợp thức hóa trường trống. Không thay business rules X/Y. Ghi log start/end kèm request_id/provider/thời gian/status và lưu DB atomically sau khi xác nhận snapshot còn đúng. Lỗi DB phải hiển thị như lỗi lưu, không giả thành công AI.

## 5. Công việc và thứ tự phụ thuộc

| Task ID | Priority | Files / module | Problem | Implementation | Dependencies | Tests | Acceptance Criteria | Status |
|---|---|---|---|---|---|---|---|---|
| T1 | Critical | File này; tests/unit/kh02_ocr.test.tsx (mới) | Chưa có chứng cứ runtime vòng lặp | Ghi baseline, dựng test mount KH-02 đủ ảnh với provider kiểm soát; chứng minh OCR lặp trước sửa | Không | Regression tái hiện trên baseline | Có bằng chứng test fail đúng lỗi F1; kế hoạch lưu trước triển khai tiếp | IN PROGRESS |
| T2 | High | src/ai/images.ts, src/ai/timeout.ts (helper đang dở), src/features/customer/KH02Page.tsx | File/decode có thể treo, chấp nhận sai loại | Validate MIME/size trước decode; deadline và abort/catch callback; lỗi cụ thể | T1 | Rỗng, PDF/HEIC, quá lớn, JPEG/PNG/WebP/BMP, decode lỗi | File sai không lưu/không gọi OCR, promise settle | PENDING |
| T3 | Critical | src/ai/realOcr.ts, src/ai/local.ts (mới), src/ai/types.ts, src/db/types.ts, src/ai/mock.ts | OCR đôi, worker tiếp tục sau timeout, dữ liệu mẫu | Reuse/terminate worker, eng+vie, deadline/errorHandler, parse theo nhãn/date hợp lệ; LOCAL trả schema thật; mock chỉ mô phỏng | T2 | Recognize thật fixture; init/recognize treo/lỗi; missing fields | Thực sự đọc bytes; không giá trị giả; worker dừng; routing trung thực | PENDING |
| T4 | High | src/ai/gemini.ts, src/config/ai.ts, .env.example, src/features/manager/AiLogPage.tsx | Thiếu ảnh/schema/deadline và model/config | Đính kèm bytes ba mặt, schema đầy đủ, sanitize lỗi, retry hữu hạn, timeout body; config không fallback mock, cấu hình model rõ ràng | T2 | Request payload; 401/429/5xx/mạng/body treo/schema sai/block/request_id sai | JSON đúng contract, lỗi nhận biết được, không secret log, timeout hữu hạn | PENDING |
| T5 | Critical | src/ai/index.ts, src/engine/fn/index.ts | Trùng job, persist partial/stale | Single-flight cùng input; validation trước save, transaction docs+ai_log, snapshot guard, source chính xác; engine truyền CCCD sau; không quét lại vô ích sau xác nhận | T3,T4 | Duplicate; thay ảnh giữa chừng; DB reject; logs; regression engine | Một job cho cùng bộ ảnh, không ghi kết quả cũ, lỗi lưu hiển thị rõ | PENDING |
| T6 | Critical | src/features/customer/KH02Page.tsx | Effect loop, stale UI, báo sai thành công | Callback stable/ref guard, explicit status/error/retry/manual; restore đúng persisted dữ liệu; reset xác nhận khi thay ảnh; giữ cọc theo xác nhận | T5 | Component mount/StrictMode/rerender, retry, upload đôi, request change/unmount/refresh | Không tự lặp; success/failure hiển thị thật; bộ ảnh cũ không được xác nhận cho ảnh mới | PENDING |
| T7 | High | tests/unit/ocr_*.test.ts (mới), tests/unit/kh02_ocr.test.tsx; tests/e2e/document_ocr.spec.ts (mới) | Thiếu coverage runtime | Test unit/integration/failure, browser thật upload→storage→OCR→render; fixture tổng hợp, không PII thật | T6 | Ma trận bên dưới; npm test/typecheck/build/lint | Các test liên quan PASS, kiểm tra UI/log; phân biệt provider thật với mock | PENDING |
| T8 | Medium | File này; docs/AI_LOG.md; docs/AI_DOCUMENT_PROCESSING_REPORT.md (mới) | Chưa có bàn giao chứng cứ | Cập nhật trạng thái, đường dẫn, kết quả thực, hạn chế; không commit | T7 | git diff/check, đối chiếu bảng test | Không tuyên bố live Gemini PASS nếu chưa gọi thật, liệt kê mọi file sửa | PENDING |

## 6. Chiến lược và ma trận kiểm thử

Unit dùng Vitest + jsdom + fake-indexeddb; component Testing Library render trang với mock provider kiểm soát, DB test riêng; integration facade giữ IndexedDB thật giả lập; E2E Playwright Chromium/Vite dùng browser context mới và chặn Supabase để không đọc/ghi production. Không gọi seed/clear DB của người dùng. E2E LOCAL phải nhận diện ảnh fixture có chữ thật bằng Tesseract, không intercept kết quả OCR. Gemini tests intercept fetch chỉ để contract/failure, ghi nhãn MOCK rõ ràng. Chưa có key: kiểm thử Gemini thật UNVERIFIED.

| Case | Input / Steps | Expected / PASS condition | Log / evidence | Automation |
|---|---|---|---|---|
| C01 Baseline loop | Mount KH-02 với 3 ảnh, process_state chưa xác nhận, provider resolve | Trước sửa tái hiện >1 call; sau sửa 1 call sau nhiều rerender | spy count, UI processing/result | Component |
| C02 File hợp lệ | Upload 3 fixture JPEG/PNG/WebP/BMP, đọc thật | Bytes lưu, OCR nhận diện đúng các trường có trên ảnh, UI hiển thị và chờ xác nhận | DB file_url/ai_result/source + screenshot | Unit + E2E LOCAL thật |
| C03 Invalid | PDF/HEIC, MIME sai, corrupt image, file rỗng | Error cụ thể; không lưu/không gọi OCR; loading dừng | toast/UI, DB count | Unit + component + E2E |
| C04 Oversize | >10MB | Reject trước FileReader, không provider | count | Unit + E2E |
| C05 Slow | Deferred provider rồi resolve trong deadline | PROCESSING rồi COMPLETED, không job lặp | UI và số call | Component + E2E mock |
| C06 Hung | init/recognize/fetch/body không resolve | FAILED đúng deadline; abort/terminate, không result/log success muộn | fake timer, worker signal | Unit + component + E2E mock |
| C07 Auth/config | LIVE thiếu key, 401/403, model 404 | FAILED/safe error, không mock, không retry auth | fetch count + sanitized ai_log | Unit/integration |
| C08 Rate limit | 429/503 tạm thời rồi success, hoặc lặp lỗi | Tối đa 1 retry trong deadline; lỗi vĩnh viễn FAILED | fetch count | Unit/integration |
| C09 Response sai | JSON hỏng, schema thiếu, blocked candidate, sai request_id | FALLBACK_MANUAL/FAILED, không điền giả | ai_log và UI | Unit + E2E mock |
| C10 Multi-upload | Double click/select/rerender | Single-flight; latest ảnh thắng, xác nhận cũ bị vô hiệu | provider count, DB snapshot | Component/integration/E2E |
| C11 Refresh | Reload khi PROCESSING, sau completion | Không loop/persist stale; trang mới đọc dữ liệu và chỉ chạy cần thiết | request count, restored result | E2E |
| C12 Network | Worker assets/network/API reject | Failed finite + thông báo retry, không toast success | console sanitized, UI | Unit + E2E mock |
| C13 Database | Reject transaction/log/update | Rollback, FAILED lỗi lưu, không success toast | DB state + error UI | Integration/component |
| C14 Unmount/change ID | Chuyển trang/hồ sơ trong pending | Không áp kết quả vào hồ sơ khác; tài nguyên hủy khi có thể | DB + callback counts | Component |
| C15 Regression | Bộ test engine/auth/rules sẵn có, typecheck/build/lint | Không phát sinh regression do patch; ghi riêng lỗi baseline | command outputs | CLI |

## 7. Rủi ro và tiêu chí nghiệm thu

- Tesseract tải language/core lần đầu cần mạng nếu chưa bundle/cache; test offline/cold riêng. OCR heuristic không bảo đảm mọi layout/ảnh mờ, nên LOCAL chỉ đề xuất và cần người đối chiếu; không tự chứng nhận giấy tờ.
- Frontend-only không thể giữ bí mật khóa nhà cung cấp do người dùng nhập trong browser; không đưa thêm key vào repo/bundle/log. Deploy production muốn khóa server-private cần quyết định backend riêng ngoài phạm vi này. Không gọi paid API khi chưa được phép.
- UNKNOWN/không đọc được giữ null/trống kèm reason_codes, không đổi output envelope; `ai_source=LOCAL` chỉ thêm enum TypeScript, kiểm tra modules downstream.
- Giữ BPMN và các màn hình không liên quan; không đổi cloud/auth/seed. Test E2E cũ có selector/tài khoản đã lỗi thời có thể fail baseline; không sửa các module không liên quan chỉ để đổi màu kết quả.
- Acceptance: tái hiện F1 trước sửa; sau sửa một lượt cho bộ ảnh, có deadline/error/retry rõ; dữ liệu thật từ fixture OCR đến UI và DB; không mock thành công trong upload thật; lưu atomic; regression/typecheck/build phù hợp; báo cáo trạng thái mọi test và giới hạn Gemini thật.

## 8. Nhật ký thực hiện (cập nhật sau từng task)

- T1 COMPLETED: `npm ci` hoàn tất; test `kh02_ocr.test.tsx` chạy trên baseline trước sửa FAILED đúng lỗi: expected 1 call, actual 3. Sau sửa test PASS (StrictMode, render, real fake-indexeddb). Bằng chứng không chỉ suy luận code.
- T2 đang xác minh: thêm `images.ts`, `timeout.ts`, `errors.ts`; validate MIME/10MB, bắt lỗi Canvas, deadline abort và cleanup. Tests lỗi file/size/callback/hung PASS; đang kiểm tra browser decode thật nhiều định dạng.
- T3 đang xác minh: LOCAL provider, worker bao ngoài `src/ai/ocr.worker.ts` (bổ sung vào danh sách file), tải eng/vie có signal, worker/core bundle từ dependency hiện có, một worker cho ba ảnh; terminate cả giai đoạn init. Parse theo nhãn, date hợp lệ, GPLX đọc họ tên độc lập. Không thêm dependency. Unit worker timeout/parser/assets failure PASS; OCR thật browser chưa chạy.
- T4 đang xác minh: gửi đủ ba ảnh + JSON responseSchema, khóa trong header, timeout cả body; tối đa một retry mạng/429/5xx; không retry auth/model/schema; model default dùng alias `gemini-flash-latest` và có ô model/timeout. Contract/failure tests PASS; Gemini thật UNVERIFIED do không có khóa, không tự gọi paid API. Tham khảo alias chính thức: https://developers.googleblog.com/en/continuing-to-bring-you-our-latest-models-with-an-improved-gemini-2-5-flash-and-flash-lite-release/.
- T5 đang xác minh: facade single-flight, transaction ai_log+doc fields, guard bộ ảnh stale, lỗi DB không giả thành công. Engine giữ bước kiểm tra đầy đủ và cho phép tiếp tục quyết định đối chiếu thủ công đã lưu mà không chạy OCR lần nữa. Unit duplicate/stale/rollback/missing key PASS, bảy tests phase8 cũ PASS.
- T6 đang xác minh: callback ổn định, ref guard, status/error/retry/manual, bỏ default giả; thay ảnh xóa kết quả/xác nhận của bộ cũ; kiểm tra sở hữu hồ sơ trước đọc giấy tờ; UI không hiển thị kết quả của trang đã rời. Component regression đầu tiên PASS, bổ sung các case khác đang chạy.
- `npm run typecheck` PASS sau chỉnh kiểu/import; `npm run build` PASS (worker và core được emit); targeted lint phát hiện regex escape đã sửa, cần chạy lại.
- T7/T8 chưa hoàn tất; mọi acceptance browser/thực tế và regression sẽ cập nhật sau khi chạy.

## Tài liệu tham khảo chính thức

### Trạng thái tại thời điểm người dùng yêu cầu commit/push

- Người dùng yêu cầu lưu và push toàn bộ thay đổi hiện tại; việc triển khai/kiểm thử bị ngắt để thực hiện yêu cầu Git này. T2–T8 chưa được đánh dấu hoàn tất.
- `npm test -- --reporter=dot`: 109/109 tests PASS tại lần chạy toàn bộ; sau đó bổ sung kiểm tra định dạng dữ liệu và chỉnh các chi tiết vòng đời. Lần chạy lại riêng OCR pipeline + phase8: 42/42 PASS.
- `npm run lint` và `npm run typecheck`: PASS sau khi loại thư mục backup/clone cục bộ khỏi lint. `npm run build`: PASS tại lần build đã chạy; các chỉnh sửa sau đó chưa build lại tại thời điểm ghi chú này.
- Component tests KH-02: 6/6 PASS trong lần chạy riêng (controlled provider), có test StrictMode, retry, failed/manual, restore và unmount.
- E2E Chromium đã thực thi nhưng 4/4 FAILED trong bước chuẩn bị fixture: `db.vehicles.toCollection().first()` trả undefined trước upload. Chưa xác minh nguyên nhân setup (nghi init/seed đồng thời); chưa có bằng chứng nhận diện thật từ ảnh trong browser. Các lần chạy trước đó còn gặp môi trường thiếu browser/webServer timeout, đã cài Chromium và cấu hình loopback IPv4.
- Không được coi kết quả compile/unit/mock là xác nhận OCR thật đã hoạt động. Tesseract browser thực tế và Gemini LIVE vẫn UNVERIFIED; cần hoàn tất sửa fixture rồi chạy E2E. Không có API key Gemini thật và chưa gọi dịch vụ trả phí.
- Bổ sung file công cụ kiểm thử vào phạm vi: `eslint.config.js` bỏ qua backup/clone cục bộ; `vite.config.ts` chỉ quét entry app, bỏ thư mục công cụ/backup và bind IPv4; `playwright.config.ts` dùng cùng địa chỉ IPv4. Không đổi dữ liệu production.

- Tesseract worker lifecycle: https://github.com/naptha/tesseract.js/blob/master/README.md (reuse worker cho nhiều ảnh và terminate).
- Tesseract API/options: https://github.com/naptha/tesseract.js/blob/master/docs/api.md (errorHandler, worker paths).
- Gemini generateContent: https://ai.google.dev/api/generate-content (ảnh inline, cấu trúc request/response).
