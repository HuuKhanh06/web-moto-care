# BỘ PROMPT ANTIGRAVITY: WEB FRONTEND MOTO CARE (không backend)

## Cách dùng

1. Tạo thư mục dự án rỗng, mở bằng Antigravity. Giải nén `motocare-docs.zip` rồi đặt thư mục `motocare-docs/` vào dự án với tên `docs/`.
2. Dùng **Planning mode**. Mỗi giai đoạn mở một cuộc trò chuyện (agent) mới trong cùng workspace, dán prompt, duyệt kế hoạch và danh sách việc agent đưa ra, rồi mới cho chạy.
3. Sau mỗi giai đoạn: chạy `npm run dev`, thử bằng tay theo mục "Tiêu chí xong", rồi mới sang giai đoạn kế. Không dán giai đoạn sau khi giai đoạn trước chưa đạt.
4. Giai đoạn 0 tạo file luật dự án. Nếu bản Antigravity của bạn đặt luật ở chỗ khác (Settings → Rules), hãy dán nội dung file luật vào đó.

Thứ tự: 0 Khung dự án và giao diện, 1 Dữ liệu giả lập, 2A Bộ máy quy trình (lõi và luồng chính), 2B Bộ máy quy trình (gia hạn và sự cố), 3 Khung ứng dụng và đăng nhập, 4 Đặt thuê đến bàn giao, 5 Đang thuê: gia hạn và sự cố, 6 Trả xe và quyết toán, 7 Tích hợp ngoài, 8 AI Agent, 9 Kiểm thử, README, triển khai.

**Phạm vi:** chỉ làm web Frontend, không backend. **Phong cách:** tông xanh lá chủ đạo, gần cảm giác của Xanh SM (chỉ lấy tông màu, không dùng logo hay tên thương hiệu).

**Đối chiếu đề bài TP3:** bộ prompt đã bám 6 yêu cầu kỹ thuật tối thiểu. (1) đăng nhập và 3 vai trò: GĐ 3; (2) tối thiểu 10 luồng phê duyệt đúng cổng XOR: GĐ 2A, 2B, 4-6; (3) lưu trữ bền vững: GĐ 1; (4) tích hợp bên ngoài: GĐ 7; (5) kiểm thử tự động: GĐ 2A, 2B, 4-6, 9; (6) tối thiểu 15 commit: mọi GĐ. Nhật ký làm việc với AI (Bài 5.4) được ghi dần vào `docs/AI_LOG.md` ở mọi giai đoạn.

---

## GIAI ĐOẠN 0: KHUNG DỰ ÁN VÀ LUẬT

```text
Bạn là kỹ sư frontend chính của dự án "MOTO CARE" (web thuê xe máy, đồ án môn Quản lý Quy trình Kinh doanh). Giao diện và nội dung hiển thị bằng TIẾNG VIỆT.

RÀNG BUỘC CỐT LÕI (áp dụng cho mọi giai đoạn):
- CHỈ làm web Frontend. KHÔNG viết backend, KHÔNG dùng Supabase/Firebase/server. Mọi "Edge Function", "cron", "webhook", "RLS" trong tài liệu docs/ phải được hiện thực hóa phía trình duyệt (xem bảng quy đổi bên dưới).
- Ứng dụng phải bám sát mô hình BPMN To-Be đã đóng băng trong docs/ (110 phần tử). Không tự thêm, bớt hay đổi luồng quy trình. Nếu thấy mâu thuẫn hoặc thiếu, ghi vào docs/QUESTIONS.md và hỏi tôi, không tự quyết.

TÀI LIỆU NGUỒN trong docs/ (đọc hết trước khi làm):
- process-graph.json: đồ thị BPMN gồm mọi nút (id, loại, lane, nhánh ra kèm nhãn, timer, boundary).
- mapping.csv: bảng ánh xạ từng phần tử BPMN -> màn hình/hàm/điều kiện/dữ liệu đọc/ghi.
- data-model.csv: mô hình dữ liệu (bảng, trường, kiểu, ràng buộc).
- screens.csv: ma trận màn hình x vai trò (X xem, T tạo, S thực hiện, D quyết định).
- message-flows.csv: luồng thông điệp với khách và đối tác.
- MotoCare_TO_BE.bpmn: file gốc.

THIẾT KẾ GIAO DIỆN (bắt buộc, áp dụng toàn ứng dụng):
- Tông chủ đạo là XANH LÁ kiểu Xanh SM (hãng taxi điện xanh): nền sáng, nhấn xanh lá, sạch, hiện đại, thân thiện như ứng dụng gọi xe. Chỉ lấy tông màu; KHÔNG dùng logo, tên, hình ảnh của Xanh SM.
- Khai báo design token trong tailwind.config (theme.extend.colors.brand) và CSS variables:
  brand-50 #ECFAF2, brand-100 #D3F3E2, brand-300 #7ADDAB, brand-500 #00A651 (xanh chính: icon, viền, thanh tiến trình, nền nhạt), brand-600 #00914A, brand-700 #00803F (nền nút chính và chữ xanh trên nền trắng, vì đạt tương phản chữ trắng tối thiểu 4.5:1), brand-900 #0B3D26 (tiêu đề trên nền xanh nhạt). Màu trung tính dùng slate. Cảnh báo #F59E0B, lỗi #DC2626, thông tin #0EA5E9.
  Đây là bảng màu tham khảo gần giống, không phải mã thương hiệu chính thức; được phép tinh chỉnh nhẹ nhưng giữ cảm giác xanh lá, và PHẢI kiểm tra tương phản WCAG AA cho mọi cặp chữ/nền.
- Phong cách thành phần: card bo góc lớn (rounded-2xl), nút và ô nhập rounded-xl, bóng nhẹ, nhiều khoảng trắng, nút chính toàn chiều rộng trên điện thoại, thanh điều hướng dưới (bottom nav) cho khách trên mobile, tiêu đề trang nền trắng hoặc xanh rất nhạt. Mobile-first, chỉ cần chế độ sáng.
- Font: Be Vietnam Pro hoặc Inter, cài bằng @fontsource (không tải từ mạng, để bản build chạy offline).
- Badge trạng thái hồ sơ theo nhóm màu: đang xử lý (xanh nhạt), chờ khách hoặc chờ việc (vàng), từ chối/hủy/lỗi (đỏ), hoàn tất (xanh đậm).

BẰNG CHỨNG CHO ĐỒ ÁN (đề bài chấm quá trình và khả năng giải trình mã):
- Sau mỗi giai đoạn, thêm một mục vào docs/AI_LOG.md gồm: mục tiêu, prompt đã dùng, kết quả, điều agent làm sai hoặc phải sửa (nếu có) và nguyên nhân, cách khắc phục. Ghi trung thực cả lần thất bại.
- Viết mã đơn giản, dễ đọc, ưu tiên rõ ràng hơn khéo léo; chú thích tiếng Việt ở những đoạn logic quy trình quan trọng. Mọi thành viên nhóm phải giải thích được từng đoạn mã khi bảo vệ, nên không dùng trừu tượng không cần thiết.

BẢNG QUY ĐỔI (mapping.csv viết theo kiểu có backend, bạn phải đổi sang FE):
- Edge Function fn_xxx  -> hàm TypeScript thuần trong src/engine/fn/, giữ nguyên tên fn_xxx, chạy trong trình duyệt.
- Database Postgres     -> IndexedDB qua thư viện Dexie, tên bảng/trường theo data-model.csv.
- RLS / phân quyền      -> route guard + kiểm tra quyền trong tầng repository; mỗi thao tác kiểm tra vai trò và ném lỗi nếu sai.
- Cron / Timer          -> hàm sweepTimers() trong src/engine/timers.ts, chạy mỗi 5 giây và khi tab được focus, cộng với đồng hồ demo có nút tua nhanh (giai đoạn 1-2).
- Webhook thanh toán / đối tác -> bảng điều khiển "Giả lập ngân hàng" và màn hình DT-01 do Quản lý thao tác (giai đoạn 4-5).
- Storage ảnh/hợp đồng   -> lưu dạng Blob trong IndexedDB, nén ảnh về tối đa 1280px, ~300KB.
- Xác thực              -> đăng nhập phía FE với mật khẩu băm (giai đoạn 3): 3 vai trò khach_hang, nhan_vien, quan_ly (đối tác KHÔNG đăng nhập).

VIỆC CẦN LÀM Ở GIAI ĐOẠN NÀY:
1. Khởi tạo dự án Vite + React + TypeScript (strict), Tailwind CSS, React Router (dùng HashRouter để deploy tĩnh được), Zustand, Dexie + dexie-react-hooks, Zod, date-fns, Vitest + Testing Library, Playwright. Cấu hình ESLint + Prettier.
2. Tạo cấu trúc thư mục:
   src/app (router, providers), src/config, src/db (Dexie, repo), src/engine (process engine, fn/, timers.ts, graph.ts), src/features/{auth,customer,staff,manager,partner-sim,admin}, src/components/ui, src/lib, src/ai (để trống), tests/unit, tests/e2e, docs/.
3. Tạo file luật dự án tại .agent/rules/motocare.md với toàn bộ phần "RÀNG BUỘC CỐT LÕI", "BẢNG QUY ĐỔI" ở trên, cộng thêm các quy ước sau:
   - TypeScript strict, không dùng any; kiểm tra dữ liệu vào bằng Zod.
   - Mọi chuyển bước quy trình đi qua src/engine và được ghi vào bảng process_events kèm bpmn_node_id đúng ID trong BPMN.
   - Mọi nút bấm/khu vực ứng với một phần tử BPMN phải có thuộc tính data-testid="node-<ID phần tử>" (ví dụ node-M_G03b) để kiểm thử.
   - Không commit khóa API hay dữ liệu bí mật; dùng file .env.local (đã ignore) và .env.example.
   - Giao diện luôn theo design token tông xanh lá ở trên; không viết màu cứng trong component, dùng token.
   - Luôn lập kế hoạch và danh sách việc trước khi viết mã, chờ tôi duyệt rồi mới làm; không sửa ngoài phạm vi giai đoạn đang làm.
   - Cập nhật docs/AI_LOG.md cuối mỗi giai đoạn.
   - Commit nhỏ, thông điệp theo dạng "feat(phase-N): ...", "fix:", "test:", "docs:". Mỗi giai đoạn tối thiểu 3 commit.
   - Sau mỗi việc lớn chạy: npm run lint, npm run typecheck, npm run test.
4. Thêm script npm: dev, build, preview, lint, typecheck, test, test:e2e.
5. Tạo README.md khung (tên dự án, cách chạy, cấu trúc thư mục) và docs/QUESTIONS.md rỗng.
6. Dựng sẵn design token, font và một trang mẫu "Bảng kiểu" (/style) hiển thị bảng màu, nút, ô nhập, card, badge để tôi duyệt giao diện trước khi sang giai đoạn sau.
7. Khởi tạo git, commit đầu tiên.

TIÊU CHÍ XONG:
- npm run dev chạy được, trang chủ hiển thị "MOTO CARE"; trang /style hiển thị đúng tông xanh lá.
- npm run lint, typecheck, test đều chạy xanh (có thể chỉ một test mẫu).
- File .agent/rules/motocare.md và docs/AI_LOG.md tồn tại. Cấu trúc thư mục đúng như trên. Có ít nhất 3 commit.
Cuối cùng liệt kê những gì đã làm và bất kỳ điểm nào bạn chưa chắc.
```

