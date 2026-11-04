// tests/e2e/phase7_integrations.spec.ts
// E2E test cho Giai đoạn 7: Màn hình Nhật ký Tích hợp Bên Ngoài (/integration-log)

import { test, expect } from '@playwright/test';

test.describe('E2E GIAI ĐOẠN 7: Màn hình Nhật Ký Tích Hợp (/integration-log)', () => {
  test.beforeEach(async ({ page }) => {
    // Đăng nhập vai trò Quản lý
    await page.goto('/login');
    await page.fill('input[type="text"]', 'quanly1');
    await page.fill('input[type="password"]', 'Manager@123456');
    await page.click('button[type="submit"]');
    // Chờ chuyển trang
    await expect(page).toHaveURL(/.*\/ql\/.*/);
  });

  test('Hiển thị đầy đủ thông tin trang Nhật ký tích hợp và các thẻ thống kê', async ({ page }) => {
    await page.goto('/integration-log');
    await expect(page.getByText('Nhật Ký Tích Hợp Bên Ngoài (Integration Log)')).toBeVisible();
    await expect(page.getByText('Tổng số lần gọi')).toBeVisible();
    await expect(page.getByText('Thành công')).toBeVisible();
    await expect(page.getByText('Độ trễ trung bình')).toBeVisible();
  });

  test('Thực hiện các nút Thử nghiệm kết nối nhanh (Test Actions)', async ({ page }) => {
    await page.goto('/integration-log');

    // Nút Test Notifier
    const testEmailBtn = page.getByRole('button', { name: /Test Notifier/i });
    await expect(testEmailBtn).toBeVisible();
    await testEmailBtn.click();

    // Nút Test VietQR
    const testQrBtn = page.getByRole('button', { name: /Test VietQR/i });
    await expect(testQrBtn).toBeVisible();
    await testQrBtn.click();

    // Nút Test Webhook
    const testWhBtn = page.getByRole('button', { name: /Test Webhook/i });
    await expect(testWhBtn).toBeVisible();
    await testWhBtn.click();

    // Kiểm tra hàng nhật ký xuất hiện trong bảng
    await expect(page.getByText('EMAIL').first()).toBeVisible({ timeout: 5000 });
  });

  test('Mở khung Cài đặt khóa & URL thành công', async ({ page }) => {
    await page.goto('/integration-log');
    const settingsBtn = page.getByRole('button', { name: /Cài đặt khóa & URL/i });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Modal cài đặt hiển thị
    await expect(page.getByText('Cấu Hình Dịch Vụ Tích Hợp Bên Ngoài')).toBeVisible();
    await expect(page.getByText('Mã BIN Ngân hàng')).toBeVisible();
    await expect(page.getByText('Số tài khoản nhận cọc')).toBeVisible();
    await expect(page.getByText('EmailJS Service ID')).toBeVisible();

    // Đóng modal
    await page.getByRole('button', { name: 'Hủy bỏ' }).click();
    await expect(page.getByText('Cấu Hình Dịch Vụ Tích Hợp Bên Ngoài')).not.toBeVisible();
  });
});

