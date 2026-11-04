# BẢNG ĐỐI CHIẾU TO-BE BPMN VÀ ỨNG DỤNG FRONTEND (TRACEABILITY MATRIX)

> **Dự án:** MOTO CARE - Hệ Thống Thuê Xe Máy Trực Tuyến  
> **Phiên bản:** Đồ án BPMN To-Be (110 phần tử quy chuẩn)  
> **Tình trạng kiểm thử:** Đạt 110/110 phần tử (100% Đạt, 0 Lệch, 0 Chưa làm)  

---

## 1. Tổng quan ma trận đối chiếu

- Toàn bộ 110 phần tử BPMN từ mô hình `MotoCare_TO_BE.bpmn` và `docs/process-graph.json` đã được hiện thực hóa đầy đủ phía Frontend (trình duyệt) theo đúng luật dự án `.agent/rules/motocare.md`.
- Tất cả các nút bấm và cổng quyết định trên giao diện người dùng đều được gắn thẻ `data-testid="node-<ID>"` tương ứng.
- Mọi chuyển biến trạng thái, thực thi hàm tự động, rẽ nhánh cổng XOR, kích hoạt timer và error boundary đều được ghi nhật ký bất biến vào bảng IndexedDB `process_events`.

| Chỉ số | Số lượng | Tỷ lệ | Đánh giá |
|---|:---:|:---:|:---:|
| **Tổng số phần tử BPMN** | 110 | 100% | Đầy đủ |
| **Phần tử có mã nguồn hiện thực** | 110 | 100% | Đạt |
| **Phần tử có kiểm thử tự động (Unit Test / E2E)** | 110 | 100% | Đạt |
| **Phần tử bị lệch hoặc chưa làm** | 0 | 0% | Tuyệt đối an toàn |

---

## 2. Bảng đối chiếu chi tiết 110 phần tử BPMN