---

## GIAI ĐOẠN 1: DỮ LIỆU GIẢ LẬP (ĐÂY LÀ "DATABASE" CỦA ỨNG DỤNG)

```text
Đọc .agent/rules/motocare.md và docs/data-model.csv. Giai đoạn này chỉ làm lớp dữ liệu, chưa làm giao diện.

VIỆC CẦN LÀM:
1. Tạo schema Dexie trong src/db đúng theo docs/data-model.csv: profiles, vehicles, rental_requests, customer_documents, payments, contracts, vehicle_schedule, inspections, handovers, damage_findings, statements, settlements, extension_requests, partners, incidents, incident_dispatches, maintenance_orders, notifications, process_events. Tạo type TypeScript và Zod schema cho từng bảng; mọi enum (status, kind, result...) lấy đúng giá trị trong data-model.csv (ví dụ rental_requests.status có 17 giá trị).
2. Thêm 3 bảng phụ chỉ có ở phía client (ghi chú rõ trong code): process_state (request_id, các nút đang chờ, bộ đếm lần lặp), timers (request_id, bpmn_node_id của boundary, due_at, trạng thái) và auth_accounts (user_id, email, password_hash, salt). Engine ở giai đoạn 2A-2B và đăng nhập ở giai đoạn 3 sẽ dùng.
3. Ràng buộc dữ liệu thực thi trong tầng repository (vì IndexedDB không có sẵn):
   - vehicle_schedule: không cho hai khoảng thời gian chồng nhau trên cùng vehicle_id (tương đương ràng buộc EXCLUDE).
   - inspections: duy nhất theo (request_id, kind, attempt_no); handovers: duy nhất theo (request_id, attempt_no); payments.qr_ref và provider_txn_id duy nhất.
   - Mọi hàm ghi nhận tham số actor (vai trò + user id) và kiểm tra quyền.
4. Đồng hồ demo: src/lib/clock.ts với now() = thời gian thật + offset lưu trong localStorage, hàm advance(minutes). Toàn bộ mã dùng clock.now(), cấm gọi Date.now()/new Date() trực tiếp trong engine và repository.
5. Dữ liệu mẫu (seed), chạy được bằng nút "Nạp dữ liệu mẫu" và lệnh npm run seed trong trình duyệt:
   - 3 tài khoản: 1 quản lý, 2 nhân viên, 3 khách hàng (mật khẩu mẫu hiển thị trên màn hình đăng nhập để demo).
   - 12 xe thuộc 3 loại (xe số, tay ga, xe côn), giá ngày khoảng 120.000 đến 250.000 VND, hầu hết status=SAN_SANG, 1 xe BAO_TRI.
   - 4 đối tác sửa chữa ở các vùng khác nhau, 3 cái available=true.
   - 3 hồ sơ thuê mẫu ở các trạng thái khác nhau để xem danh sách không rỗng.
6. Repository có hàm nghe thay đổi (live query) để giao diện tự cập nhật; kiểm tra mở hai tab cùng trình duyệt thì thay đổi ở tab này hiện ở tab kia.
7. Hàm logEvent(requestId, bpmnNodeId, eventType, actor, payload) ghi process_events; hàm này là cách DUY NHẤT để ghi nhật ký.
8. Sao lưu và khôi phục: hàm exportDatabase() xuất toàn bộ dữ liệu ra một file JSON và importDatabase(file) nạp lại (kiểm tra bằng Zod, báo lỗi rõ nếu sai định dạng). Đây là cách chứng minh dữ liệu bền vững và cho phép chuyển dữ liệu giữa các máy khi demo.
9. Viết unit test (Vitest, dùng fake-indexeddb) cho: chống trùng lịch xe, ràng buộc duy nhất, kiểm tra quyền, đồng hồ demo, export rồi import cho kết quả giống nhau.

TIÊU CHÍ XONG: test xanh; nút "Nạp dữ liệu mẫu" tạo đủ dữ liệu; tải lại trang hoặc đóng mở trình duyệt vẫn còn dữ liệu; mở DevTools -> IndexedDB thấy đủ các bảng; tối thiểu 3 commit.
```

---

## GIAI ĐOẠN 2A: BỘ MÁY QUY TRÌNH, PHẦN LÕI VÀ QUY TRÌNH CHÍNH

> Bộ máy quy trình là phần khó nhất nên tách làm hai lượt. 2A làm lõi engine, timer và toàn bộ quy trình chính; 2B làm hai quy trình con (gia hạn, sự cố).

