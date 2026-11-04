// src/db/types.ts
// Các kiểu dữ liệu chuẩn theo docs/data-model.csv và các bảng client-side

export type UserRole = 'khach_hang' | 'nhan_vien' | 'quan_ly';

export interface Actor {
  id: string;
  role: UserRole | 'system';
}

// 1. profiles
export interface Profile {
  id: string; // uuid, trùng auth_accounts.user_id
  full_name: string;
  phone?: string;
  role: UserRole;
}

// 2. vehicles
export type VehicleStatus = 'SAN_SANG' | 'DANG_THUE' | 'BAO_TRI';

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  vehicle_type: string; // xe_so | tay_ga | xe_con
  daily_price: number;
  status: VehicleStatus;
  condition_note?: string;
}

// 3. rental_requests
export type RentalRequestStatus =
  | 'MOI'
  | 'CHO_HO_SO'
  | 'CHO_COC'
  | 'CHO_KY'
  | 'CHO_BAN_GIAO'
  | 'CHO_KHACH_NHAN'
  | 'DANG_THUE'
  | 'DANG_GIA_HAN'
  | 'DANG_XU_LY_SU_CO'
  | 'CHO_NHAN_XE_TRA'
  | 'CHO_KHACH_XAC_NHAN_BANG_KE'
  | 'CHO_THU_THEM'
  | 'CONG_NO'
  | 'CHO_DANH_GIA_XE'
  | 'HOAN_TAT'
  | 'DA_HUY'
  | 'TU_CHOI';

export interface RentalRequest {
  id: string;
  customer_id: string;
  vehicle_id?: string;
  start_at: string; // timestamptz ISO
  end_at: string;   // timestamptz ISO
  status: RentalRequestStatus;
  total_price?: number;
  deposit_amount?: number;
  doc_request_count: number;
  closed_reason?: 'HET_XE' | 'QUA_HAN_COC' | 'HO_SO_KHONG_DAT' | 'QUA_HAN_KY' | string;
  returned_at?: string;
  closed_at?: string;
  archived_at?: string;
}

// 4. customer_documents
export type DocumentType = 'CCCD_TRUOC' | 'CCCD_SAU' | 'BANG_LAI_TRUOC' | 'BANG_LAI_SAU' | 'OTHER';

export interface CustomerDocument {
  id: string;
  request_id: string;
  doc_type: DocumentType;
  file_url: string; // Base64 hoặc ObjectURL
  is_valid?: boolean;
  check_note?: string;
  ai_result?: Record<string, unknown> | null;
  ai_confidence?: number | null;
  ai_source?: 'GEMINI' | 'MOCK' | 'MANUAL';
}

// 5. payments
export type PaymentKind = 'DEPOSIT' | 'EXTENSION' | 'EXTRA' | 'REFUND';
export type PaymentStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'FAILED';
export type PaymentMatchResult = 'DU' | 'THIEU' | 'SAI';

export interface Payment {
  id: string;
  request_id: string;
  kind: PaymentKind;
  amount: number;
  paid_amount?: number;
  qr_ref: string; // UNIQUE
  status: PaymentStatus;
  expires_at?: string;
  provider_txn_id?: string; // UNIQUE
  paid_at?: string;
  verified_at?: string;
  match_result?: PaymentMatchResult;
  manual_verified_by?: string;
  manual_note?: string;
}

// 6. contracts
export type ContractStatus = 'SENT' | 'SIGNED' | 'EXPIRED';

export interface Contract {
  id: string;
  request_id: string; // UNIQUE
  file_url?: string;
  status: ContractStatus;
  sent_at?: string;
  expires_at?: string;
  signed_at?: string;
}

// 7. vehicle_schedule
export type ScheduleKind = 'RENTAL' | 'MAINTENANCE';

export interface VehicleSchedule {
  id: string;
  vehicle_id: string;
  request_id?: string;
  kind: ScheduleKind;
  start_at: string; // timestamptz ISO
  end_at: string;   // timestamptz ISO
}

// 8. inspections
export type InspectionKind = 'PRE_HANDOVER' | 'RETURN' | 'POST_RETURN';
export type InspectionResult = 'DAT' | 'CHUA_DAT' | 'CAN_BAO_TRI';

export interface Inspection {
  id: string;
  request_id: string;
  vehicle_id: string;
  kind: InspectionKind;
  attempt_no: number;
  inspector_id?: string;
  checklist?: Record<string, unknown>;
  result?: InspectionResult;
  photo_urls?: string[];
  diff_items?: Record<string, unknown>;
  rework_note?: string;
}

// 9. handovers
export interface Handover {
  id: string;
  request_id: string;
  attempt_no: number;
  accessories?: Record<string, unknown>;
  staff_id?: string;
  customer_accepted?: boolean;
  customer_note?: string;
  handed_over_at?: string;
}

// 10. damage_findings
export interface DamageFinding {
  id: string;
  request_id: string;
  inspection_id: string;
  description: string;
  evidence_urls?: string[];
  estimated_cost: number;
  verified_by?: string;
  verified_at?: string;
}

// 11. statements
export type StatementStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DISPUTED';
export type StatementCustomerAnswer = 'CHAP_THUAN' | 'KHIEU_NAI';

export interface StatementItem {
  name: string;
  amount: number;
  note?: string;
}

