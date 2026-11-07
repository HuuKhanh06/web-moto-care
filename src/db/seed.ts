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
  ProcessState,
  Statement,
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

  // 2. Tạo 30 xe thuộc 3 loại (10 xe số, 12 tay ga, 8 xe côn), 28 SAN_SANG, 2 BAO_TRI
  const vehicles: Vehicle[] = [
    // Xe số (10 xe)
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

    // Tay ga (12 xe)
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

    // Xe côn (8 xe)
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

    // Bổ sung đội xe: Xe số 13 -> 18
    {
      id: 'a1111111-0000-0000-0000-000000000013',
      plate: '29-B1 345.67',
      model: 'Honda Wave Alpha 110 Đỏ Đen',
      vehicle_type: 'xe_so',
      daily_price: 120000,
      status: 'SAN_SANG',
      condition_note: 'Bảo dưỡng định kỳ, xích và phanh chuẩn',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000014',
      plate: '29-B1 678.90',
      model: 'Honda Blade 110 Thể Thao',
      vehicle_type: 'xe_so',
      daily_price: 130000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000015',
      plate: '29-B1 456.78',
      model: 'Yamaha Sirius FI Tiết Kiệm Xăng',
      vehicle_type: 'xe_so',
      daily_price: 130000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000016',
      plate: '29-B1 789.12',
      model: 'Honda Future 125 Cao Cấp',
      vehicle_type: 'xe_so',
      daily_price: 150000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000017',
      plate: '29-B1 890.23',
      model: 'Honda Wave Alpha 110 Xanh Đậm',
      vehicle_type: 'xe_so',
      daily_price: 120000,
      status: 'SAN_SANG',
    },
    {
      id: 'a1111111-0000-0000-0000-000000000018',
      plate: '29-B1 901.34',
      model: 'Honda Blade 110 Vành Đúc',
      vehicle_type: 'xe_so',
      daily_price: 135000,
      status: 'SAN_SANG',
    },

    // Bổ sung đội xe: Xe tay ga 19 -> 26
    {
      id: 'b2222222-0000-0000-0000-000000000019',
      plate: '29-C1 556.77',
      model: 'Honda Vision 2023 Trắng Ngọc Trai',
      vehicle_type: 'tay_ga',
      daily_price: 160000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000020',
      plate: '29-C1 667.88',
      model: 'Honda Vision 2023 Đen Nhám',
      vehicle_type: 'tay_ga',
      daily_price: 165000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000021',
      plate: '29-C1 778.01',
      model: 'Honda Lead 125 Bạc Ánh Kim',
      vehicle_type: 'tay_ga',
      daily_price: 180000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000022',
      plate: '29-C1 889.12',
      model: 'Honda Air Blade 160 Phanh ABS',
      vehicle_type: 'tay_ga',
      daily_price: 210000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000023',
      plate: '29-C1 990.23',
      model: 'Honda Air Blade 125 Đỏ Đen',
      vehicle_type: 'tay_ga',
      daily_price: 190000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000024',
      plate: '29-C1 112.45',
      model: 'Yamaha Grande Hybrid Xanh Pastel',
      vehicle_type: 'tay_ga',
      daily_price: 195000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000025',
      plate: '29-C1 223.56',
      model: 'Honda Vision 2023 Xám Xi Măng',
      vehicle_type: 'tay_ga',
      daily_price: 170000,
      status: 'SAN_SANG',
    },
    {
      id: 'b2222222-0000-0000-0000-000000000026',
      plate: '29-C1 334.67',
      model: 'Honda Lead 125 Đỏ Đô',
      vehicle_type: 'tay_ga',
      daily_price: 180000,
      status: 'BAO_TRI',
      condition_note: 'Đang bảo dưỡng định kỳ hệ thống phanh và thay dầu',
    },

    // Bổ sung đội xe: Xe côn 27 -> 30
    {
      id: 'c3333333-0000-0000-0000-000000000027',
      plate: '29-D1 448.88',
      model: 'Honda Winner X 150 Thể Thao',
      vehicle_type: 'xe_con',
      daily_price: 220000,
      status: 'SAN_SANG',
    },
    {
      id: 'c3333333-0000-0000-0000-000000000028',
      plate: '29-D1 559.99',
      model: 'Yamaha Exciter 155 VVA GP',
      vehicle_type: 'xe_con',
      daily_price: 230000,
      status: 'SAN_SANG',
    },
    {
      id: 'c3333333-0000-0000-0000-000000000029',
      plate: '29-D1 660.11',
      model: 'Honda Winner X 150 Đường Đua',
      vehicle_type: 'xe_con',
      daily_price: 225000,
      status: 'SAN_SANG',
    },
    {
      id: 'c3333333-0000-0000-0000-000000000030',
      plate: '29-D1 771.22',
      model: 'Yamaha Exciter 155 Monster Energy',
      vehicle_type: 'xe_con',
      daily_price: 235000,
      status: 'SAN_SANG',
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

  // 4. Tạo các hồ sơ thuê mẫu ở các giai đoạn BPMN nghiệp vụ
  const startDay1 = new Date(now.getTime() - 2 * 24 * 3600 * 1000).toISOString();
  const endDay1 = new Date(now.getTime() + 1 * 24 * 3600 * 1000).toISOString();

  const startDay2 = new Date(now.getTime() + 1 * 24 * 3600 * 1000).toISOString();
  const endDay2 = new Date(now.getTime() + 4 * 24 * 3600 * 1000).toISOString();

  const startDay3 = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
  const endDay3 = new Date(now.getTime() - 4 * 24 * 3600 * 1000).toISOString();

  const startDay4 = new Date(now.getTime() + 2 * 3600 * 1000).toISOString();
  const endDay4 = new Date(now.getTime() + 3 * 24 * 3600 * 1000).toISOString();

  const startDay5 = new Date(now.getTime() - 3 * 24 * 3600 * 1000).toISOString();
  const endDay5 = new Date(now.getTime() - 1 * 3600 * 1000).toISOString();

  const startDay6 = new Date(now.getTime() - 10 * 24 * 3600 * 1000).toISOString();
  const endDay6 = new Date(now.getTime() - 8 * 24 * 3600 * 1000).toISOString();

  const rentalRequests: RentalRequest[] = [
    // Hồ sơ 1: Đang thuê (DANG_THUE) -> Cổng M_EG
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
    // Hồ sơ 2: Chờ ký hợp đồng (CHO_KY) -> M_WaitSign
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
      vehicle_id: vehicles[0].id,    // Honda Wave Alpha
      start_at: startDay3,
      end_at: endDay3,
      status: 'HOAN_TAT',
      total_price: 360000,
      deposit_amount: 1000000,
      doc_request_count: 0,
      returned_at: endDay3,
      closed_at: endDay3,
    },
    // Hồ sơ 4: Chờ nhân viên kiểm tra kỹ thuật tiền bàn giao (CHO_BAN_GIAO -> M_InspectPre)
    {
      id: 'r4444444-0000-0000-0000-000000000004',
      customer_id: SEED_USERS[3].id, // Khách 1
      vehicle_id: vehicles[1].id,    // Honda Blade
      start_at: startDay4,
      end_at: endDay4,
      status: 'CHO_BAN_GIAO',
      total_price: 390000,
      deposit_amount: 1000000,
      doc_request_count: 0,
    },
    // Hồ sơ 5: Khách khiếu nại bảng kê -> Quản lý phân giải hòa giải (CHO_KHACH_XAC_NHAN_BANG_KE -> M_Resolve)
    {
      id: 'r5555555-0000-0000-0000-000000000005',
      customer_id: SEED_USERS[4].id, // Khách 2
      vehicle_id: vehicles[7].id,    // Yamaha Grande
      start_at: startDay5,
      end_at: endDay5,
      status: 'CHO_KHACH_XAC_NHAN_BANG_KE',
      total_price: 570000,
      deposit_amount: 1000000,
      doc_request_count: 0,
      returned_at: endDay5,
    },
    // Hồ sơ 6: Hồ sơ công nợ tồn đọng (CONG_NO -> M_END_DEBT)
    {
      id: 'r6666666-0000-0000-0000-000000000006',
      customer_id: SEED_USERS[5].id, // Khách 3
      vehicle_id: vehicles[3].id,    // Honda Future
      start_at: startDay6,
      end_at: endDay6,
      status: 'CONG_NO',
      total_price: 300000,
      deposit_amount: 0,
      doc_request_count: 0,
      returned_at: endDay6,
      closed_at: endDay6,
    },
  ];

  // Lịch xe
  const schedules: VehicleSchedule[] = [
    {
      id: 's1111111-0000-0000-0000-000000000001',
      vehicle_id: vehicles[4].id,
      request_id: rentalRequests[0].id,
      kind: 'RENTAL',
      start_at: startDay1,
      end_at: endDay1,
    },
    {
      id: 's4444444-0000-0000-0000-000000000004',
      vehicle_id: vehicles[1].id,
      request_id: rentalRequests[3].id,
      kind: 'RENTAL',
      start_at: startDay4,
      end_at: endDay4,
    },
  ];

  // Hợp đồng
  const contracts: Contract[] = [
    {
      id: 'ct111111-0000-0000-0000-000000000001',
      request_id: rentalRequests[0].id,
      status: 'SIGNED',
      sent_at: startDay1,
      signed_at: startDay1,
      expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'ct222222-0000-0000-0000-000000000002',
      request_id: rentalRequests[1].id,
      status: 'SENT',
      sent_at: nowISO,
      expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    },
    {
      id: 'ct444444-0000-0000-0000-000000000004',
      request_id: rentalRequests[3].id,
      status: 'SIGNED',
      sent_at: startDay4,
      signed_at: startDay4,
      expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    },
  ];

  // Bản ghi thanh toán cọc
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
    {
      id: 'pay22222-0000-0000-0000-000000000002',
      request_id: rentalRequests[1].id,
      kind: 'DEPOSIT',
      amount: 1500000,
      paid_amount: 1500000,
      qr_ref: 'MC_DEP_R2',
      status: 'VERIFIED',
      provider_txn_id: 'VNPAY_99882233',
      paid_at: startDay2,
      verified_at: startDay2,
      match_result: 'DU',
    },
    {
      id: 'pay44444-0000-0000-0000-000000000004',
      request_id: rentalRequests[3].id,
      kind: 'DEPOSIT',
      amount: 1000000,
      paid_amount: 1000000,
      qr_ref: 'MC_DEP_R4',
      status: 'VERIFIED',
      provider_txn_id: 'VNPAY_99884455',
      paid_at: startDay4,
      verified_at: startDay4,
      match_result: 'DU',
    },
  ];

  // Bảng kê thanh lý (cho hồ sơ 5 đang có khiếu nại)
  const statements: Statement[] = [
    {
      id: 'st555555-0000-0000-0000-000000000005',
      request_id: rentalRequests[4].id,
      version: 1,
      items: [
        { name: 'Tiền thuê xe thực tế (3 ngày)', amount: 570000 },
        { name: 'Phụ phí xử lý trầy xước dàn áo bên trái', amount: 350000, note: 'Trầy xước sâu 15cm yếm trước' },
      ],
      total_fee: 920000,
      status: 'DISPUTED',
      customer_answer: 'KHIEU_NAI',
      dispute_reason: 'Tôi không đồng ý phụ phí 350.000đ vì vết xước nhỏ này đã có sẵn khi nhận xe từ nhân viên.',
      sent_at: endDay5,
      answered_at: endDay5,
    },
  ];

  // Đồng bộ hóa trạng thái quy trình BPMN ProcessState cho từng hồ sơ
  const processStates: ProcessState[] = [
    // Hồ sơ 1: Đang thuê -> Sẵn sàng bấm sự kiện M_EG (Gia hạn, Cứu hộ, Trả xe)
    {
      request_id: rentalRequests[0].id,
      waiting_node_ids: ['M_EG'],
      loop_counters: {},
      variables: { preferred_vehicle_type: 'tay_ga' },
      updated_at: nowISO,
    },
    // Hồ sơ 2: Chờ ký -> Điểm chờ M_WaitSign (KH-04)
    {
      request_id: rentalRequests[1].id,
      waiting_node_ids: ['M_WaitSign'],
      loop_counters: {},
      variables: { preferred_vehicle_type: 'xe_con' },
      updated_at: nowISO,
    },
    // Hồ sơ 3: Hoàn tất
    {
      request_id: rentalRequests[2].id,
      waiting_node_ids: [],
      loop_counters: {},
      variables: { preferred_vehicle_type: 'xe_so' },
      updated_at: nowISO,
    },
    // Hồ sơ 4: Chờ nhân viên kiểm tra bàn giao xe NV-03 (M_InspectPre)
    {
      request_id: rentalRequests[3].id,
      waiting_node_ids: ['M_InspectPre'],
      loop_counters: {},
      variables: { preferred_vehicle_type: 'xe_so' },
      updated_at: nowISO,
    },
    // Hồ sơ 5: Khách khiếu nại -> Điểm chờ Quản lý giải quyết tranh chấp QL-01 (M_Resolve)
    {
      request_id: rentalRequests[4].id,
      waiting_node_ids: ['M_Resolve'],
      loop_counters: { dispute_count: 1 },
      variables: { preferred_vehicle_type: 'tay_ga' },
      updated_at: nowISO,
    },
    // Hồ sơ 6: Hồ sơ công nợ
    {
      request_id: rentalRequests[5].id,
      waiting_node_ids: [],
      loop_counters: {},
      variables: { preferred_vehicle_type: 'xe_so' },
      updated_at: nowISO,
    },
  ];

  // Ghi đồng loạt vào Dexie (dùng bulkPut để an toàn nếu cập nhật/nạp thêm dữ liệu mà không bị lỗi trùng khóa)
  await db.transaction('rw', db.tables, async () => {
    await db.profiles.bulkPut(profiles);
    await db.auth_accounts.bulkPut(authAccounts);
    await db.vehicles.bulkPut(vehicles);
    await db.partners.bulkPut(partners);
    await db.rental_requests.bulkPut(rentalRequests);
    await db.vehicle_schedule.bulkPut(schedules);
    await db.contracts.bulkPut(contracts);
    await db.payments.bulkPut(payments);
    await db.statements.bulkPut(statements);
    await db.process_state.bulkPut(processStates);
  });
}