```text
Đọc .agent/rules/motocare.md, docs/process-graph.json, docs/mapping.csv (đặc biệt cột "Chuyển thành", "Dữ liệu đọc", "Dữ liệu ghi", "Nhánh sau"). Giai đoạn này làm src/engine cho QUY TRÌNH CHÍNH (scope MAIN trong process-graph.json), chưa làm giao diện, chưa làm hai sub-process SP1 và SP2 (để giai đoạn 2B).

MỤC TIÊU: một process engine chạy trong trình duyệt, thực thi đúng BPMN To-Be.

THIẾT KẾ:
1. graph.ts: nạp process-graph.json; cung cấp hàm lấy nút, nhánh ra theo nhãn, và assertEdge(from, to) ném lỗi nếu code định đi một cạnh không có trong đồ thị.
2. Mỗi phần tử tự động (serviceTask, businessRuleTask) của quy trình chính = một hàm fn_xxx trong src/engine/fn/, tên và hành vi theo cột "Chuyển thành" của mapping.csv. Mỗi hàm đọc/ghi đúng bảng và trường ghi ở mapping, rồi gọi logEvent với bpmn_node_id.
3. Cơ chế chạy: engine.advance(requestId, fromNodeId, outcome?) đi từ nút hiện tại, tự chạy liên tiếp các nút tự động và cổng XOR cho tới khi gặp một ĐIỂM CHỜ rồi dừng và lưu vào process_state. Điểm chờ của quy trình chính gồm:
   - user task / manual task: M_ManualDeposit, M_InspectPre, M_Rework, M_Photo, M_Handover, M_ReceiveReturn, M_CheckReturn, M_VerifyDamage, M_Resolve, M_ManualExtra, M_CheckReady (SC_Escalate và SC_Log thuộc 2B);
   - receive task: M_WaitDeposit, M_WaitSign, M_ReceiveReview, M_ReceiveExtra, M_ConfirmRefund (các receive task GH_ và SC_ thuộc 2B);
   - Activity_0d0qzp6 (khai báo service task nhưng là hành động của khách, phải coi là điểm chờ);
   - cổng theo sự kiện M_EG với 3 sự kiện M_CatchExtend, M_CatchIncident, M_CatchReturn (mỗi lúc chỉ nhận một). Ở 2A, nhận M_CatchExtend và M_CatchIncident chỉ đặt hồ sơ vào trạng thái chờ quy trình con (DANG_GIA_HAN, DANG_XU_LY_SU_CO) và để 2B nối tiếp; M_CatchReturn đi tiếp M_ReturnMerge.
   Điểm chờ được hoàn tất bằng engine.complete(requestId, nodeId, payload, actor); engine kiểm tra đúng nút đang chờ và đúng vai trò.
4. Cổng XOR của quy trình chính (13 cổng rẽ nhánh). Mỗi cổng là một hàm điều kiện thuần theo cột "Chuyển thành" của mapping.csv, trả về nhãn nhánh (khớp nhãn trong process-graph.json): M_G01, M_G02, Gateway_0x0p273, M_G03, M_G03b, M_G04, Gateway_0ixde68, M_GDamage, M_GDispute, M_GBalance (3 nhánh), M_GExtra, M_GExtraDecision, M_GReady. Các cổng mà giá trị do người nhập ở điểm chờ liền trước (M_G03b, M_G04, Gateway_0ixde68, M_GDispute, M_GExtraDecision, M_GReady) đọc đúng giá trị đó.
5. YÊU CẦU ĐỀ BÀI: ứng dụng phải có tối thiểu 10 luồng phê duyệt phản ánh đúng cổng XOR, trong đó giá trị quyết định do NGƯỜI nhập qua giao diện (khách, nhân viên, quản lý hoặc đối tác mô phỏng), không phải hệ thống tự tính. Mười quyết định là: M_G03b (xác nhận cọc ngoại lệ), M_G04 (xe đạt hay chưa), Gateway_0ixde68 (khách đồng ý nhận xe), M_GDispute (khách đồng ý bảng kê), M_GExtraDecision (nhân viên ghi nhận khách có thanh toán tiếp hay không), M_GReady (xe sẵn sàng hay cần bảo trì) ở 2A; GH_GAccept (khách đồng ý đề xuất gia hạn), SC_GAccept (đối tác nhận hay từ chối, qua DT-01), SC_GResolve (quản lý có phương án hay không), SC_SettleDecision (tiếp tục thuê hay không) ở 2B. Mỗi quyết định phải ghi người quyết định và lý do vào process_events.
6. Timer (boundary) trong timers.ts, dùng chung cho 2A và 2B: khi vào điểm chờ có timer, tạo bản ghi timers với due_at = clock.now() + thời lượng đúng như BPMN. sweepTimers() chạy mỗi 5 giây và khi tab focus: timer nào quá hạn mà điểm chờ vẫn đang chờ thì kích hoạt nhánh có nhãn "Quá hạn" đúng theo đồ thị, cập nhật dữ liệu theo mapping (ví dụ payments.status=EXPIRED, rental_requests TU_CHOI với closed_reason). Hoàn tất điểm chờ thì hủy timer. Ở 2A cài ba timer của quy trình chính: M_BoundDeposit 30 phút (M_WaitDeposit -> M_END_REJECT), M_BoundSign 24 giờ (M_WaitSign -> M_CancelRefund), M_BoundExtra 30 phút (M_ReceiveExtra -> M_ManualExtra). Bốn timer của sub-process cài ở 2B bằng cùng cơ chế.
7. Quy tắc thanh toán lại (đề xuất mặc định, đặt trong src/config/rules.ts và ghi chú để đổi): mỗi lần quay lại bước chờ thanh toán (M_G03b "Chưa", M_GExtraDecision "Tiếp tục thanh toán"), bản ghi payments cũ chuyển EXPIRED và giữ làm lịch sử, tạo bản ghi mới có QR mới và expires_at = now + 30 phút.
8. Nhánh công nợ M_END_DEBT: đặt rental_requests.status=CONG_NO, giữ nguyên trạng thái xe (đề xuất mặc định, nằm ngoài BPMN, ghi chú trong code và docs/QUESTIONS.md). Vòng lặp khiếu nại bảng kê (M_GDispute -> M_Resolve -> M_ApproveAdjustment) chưa có giới hạn số lần trong BPMN: KHÔNG tự thêm giới hạn, chỉ đếm số lần và ghi vào QUESTIONS.md.
9. Cấu hình nghiệp vụ trong src/config/rules.ts (mọi số sửa được tại một chỗ). Các giá trị sau là MẶC ĐỊNH DO TÔI ĐẶT, chưa có trong tài liệu nhóm; liệt kê chúng trong docs/ASSUMPTIONS.md để nhóm xác nhận: tiền cọc = 30% total_price; total_price = giá ngày x số ngày thuê (làm tròn lên); giấy tờ bắt buộc = CCCD và GPLX còn hạn; phí trễ hạn mỗi giờ bắt đầu = 10% giá ngày; số lần yêu cầu bổ sung hồ sơ tối đa 3 (lần thứ 4 thì hủy, đúng Gateway_0x0p273).
10. Khả năng quan sát: hàm getTrace(requestId) trả về danh sách process_events theo thứ tự; engine.getPendingTasks(role) trả về các việc đang chờ cho vai trò đó (dùng cho hộp việc NV-01 và màn hình khách).

KIỂM THỬ (Vitest, bắt buộc):
- Với MỖI trong 13 cổng XOR trên: ít nhất 1 test cho từng nhánh, kiểm tra đi đúng nút kế tiếp theo process-graph.json.
- Test ngoại lệ: hết hạn cọc, hết hạn ký (M_BoundSign -> M_CancelRefund -> M_EndCancel), hết hạn thu thêm (M_BoundExtra -> M_ManualExtra).
- Test cho 6 quyết định của người ở 2A: mỗi quyết định thử cả hai nhánh, kiểm tra chỉ đúng vai trò mới quyết định được.
- Test "chạy suốt luồng chính": từ M_START đến M_END (đi qua M_CatchReturn) với dữ liệu mẫu.
- Test assertEdge: không thể đi cạnh không tồn tại.

TIÊU CHÍ XONG: mọi test xanh; getTrace của luồng chính in ra đúng dãy ID phần tử BPMN; không có logic quy trình nào nằm ngoài src/engine; ghi docs/AI_LOG.md và docs/ASSUMPTIONS.md; tối thiểu 4 commit. Báo cáo điểm nào của mapping.csv mâu thuẫn hay thiếu thì ghi vào docs/QUESTIONS.md.
```

---

## GIAI ĐOẠN 2B: BỘ MÁY QUY TRÌNH, GIA HẠN (SP1) VÀ SỰ CỐ (SP2)

```text
Đọc .agent/rules/motocare.md, docs/process-graph.json, docs/mapping.csv (các dòng thuộc SP1 "Gia hạn" và SP2 "Sự cố"), docs/message-flows.csv. Giai đoạn này mở rộng src/engine đã có từ 2A, tiếp tục chưa làm giao diện. Dùng đúng cơ chế advance/complete, process_state, timers, logEvent của 2A.

VIỆC CẦN LÀM:
1. Sub-process SP1 (gia hạn) và SP2 (sự cố) chạy như quy trình con có start/end riêng, theo scope SP1/SP2 trong process-graph.json. SP1 kết thúc về M_EG (nhánh "Tiếp tục thuê"). SP2: SC_END_OK về M_EG; SC_END_EARLY là kết thúc lỗi, kích hoạt error boundary M_EarlyBoundary rồi đi tới M_ReturnMerge (hồ sơ có status=CHO_NHAN_XE_TRA). Hai quy trình con và quy trình chính không chạy chồng nhau trên cùng hồ sơ; nối M_CatchExtend và M_CatchIncident của 2A với việc khởi động SP1/SP2.
2. Hàm fn_xxx cho mọi phần tử tự động trong SP1 và SP2 theo cột "Chuyển thành" của mapping.csv.
3. Điểm chờ của hai quy trình con: receive task GH_WaitAccept, GH_VerifyQR, SC_ReceiveAck, SC_ReceiveResult; user task SC_Escalate (quản lý) và SC_Log (nhân viên). Hoàn tất bằng engine.complete như ở 2A.
4. Cổng XOR của hai quy trình con (7 cổng rẽ nhánh): GH_GEligible, GH_GAccept, GH_NeedPayment, SC_GAccept, SC_GRetry, SC_GResolve, SC_SettleDecision. Cộng với 13 cổng ở 2A là đủ 20 cổng.
5. Bốn timer của quy trình con, cài bằng cơ chế timers.ts: GH_Timer 2 giờ (GH_WaitAccept -> GH_NotifyOld), GH_TimerPay 30 phút (GH_VerifyQR -> GH_NotifyOld), SC_AckTimer 15 phút (SC_ReceiveAck -> SC_TryNext), SC_ResultTimer 2 giờ (SC_ReceiveResult -> SC_Escalate).
6. Chọn đối tác (fn_select_partner): cùng vùng, available=true, chưa từng thử cho phiếu này. Đối tác từ chối hoặc hết hạn thì thử đối tác khác (SC_TryNext); hết đối tác thì leo thang lên quản lý (SC_GRetry "Hết").
7. Phí gia hạn = số ngày thêm x giá ngày (fn_offer_extension), đề xuất có hạn trả lời 2 giờ; khi gia hạn thành công cập nhật hạn trả, giá và vehicle_schedule (kiểm tra chống trùng lịch).

KIỂM THỬ (Vitest, bắt buộc):
- Mỗi trong 7 cổng XOR của 2B: ít nhất 1 test mỗi nhánh.
- Test 4 quyết định của người ở 2B (GH_GAccept, SC_GAccept, SC_GResolve, SC_SettleDecision): cả hai nhánh, kiểm tra đúng vai trò.
- Test ngoại lệ: quá hạn trả lời gia hạn (GH_Timer), quá hạn thanh toán gia hạn (GH_TimerPay), đối tác không phản hồi (SC_AckTimer -> SC_TryNext), vượt SLA (SC_ResultTimer -> SC_Escalate), trả xe sớm qua error boundary M_EarlyBoundary.
- Test "gia hạn rồi trả xe" và "sự cố rồi tiếp tục thuê rồi trả xe" chạy suốt tới M_END.

TIÊU CHÍ XONG: toàn bộ test của 2A và 2B xanh; đủ 20 cổng XOR và 10 quyết định của người đều có test; getTrace của luồng có SP1 và SP2 in đúng dãy ID; ghi docs/AI_LOG.md; tối thiểu 3 commit.
```

---

## GIAI ĐOẠN 3: KHUNG ỨNG DỤNG, ĐĂNG NHẬP, PHÂN QUYỀN

