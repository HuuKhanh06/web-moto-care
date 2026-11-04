// src/db/schema.ts
// Zod schemas dùng để xác thực dữ liệu vào và import/export backup

import { z } from 'zod';

// Roles & Actors
export const UserRoleSchema = z.enum(['khach_hang', 'nhan_vien', 'quan_ly']);
export const ActorRoleSchema = z.enum(['khach_hang', 'nhan_vien', 'quan_ly', 'system']);

export const ActorSchema = z.object({
  id: z.string(),
  role: ActorRoleSchema,
});

// 1. profiles
export const ProfileSchema = z.object({
  id: z.string(),
  full_name: z.string().min(1),
  phone: z.string().optional(),
  role: UserRoleSchema,
});

// 2. vehicles
export const VehicleStatusSchema = z.enum(['SAN_SANG', 'DANG_THUE', 'BAO_TRI']);

export const VehicleSchema = z.object({
  id: z.string(),
  plate: z.string().min(1),
  model: z.string(),
  vehicle_type: z.string(),
  daily_price: z.number().nonnegative(),
  status: VehicleStatusSchema,
  condition_note: z.string().optional(),
});

// 3. rental_requests (17 trạng thái quy chuẩn)
export const RentalRequestStatusSchema = z.enum([
  'MOI',
  'CHO_HO_SO',
  'CHO_COC',
  'CHO_KY',
  'CHO_BAN_GIAO',
  'CHO_KHACH_NHAN',
  'DANG_THUE',
  'DANG_GIA_HAN',
  'DANG_XU_LY_SU_CO',
  'CHO_NHAN_XE_TRA',
  'CHO_KHACH_XAC_NHAN_BANG_KE',
  'CHO_THU_THEM',
  'CONG_NO',
  'CHO_DANH_GIA_XE',
  'HOAN_TAT',
  'DA_HUY',
  'TU_CHOI',
]);

export const RentalRequestSchema = z.object({
  id: z.string(),
  customer_id: z.string(),
  vehicle_id: z.string().optional(),
  start_at: z.string(),
  end_at: z.string(),
  status: RentalRequestStatusSchema,
  total_price: z.number().nonnegative().optional(),
  deposit_amount: z.number().nonnegative().optional(),
  doc_request_count: z.number().int().nonnegative().default(0),
  closed_reason: z.string().optional(),
  returned_at: z.string().optional(),
  closed_at: z.string().optional(),
  archived_at: z.string().optional(),
});

// 4. customer_documents
export const DocumentTypeSchema = z.enum(['CCCD_TRUOC', 'CCCD_SAU', 'BANG_LAI_TRUOC', 'BANG_LAI_SAU', 'OTHER']);

export const CustomerDocumentSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  doc_type: DocumentTypeSchema,
  file_url: z.string(),
  is_valid: z.boolean().optional(),
  check_note: z.string().optional(),
});

// 5. payments
export const PaymentKindSchema = z.enum(['DEPOSIT', 'EXTENSION', 'EXTRA', 'REFUND']);
export const PaymentStatusSchema = z.enum(['PENDING', 'VERIFIED', 'EXPIRED', 'FAILED']);
export const PaymentMatchResultSchema = z.enum(['DU', 'THIEU', 'SAI']);

export const PaymentSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  kind: PaymentKindSchema,
  amount: z.number(),
  paid_amount: z.number().optional(),
  qr_ref: z.string(),
  status: PaymentStatusSchema,
  expires_at: z.string().optional(),
  provider_txn_id: z.string().optional(),
  paid_at: z.string().optional(),
  verified_at: z.string().optional(),
  match_result: PaymentMatchResultSchema.optional(),
  manual_verified_by: z.string().optional(),
  manual_note: z.string().optional(),
});

// 6. contracts
export const ContractStatusSchema = z.enum(['SENT', 'SIGNED', 'EXPIRED']);

export const ContractSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  file_url: z.string().optional(),
  status: ContractStatusSchema,
  sent_at: z.string().optional(),
  expires_at: z.string().optional(),
  signed_at: z.string().optional(),
});

