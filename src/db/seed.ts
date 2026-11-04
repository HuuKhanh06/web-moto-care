// src/db/seed.ts
// Bộ dữ liệu mẫu (Seed Data) chuẩn bị sẵn sàng cho Demo đồ án

import { db } from './index';
import { clock } from '@/lib/clock';
import { hashPassword } from '@/features/auth/crypto';
import type {
  Profile,
  Vehicle,
  RentalRequest,
  Partner,
  AuthAccount,
  VehicleSchedule,
  Contract,
  Payment,
} from './types';

// Mật khẩu được băm chuẩn PBKDF2 bằng Web Crypto API qua hashPassword

export const SEED_USERS = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    email: 'quanly@motocare.vn',
    password: 'password123',
    full_name: 'Trần Văn Quản Lý',
    phone: '0901112233',
    role: 'quan_ly' as const,
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'nhanvien1@motocare.vn',
    password: 'password123',
    full_name: 'Lê Thị Nhân Viên 1',
    phone: '0902223344',
    role: 'nhan_vien' as const,
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    email: 'nhanvien2@motocare.vn',
    password: 'password123',
    full_name: 'Phạm Văn Kỹ Thuật',
    phone: '0903334455',
    role: 'nhan_vien' as const,
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    email: 'khachhang1@gmail.com',
    password: 'password123',
    full_name: 'Nguyễn Văn Khách 1',
    phone: '0981119999',
    role: 'khach_hang' as const,
  },
  {
    id: '55555555-5555-4555-8555-555555555555',
    email: 'khachhang2@gmail.com',
    password: 'password123',
    full_name: 'Hoàng Thị Khách 2',
    phone: '0982228888',
    role: 'khach_hang' as const,
  },
  {
    id: '66666666-6666-4666-8666-666666666666',
    email: 'khachhang3@gmail.com',
    password: 'password123',
    full_name: 'Đặng Tuấn Khách 3',
    phone: '0983337777',
    role: 'khach_hang' as const,
  },
];