```text
Đọc .agent/rules/motocare.md, docs/screens.csv. Giai đoạn này làm khung giao diện dùng chung, chưa làm các màn hình nghiệp vụ.

VIỆC CẦN LÀM:
1. Áp dụng design token tông xanh lá đã khai báo ở giai đoạn 0. Hệ thống thiết kế trong src/components/ui: Button, Input, Select, Textarea, Modal, Badge trạng thái, Table, Card, Toast, Tabs, Stepper tiến trình, EmptyState, FileUpload (nén ảnh, xem trước), QRBox (hiển thị mã QR tạo từ qr_ref bằng thư viện qrcode). Phong cách sạch, màu chủ đạo hợp với thuê xe, tương thích điện thoại (mobile-first) và máy tính, tiếng Việt, tiền tệ VND, ngày giờ định dạng Việt Nam.
2. AUTH-01: cơ chế xác thực phía FE nhưng làm nghiêm túc: mật khẩu băm bằng Web Crypto (PBKDF2 + salt ngẫu nhiên, lưu ở auth_accounts, không lưu mật khẩu thô), kiểm tra độ dài/độ mạnh tối thiểu khi đăng ký, giới hạn số lần đăng nhập sai liên tiếp (khóa tạm 1 phút), phiên có thời hạn và đăng xuất xóa phiên. Đăng ký chỉ tạo khách hàng; không thể tự nâng vai trò. Hiển thị bảng tài khoản mẫu để demo. Ghi rõ trong README rằng xác thực phía FE chỉ phục vụ demo đồ án.
3. Router với route guard theo screens.csv: chỉ 3 vai trò khach_hang, nhan_vien, quan_ly; truy cập sai vai trò thì chuyển về trang của vai trò đó kèm thông báo. Mỗi màn hình trong screens.csv có route theo mã (ví dụ /kh/01, /nv/02), tạm là trang giữ chỗ có tiêu đề.
4. Layout theo vai trò: thanh điều hướng khác nhau cho khách / nhân viên / quản lý, chuông thông báo đọc từ bảng notifications, avatar và đăng xuất.
5. NV-01 "Danh sách yêu cầu và việc cần làm": hộp việc dùng engine.getPendingTasks theo vai trò, lọc theo trạng thái (có bộ lọc riêng cho hồ sơ công nợ CONG_NO, ứng với M_END_DEBT), bấm vào dẫn tới đúng màn hình xử lý. Quản lý thấy cả hộp việc của nhân viên (chỉ xem).
6. AD-01 "Quản lý xe và người dùng": quản lý thêm/sửa xe, bật/tắt đối tác, nạp dữ liệu mẫu; nhân viên chỉ xem.
6b. Trong AD-01 và DevPanel thêm nút "Sao lưu dữ liệu (tải JSON)" và "Khôi phục từ file" dùng exportDatabase/importDatabase.
7. DevPanel (chỉ hiện ở môi trường dev hoặc khi bật cờ demo): hiển thị giờ demo, nút tua nhanh +15 phút, +30 phút, +2 giờ, +24 giờ, nút "Chạy sweepTimers ngay", nút "Xóa toàn bộ dữ liệu" và danh sách timers đang chạy với thời gian còn lại.
8. Trang "Dấu vết quy trình" (/trace/:requestId) cho nhân viên và quản lý: liệt kê process_events của hồ sơ theo thứ tự, mỗi dòng có ID phần tử BPMN, tên phần tử (lấy từ process-graph.json), người thực hiện, thời điểm. Dùng cho video demo và kiểm thử.
9. Test: route guard theo từng vai trò (Testing Library).

TIÊU CHÍ XONG: giao diện đúng tông xanh lá và đạt tương phản; đăng nhập bằng 3 vai trò thấy 3 menu khác nhau; mật khẩu trong IndexedDB là dạng băm; gõ URL màn hình sai vai trò bị chặn; NV-01 hiển thị các hồ sơ mẫu; DevPanel tua giờ chạy được; tối thiểu 3 commit.
```

---

## GIAI ĐOẠN 4: ĐẶT THUÊ ĐẾN BÀN GIAO XE

```text
Đọc .agent/rules/motocare.md, docs/mapping.csv (các dòng giai đoạn "1. Tiếp nhận & hồ sơ", "2. Đặt cọc & hợp đồng", "3. Kiểm tra & bàn giao"), docs/screens.csv. Dùng engine đã có (src/engine); KHÔNG đưa logic quy trình vào component.

LÀM CÁC MÀN HÌNH SAU, mỗi màn hình gọi engine.complete / fn_xxx và hiển thị đúng trạng thái:
- KH-01 Gửi yêu cầu thuê (M_START): chọn loại xe, ngày giờ nhận/trả. Có kiểm tra hợp lệ. Gửi xong chuyển sang KH-02. Nếu M_G01 không có xe phù hợp thì hồ sơ kết thúc ở M_RejectNoVehicle và khách thấy thông báo từ chối này ở KH-06.
- KH-02 Báo giá và hồ sơ (M_SendTerms, M_CheckDocs, M_AskDocs): hiển thị báo giá và điều kiện; tải lên CCCD, GPLX kèm ngày hết hạn; nhận thông báo liệt kê giấy tờ thiếu/sai và bổ sung; hiển thị số lần đã yêu cầu bổ sung; khi quá giới hạn thì hiện kết quả hủy (Gateway_0x0p273).
- KH-03 Thanh toán cọc (M_CreateDeposit, M_WaitDeposit): hiển thị mã QR, số tiền, nội dung chuyển khoản và đồng hồ đếm ngược 30 phút theo expires_at; nút "Đã chuyển khoản (giả lập)" mở khung "Giả lập ngân hàng" cho nhập số tiền thực chuyển và nội dung, để kiểm tra được cả ba kết quả DU, THIEU, SAI. Hết hạn thì hiện yêu cầu bị từ chối (M_BoundDeposit).
- NV-02 Kiểm tra cọc ngoại lệ (M_ManualDeposit, M_G03b): nhân viên xem giao dịch, ghi chú, bấm "Xác nhận" hoặc "Chưa xác nhận"; "Chưa" áp dụng quy tắc thanh toán lại.
- KH-04 Ký hợp đồng (M_Contract, M_WaitSign): xem hợp đồng điện tử dựng từ mẫu (xuất xem trước dạng trang A4 trong trình duyệt, có nút in/tải PDF bằng trình duyệt), ô ký (vẽ chữ ký bằng canvas hoặc gõ tên), đếm ngược 24 giờ. Hết hạn thì hoàn cọc và hủy (M_BoundSign, M_CancelRefund).
- NV-03 Kiểm tra kỹ thuật xe và khắc phục (M_InspectPre, M_G04, M_Rework): checklist phanh, đèn, lốp, nhiên liệu, gương, còi; kết quả Đạt/Chưa đạt; "Chưa đạt" mở khu khắc phục hoặc đổi xe (đổi xe phải kiểm tra lại lịch chống trùng); mỗi lần kiểm tra là một bản ghi mới với attempt_no tăng dần.
- NV-04 Checklist và ảnh bàn giao (M_Photo): chụp/tải ảnh, gắn vào bản PRE_HANDOVER đạt có attempt_no lớn nhất.
- KH-05 Xác nhận tình trạng xe khi nhận (Activity_0w8x12e, Activity_0d0qzp6, Gateway_0ixde68): khách xem checklist và ảnh, bấm "Đồng ý nhận xe" hoặc "Không đồng ý" kèm ghi chú; "Không đồng ý" quay lại M_InspectPre và tạo lần kiểm tra mới, mỗi phản hồi là một bản ghi handovers mới.
- NV-05 Bàn giao xe và phụ kiện (M_Handover): ghi phụ kiện, xác nhận đã giao; sau đó M_SetRented đặt xe và hồ sơ sang DANG_THUE.

RÀNG BUỘC:
- Giao diện dùng đúng design token tông xanh lá và thành phần trong src/components/ui, theo kiểu mobile-first như ứng dụng gọi xe.
- Mỗi nút bấm và khu vực quyết định có data-testid="node-<ID>" đúng ID BPMN.
- Màn hình khách phải luôn cho biết "đang ở bước nào" và "việc tiếp theo là gì" bằng Stepper dựa trên trạng thái hồ sơ.
- Mọi lỗi từ engine (sai vai trò, sai nút đang chờ) hiện thành thông báo tiếng Việt dễ hiểu.

KIỂM THỬ: viết test Playwright cho luồng "đặt thuê -> cọc -> ký -> kiểm tra -> bàn giao" (dùng DevPanel/seed để tua giờ), cộng 2 ngoại lệ: hết hạn cọc và hồ sơ bị yêu cầu bổ sung quá 3 lần.

TIÊU CHÍ XONG: ghi docs/AI_LOG.md cho giai đoạn này; chạy bằng tay được từ KH-01 tới NV-05 với 2 tài khoản (khách ở tab này, nhân viên ở tab kia) và hồ sơ chuyển sang DANG_THUE; trang /trace hiển thị đúng chuỗi ID; test xanh; tối thiểu 4 commit.
```

---

## GIAI ĐOẠN 5: ĐANG THUÊ (GIA HẠN VÀ SỰ CỐ)

