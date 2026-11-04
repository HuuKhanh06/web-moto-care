// tests/e2e/phase8_ai.spec.ts
// E2E test cho Giai đoạn 8: Màn hình Nhật Ký AI Agent OCR (/ai-log)

import { test, expect } from '@playwright/test';

test.describe('E2E GIAI ĐOẠN 8: Màn hình Nhật Ký AI Agent OCR (/ai-log)', () => {
  test.beforeEach(async ({ page }) => {
    // Đăng nhập vai trò Quản lý
    await page.goto('/login');
    await page.fill('input[type="text"]', 'quanly1');
    await page.fill('input[type="password"]', 'Manager@123456');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*\/ql\/.*/);
  });

  test('Hiển thị tiêu đề, các thẻ thống kê và bảng nhật ký AI OCR', async ({ page }) => {
    await page.goto('/ai-log');
    await expect(page.getByText('Nhật Ký AI Agent OCR (AI Log)')).toBeVisible();
    await expect(page.getByText('Tổng số lần gọi')).toBeVisible();
    await expect(page.getByText('Cần xác minh')).toBeVisible();
    await expect(page.getByText('Fallback thủ công')).toBeVisible();
  });

  test('Kích hoạt các nút Thử nghiệm kịch bản nhanh và mở Modal xem JSON', async ({ page }) => {
    await page.goto('/ai-log');

    // Nút Kịch bản 1: Tin cậy cao (m = 96% >= X)
    const testPreset1Btn = page.getByRole('button', { name: /Tin cậy cao/i });
    await expect(testPreset1Btn).toBeVisible();
    await testPreset1Btn.click();

    // Nút Kịch bản 2: Tin cậy vừa (m = 87%)
    const testPreset2Btn = page.getByRole('button', { name: /Tin cậy vừa/i });
    await expect(testPreset2Btn).toBeVisible();
    await testPreset2Btn.click();

    // Kiểm tra hàng nhật ký xuất hiện trong bảng
    await expect(page.getByText('96.0%').first()).toBeVisible({ timeout: 5000 });

    // Bấm nút JSON để mở modal chi tiết
    const jsonBtn = page.getByRole('button', { name: 'JSON' }).first();
    await expect(jsonBtn).toBeVisible();
    await jsonBtn.click();

    // Modal hiển thị đầy đủ thông tin JSON
    await expect(page.getByText('JSON Kết Quả Đặc Tả AI Agent:')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng' }).click();
  });

  test('Mở modal Cấu hình AI & Ngưỡng X/Y thành công', async ({ page }) => {
    await page.goto('/ai-log');
    const settingsBtn = page.getByRole('button', { name: /Cấu hình AI & Ngưỡng/i });
    await expect(settingsBtn).toBeVisible();
    await settingsBtn.click();

    // Modal cấu hình
    await expect(page.getByText('Cấu Hình AI Agent OCR & Ngưỡng X/Y')).toBeVisible();
    await expect(page.getByText('Google Gemini API Key')).toBeVisible();
    await expect(page.getByText('Ngưỡng X (Tự động điền)')).toBeVisible();
    await expect(page.getByText('Ngưỡng Y (Xác minh thủ công)')).toBeVisible();

    await page.getByRole('button', { name: 'Hủy bỏ' }).click();
    await expect(page.getByText('Cấu Hình AI Agent OCR & Ngưỡng X/Y')).not.toBeVisible();
  });
});