| STT | ID Phần tử | Tên phần tử BPMN | Phân hệ / Lane | Loại phần tử | Hiện thực mã nguồn | File kiểm thử bao phủ | Trạng thái |
|:---:|:---|:---|:---|:---|:---|:---|:---:|
| 1 | `M_START` | Khách gửi yêu cầu | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện bắt đầu | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/e2e/phase4_flow.spec.ts`<br>`tests/unit/engine.test.ts` | **Đạt** |
| 2 | `M_CheckFleet` | T01b • Tra cứu xe và lịch thuê | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 3 | `M_G01` | Có xe? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 4 | `M_RejectNoVehicle` | T13 • Gửi thông báo không có xe | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 5 | `M_END_REJECT` | Từ chối | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện kết thúc | `src/engine/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 6 | `M_SendTerms` | T02 • Báo giá/điều kiện thuê | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 7 | `M_CheckDocs` | T02b • Kiểm tra hồ sơ/điều kiện | HỆ THỐNG / TỰ ĐỘNG HÓA | Business rule task | `src/ai/index.ts`<br>`src/ai/types.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 8 | `M_G02` | Hồ sơ hợp lệ? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 9 | `M_AskDocs` | Yêu cầu bổ sung/điều chỉnh | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/ai/mock.ts`<br>`src/engine/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 10 | `Gateway_0x0p273` | Yêu cầu >3? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 11 | `M_EndCancel` | Kết thúc hủy | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện kết thúc | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 12 | `M_CreateDeposit` | T02c • Tạo yêu cầu cọc/QR | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 13 | `M_WaitDeposit` | Chờ xác nhận tiền cọc | HỆ THỐNG / TỰ ĐỘNG HÓA | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH02Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 14 | `M_BoundDeposit` | Hết hạn cọc | HỆ THỐNG / TỰ ĐỘNG HÓA | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 15 | `M_CheckDeposit` | T02d • Đối soát tiền cọc | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 16 | `M_G03` | Đúng/đủ cọc? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 17 | `M_ManualDeposit` | Kiểm tra cọc ngoại lệ | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/customer/KH03Page.tsx` | `tests/unit/engine.test.ts` | **Đạt** |
| 18 | `M_G03b` | Xác nhận được? | NHÂN VIÊN / VẬN HÀNH | Cổng XOR (rẽ nhánh) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/database.test.ts`<br>`tests/unit/engine.test.ts` | **Đạt** |
| 19 | `M_Contract` | T03 • Tạo hợp đồng điện tử | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 20 | `M_WaitSign` | Nhận hợp đồng đã ký | HỆ THỐNG / TỰ ĐỘNG HÓA | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH04Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 21 | `M_BoundSign` | Hết hạn ký | HỆ THỐNG / TỰ ĐỘNG HÓA | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 22 | `M_CancelRefund` | Hoàn cọc hợp lệ, hủy yêu cầu | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts` | **Đạt** |
| 23 | `M_SaveBooking` | T03b • Khóa lịch xe đặt thuê | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 24 | `M_InspectPre` | T04 • Kiểm tra kỹ thuật xe | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 25 | `M_G04` | Xe đạt? | NHÂN VIÊN / VẬN HÀNH | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 26 | `M_Rework` | T14 • Khắc phục/đổi xe | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 27 | `M_Photo` | T04b • Checklist + ảnh bàn giao | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 28 | `Activity_0w8x12e` | Gửi khách checklist và ảnh tình trạng xe | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 29 | `Activity_0d0qzp6` | Nhận phản hồi từ khách | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/features/customer/KH05Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 30 | `Gateway_0ixde68` | Đồng ý nhận xe? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 31 | `M_Handover` | T05 • Bàn giao xe & phụ kiện | NHÂN VIÊN / VẬN HÀNH | Manual task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 32 | `M_SetRented` | T05b • Cập nhật Đang thuê | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase4_booking_to_handover.test.ts` | **Đạt** |
| 33 | `M_EG` | Chờ sự kiện thuê | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng theo sự kiện | `src/engine/index.ts`<br>`src/features/customer/KH06Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 34 | `M_CatchExtend` | Nhận yêu cầu gia hạn | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện trung gian (nhận thông điệp) | `src/engine/index.ts`<br>`src/features/customer/KH06Page.tsx` | `tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 35 | `SP1` | SP1 • Xử lý gia hạn (TO-BE) | HỆ THỐNG / TỰ ĐỘNG HÓA | Sub-process | `src/engine/graph.ts`<br>`src/engine/index.ts` | `tests/e2e/phase5_flow.spec.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 36 | `GH_START` | Bắt đầu SP1 | HỆ THỐNG | Sự kiện bắt đầu | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 37 | `GH_GetRequest` | GH01 • Ghi yêu cầu gia hạn | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 38 | `GH_Check` | GH02 • Kiểm tra lịch + điều kiện | HỆ THỐNG | Business rule task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 39 | `GH_GEligible` | Có thể gia hạn? | HỆ THỐNG | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 40 | `GH_Offer` | GH03 • Tính phí và gửi đề xuất | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 41 | `GH_WaitAccept` | Chờ khách trả lời | HỆ THỐNG | Receive task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 42 | `GH_Timer` | Quá hạn trả lời | HỆ THỐNG | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 43 | `GH_GAccept` | Khách đồng ý? | HỆ THỐNG | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 44 | `GH_NeedPayment` | Có phí bổ sung? | HỆ THỐNG | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 45 | `GH_CreateQR` | Tạo QR bổ sung | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 46 | `GH_VerifyQR` | Chờ thanh toán được xác thực | HỆ THỐNG | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH07Page.tsx` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 47 | `GH_TimerPay` | Quá hạn trả | HỆ THỐNG | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 48 | `GH_Update` | GH03c • Cập nhật thời hạn/lịch/giá | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 49 | `GH_NotifyOK` | GH03d • Gửi xác nhận gia hạn | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 50 | `GH_NotifyOld` | GH04 • Giữ hạn cũ/thông báo từ chối | HỆ THỐNG | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 51 | `GH_GMerge` | Kết thúc SP1 | HỆ THỐNG | Cổng XOR (gộp) | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 52 | `GH_END` | Trở lại thuê | HỆ THỐNG | Sự kiện kết thúc | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 53 | `M_CatchIncident` | Nhận báo sự cố | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện trung gian (nhận thông điệp) | `src/engine/index.ts`<br>`src/features/customer/KH06Page.tsx` | `tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 54 | `SP2` | SP2 • Hỗ trợ sự cố (TO-BE) | HỆ THỐNG / TỰ ĐỘNG HÓA | Sub-process | `src/engine/graph.ts`<br>`src/engine/index.ts` | `tests/e2e/phase5_flow.spec.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 55 | `SC_START` | Bắt đầu SP2 | HỆ THỐNG / ĐIỀU PHỐI | Sự kiện bắt đầu | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 56 | `SC_Create` | SC01 • Tạo phiếu từ vị trí/ảnh sự cố | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 57 | `SC_Select` | Chọn đối tác theo vùng/khả dụng | HỆ THỐNG / ĐIỀU PHỐI | Business rule task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 58 | `SC_Dispatch` | SC02 • Gửi yêu cầu và mã sự cố | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 59 | `SC_ReceiveAck` | Chờ đối tác tiếp nhận | HỆ THỐNG / ĐIỀU PHỐI | Receive task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 60 | `SC_AckTimer` | Quá hạn phản hồi | HỆ THỐNG / ĐIỀU PHỐI | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 61 | `SC_GAccept` | Đã nhận hỗ trợ? | HỆ THỐNG / ĐIỀU PHỐI | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 62 | `SC_TryNext` | Tăng số thử, tìm đối tác khác | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 63 | `SC_GRetry` | Còn đối tác? | HỆ THỐNG / ĐIỀU PHỐI | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 64 | `SC_Track` | Theo dõi trạng thái hỗ trợ | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 65 | `SC_ReceiveResult` | Chờ xác nhận kết quả hỗ trợ | HỆ THỐNG / ĐIỀU PHỐI | Receive task | `src/engine/index.ts`<br>`src/features/partner/DT01Page.tsx` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 66 | `SC_ResultTimer` | Quá hạn SLA | HỆ THỐNG / ĐIỀU PHỐI | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 67 | `SC_Escalate` | QL xử lý vượt SLA / phương án khác | QUẢN LÝ | User task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 68 | `SC_GResolve` | Có thể hỗ trợ? | QUẢN LÝ | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts` | **Đạt** |
| 69 | `SC_Log` | SC04 • Xác nhận thực tế, ghi phí hợp lệ | NHÂN VIÊN | User task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 70 | `SC_SettleDecision` | Tiếp tục thuê? | HỆ THỐNG / ĐIỀU PHỐI | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 71 | `SC_SendContinue` | SC06 • Thông báo tiếp tục thuê | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 72 | `SC_NotifyEarly` | SC05/06 • Hướng dẫn trả xe sớm | HỆ THỐNG / ĐIỀU PHỐI | Service task | `src/engine/index.ts`<br>`src/engine/fn/sp.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 73 | `SC_END_OK` | Tiếp tục | HỆ THỐNG / ĐIỀU PHỐI | Sự kiện kết thúc | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 74 | `SC_END_EARLY` | Kết thúc sớm | HỆ THỐNG / ĐIỀU PHỐI | Sự kiện kết thúc (lỗi) | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 75 | `M_EarlyBoundary` | Trả xe sớm | HỆ THỐNG / TỰ ĐỘNG HÓA | Error biên (ngắt) | `src/engine/index.ts`<br>`src/features/manager/QL02Page.tsx` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 76 | `M_CatchReturn` | Nhận yêu cầu trả xe | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện trung gian (nhận thông điệp) | `src/engine/index.ts`<br>`src/features/customer/KH06Page.tsx` | `tests/unit/engine.test.ts` | **Đạt** |
| 77 | `M_ReturnMerge` | Gộp trả xe | NHÂN VIÊN / VẬN HÀNH | Cổng XOR (gộp) | `src/engine/index.ts` | `tests/unit/engine_sp.test.ts`<br>`tests/unit/phase5_rental_events.test.ts` | **Đạt** |
| 78 | `M_ReceiveReturn` | T06 • Nhận xe trả | NHÂN VIÊN / VẬN HÀNH | Manual task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 79 | `M_CheckReturn` | T06b • Kiểm tra xe trả theo checklist | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 80 | `M_DigitalCompare` | T07 • Đối chiếu ảnh/giao–nhận | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 81 | `M_GDamage` | Có sai lệch? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 82 | `M_VerifyDamage` | Xác minh hư hỏng và bằng chứng | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 83 | `M_CalcFees` | T07b • Tự động tính phí | HỆ THỐNG / TỰ ĐỘNG HÓA | Business rule task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 84 | `M_SendStatement` | T07c • Gửi bảng kê chi tiết | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 85 | `M_ReceiveReview` | Chờ khách xác nhận bảng kê | HỆ THỐNG / TỰ ĐỘNG HÓA | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH09Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 86 | `M_GDispute` | Khách đồng ý? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 87 | `M_Resolve` | T15 • Xử lý bất đồng/đề xuất điều chỉnh | QUẢN LÝ / CHỦ CƠ SỞ | User task | `src/engine/index.ts`<br>`src/features/customer/KH09Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 88 | `M_ApproveAdjustment` | Cập nhật kết luận/biên bản phí | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 89 | `M_NetDeposit` | T08 • Đối trừ tiền cọc | HỆ THỐNG / TỰ ĐỘNG HÓA | Business rule task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 90 | `M_GBalance` | Chênh lệch? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 91 | `M_Refund` | T08b • Khởi tạo hoàn cọc dư | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 92 | `M_ConfirmRefund` | Nhận xác nhận hoàn tiền | HỆ THỐNG / TỰ ĐỘNG HÓA | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH06Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 93 | `M_PayExtra` | T08a • Tạo yêu cầu thu thêm | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 94 | `M_ReceiveExtra` | Chờ tiền bổ sung | HỆ THỐNG / TỰ ĐỘNG HÓA | Receive task | `src/engine/index.ts`<br>`src/features/customer/KH10Page.tsx` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 95 | `M_BoundExtra` | Hết hạn thu thêm | HỆ THỐNG / TỰ ĐỘNG HÓA | Timer biên (ngắt) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 96 | `M_VerifyExtra` | Đối soát khoản thu bổ sung | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 97 | `M_GExtra` | Thu thành công? | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 98 | `M_ManualExtra` | Liên hệ/xử lý khoản chưa thanh toán | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/customer/KH10Page.tsx` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 99 | `M_GExtraDecision` | Khách thanh toán tiếp? | NHÂN VIÊN / VẬN HÀNH | Cổng XOR (rẽ nhánh) | `src/config/rules.ts`<br>`src/engine/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 100 | `M_RecordDebt` | Ghi nhận công nợ chưa tất toán | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 101 | `M_END_DEBT` | Chờ xử lý công nợ | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện kết thúc | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 102 | `M_GJoinBalance` | Gộp quyết toán | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (gộp) | `src/engine/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 103 | `M_Settle` | T08c • Ghi hoàn tất quyết toán | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 104 | `M_CheckReady` | T09 • Đánh giá xe sau trả | NHÂN VIÊN / VẬN HÀNH | User task | `src/engine/index.ts`<br>`src/features/staff/NV01Page.tsx` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |
| 105 | `M_GReady` | Sẵn sàng? | NHÂN VIÊN / VẬN HÀNH | Cổng XOR (rẽ nhánh) | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 106 | `M_Maintenance` | T11/T11b • Lập phiếu bảo trì, khóa lịch | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 107 | `M_MarkReady` | T10 • Trạng thái Sẵn sàng | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 108 | `M_GStatus` | Đồng bộ hồ sơ | HỆ THỐNG / TỰ ĐỘNG HÓA | Cổng XOR (gộp) | `src/engine/index.ts` | `tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 109 | `M_Archive` | T12 • Lưu hồ sơ tập trung | HỆ THỐNG / TỰ ĐỘNG HÓA | Service task | `src/engine/index.ts`<br>`src/engine/fn/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/phase6_return_settle.test.ts` | **Đạt** |
| 110 | `M_END` | Hoàn tất | HỆ THỐNG / TỰ ĐỘNG HÓA | Sự kiện kết thúc | `src/engine/index.ts` | `tests/unit/engine.test.ts`<br>`tests/unit/engine_sp.test.ts` | **Đạt** |

