// tests/e2e/phase4_flow.spec.ts
// Kiểm thử luồng giao diện Giai đoạn 4: Đặt thuê đến Bàn giao xe

import { test, expect } from '@playwright/test';

test.describe('E2E GIAI ĐOẠN 4: Đặt thuê xe đến Bàn giao xe', () => {
  test('Khách hàng đăng nhập và truy cập màn hình KH-01 đặt xe', async ({ page }) => {
    await page.goto('/login');

    // Kiểm tra giao diện đăng nhập
    await expect(page.getByText('Đăng nhập')).toBeVisible();

    // Điền tài khoản mẫu khách hàng
    await page.fill('input[type="email"]', 'khach_hang_1@motocare.vn');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');

    // Điều hướng vào trang khách hàng (KH-06 hoặc KH-01)
    await expect(page).toHaveURL(/\/kh\/(06|01)/);

    // Truy cập màn hình đặt xe KH-01
    await page.goto('/kh/01');
    await expect(page.getByText('Gửi yêu cầu thuê xe')).toBeVisible();

    // Kiểm tra nút kích hoạt quy trình M_START có đúng data-testid
    const startBtn = page.locator('[data-testid="node-M_START"]');
    await expect(startBtn).toBeVisible();
  });

  test('Nhân viên đăng nhập và truy cập màn hình NV-01 và các bước bàn giao', async ({ page }) => {
    await page.goto('/login');

    // Điền tài khoản mẫu nhân viên
    await page.fill('input[type="email"]', 'nhanvien_ha@motocare.vn');
    await page.fill('input[type="password"]', 'Demo@123');
    await page.click('button[type="submit"]');

    // Điều hướng vào danh sách việc cần làm NV-01
    await expect(page).toHaveURL(/\/nv\/01/);
    await expect(page.getByText('Danh sách yêu cầu & Việc cần làm')).toBeVisible();

    // Kiểm tra liên kết phân hệ nhân viên hoạt động
    await page.goto('/nv/03');
    await expect(page).toHaveURL(/\/nv\/03/);
  });
});