export async function seedDatabase(): Promise<void> {
  await db.clearAllTables();

  const now = clock.now();
  const nowISO = clock.nowISO();

  // 1. Tạo Tài khoản và Hồ sơ (1 Quản lý, 2 Nhân viên, 3 Khách hàng)
  const profiles: Profile[] = [];
  const authAccounts: AuthAccount[] = [];

  for (const u of SEED_USERS) {
    const salt = 'salt_' + u.id.slice(0, 8);
    const { hash } = await hashPassword(u.password, salt);

    profiles.push({
      id: u.id,
      full_name: u.full_name,
      phone: u.phone,
      role: u.role,
    });

    authAccounts.push({
      user_id: u.id,
      email: u.email,
      password_hash: hash,
      salt: salt,
      created_at: nowISO,
    });
  }

  // 2. Tạo 12 xe thuộc 3 loại (xe số, tay ga, xe côn), 11 SAN_SANG, 1 BAO_TRI
  const vehicles: Vehicle[] = [
    // Xe số
    {
      id: 'a1111111-0000-0000-0000-000000000001',
      plate: '29-B1 112.34',
      model: 'Honda Wave Alpha 110',
      vehicle_type: 'xe_so',
      daily_price: 120000,
      status: 'SAN_SANG',
      condition_note: 'Xe mới bảo dưỡng xích và phanh',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000002',
      plate: '29-B1 556.78',
      model: 'Honda Blade 110',
      vehicle_type: 'xe_so',
      daily_price: 130000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000003',
      plate: '29-B1 889.01',
      model: 'Yamaha Sirius FI',
      vehicle_type: 'xe_so',
      daily_price: 130000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000004',
      plate: '29-B1 234.56',
      model: 'Honda Future 125',
      vehicle_type: 'xe_so',
      daily_price: 150000,
      status: 'SAN_SANG',
    },

    // Tay ga
    {
      id: 'b2222222-0000-0000-0000-000000000005',
      plate: '29-C1 334.55',
      model: 'Honda Vision 2023 Smartkey',
      vehicle_type: 'tay_ga',
      daily_price: 160000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000006',
      plate: '29-C1 778.99',
      model: 'Honda Lead 125 Cốp rộng',
      vehicle_type: 'tay_ga',
      daily_price: 180000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000007',
      plate: '29-C1 991.22',
      model: 'Honda Air Blade 125',
      vehicle_type: 'tay_ga',
      daily_price: 190000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000008',
      plate: '29-C1 445.66',
      model: 'Yamaha Grande Hybrid',
      vehicle_type: 'tay_ga',
      daily_price: 190000,
      status: 'SAN_SANG',
    },

    // Xe côn
    {
      id: 'c3333333-0000-0000-0000-000000000009',
      plate: '29-D1 119.88',
      model: 'Honda Winner X 150 ABS',
      vehicle_type: 'xe_con',
      daily_price: 220000,
      status: 'SAN_SANG',
    },
    {
      id: 'c3333333-0000-0000-0000-000000000010',
      plate: '29-D1 228.77',
      model: 'Yamaha Exciter 155 VVA',
      vehicle_type: 'xe_con',
      daily_price: 230000,
      status: 'SAN_SANG',
    },
    {
      id: 'c3333333-0000-0000-0000-000000000011',
      plate: '29-D1 337.66',
      model: 'Suzuki Raider R150',
      vehicle_type: 'xe_con',
      daily_price: 220000,
      status: 'SAN_SANG',
    },
    // 1 xe đang bảo trì
    {
      id: 'c3333333-0000-0000-0000-000000000012',
      plate: '29-D1 999.00',
      model: 'Honda CB150R Neo Cafe',
      vehicle_type: 'xe_con',
      daily_price: 250000,
      status: 'BAO_TRI',
      condition_note: 'Đang thay bộ nhông sên dĩa và lọc nhớt định kỳ',
    },
  ];

  // 3. Tạo 4 đối tác sửa chữa ở các vùng, 3 đối tác available=true
  const partners: Partner[] = [
    {
      id: 'p1111111-0000-0000-0000-000000000001',
      name: 'Trung Tâm Cứu Hộ & Sửa Chữa Hà Nội 247',
      region: 'Hà Nội',
      contact: '0912.333.444',
      available: true,
    },
    {
      id: 'p2222222-0000-0000-0000-000000000002',
      name: 'Garage Xe Máy Đà Nẵng MotoService',
      region: 'Đà Nẵng',
      contact: '0935.555.666',
      available: true,
    },
    {
      id: 'p3333333-0000-0000-0000-000000000003',
      name: 'Cứu Hộ Xe Máy Sài Gòn Express',
      region: 'TP. Hồ Chí Minh',
      contact: '0908.777.888',
      available: true,
    },
    {
      id: 'p4444444-0000-0000-0000-000000000004',
      name: 'Xưởng Bảo Trì Miền Tây Cần Thơ',
      region: 'Cần Thơ',
      contact: '0949.123.456',
      available: false, // Tạm ngưng nhận ca
    },
  ];

  // 4. Tạo 3 hồ sơ thuê mẫu ở các trạng thái khác nhau
  const startDay1 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
  const endDay1 = new Date(now.getTime() + 1 * 24 * 3600 * 1000).toISOString();

  const startDay2 = new Date(now.getTime() + 1 * 24 * 3600 * 1000).toISOString();
  const endDay2 = new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString();

  const startDay3 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const endDay3 = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString();

  const rentalRequests: RentalRequest[] = [
    // Hồ sơ 1: Đang thuê (DANG_THUE)
    {
      id: 'r1111111-0000-0000-0000-000000000001',
      customer_id: SEED_USERS[3].id, // Khách 1
      vehicle_id: vehicles[4].id,    // Honda Vision
      start_at: startDay1,
      end_at: endDay1,
      status: 'DANG_THUE',
      total_price: 480000,
      deposit_amount: 1000000,
      doc_request_count: 0,
    },
    // Hồ sơ 2: Chờ ký hợp đồng (CHO_KY)
    {
      id: 'r2222222-0000-0000-0000-000000000002',
      customer_id: SEED_USERS[4].id, // Khách 2
      vehicle_id: vehicles[8].id,    // Honda Winner X
      start_at: startDay2,
      end_at: endDay2,
      status: 'CHO_KY',
      total_price: 660000,
      deposit_amount: 1500000,
      doc_request_count: 0,
    },
    // Hồ sơ 3: Đã hoàn tất thuê & thanh lý (HOAN_TAT)
    {
      id: 'r3333333-0000-0000-0000-000000000003',
      customer_id: SEED_USERS[5].id, // Khách 3
      vehicle_id: vehicles[0].id,    // Honda Wave
      start_at: startDay3,
      end_at: endDay3,
      status: 'HOAN_TAT',
      total_price: 360000,
      deposit_amount: 1000000,
      doc_request_count: 0,
      returned_at: endDay3,
      closed_at: endDay3,
    },
  ];

  // Lịch xe tương ứng với hồ sơ 1 (đang thuê)
  const schedules: VehicleSchedule[] = [
    {
      id: 's1111111-0000-0000-0000-000000000001',
      vehicle_id: vehicles[4].id,
      request_id: rentalRequests[0].id,
      kind: 'RENTAL',
      start_at: startDay1,
      end_at: endDay1,
    },
  ];

  // Hợp đồng cho hồ sơ 2 (đang chờ ký)
  const contracts: Contract[] = [
    {
      id: 'ct111111-0000-0000-0000-000000000002',
      request_id: rentalRequests[1].id,
      status: 'SENT',
      sent_at: nowISO,
      expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    },
  ];

  // Bản ghi thanh toán cọc cho hồ sơ 1
  const payments: Payment[] = [
    {
      id: 'pay11111-0000-0000-0000-000000000001',
      request_id: rentalRequests[0].id,
      kind: 'DEPOSIT',
      amount: 1000000,
      paid_amount: 1000000,
      qr_ref: 'MC_DEP_R1',
      status: 'VERIFIED',
      provider_txn_id: 'VNPAY_99881122',
      paid_at: startDay1,
      verified_at: startDay1,
      match_result: 'DU',
    },
  ];

  // Ghi đồng loạt vào Dexie
  await db.transaction('rw', db.tables, async () => {
    await db.profiles.bulkAdd(profiles);
    await db.auth_accounts.bulkAdd(authAccounts);
    await db.vehicles.bulkAdd(vehicles);
    await db.partners.bulkAdd(partners);
    await db.rental_requests.bulkAdd(rentalRequests);
    await db.vehicle_schedule.bulkAdd(schedules);
    await db.contracts.bulkAdd(contracts);
    await db.payments.bulkAdd(payments);
  });
}