---

## 3. Danh sách phần tử chưa có test

- **Chúc mừng!** Không có phần tử nào bị thiếu test. Toàn bộ 110/110 phần tử đều đã có mã kiểm thử bao phủ trực tiếp.

---

## 4. Giải trình các điểm đặc biệt của quy trình

1. **Tích hợp AI Agent OCR tại `M_CheckDocs` (Giai đoạn 8):**
   - Giữ nguyên cấu trúc `M_CheckDocs` là Business Rule Task trong quy trình chính.
   - AI OCR Agent hoạt động như một thành phần thông minh bên trong tác vụ, trích xuất CCCD và GPLX, tính điểm phân nhánh $m$ dựa trên 2 ngưỡng $X = 0.95$ và $Y = 0.80$.
   - Kết quả phân nhánh: $m \ge X$ tự động điền (`PREFILL_FOR_RULES`), $Y \le m < X$ hoặc lệch tên chuyển sang xác minh thủ công (`MANUAL_REVIEW`), $m < Y$ yêu cầu nộp lại (`REQUEST_REUPLOAD`), lỗi kỹ thuật rơi về `FALLBACK_MANUAL`.

2. **Cổng rẽ nhánh theo sự kiện `M_EG` (Event-Based Gateway):**
   - Điều phối 3 nhánh cạnh tranh: Gia hạn (`M_CatchExtend` -> SP1), Báo sự cố (`M_CatchIncident` -> SP2), và Trả xe (`M_CatchReturn`).
   - Thực hiện quy tắc khóa tương hỗ (mutual exclusion) chặt chẽ: khi đang gia hạn hoặc xử lý cứu hộ, giao diện khóa các nút sự kiện còn lại.

3. **Vòng lặp khiếu nại bảng kê (`M_GDispute` -> `M_Resolve` -> `M_ApproveAdjustment`):**
   - Mô hình BPMN To-Be không quy định giới hạn cứng số lần khiếu nại; ứng dụng ghi nhận `dispute_count` và tăng version bảng kê qua từng vòng lặp giải quyết của Quản lý.

4. **Xử lý sự kiện kết thúc công nợ (`M_END_DEBT`):**
   - Khi khách hàng không đồng ý thanh toán khoản thu thêm tại `NV-08` (`M_GExtraDecision = 'Không'`), quy trình ghi nhận nợ khó đòi `M_RecordDebt` và dừng tại `M_END_DEBT` với trạng thái `CONG_NO`.