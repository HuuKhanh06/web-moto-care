// tests/e2e/phase5_flow.spec.ts
// Kiểm thử luồng giao diện Giai đoạn 5: Gia hạn hợp đồng SP1 và Báo sự cố/Cứu hộ SP2

import { test, expect } from '@playwright/test';

test.describe('E2E GIAI ĐOẠN 5: Các sự kiện trong thời gian thuê (SP1 & SP2)', () => {
  test('Khách hàng truy cập KH-06 xem hợp đồng và truy cập trang gia hạn KH-07 / báo sự cố KH-08', async ({ page }) => {
    await page.goto('/login');

    // Đăng nhập tài khoản khách hàng
    await page.fill('input[type="email"]', 'khach_hang_1@motocare.vn');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');

    // Chuyển tới trang KH-06
    await page.goto('/kh/06');
    await expect(page.getByText('Yêu cầu thuê của tôi')).toBeVisible();

    // Truy cập trực tiếp trang gia hạn KH-07
    await page.goto('/kh/07');
    await expect(page).toHaveURL(/\/kh\/07/);

    // Truy cập trực tiếp trang báo sự cố KH-08
    await page.goto('/kh/08');
    await expect(page).toHaveURL(/\/kh\/08/);
  });

  test('Quản lý truy cập Cổng đối tác cứu hộ DT-01 và xử lý sự cố vượt SLA QL-02', async ({ page }) => {
    await page.goto('/login');

    // Đăng nhập tài khoản quản lý
    await page.fill('input[type="email"]', 'quanly_minh@motocare.vn');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');

    // Truy cập Cổng đối tác mô phỏng DT-01
    await page.goto('/dt/01');
    await expect(page.getByText('Cổng đối tác cứu hộ xe máy (Mô phỏng)')).toBeVisible();

    // Truy cập trang QL-02 xử lý vượt SLA
    await page.goto('/ql/02');
    await expect(page.getByText('Xử lý sự cố vượt SLA')).toBeVisible();
  });

  test('Nhân viên truy cập NV-10 nghiệm thu chi phí sự cố', async ({ page }) => {
    await page.goto('/login');

    // Đăng nhập tài khoản nhân viên
    await page.fill('input[type="email"]', 'nhanvien_ha@motocare.vn');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');

    // Truy cập màn hình NV-10
    await page.goto('/nv/10');
    await expect(page.getByText('Xác nhận sự cố & Ghi nhận chi phí')).toBeVisible();
  });
});

