// tests/unit/auth_router.test.tsx
// Kiểm thử Giai đoạn 3: Xác thực Web Crypto, Route Guard theo vai trò và Phân quyền

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '@/features/auth/crypto';
import { useAuthStore } from '@/features/auth/authStore';
import { ProtectedRoute } from '@/app/ProtectedRoute';

describe('GIAI ĐOẠN 3: Xác thực Web Crypto & Phân quyền Route Guard', () => {
  beforeEach(async () => {
    await db.clearAllTables();
    clock.reset();
    useAuthStore.getState().logout();
  });

  describe('1. Cơ chế băm mật khẩu Web Crypto (PBKDF2)', () => {
    it('Băm mật khẩu tạo ra chuỗi hash và salt ngẫu nhiên, không lưu mật khẩu thô', async () => {
      const rawPassword = 'SecurePassword123';
      const { hash, salt } = await hashPassword(rawPassword);

      expect(hash).toBeDefined();
      expect(salt).toBeDefined();
      expect(hash).not.toContain(rawPassword);
      expect(salt).toHaveLength(32); // 16 bytes hex

      // Đối soát đúng mật khẩu
      const isValid = await verifyPassword(rawPassword, hash, salt);
      expect(isValid).toBe(true);

      // Đối soát sai mật khẩu
      const isInvalid = await verifyPassword('WrongPassword', hash, salt);
      expect(isInvalid).toBe(false);
    });

    it('Kiểm tra độ mạnh mật khẩu tối thiểu 6 ký tự', () => {
      expect(validatePasswordStrength('12345').isValid).toBe(false);
      expect(validatePasswordStrength('123456').isValid).toBe(false);
      expect(validatePasswordStrength('abc123').isValid).toBe(true);
      expect(validatePasswordStrength('Password123!').strength).toBe('MANH');
    });
  });

  describe('2. Khóa tài khoản tạm thời khi nhập sai 5 lần liên tiếp', () => {
    it('Nhập sai 5 lần liên tiếp sẽ kích hoạt locked_until trong 1 phút', async () => {
      const userId = crypto.randomUUID();
      const { hash, salt } = await hashPassword('CorrectPassword123');

      await db.profiles.add({
        id: userId,
        full_name: 'Nguyễn Văn Test',
        role: 'khach_hang',
      });

      await db.auth_accounts.add({
        user_id: userId,
        email: 'test@motocare.vn',
        password_hash: hash,
        salt,
        created_at: clock.nowISO(),
      });

      // Nhập sai 4 lần đầu
      for (let i = 1; i <= 4; i++) {
        const res = await useAuthStore.getState().login('test@motocare.vn', 'WrongPass');
        expect(res.success).toBe(false);
        expect(res.error).toContain(`Bạn còn ${5 - i} lần thử`);
      }

      // Lần thứ 5 nhập sai -> Khóa 1 phút
      const fifthRes = await useAuthStore.getState().login('test@motocare.vn', 'WrongPass');
      expect(fifthRes.success).toBe(false);
      expect(fifthRes.error).toContain('tạm khóa đăng nhập trong 1 phút');

      // Kiểm tra trong database có locked_until
      const account = await db.auth_accounts.get(userId);
      expect(account?.locked_until).toBeDefined();

      // Dù nhập đúng mật khẩu ngay sau đó vẫn bị chặn do đang bị khóa
      const blockedRes = await useAuthStore.getState().login('test@motocare.vn', 'CorrectPassword123');
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.error).toContain('Tài khoản đang bị tạm khóa');

      // Tua nhanh đồng hồ 61 giây
      clock.advance(1.05); // > 1 phút

      // Sau khi hết hạn khóa, nhập đúng mật khẩu sẽ đăng nhập thành công
      const successRes = await useAuthStore.getState().login('test@motocare.vn', 'CorrectPassword123');
      expect(successRes.success).toBe(true);
      expect(useAuthStore.getState().isAuthenticated).toBe(true);
      expect(useAuthStore.getState().currentActor?.role).toBe('khach_hang');
    });
  });

  describe('3. Đăng ký tài khoản chỉ tạo Khách hàng (khach_hang)', () => {
    it('Người dùng đăng ký chỉ được gán vai trò khach_hang, mật khẩu lưu dưới dạng băm', async () => {
      const regRes = await useAuthStore.getState().register({
        email: 'customer.new@gmail.com',
        password: 'Password999',
        full_name: 'Khách Mới Đăng Ký',
        phone: '0909999888',
      });

      expect(regRes.success).toBe(true);

      const account = await db.auth_accounts.where('email').equalsIgnoreCase('customer.new@gmail.com').first();
      expect(account).toBeDefined();
      expect(account?.password_hash).not.toBe('Password999');

      const profile = await db.profiles.get(account!.user_id);
      expect(profile?.role).toBe('khach_hang');
    });
  });

  describe('4. Route Guard: Kiểm soát truy cập nghiêm ngặt theo vai trò', () => {
    it('Chưa đăng nhập truy cập trang bảo vệ bị điều hướng về /login', async () => {
      render(
        <MemoryRouter initialEntries={['/nv/01']}>
          <Routes>
            <Route path="/login" element={<div>Trang Đăng Nhập</div>} />
            <Route
              path="/nv/01"
              element={
                <ProtectedRoute allowedRoles={['nhan_vien']}>
                  <div>Trang Hộp Việc Nhân Viên</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Trang Đăng Nhập')).toBeInTheDocument();
      });
    });

    it('Khách hàng cố tình truy cập /nv/01 bị chặn và chuyển về /kh/06', async () => {
      // Giả lập trạng thái đã đăng nhập là khach_hang
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: false,
        currentActor: { id: 'cust-1', role: 'khach_hang' },
        currentUser: { id: 'cust-1', full_name: 'Khách Demo', role: 'khach_hang' },
      });

      render(
        <MemoryRouter initialEntries={['/nv/01']}>
          <Routes>
            <Route path="/kh/06" element={<div>Trang Chủ Khách Hàng KH-06</div>} />
            <Route
              path="/nv/01"
              element={
                <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
                  <div>Trang Hộp Việc Nhân Viên</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Trang Chủ Khách Hàng KH-06')).toBeInTheDocument();
      });
      expect(screen.queryByText('Trang Hộp Việc Nhân Viên')).not.toBeInTheDocument();
    });

    it('Nhân viên cố tình truy cập trang chỉ dành cho Khách hàng /kh/01 bị chặn và chuyển về /nv/01', async () => {
      // Giả lập trạng thái đã đăng nhập là nhan_vien
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: false,
        currentActor: { id: 'staff-1', role: 'nhan_vien' },
        currentUser: { id: 'staff-1', full_name: 'Kỹ Thuật Viên 1', role: 'nhan_vien' },
      });

      render(
        <MemoryRouter initialEntries={['/kh/01']}>
          <Routes>
            <Route path="/nv/01" element={<div>Trang Hộp Việc Nhân Viên NV-01</div>} />
            <Route
              path="/kh/01"
              element={
                <ProtectedRoute allowedRoles={['khach_hang']}>
                  <div>Trang Tạo Yêu Cầu Thuê Xe KH-01</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Trang Hộp Việc Nhân Viên NV-01')).toBeInTheDocument();
      });
      expect(screen.queryByText('Trang Tạo Yêu Cầu Thuê Xe KH-01')).not.toBeInTheDocument();
    });

    it('Quản lý (quan_ly) có quyền truy cập trang hộp việc nhân viên NV-01', async () => {
      useAuthStore.setState({
        isAuthenticated: true,
        isLoading: false,
        currentActor: { id: 'manager-1', role: 'quan_ly' },
        currentUser: { id: 'manager-1', full_name: 'Quản Lý Tổng', role: 'quan_ly' },
      });

      render(
        <MemoryRouter initialEntries={['/nv/01']}>
          <Routes>
            <Route
              path="/nv/01"
              element={
                <ProtectedRoute allowedRoles={['nhan_vien', 'quan_ly']}>
                  <div>Trang Hộp Việc Nhân Viên NV-01</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Trang Hộp Việc Nhân Viên NV-01')).toBeInTheDocument();
      });
    });
  });
});