// 7. vehicle_schedule
export const ScheduleKindSchema = z.enum(['RENTAL', 'MAINTENANCE']);

export const VehicleScheduleSchema = z.object({
  id: z.string(),
  vehicle_id: z.string(),
  request_id: z.string().optional(),
  kind: ScheduleKindSchema,
  start_at: z.string(),
  end_at: z.string(),
});

// 8. inspections
export const InspectionKindSchema = z.enum(['PRE_HANDOVER', 'RETURN', 'POST_RETURN']);
export const InspectionResultSchema = z.enum(['DAT', 'CHUA_DAT', 'CAN_BAO_TRI']);

export const InspectionSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  vehicle_id: z.string(),
  kind: InspectionKindSchema,
  attempt_no: z.number().int().positive(),
  inspector_id: z.string().optional(),
  checklist: z.record(z.unknown()).optional(),
  result: InspectionResultSchema.optional(),
  photo_urls: z.array(z.string()).optional(),
  diff_items: z.record(z.unknown()).optional(),
  rework_note: z.string().optional(),
});

// 9. handovers
export const HandoverSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  attempt_no: z.number().int().positive(),
  accessories: z.record(z.unknown()).optional(),
  staff_id: z.string().optional(),
  customer_accepted: z.boolean().optional(),
  customer_note: z.string().optional(),
  handed_over_at: z.string().optional(),
});

// 10. damage_findings
export const DamageFindingSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  inspection_id: z.string(),
  description: z.string(),
  evidence_urls: z.array(z.string()).optional(),
  estimated_cost: z.number().nonnegative(),
  verified_by: z.string().optional(),
  verified_at: z.string().optional(),
});

// 11. statements
export const StatementStatusSchema = z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'DISPUTED']);
export const StatementCustomerAnswerSchema = z.enum(['CHAP_THUAN', 'KHIEU_NAI']);

export const StatementItemSchema = z.object({
  name: z.string(),
  amount: z.number(),
  note: z.string().optional(),
});

export const StatementSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  version: z.number().int().positive().default(1),
  items: z.array(StatementItemSchema),
  total_fee: z.number(),
  status: StatementStatusSchema,
  customer_answer: StatementCustomerAnswerSchema.optional(),
  dispute_reason: z.string().optional(),
  resolution_note: z.string().optional(),
  resolved_by: z.string().optional(),
  sent_at: z.string().optional(),
  answered_at: z.string().optional(),
});

// 12. settlements
export const SettlementKindSchema = z.enum(['HOAN_DU', 'CAN_BANG', 'THU_THEM']);
export const SettlementStatusSchema = z.enum(['CHO', 'HOAN_TAT', 'CONG_NO']);

export const SettlementSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  deposit_paid: z.number(),
  total_fee: z.number(),
  balance: z.number(),
  kind: SettlementKindSchema,
  status: SettlementStatusSchema,
  settled_at: z.string().optional(),
});

// 13. extension_requests
export const ExtensionRequestStatusSchema = z.enum(['YEU_CAU', 'DA_DE_XUAT', 'DA_AP_DUNG', 'TU_CHOI', 'HET_HAN']);
export const ExtensionCustomerAnswerSchema = z.enum(['DONG_Y', 'TU_CHOI']);

export const ExtensionRequestSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  new_end_at: z.string(),
  eligible: z.boolean().optional(),
  reject_reason: z.string().optional(),
  extra_fee: z.number().optional(),
  status: ExtensionRequestStatusSchema,
  customer_answer: ExtensionCustomerAnswerSchema.optional(),
  offer_expires_at: z.string().optional(),
});

// 14. partners
export const PartnerSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  region: z.string(),
  contact: z.string(),
  available: z.boolean(),
});

// 15. incidents
export const IncidentStatusSchema = z.enum(['MOI', 'DANG_HO_TRO', 'VUOT_SLA', 'DONG_TIEP_TUC', 'DONG_TRA_SOM']);