export interface Statement {
  id: string;
  request_id: string;
  version: number;
  items: StatementItem[];
  total_fee: number;
  status: StatementStatus;
  customer_answer?: StatementCustomerAnswer;
  dispute_reason?: string;
  resolution_note?: string;
  resolved_by?: string;
  sent_at?: string;
  answered_at?: string;
}

// 12. settlements
export type SettlementKind = 'HOAN_DU' | 'CAN_BANG' | 'THU_THEM';
export type SettlementStatus = 'CHO' | 'HOAN_TAT' | 'CONG_NO';

export interface Settlement {
  id: string;
  request_id: string; // UNIQUE
  deposit_paid: number;
  total_fee: number;
  balance: number; // deposit_paid - total_fee
  kind: SettlementKind;
  status: SettlementStatus;
  settled_at?: string;
}

// 13. extension_requests
export type ExtensionRequestStatus = 'YEU_CAU' | 'DA_DE_XUAT' | 'DA_AP_DUNG' | 'TU_CHOI' | 'HET_HAN';
export type ExtensionCustomerAnswer = 'DONG_Y' | 'TU_CHOI';

export interface ExtensionRequest {
  id: string;
  request_id: string;
  new_end_at: string;
  eligible?: boolean;
  reject_reason?: string;
  extra_fee?: number;
  status: ExtensionRequestStatus;
  customer_answer?: ExtensionCustomerAnswer;
  offer_expires_at?: string;
}

// 14. partners
export interface Partner {
  id: string;
  name: string;
  region: string;
  contact: string;
  available: boolean;
}

// 15. incidents
export type IncidentStatus = 'MOI' | 'DANG_HO_TRO' | 'VUOT_SLA' | 'DONG_TIEP_TUC' | 'DONG_TRA_SOM';

export interface Incident {
  id: string;
  request_id: string;
  reported_by: string;
  incident_code: string; // UNIQUE
  lat?: number;
  lng?: number;
  photo_urls?: string[];
  description: string;
  status: IncidentStatus;
  attempt_no: number;
  partner_id?: string;
  escalation_note?: string;
  actual_cost?: number;
  continue_rental?: boolean;
  confirmed_by?: string;
  created_at: string;
  closed_at?: string;
}

// 16. incident_dispatches
export type IncidentDispatchStatus = 'SENT' | 'ACCEPTED' | 'DECLINED' | 'TIMEOUT';

export interface IncidentDispatch {
  id: string;
  incident_id: string;
  partner_id: string;
  attempt_no: number;
  status: IncidentDispatchStatus;
  sent_at: string;
  ack_at?: string;
  result_at?: string;
  result?: string;
}

// 17. maintenance_orders
export type MaintenanceOrderStatus = 'MO' | 'XONG';

export interface MaintenanceOrder {
  id: string;
  vehicle_id: string;
  request_id?: string;
  reason: string;
  status: MaintenanceOrderStatus;
  created_at: string;
}

// 18. notifications
export interface Notification {
  id: string;
  user_id: string;
  request_id?: string;
  template: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// 19. process_events (Nhật ký BPMN)
export interface ProcessEvent {
  id: string;
  request_id: string;
  bpmn_node_id: string;
  event_type: string;
  actor_id?: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

// ==============================================================
// 3 BẢNG PHỤ CLIENT-SIDE (Dùng cho engine, timers và xác thực FE)
// ==============================================================

// 20. process_state (Client-side)
export interface ProcessState {
  request_id: string; // PK
  waiting_node_ids: string[];
  loop_counters: Record<string, number>;
  variables: Record<string, unknown>;
  updated_at: string;
}

// 21. timers (Client-side)
export type TimerStatus = 'PENDING' | 'TRIGGERED' | 'CANCELLED';

export interface ProcessTimer {
  id: string; // PK
  request_id: string;
  bpmn_node_id: string;
  due_at: string; // ISO
  status: TimerStatus;
  created_at: string;
}

// 22. auth_accounts (Client-side)
export interface AuthAccount {
  user_id: string; // PK (trùng profiles.id)
  email: string;   // UNIQUE
  password_hash: string;
  salt: string;
  failed_attempts?: number;
  locked_until?: string;
  created_at: string;
}


// 23. integration_logs (Client-side / Bằng chứng tích hợp bên ngoài)
export type IntegrationType = 'EMAIL' | 'VIETQR' | 'WEBHOOK';
export type IntegrationStatus = 'SUCCESS' | 'ERROR' | 'RETRYING';

export interface IntegrationLog {
  id: string; // PK
  type: IntegrationType;
  endpoint: string;
  status: IntegrationStatus;
  attempt: number;
  duration_ms: number;
  request_id?: string;
  bpmn_node_id?: string;
  payload: Record<string, unknown> | string;
  response?: Record<string, unknown> | string;
  error_message?: string;
  created_at: string;
}

// 24. ai_logs (Nhật ký AI Agent OCR tại M_CheckDocs)
export interface AiLog {
  id?: number;
  request_id: string;
  bpmn_node_id: string;
  scenario_preset?: string;
  input_summary: string;
  output: Record<string, unknown>;
  confidence: number | null;
  routing_action: string;
  is_overridden: boolean;
  override_note?: string;
  created_at: string;
}