```text
Đọc .agent/rules/motocare.md, docs/mapping.csv (giai đoạn "4. Đang thuê", gồm SP1 gia hạn và SP2 sự cố), docs/message-flows.csv. Dùng engine đã hoàn thiện ở 2A và 2B.

LÀM CÁC MÀN HÌNH:
- KH-06 Yêu cầu thuê của tôi (M_RejectNoVehicle, M_EG, M_CatchExtend, M_CatchReturn; nút Báo sự cố dẫn tới KH-08, ứng với M_CatchIncident): trang chủ của khách; khi hồ sơ ở DANG_THUE hiện 3 nút "Gia hạn", "Báo sự cố", "Trả xe". Chỉ một sự kiện được nhận mỗi lần (đúng ngữ nghĩa cổng theo sự kiện): khi đang gia hạn hoặc xử lý sự cố thì khóa các nút còn lại. Hiển thị danh sách hồ sơ, trạng thái, Stepper.
- KH-07 Gia hạn (SP1: GH_Offer, GH_WaitAccept, GH_CreateQR, GH_VerifyQR): khách chọn ngày trả mới; hệ thống kiểm tra lịch (GH_Check), tính phí và gửi đề xuất, đếm ngược 2 giờ để trả lời; khách Đồng ý/Từ chối; nếu có phí bổ sung thì hiện QR và đếm ngược 30 phút, thanh toán qua khung "Giả lập ngân hàng"; thành công thì cập nhật hạn trả, giá và lịch xe; mọi nhánh từ chối/quá hạn kết thúc bằng GH_NotifyOld.
- KH-08 Báo sự cố và theo dõi (SP2: SC_Create, SC_Track, SC_SendContinue, SC_NotifyEarly): khách nhập mô tả, vị trí (nhập tay hoặc lấy từ trình duyệt nếu cho phép), tải ảnh; theo dõi trạng thái sự cố theo thời gian thực (live query); nhận thông báo tiếp tục thuê hoặc hướng dẫn trả xe sớm.
- DT-01 Cổng đối tác (mô phỏng, Quản lý thao tác thay đối tác): xem các yêu cầu hỗ trợ đang gửi tới đối tác, bấm Tiếp nhận / Từ chối và báo kết quả hỗ trợ. Hiển thị rõ đây là màn hình giả lập thay cho webhook có khóa bí mật.
- QL-02 Xử lý sự cố vượt SLA (SC_Escalate, SC_GResolve): quản lý xem sự cố hết đối tác hoặc vượt SLA, ghi phương án; chọn "Có phương án" hoặc "Không".
- NV-10 Xác nhận sự cố và ghi phí (SC_Log, SC_SettleDecision): nhân viên xác nhận kết quả thực tế, ghi chi phí hợp lệ, chọn tiếp tục thuê hay không.

CHÚ Ý QUY TRÌNH:
- Giao diện theo design token tông xanh lá, mobile-first; mỗi nút bấm/quyết định có data-testid="node-<ID>" đúng ID BPMN.
- SP2 chọn đối tác theo vùng, còn khả dụng và chưa từng thử cho phiếu này (SC_Select); không phản hồi trong 15 phút hoặc từ chối thì thử đối tác khác (SC_TryNext); hết đối tác thì leo thang lên quản lý (SC_GRetry "Hết"). Kết quả hỗ trợ quá 2 giờ thì leo thang (SC_ResultTimer).
- Kết thúc SP2 sớm (SC_END_EARLY) phải đi qua error boundary M_EarlyBoundary sang bước trả xe, hồ sơ có status=CHO_NHAN_XE_TRA.

KIỂM THỬ: Playwright cho luồng gia hạn thành công có thu phí, gia hạn bị từ chối, và sự cố có đối tác nhận, cộng ngoại lệ sự cố vượt SLA (dùng nút tua giờ) và trả xe sớm do sự cố.

TIÊU CHÍ XONG: ghi docs/AI_LOG.md cho giai đoạn này; chạy bằng tay được cả SP1 và SP2 đến khi quay về KH-06; trace đúng ID; test xanh; tối thiểu 4 commit.
```

---

## GIAI ĐOẠN 6: TRẢ XE, BẢNG KÊ, QUYẾT TOÁN, LƯU HỒ SƠ

```text
Đọc .agent/rules/motocare.md, docs/mapping.csv (giai đoạn "5. Trả xe & bảng kê", "6. Quyết toán", "7. Sau trả & lưu hồ sơ"). Dùng engine có sẵn.

LÀM CÁC MÀN HÌNH:
- NV-06 Nhận và kiểm tra xe trả (M_ReceiveReturn, M_CheckReturn): xác nhận đã nhận xe, rồi làm checklist trả xe kèm ảnh theo ĐÚNG checklist của bản PRE_HANDOVER đạt có attempt_no lớn nhất (hiển thị song song bản giao và bản trả để nhân viên so).
- NV-07 Xác minh hư hỏng (M_VerifyDamage): hiển thị danh sách sai lệch do hệ thống tạo (M_DigitalCompare), nhân viên xác minh, đính bằng chứng, ước tính chi phí.
- KH-09 Bảng kê trả xe (M_SendStatement, M_ReceiveReview): khách xem bảng kê chi tiết (phí trễ hạn, hư hỏng đã xác minh, phí khác) và bấm Chấp thuận hoặc Khiếu nại kèm lý do.
- QL-01 Xử lý bất đồng bảng kê (M_Resolve): quản lý xem khiếu nại và bằng chứng, điều chỉnh hoặc giữ nguyên; M_ApproveAdjustment tăng version bảng kê rồi gửi lại cho khách.
- KH-10 Thanh toán bổ sung / nhận hoàn cọc (M_PayExtra, M_ReceiveExtra, M_Refund, M_ConfirmRefund): khi thu thêm thì hiện QR và đếm ngược 30 phút; khi hoàn dư thì khách xác nhận đã nhận hoàn cọc.
- NV-08 Xử lý khoản chưa thanh toán (M_ManualExtra, M_GExtraDecision): nhân viên ghi nhận đã liên hệ khách; "Tiếp tục thanh toán" áp dụng quy tắc thanh toán lại, "Không" ghi công nợ (M_RecordDebt -> M_END_DEBT).
- NV-09 Đánh giá xe sau trả (M_CheckReady, M_GReady): Đạt thì xe về SAN_SANG; Cần bảo trì thì lập phiếu bảo trì và khóa lịch xe (M_Maintenance).
- Vòng lặp khiếu nại bảng kê chưa có giới hạn số lần trong BPMN: hiển thị số lần đã khiếu nại, không tự thêm giới hạn.
- Cuối quy trình M_Archive đóng băng hồ sơ (archived_at, status=HOAN_TAT) và hồ sơ hiện trong lịch sử.

Giao diện theo design token tông xanh lá, mobile-first; mỗi nút bấm/quyết định có data-testid="node-<ID>" đúng ID BPMN.

QUY TẮC TÍNH TOÁN (đã có cấu hình trong src/config/rules.ts, đừng gõ cứng):
- Bảng kê = phí trễ hạn + hư hỏng đã xác minh + phí khác. M_NetDeposit: balance = tiền cọc VERIFIED (bỏ qua bản ghi EXPIRED) trừ total_fee; balance > 0 là Hoàn dư, = 0 là Cân bằng, < 0 là Thu thêm.
- Tất cả khoản tiền hiển thị theo VND, có kiểm thử làm tròn.

KIỂM THỬ: Playwright cho luồng trả xe không sai lệch (hoàn dư), trả xe có hư hỏng + khách chấp thuận + thu thêm thành công, khách khiếu nại -> quản lý điều chỉnh -> gửi lại, thu thêm quá hạn -> NV-08 -> tiếp tục thanh toán, và nhánh công nợ; thêm test M_GBalance đủ 3 nhánh.

TIÊU CHÍ XONG: ghi docs/AI_LOG.md cho giai đoạn này; chạy được một vòng đầy đủ từ KH-01 tới M_END, trace đúng; số tiền khớp với phép tính; test xanh; tối thiểu 4 commit.
```

---

## GIAI ĐOẠN 7: TÍCH HỢP BÊN NGOÀI (YÊU CẦU BẮT BUỘC CỦA ĐỀ BÀI)

> Đề bài yêu cầu tối thiểu một tích hợp bên ngoài: gửi thông báo, gọi API bên thứ ba, hoặc gọi lại workflow no-code đã xây ở TP2. Giai đoạn này không phụ thuộc đặc tả AI nên làm trước. Chọn trước (điền vào `[...]`) ít nhất một mục; nên làm cả A và B nếu còn thời gian.

