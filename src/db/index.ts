// src/db/index.ts
// Cơ sở dữ liệu Dexie IndexedDB cho MOTO CARE (Frontend-Only Database)

import Dexie, { type Table } from 'dexie';
import type {
  Profile,
  Vehicle,
  RentalRequest,
  CustomerDocument,
  Payment,
  Contract,
  VehicleSchedule,
  Inspection,
  Handover,
  DamageFinding,
  Statement,
  Settlement,
  ExtensionRequest,
  Partner,
  Incident,
  IncidentDispatch,
  MaintenanceOrder,
  Notification,
  ProcessEvent,
  ProcessState,
  ProcessTimer,
  AuthAccount,
  IntegrationLog,
  AiLog,
} from './types';

export class MotoCareDatabase extends Dexie {
  // 19 bảng quy chuẩn từ docs/data-model.csv
  profiles!: Table<Profile, string>;
  vehicles!: Table<Vehicle, string>;
  rental_requests!: Table<RentalRequest, string>;
  customer_documents!: Table<CustomerDocument, string>;
  payments!: Table<Payment, string>;
  contracts!: Table<Contract, string>;
  vehicle_schedule!: Table<VehicleSchedule, string>;
  inspections!: Table<Inspection, string>;
  handovers!: Table<Handover, string>;
  damage_findings!: Table<DamageFinding, string>;
  statements!: Table<Statement, string>;
  settlements!: Table<Settlement, string>;
  extension_requests!: Table<ExtensionRequest, string>;
  partners!: Table<Partner, string>;
  incidents!: Table<Incident, string>;
  incident_dispatches!: Table<IncidentDispatch, string>;
  maintenance_orders!: Table<MaintenanceOrder, string>;
  notifications!: Table<Notification, string>;
  process_events!: Table<ProcessEvent, string>;

  // 4 bảng phụ Client-side (Engine, Timers, Auth, Integration Logs)
  process_state!: Table<ProcessState, string>;
  timers!: Table<ProcessTimer, string>;
  auth_accounts!: Table<AuthAccount, string>;
  integration_logs!: Table<IntegrationLog, string>;
  ai_logs!: Table<AiLog, number>;

  constructor(name = 'MotoCareDB') {
    super(name);

    this.version(1).stores({
      // 19 bảng gốc
      profiles: '&id, role, full_name, phone',
      vehicles: '&id, &plate, status, vehicle_type, daily_price',
      rental_requests: '&id, customer_id, vehicle_id, status, start_at, end_at, [customer_id+status]',
      customer_documents: '&id, request_id, doc_type',
      payments: '&id, request_id, &qr_ref, status, kind, &provider_txn_id',
      contracts: '&id, &request_id, status',
      vehicle_schedule: '&id, vehicle_id, request_id, kind, [vehicle_id+start_at]',
      inspections: '&id, request_id, vehicle_id, kind, attempt_no, [request_id+kind+attempt_no]',
      handovers: '&id, request_id, attempt_no, [request_id+attempt_no]',
      damage_findings: '&id, request_id, inspection_id',
      statements: '&id, request_id, version, status',
      settlements: '&id, &request_id, status',
      extension_requests: '&id, request_id, status',
      partners: '&id, region, available',
      incidents: '&id, request_id, &incident_code, status, reported_by',
      incident_dispatches: '&id, incident_id, partner_id, attempt_no, status',
      maintenance_orders: '&id, vehicle_id, request_id, status',
      notifications: '&id, user_id, request_id, is_read, created_at',
      process_events: '&id, request_id, bpmn_node_id, event_type, created_at',

      // 4 bảng phụ client-side
      process_state: '&request_id, updated_at',
      timers: '&id, request_id, bpmn_node_id, due_at, status',
      auth_accounts: '&user_id, &email',
      integration_logs: '&id, type, status, endpoint, request_id, created_at, [type+status]',
      ai_logs: '++id, request_id, bpmn_node_id, routing_action, created_at',
    });

    // Reset legacy browser data once. Suppress cloud hooks: clearing a cache must never delete cloud rows.
    this.version(2).stores({}).upgrade(async transaction => {
      (transaction as unknown as Record<string, unknown>).__motocareRemote = true;
      for (const table of transaction.db.tables) {
        if (table.name !== 'vehicles' && table.name !== 'partners') await transaction.table(table.name).clear();
      }
    });
  }

  /**
   * Xóa toàn bộ dữ liệu trong tất cả các bảng
   */
  async clearAllTables(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      for (const table of this.tables) {
        await table.clear();
      }
    });
  }
}

export const db = new MotoCareDatabase();