export const IncidentSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  reported_by: z.string(),
  incident_code: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  photo_urls: z.array(z.string()).optional(),
  description: z.string(),
  status: IncidentStatusSchema,
  attempt_no: z.number().int().positive(),
  partner_id: z.string().optional(),
  escalation_note: z.string().optional(),
  actual_cost: z.number().optional(),
  continue_rental: z.boolean().optional(),
  confirmed_by: z.string().optional(),
  created_at: z.string(),
  closed_at: z.string().optional(),
});

// 16. incident_dispatches
export const IncidentDispatchStatusSchema = z.enum(['SENT', 'ACCEPTED', 'DECLINED', 'TIMEOUT']);

export const IncidentDispatchSchema = z.object({
  id: z.string(),
  incident_id: z.string(),
  partner_id: z.string(),
  attempt_no: z.number().int().positive(),
  status: IncidentDispatchStatusSchema,
  sent_at: z.string(),
  ack_at: z.string().optional(),
  result_at: z.string().optional(),
  result: z.string().optional(),
});

// 17. maintenance_orders
export const MaintenanceOrderStatusSchema = z.enum(['MO', 'XONG']);

export const MaintenanceOrderSchema = z.object({
  id: z.string(),
  vehicle_id: z.string(),
  request_id: z.string().optional(),
  reason: z.string(),
  status: MaintenanceOrderStatusSchema,
  created_at: z.string(),
});

// 18. notifications
export const NotificationSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  request_id: z.string().optional(),
  template: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  created_at: z.string(),
});

// 19. process_events
export const ProcessEventSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  bpmn_node_id: z.string(),
  event_type: z.string(),
  actor_id: z.string().optional(),
  payload: z.record(z.unknown()).optional(),
  created_at: z.string(),
});

// ==============================================================
// 3 BẢNG PHỤ CLIENT-SIDE
// ==============================================================

// 20. process_state
export const ProcessStateSchema = z.object({
  request_id: z.string(),
  waiting_node_ids: z.array(z.string()),
  loop_counters: z.record(z.number()),
  variables: z.record(z.unknown()),
  updated_at: z.string(),
});

// 21. timers
export const TimerStatusSchema = z.enum(['PENDING', 'TRIGGERED', 'CANCELLED']);

export const ProcessTimerSchema = z.object({
  id: z.string(),
  request_id: z.string(),
  bpmn_node_id: z.string(),
  due_at: z.string(),
  status: TimerStatusSchema,
  created_at: z.string(),
});

// 22. auth_accounts
export const AuthAccountSchema = z.object({
  user_id: z.string(),
  email: z.string().email(),
  password_hash: z.string(),
  salt: z.string(),
  created_at: z.string(),
});

// Cấu trúc kiểm tra khi Import Database JSON
export const DatabaseBackupSchema = z.object({
  version: z.number(),
  exported_at: z.string(),
  data: z.object({
    profiles: z.array(ProfileSchema).default([]),
    vehicles: z.array(VehicleSchema).default([]),
    rental_requests: z.array(RentalRequestSchema).default([]),
    customer_documents: z.array(CustomerDocumentSchema).default([]),
    payments: z.array(PaymentSchema).default([]),
    contracts: z.array(ContractSchema).default([]),
    vehicle_schedule: z.array(VehicleScheduleSchema).default([]),
    inspections: z.array(InspectionSchema).default([]),
    handovers: z.array(HandoverSchema).default([]),
    damage_findings: z.array(DamageFindingSchema).default([]),
    statements: z.array(StatementSchema).default([]),
    settlements: z.array(SettlementSchema).default([]),
    extension_requests: z.array(ExtensionRequestSchema).default([]),
    partners: z.array(PartnerSchema).default([]),
    incidents: z.array(IncidentSchema).default([]),
    incident_dispatches: z.array(IncidentDispatchSchema).default([]),
    maintenance_orders: z.array(MaintenanceOrderSchema).default([]),
    notifications: z.array(NotificationSchema).default([]),
    process_events: z.array(ProcessEventSchema).default([]),
    process_state: z.array(ProcessStateSchema).default([]),
    timers: z.array(ProcessTimerSchema).default([]),
    auth_accounts: z.array(AuthAccountSchema).default([]),
  }),
});

export type DatabaseBackup = z.infer<typeof DatabaseBackupSchema>;