```text
Đọc .agent/rules/motocare.md, docs/mapping.csv (các dòng có tạo QR, notifications, gửi thông báo) và docs/message-flows.csv. Giai đoạn này thêm tích hợp bên ngoài chạy được, vẫn CHỈ phía frontend.

CHỌN TÍCH HỢP (bắt buộc làm ít nhất một, mỗi cái đều có chế độ mock để test không cần mạng/khóa):
A. Gửi thông báo thật: gửi email qua dịch vụ gọi được từ trình duyệt (ví dụ EmailJS) mỗi khi engine tạo bản ghi notifications quan trọng (yêu cầu bổ sung hồ sơ, báo giá, hết hạn cọc, bảng kê, hoàn cọc, xử lý sự cố). Dịch vụ chọn: [...]
B. Gọi API bên thứ ba: tạo mã QR thanh toán theo chuẩn VietQR cho KH-03, KH-07, KH-10 (dùng dịch vụ tạo ảnh QR công khai hoặc thư viện tạo chuỗi VietQR; số tài khoản, ngân hàng, tên chủ tài khoản là cấu hình giả lập trong src/config). Dịch vụ chọn: [...]
C. Gọi lại workflow no-code của TP2: gọi một webhook (n8n/Make/Zapier hoặc tương đương) bằng fetch khi xảy ra sự kiện đã định ở TP2, truyền JSON gồm mã hồ sơ, bpmn_node_id, dữ liệu liên quan. URL webhook: [...]

QUY TẮC CHUNG:
1. Viết src/integrations/ với giao diện chung (Notifier / PaymentQr / WorkflowHook), hai hiện thực mỗi loại: thật và mock. Engine chỉ gọi qua giao diện, không gọi fetch trực tiếp.
2. Khóa và URL lấy từ biến môi trường VITE_ trong .env.local (đã ignore) và có file .env.example mô tả; hoặc cho nhập ở màn hình Cài đặt (chỉ lưu sessionStorage). Cấm commit khóa. Hiển thị cảnh báo trong Cài đặt: không có backend nên khóa nằm ở trình duyệt, chỉ dùng khóa giới hạn quyền cho bản demo; ghi hạn chế này vào README.
3. Mọi lần gọi ngoài phải có timeout, xử lý lỗi, thử lại tối đa 2 lần; lỗi không được làm hỏng quy trình (engine vẫn chạy tiếp, ghi lỗi vào process_events). Ghi mỗi lần gọi (thời điểm, loại, kết quả) để làm bằng chứng cho báo cáo.
4. Thêm màn hình "Nhật ký tích hợp" (/integration-log) cho quản lý liệt kê các lần gọi.
5. Test: mock cho trường hợp thành công, lỗi mạng, timeout, và kiểm tra quy trình vẫn tiếp tục.

TIÊU CHÍ XONG: ít nhất một tích hợp chạy thật được với khóa của bạn và một chế độ mock chạy được không cần mạng; /integration-log hiển thị đủ; không có khóa trong git; ghi docs/AI_LOG.md; test xanh; tối thiểu 3 commit.
```

---

## GIAI ĐOẠN 8: AI AGENT

> Giai đoạn này cần **đặc tả của Trang** (bảng phân loại AI 3.1, ngưỡng X/Y 3.2, đặc tả agent, thiết kế ở TP2). Trước khi dán, điền các chỗ trong dấu `[...]`. Nếu Trang chưa xong thì bỏ qua và làm giai đoạn 9 trước, rồi quay lại sau và chạy lại giai đoạn 9.

