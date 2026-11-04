// tests/e2e/phase6_flow.spec.ts
// E2E test cho Giai đoạn 6: Trả xe, Bảng kê, Quyết toán và Lưu hồ sơ

import { test, expect } from '@playwright/test';

test.describe('E2E GIAI ĐOẠN 6: Trả xe, Bảng kê thanh lý và Quyết toán', () => {
  test('NV-06 hiển thị đầy đủ thông tin kiểm tra trả xe và checklist đối chiếu', async ({ page }) => {
    await page.goto('/login');
    // Đăng nhập nhanh tài khoản nhân viên
    await page.fill('input[type="text"]', 'nhanvien1');
    await page.fill('input[type="password"]', 'Staff@123456');
    await page.click('button[type="submit"]');

    // Chuyển tới NV-06 với param mẫu
    await page.goto('/nv/06?requestId=test-request-id');
    await expect(page.getByText('Màn hình NV-06')).toBeVisible();
    await expect(page.getByText('Nhận & Kiểm Tra Xe Trả (Đối Chiếu)')).toBeVisible();
  });

  test('NV-07 hiển thị form xác minh hư hỏng và ước tính chi phí', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'nhanvien1');
    await page.fill('input[type="password"]', 'Staff@123456');
    await page.click('button[type="submit"]');

    await page.goto('/nv/07?requestId=test-request-id');
    await expect(page.getByText('Màn hình NV-07')).toBeVisible();
    await expect(page.getByText('Xác Minh Hư Hỏng & Ước Tính Bồi Thường')).toBeVisible();
  });

  test('KH-09 hiển thị bảng kê chi tiết và nút Chấp thuận / Khiếu nại', async ({ page }) => {
    await page.goto('/login');
    // Đăng nhập khách hàng
    await page.fill('input[type="text"]', 'khachhang1');
    await page.fill('input[type="password"]', 'Customer@123456');
    await page.click('button[type="submit"]');

    await page.goto('/kh/09?requestId=test-request-id');
    await expect(page.getByText('Màn hình KH-09')).toBeVisible();
    await expect(page.getByText('Bảng Kê Chi Tiết Trả Xe & Quyết Toán')).toBeVisible();
  });

  test('KH-10 hiển thị giao diện quyết toán thu thêm / hoàn cọc', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'khachhang1');
    await page.fill('input[type="password"]', 'Customer@123456');
    await page.click('button[type="submit"]');

    await page.goto('/kh/10?requestId=test-request-id');
    await expect(page.getByText('Màn hình KH-10')).toBeVisible();
    await expect(page.getByText(/Quyết Toán:/)).toBeVisible();
  });

  test('QL-01 hiển thị màn hình xử lý khiếu nại bảng kê của Quản lý', async ({ page }) => {
    await page.goto('/login');
    // Đăng nhập quản lý
    await page.fill('input[type="text"]', 'quanly1');
    await page.fill('input[type="password"]', 'Admin@123456');
    await page.click('button[type="submit"]');

    await page.goto('/ql/01?requestId=test-request-id');
    await expect(page.getByText('Màn hình QL-01')).toBeVisible();
    await expect(page.getByText('Xử Lý Bất Đồng Bảng Kê Thanh Lý')).toBeVisible();
  });

  test('NV-08 hiển thị xử lý khoản chưa thanh toán / công nợ', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'nhanvien1');
    await page.fill('input[type="password"]', 'Staff@123456');
    await page.click('button[type="submit"]');

    await page.goto('/nv/08?requestId=test-request-id');
    await expect(page.getByText('Màn hình NV-08')).toBeVisible();
    await expect(page.getByText('Xử Lý Khoản Chưa Thanh Toán / Quá Hạn Thu Thêm')).toBeVisible();
  });

  test('NV-09 hiển thị màn hình đánh giá xe sau trả', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="text"]', 'nhanvien1');
    await page.fill('input[type="password"]', 'Staff@123456');
    await page.click('button[type="submit"]');

    await page.goto('/nv/09?requestId=test-request-id');
    await expect(page.getByText('Màn hình NV-09')).toBeVisible();
    await expect(page.getByText('Đánh Giá Xe Sau Trả & Lưu Trữ Hồ Sơ')).toBeVisible();
  });
});