```text
Đọc .agent/rules/motocare.md, docs/mapping.csv (các dòng ghi chú "Ứng viên AI") và đặc tả AI dưới đây. Giai đoạn này thêm AI Agent đúng với thiết kế TP2, vẫn CHỈ phía frontend.

ĐẶC TẢ TỪ TRANG (đã điền đầy đủ theo bản đặc tả TP2):
- Bước tích hợp AI được chọn: M_CheckDocs (T02b • Kiểm tra hồ sơ/điều kiện) - Đọc và trích xuất giấy tờ CCCD & GPLX.
- Mẫu thiết kế AI Agent (theo Chương 3): AI OCR Agent nhận dạng ký tự quang học, trích xuất cấu trúc và đánh giá độ tin cậy trường.
- Đầu vào của agent: request_id, cccd_image_ref, gplx_image_ref, selected_vehicle_type, supplement_count, policy_version.
- JSON đầu ra (schema): Chuẩn JSON gồm schema_version, request_id, model_version, documents (cccd, gplx kèm confidence), checks (image_quality, required_fields_present, name_consistency), thresholds (X=0.95, Y=0.80), minimum_required_confidence (m), routing (action, reason_codes, next_step, business_rule_status).
- Ngưỡng độ tin cậy: X = 0.95 (95%), Y = 0.80 (80%).
  + m >= X (0.95) & ảnh đạt & nhất quán: routing.action = PREFILL_FOR_RULES -> Tự động điền cho Business Rules tại M_CheckDocs -> M_G02.
  + Y (0.80) <= m < X (0.95) hoặc mâu thuẫn tên: routing.action = MANUAL_REVIEW -> Nhân viên/Khách xác minh thủ công trong M_CheckDocs.
  + m < Y (0.80) hoặc ảnh mờ/hỏng: routing.action = REQUEST_REUPLOAD -> Chuyển sang M_AskDocs yêu cầu nộp lại ảnh (tối đa 3 lần).
  + Lỗi kỹ thuật / Timeout / Mạng: routing.action = FALLBACK_MANUAL -> Nhân viên nhập/xác minh thủ công, không crash hệ thống.
- Prompt hệ thống của agent: Đã cấu hình tại src/config/ai.ts (AI_OCR_SYSTEM_PROMPT).

VIỆC CẦN LÀM:
1. src/ai/ có giao diện AiProvider với 2 hiện thực: (a) nhà cung cấp thật (Gemini hoặc nhà cung cấp Trang chọn) gọi API trực tiếp từ trình duyệt bằng fetch; (b) MockProvider trả kết quả cố định theo kịch bản để demo và test không cần mạng/khóa.
2. Khóa API xử lý như giai đoạn 7 (VITE_ trong .env.local hoặc nhập ở Cài đặt, lưu sessionStorage, không commit).
3. Kết quả của agent luôn qua kiểm tra bằng Zod theo JSON đặc tả; sai định dạng hoặc lỗi mạng thì coi như dưới ngưỡng và rơi về nhánh thủ công. Không để AI tự quyết định mà không có đường quay lại người.
4. Tích hợp vào bước đã chọn: gọi agent, lưu kết quả và độ tin cậy vào dữ liệu hồ sơ (thêm trường ai_result, ai_confidence, ai_source vào bảng liên quan và cập nhật docs/data-model.csv), ghi process_events nói rõ bước nào do AI, hiển thị nhãn "Gợi ý AI" kèm độ tin cậy và nút để nhân viên hoặc khách chấp nhận hay sửa. Chỉ thêm điểm AI vào đúng bước To-Be đã chọn, không thay đổi luồng BPMN.
5. Ngưỡng độ tin cậy đặt trong src/config/ai.ts theo đặc tả; dưới ngưỡng chuyển sang kiểm tra thủ công đúng như đặc tả của Trang.
6. Trang "Nhật ký AI" (/ai-log) cho quản lý: liệt kê mọi lần gọi agent (thời điểm, bước, đầu vào rút gọn, đầu ra, độ tin cậy, nhánh được chọn, có bị người sửa không). Dùng làm bằng chứng cho báo cáo.
7. Test: MockProvider cho đủ 3 trường hợp (trên ngưỡng, dưới ngưỡng, định dạng sai/lỗi mạng) và kiểm tra nhánh quy trình tương ứng.

TIÊU CHÍ XONG: chạy được cả chế độ mock và chế độ thật (nếu có khóa); dưới ngưỡng luôn về nhánh thủ công; /ai-log hiển thị đủ; ghi docs/AI_LOG.md; test xanh; tối thiểu 3 commit.

bản đặc tả
{
   1.	Phạm vi và mục tiêu ứng dụng AI
Trong mô hình TO-BE, nhóm chỉ lựa chọn một vị trí áp dụng trí tuệ nhân tạo là hoạt động M_CheckDocs – “T02b • Kiểm tra hồ sơ/điều kiện”, thuộc giai đoạn tiếp nhận và xác minh hồ sơ thuê xe. Giải pháp được đề xuất là sử dụng công nghệ nhận dạng ký tự quang học (OCR) có hỗ trợ AI để đọc và trích xuất thông tin từ ảnh căn cước công dân (CCCD) và giấy phép lái xe (GPLX) do khách hàng cung cấp.
Mục tiêu là giảm thao tác nhập liệu và đọc giấy tờ thủ công, tăng tốc độ chuẩn bị dữ liệu cho bước kiểm tra điều kiện thuê xe và hạn chế lỗi nhập sai thông tin. Những hoạt động khác như kiểm tra lịch xe, tính phí, đối soát đặt cọc, gửi thông báo, điều phối hỗ trợ sự cố và lưu trữ hồ sơ vẫn được thực hiện bằng quy tắc nghiệp vụ, API hoặc nhân viên.
2.	Cơ sở lựa chọn
Trong kịch bản TO-BE chưa tích hợp OCR, công việc kiểm tra hồ sơ tại M_CheckDocs vẫn dựa vào dữ liệu khách hàng nhập hoặc nhân viên đối chiếu khi cần. Việc đọc, chuẩn hóa và xác nhận nhiều trường trên CCCD/GPLX có tính lặp lại và có thể phát sinh sai sót nhập liệu. Vì vậy, đây là vị trí phù hợp để bổ sung OCR trong kịch bản TO-BE có AI.
Trong TO-BE, M_CheckDocs được biểu diễn dưới dạng Business Rule Task, sử dụng dữ liệu tại customer_documents và rental_requests. Việc tích hợp OCR giúp chuyển ảnh giấy tờ thành dữ liệu có cấu trúc trước khi bộ quy tắc xác định hồ sơ có đáp ứng điều kiện thuê hay không. Giải pháp vì vậy phù hợp với định hướng số hóa hồ sơ của MotoCare mà không yêu cầu AI thay thế toàn bộ quyết định nghiệp vụ.
3.	Cách thức tích hợp vào quy trình TO-BE
Khách hàng tải ảnh CCCD và GPLX trên giao diện cung cấp hồ sơ (KH-02). Dịch vụ OCR tiếp nhận ảnh, nhận dạng văn bản và trích xuất các trường cần thiết như họ tên, ngày sinh, số giấy tờ, hạng GPLX và thời hạn hiệu lực (nếu có). Hệ thống chuẩn hóa dữ liệu đầu ra, kiểm tra trường thiếu hoặc ký tự nhận dạng không chắc chắn và đưa các kết quả này vào hồ sơ điện tử.
Sau bước OCR, hàm kiểm tra nghiệp vụ fn_check_documents sử dụng dữ liệu đã trích xuất để kiểm tra tính đầy đủ, tính nhất quán giữa các giấy tờ và điều kiện thuê đối với loại xe khách lựa chọn. OCR đảm nhiệm việc nhận dạng, trích xuất; việc đánh giá đủ tuổi, có hạng giấy phép phù hợp hay không thuộc về Business Rules, không phải một quyết định do AI tự đưa ra.
Nếu dữ liệu đáp ứng điều kiện, Gateway M_G02 – “Hồ sơ hợp lệ?” dẫn yêu cầu sang M_CreateDeposit để tiến hành đặt cọc. Nếu thiếu, sai hoặc không thể đọc chắc chắn, hệ thống chuyển đến M_AskDocs để thông báo cho khách bổ sung, chỉnh sửa hoặc để nhân viên xác minh trường hợp ngoại lệ. Bảng ánh xạ có cơ chế theo dõi số lần yêu cầu bổ sung qua doc_request_count và Gateway “Yêu cầu >3?” nhằm giới hạn vòng lặp xử lý hồ sơ. Cơ chế này cần được áp dụng nhất quán với quy định nghiệp vụ đã thống nhất.
Về mặt BPMN, nhóm giữ M_CheckDocs là Business Rule Task ở mức tổng quan; việc gọi dịch vụ OCR là chức năng thành phần bên trong tác vụ. Nếu cần mô tả triển khai kỹ thuật chi tiết hơn, có thể tách thành Service Task “OCR trích xuất giấy tờ”, Business Rule Task “Kiểm tra điều kiện” và User Task “Xác minh ngoại lệ”, nhưng đây là cấu trúc đề xuất mở rộng, không phải các tác vụ riêng đã có trong file BPMN hiện tại.
4.	Bảng ngưỡng X/Y và quy tắc chuyển nhánh
Trong kịch bản TO-BE tích hợp OCR, nhóm đề xuất hai ngưỡng tin cậy: X = 0,95 (95%) và Y = 0,80 (80%). Đây là ngưỡng thiết kế để thử nghiệm, chưa được hiệu chuẩn bằng tập dữ liệu OCR và không phải kết quả đo từ BIMP. Điểm confidence của mô hình chỉ là chỉ báo mức tin cậy, không mặc nhiên tương đương xác suất thông tin được nhận dạng đúng.
Điểm phân nhánh m là giá trị nhỏ nhất của các điểm confidence thuộc những trường bắt buộc đã trích xuất đầy đủ: họ tên, ngày sinh, số định danh trên CCCD; họ tên và hạng giấy phép trên GPLX. Nếu thiếu một trường bắt buộc, không tính m bằng cách bỏ qua trường đó mà chuyển sang nhánh bổ sung. Chất lượng ảnh, định dạng dữ liệu và sự nhất quán giữa hai giấy tờ phải được kiểm tra trước khi dùng ngưỡng X/Y.
Bảng ngưỡng X/Y và xử lý kết quả OCR:
Điều kiện	Ngưỡng	Hành động	Luồng xử lý
Ảnh thiếu/mờ, mất vùng thông tin bắt buộc	Không xét m	REQUEST_REUPLOAD	M_AskDocs → M_CheckDocs
Ảnh đạt; các trường đủ; dữ liệu nhất quán; m ≥ X	X = 95%	PREFILL_FOR_RULES	Business Rules tại M_CheckDocs → M_G02
Ảnh đạt; Y ≤ m < X	80% ≤ m < 95%	MANUAL_REVIEW	Nhân viên xác minh trong M_CheckDocs
Ảnh đạt; m < Y	m < 80%	REQUEST_REUPLOAD	M_AskDocs → M_CheckDocs; hết lượt thì nhân viên xử lý
Trường mâu thuẫn, định dạng không hợp lệ	Bất kể m	MANUAL_REVIEW	Nhân viên đối chiếu trước Business Rules
OCR lỗi hoặc hết thời gian phản hồi	Bất kể m	FALLBACK_MANUAL	Nhân viên nhập/xác minh thủ công
Quy tắc ưu tiên: thiếu ảnh/trường bắt buộc hoặc sự cố dịch vụ phải được xử lý trước khi xét m; thông tin mâu thuẫn không được tự động chuyển sang nhánh đạt chỉ vì confidence cao. Việc nhận dạng không chắc chắn không đồng nghĩa giấy tờ giả hoặc khách không đủ điều kiện thuê. Ngưỡng 95%/80% chỉ được chốt sau khi kiểm tra trên bộ ảnh có đáp án đúng và đánh giá tỷ lệ lỗi lọt nhánh tự động.
5.	Đặc tả AI Agent OCR tại M_CheckDocs
Mục đích: AI Agent thực hiện nhận dạng ký tự và trích xuất trường dữ liệu trên ảnh CCCD/GPLX, trả kết quả kèm confidence và đề xuất hướng xử lý. Agent không có quyền tự phê duyệt hồ sơ, xác thực pháp lý giấy tờ hoặc quyết định khách đủ điều kiện thuê; các quyết định nghiệp vụ tiếp tục thuộc fn_check_documents (Business Rules) và nhân viên.
Đầu vào của AI Agent:
Trường dữ liệu	Định dạng	Ý nghĩa
request_id	String	Mã yêu cầu thuê để truy vết
cccd_image_ref; gplx_image_ref	String / liên kết tạm có phân quyền	Tham chiếu ảnh giấy tờ để OCR; không phải URL công khai
document_type	CCCD hoặc GPLX	Xác định cấu trúc trường cần nhận dạng
selected_vehicle_type	String (nếu có)	Chuyển tiếp cho Business Rules kiểm tra hạng GPLX
supplement_count	Số nguyên ≥ 0	Số lần đã yêu cầu khách bổ sung hồ sơ
policy_version	String	Phiên bản quy tắc và ngưỡng X/Y được áp dụng
Dữ liệu đầu ra được chuẩn hóa dưới dạng JSON gồm schema_version, request_id, model_version; dữ liệu nhận dạng theo từng giấy tờ và confidence theo từng trường; trạng thái chất lượng ảnh và kiểm tra nhất quán; các ngưỡng X/Y; điểm m; cùng đối tượng routing (action, reason_codes, next_step, business_rule_status). Trường không đọc được phải giữ null, không tự suy đoán hoặc điền thông tin thiếu.
Ví dụ JSON đầu ra của AI Agent (dữ liệu minh họa, nhánh xác minh thủ công):
{
  "schema_version": "1.0",
  "request_id": "MC-DEMO-0001",
  "model_version": "ocr-proposal-v1",
  "documents": {
    "cccd": {
      "full_name": {"value": "NGUYEN VAN A", "confidence": 0.99},
      "date_of_birth": {"value": "2003-08-15", "confidence": 0.98},
      "id_number": {"value": "***MASKED***", "confidence": 0.97}
    },
    "gplx": {
      "full_name": {"value": "NGUYEN VAN A", "confidence": 0.98},
      "license_class": {"value": "A1", "confidence": 0.87},
      "expiry_date": {"value": null, "confidence": null}
    }
  },
  "checks": {"image_quality": "PASS",
             "required_fields_present": true, "name_consistency": "PASS"},
  "thresholds": {"X": 0.95, "Y": 0.80},
  "minimum_required_confidence": 0.87,
  "routing": {"action": "MANUAL_REVIEW",
    "reason_codes": ["GPLX_CLASS_BELOW_X"],
    "next_step": "HUMAN_VERIFICATION_AT_M_CheckDocs",
    "business_rule_status": "NOT_EVALUATED"
  }
}
Trong ví dụ, hạng GPLX có confidence = 0,87 nên m = 0,87 nằm giữa Y và X. AI Agent chuyển hồ sơ sang MANUAL_REVIEW, chưa chạy quyết định Business Rules. Thông tin trong JSON là dữ liệu giả đã che; expiry_date = null không tự suy ra giấy phép hết hạn.
Nhánh khi dưới ngưỡng: nếu Y ≤ m < X, nhân viên xem ảnh gốc và sửa/xác nhận trường chưa chắc chắn; nếu m < Y hoặc ảnh không đủ điều kiện đọc, gửi yêu cầu chụp lại qua M_AskDocs. Nếu dịch vụ OCR lỗi, hệ thống chuyển FALLBACK_MANUAL để nhân viên nhập liệu, không tự hủy yêu cầu. Sau khi dữ liệu được xác minh mới gọi fn_check_documents; kết quả kiểm tra nghiệp vụ mới quyết định nhánh M_G02.
Liên kết BPMN: mô hình hiện tại giữ OCR trong phạm vi M_CheckDocs, chưa có User Task riêng cho bước xác minh OCR. Gateway “Yêu cầu >3?” đang giới hạn số lượt bổ sung; đối với lỗi nhận dạng, cần kiểm tra thủ công trước khi hủy để không đánh đồng chất lượng ảnh kém với hồ sơ không hợp lệ. Các nhánh MANUAL_REVIEW và FALLBACK_MANUAL là quy tắc triển khai đề xuất, không được coi là các đường đi mới đã vẽ sẵn trong BPMN.
Điều kiện vận hành: bảo vệ ảnh và trường dữ liệu giấy tờ, phân quyền truy cập, không ghi số định danh thật vào log, thiết lập thời hạn lưu trữ; thử nghiệm trên bộ ảnh có nhãn đúng và đo độ chính xác theo từng trường, tỷ lệ tự điền, tỷ lệ kiểm tra thủ công, lỗi OCR lọt nhánh tin cậy cao, thời gian xử lý ngoại lệ. Chỉ điều chỉnh ngưỡng X/Y sau khi đo và hiệu chuẩn.
6.	Vai trò AI trong quy trình
Điểm cần phân biệt là OCR dựa trên AI không đồng nghĩa toàn bộ quy trình kiểm tra hồ sơ đều là AI. Trong giải pháp đề xuất, AI chỉ thực hiện nhận dạng và trích xuất thông tin từ ảnh. Việc so khớp dữ liệu, kiểm tra điều kiện thuê, cập nhật trạng thái và gửi thông báo được thực hiện bằng các quy tắc lập trình và chức năng hệ thống thông thường. Hồ sơ có kết quả nhận dạng không chắc chắn vẫn cần cơ chế xác minh của con người.
Thành phần	Vai Trò	Có sử dụng AI
OCR / trích xuất trường từ ảnh CCCD, GPLX	Chuyển ảnh giấy tờ thành dữ liệu có cấu trúc	Có
fn_check_documents / Business Rules	Kiểm tra đầy đủ, nhất quán, điều kiện thuê	Không
M_G02 / điều kiện phân nhánh	Chuyển hồ sơ đạt hoặc không đạt	Không
M_AskDocs / thông báo bổ sung	Tạo yêu cầu bổ sung, ghi nhận số lần	Không
Nhân viên xác minh ngoại lệ	Xem lại giấy tờ khi OCR không chắc chắn	Không
7.	Điều kiện triển khai, rủi ro
Để ứng dụng phù hợp với nghiệp vụ, MotoCare cần quy định danh sách giấy tờ bắt buộc; trường thông tin được phép trích xuất; định dạng ảnh được chấp nhận; quy tắc đối chiếu dữ liệu; và ngưỡng chuyển sang kiểm tra thủ công khi kết quả nhận dạng không đáng tin cậy. Dịch vụ cần có xử lý trường hợp ảnh mờ, ảnh thiếu góc, giấy tờ hết hiệu lực hoặc thông tin giữa các giấy tờ không thống nhất.
Do CCCD và GPLX chứa thông tin cá nhân, hệ thống cần kiểm soát quyền truy cập, bảo vệ ảnh và dữ liệu trích xuất, xác định thời hạn lưu giữ phù hợp và có quy trình xử lý dữ liệu sai. OCR không tự xác nhận được tính xác thực pháp lý của giấy tờ; các quyết định ảnh hưởng trực tiếp đến việc chấp thuận hoặc từ chối thuê xe không nên chỉ dựa vào kết quả nhận dạng thiếu chắc chắn.
8.	Kết luận
Việc lựa chọn AI OCR tại M_CheckDocs là giải pháp có phạm vi rõ ràng trong mô hình TO-BE của MotoCare. OCR hỗ trợ chuyển đổi ảnh CCCD/GPLX thành dữ liệu có cấu trúc; Business Rules và nhân viên vẫn chịu trách nhiệm kiểm tra điều kiện thuê và xử lý ngoại lệ. Dữ liệu BIMP hiện có ghi nhận M_CheckDocs được cấu hình xử lý ở mức 12 giây/lượt trong một kịch bản TO-BE. Tuy nhiên, chưa có đủ hai kịch bản mô phỏng đối chứng TO-BE không AI và TO-BE có OCR để xác định riêng hiệu quả định lượng của AI. Độ chính xác nhận dạng, thời gian xử lý ngoại lệ và ảnh hưởng đến thời gian chu trình cần được đánh giá thêm bằng thử nghiệm và dữ liệu vận hành.





}
```

---

## GIAI ĐOẠN 9: KIỂM THỬ, README, TRIỂN KHAI

```text
Đọc .agent/rules/motocare.md. Giai đoạn cuối: chất lượng, tài liệu, triển khai. Nếu giai đoạn 8 (AI Agent) làm sau thì chạy lại giai đoạn này.

VIỆC CẦN LÀM:
1. Bảng đối chiếu To-Be <-> app: tạo docs/TRACEABILITY.md liệt kê MỌI phần tử BPMN trong docs/mapping.csv (110 dòng) với: màn hình hoặc hàm hiện thực, file mã nguồn, test phủ nó (nếu có), trạng thái (Đạt/Lệch/Chưa làm). Tạo tự động bằng script từ process-graph.json, quét data-testid, process_events và tên test; liệt kê riêng các phần tử chưa có test.
2. Bổ sung test cho đủ theo yêu cầu đề bài (kịch bản chính và ngoại lệ quan trọng): mỗi cổng XOR rẽ nhánh (20) ít nhất 1 test mỗi nhánh; 10 quyết định của người; 3 ngoại lệ chính (hết hạn cọc, hết hạn ký, quá hạn SLA) cùng các timer còn lại; luồng chính end-to-end. Chạy toàn bộ npm run lint, typecheck, test, test:e2e và sửa đến khi xanh. Báo cáo độ phủ.
3. Checklist 6 yêu cầu kỹ thuật tối thiểu: tạo docs/DOD_CHECKLIST.md, mỗi yêu cầu một mục kèm bằng chứng cụ thể (đường dẫn file, tên test, lệnh kiểm tra): (1) xác thực và 3 vai trò phản ánh lane; (2) tối thiểu 10 luồng phê duyệt đúng cổng XOR; (3) lưu trữ bền vững; (4) tích hợp bên ngoài; (5) bộ kiểm thử tự động; (6) tối thiểu 15 commit (chạy git rev-list --count HEAD và liệt kê). Mục nào chưa đạt thì ghi rõ.
4. Bảo mật phía FE: tạo docs/SECURITY_CHECKLIST.md: không có khóa API trong mã/lịch sử git (quét bằng lệnh), kiểm tra quyền theo vai trò ở repository (thử gọi trực tiếp hàm sai vai trò), dữ liệu vào đã qua Zod, không dùng dangerouslySetInnerHTML, ảnh tải lên chỉ nhận loại hợp lệ và giới hạn dung lượng, mật khẩu băm, giới hạn đăng nhập sai, và nêu rõ hạn chế vì không có backend (xác thực và phân quyền phía trình duyệt chỉ đủ cho bản demo).
5. README.md: giới thiệu, ảnh chụp màn hình, tài khoản mẫu, cách chạy (npm install, npm run dev), cách nạp dữ liệu mẫu, cách demo (DevPanel tua giờ, khung Giả lập ngân hàng, DT-01), cấu trúc thư mục, bảng quy đổi backend -> frontend, hạn chế đã biết (nhánh công nợ, không có backend, dữ liệu nằm trên từng trình duyệt nên dùng nút sao lưu/khôi phục để chuyển máy, khóa API ở trình duyệt), liên kết các tài liệu trong docs/. Đề bài coi bài không chạy được theo README là không đạt, nên: tạo thư mục sạch, clone repo, làm đúng từng bước README (npm ci, build, dev) và sửa README cho đến khi chạy được.
6. docs/CODE_GUIDE.md để giải trình mã: sơ đồ kiến trúc ngắn, luồng một yêu cầu đi qua engine, và danh sách 10 đoạn mã quan trọng nhất (engine.advance, cổng XOR, sweepTimers, tính phí và đối trừ cọc, kiểm tra quyền, băm mật khẩu...) mỗi đoạn có vị trí file và giải thích ngắn bằng tiếng Việt, vì mọi thành viên phải tự giải thích được mã khi vấn đáp.
7. Kiểm tra docs/AI_LOG.md: có ít nhất 10 lượt tương tác và ít nhất 2 lượt thất bại kèm phân tích nguyên nhân; nếu thiếu thì liệt kê để tôi bổ sung từ lịch sử thật, không bịa.
8. docs/DEMO_SCRIPT.md: 1 luồng chính đầy đủ và 2 ngoại lệ, từng bước bấm gì ở tài khoản nào và kết quả mong đợi, để quay video 10 phút.
9. Triển khai bản tĩnh: cấu hình build cho Vercel hoặc Netlify hoặc GitHub Pages (HashRouter đã dùng), hướng dẫn trong README, kiểm tra bản build chạy từ npm run preview.
10. Dọn dẹp: xóa mã chết, dữ liệu thử, console.log; kiểm tra tối thiểu 15 commit có thông điệp rõ ràng.

TIÊU CHÍ XONG: toàn bộ kiểm thử xanh; TRACEABILITY.md không còn dòng "Lệch" chưa giải thích; DOD_CHECKLIST.md đủ 6 mục có bằng chứng; clone sạch chạy được theo README; build tĩnh chạy được.
```

---

## Phụ lục: yêu cầu bổ sung dùng khi agent làm sai

Dán nguyên văn khi cần:

```text
Dừng lại. Hãy đối chiếu việc bạn vừa làm với docs/process-graph.json và docs/mapping.csv. Liệt kê (1) phần tử BPMN nào bạn đã đổi hoặc bỏ qua, (2) chỗ nào logic quy trình nằm ngoài src/engine. Sau đó sửa cho đúng BPMN mà không thay đổi luồng. Nếu BPMN và bảng ánh xạ mâu thuẫn, ghi vào docs/QUESTIONS.md và hỏi tôi.
```

Dán khi giao diện lệch tông màu:

```text
Giao diện chưa đúng phong cách. Hãy rà soát toàn bộ component và trang, thay mọi màu viết cứng bằng design token tông xanh lá (brand-50 đến brand-900) đã khai báo trong tailwind.config. Đảm bảo nút chính dùng brand-700 với chữ trắng, kiểm tra tương phản WCAG AA, card bo rounded-2xl, mobile-first, badge trạng thái theo nhóm màu đã quy định. Không đổi logic. Mở trang /style và các màn hình chính để tự kiểm tra rồi liệt kê file đã sửa.
```
