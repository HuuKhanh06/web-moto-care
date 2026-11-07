import { test, expect, type Page } from '@playwright/test';

// Browser contexts/IndexedDB độc lập; tuyệt đối không gọi Supabase production.
test.beforeEach(async ({ page }) => {
  await page.route('**/*.supabase.co/**', route => route.abort());
  await page.routeWebSocket(/supabase\.co/, socket => socket.close());
  await page.addInitScript(() => sessionStorage.setItem('motocare_ai_config', JSON.stringify({ mode: 'LOCAL', timeoutMs: 60000, apiKey: '' })));
  await page.goto('/#/');
  await page.waitForFunction(async () => {
    const path = '/src/db/index.ts';
    const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/db');
    return await db.auth_accounts.count() === 3 && await db.vehicles.count() === 30;
  });
  await page.evaluate(async () => {
    const dbPath = '/src/db/index.ts'; const cryptoPath = '/src/features/auth/crypto.ts';
    const { db } = await import(/* @vite-ignore */ dbPath) as typeof import('../../src/db');
    const { hashPassword } = await import(/* @vite-ignore */ cryptoPath) as typeof import('../../src/features/auth/crypto');
    const { hash, salt } = await hashPassword('OcrTest123!');
    await db.profiles.add({ id: 'e2e-ocr-customer', role: 'khach_hang', full_name: 'OCR Account Test' });
    await db.auth_accounts.add({ user_id: 'e2e-ocr-customer', email: 'ocr-test@example.test', password_hash: hash, salt, created_at: new Date().toISOString() });
    const vehicle = await db.vehicles.toCollection().first();
    await db.rental_requests.add({ id: 'e2e-ocr-request', customer_id: 'e2e-ocr-customer', vehicle_id: vehicle!.id,
      start_at: '2026-12-01T08:00:00Z', end_at: '2026-12-02T08:00:00Z', status: 'CHO_HO_SO', doc_request_count: 0 });
    await db.process_state.add({ request_id: 'e2e-ocr-request', waiting_node_ids: ['M_CheckDocs'], loop_counters: {}, variables: {}, updated_at: new Date().toISOString() });
  });
  await page.goto('/#/login');
  await page.getByLabel('Địa chỉ email').fill('ocr-test@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('OcrTest123!');
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/#\/kh\//);
  await page.goto('/#/kh/02?requestId=e2e-ocr-request');
  await expect(page.getByText('Giấy tờ tùy thân (3 ảnh)')).toBeVisible();
});

async function fixtureImage(page: Page, kind: 'front' | 'back' | 'license', mimeType = 'image/png') {
  const base64 = await page.evaluate(({ kind, mimeType }) => {
    const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 760;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'black'; ctx.font = '24px Arial';
    ctx.fillText('SYNTHETIC OCR TEST - NOT A REAL DOCUMENT', 55, 60);
    ctx.font = '40px Arial';
    const lines = kind === 'front'
      ? ['CAN CUOC CONG DAN', 'Full name: TRAN THI TEST', 'Date of birth: 20/05/1998', 'So: 048098001234']
      : kind === 'license'
        ? ['GIAY PHEP LAI XE', 'Full name: TRAN THI TEST', 'Class: A2', 'Expiry: NONE']
        : ['CCCD BACK', 'IDVNM048098001234', 'TRAN<<THI<TEST'];
    lines.forEach((line, index) => ctx.fillText(line, 55, 180 + 115 * index));
    if (mimeType === 'image/bmp') {
      const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const row = Math.ceil(canvas.width * 3 / 4) * 4;
      const bytes = new Uint8Array(54 + row * canvas.height);
      const view = new DataView(bytes.buffer);
      bytes[0] = 66; bytes[1] = 77; view.setUint32(2, bytes.length, true); view.setUint32(10, 54, true);
      view.setUint32(14, 40, true); view.setInt32(18, canvas.width, true); view.setInt32(22, canvas.height, true);
      view.setUint16(26, 1, true); view.setUint16(28, 24, true);
      for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
        const src = (y * canvas.width + x) * 4; const dest = 54 + (canvas.height - y - 1) * row + x * 3;
        bytes[dest] = rgba[src + 2]; bytes[dest + 1] = rgba[src + 1]; bytes[dest + 2] = rgba[src];
      }
      let text = ''; for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(text);
    }
    return canvas.toDataURL(mimeType).split(',')[1];
  }, { kind, mimeType });
  return { name: `${kind}.${mimeType.split('/')[1]}`, mimeType, buffer: Buffer.from(base64, 'base64') };
}

async function uploadSet(page: Page) {
  await page.getByLabel('Căn cước công dân (Mặt trước)', { exact: true }).setInputFiles(await fixtureImage(page, 'front', 'image/jpeg'));
  await expect(page.getByText('1/3 ảnh')).toBeVisible();
  await page.getByLabel('Căn cước công dân (Mặt sau)', { exact: true }).setInputFiles(await fixtureImage(page, 'back', 'image/png'));
  await expect(page.getByText('2/3 ảnh')).toBeVisible();
  await page.getByLabel('Bằng lái xe máy (Mặt trước)', { exact: true }).setInputFiles(await fixtureImage(page, 'license', 'image/webp'));
}

test('REAL LOCAL OCR: upload JPEG/PNG/WebP → worker → DB → UI → confirm → deposit', async ({ page }, info) => {
  test.setTimeout(120000);
  const ocrLogs: string[] = [];
  page.on('console', msg => { if (msg.text().startsWith('[OCR]')) ocrLogs.push(msg.text()); });
  page.on('pageerror', error => console.log('OCR browser error:', error.message));
  await uploadSet(page);
  await expect(page.getByTestId('ocr-processing')).toBeVisible();
  await expect(page.getByTestId('ocr-processing')).toHaveCount(0, { timeout: 75000 });
  await expect(page.getByText('048098001234', { exact: true })).toBeVisible();
  await expect(page.getByText('TRAN THI TEST', { exact: true })).toBeVisible();
  await expect(page.getByText('1998-05-20', { exact: true })).toBeVisible();
  await expect(page.getByText('A2', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ocr-error')).toHaveCount(0);
  const persisted = await page.evaluate(async () => {
    const path = '/src/db/index.ts'; const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/db');
    return { docs: await db.customer_documents.where('request_id').equals('e2e-ocr-request').toArray(), logs: await db.ai_logs.toArray() };
  });
  expect(persisted.docs).toHaveLength(3);
  expect(persisted.docs.every(d => d.ai_source === 'LOCAL' && d.file_url.startsWith('data:image/jpeg;'))).toBe(true);
  expect(persisted.logs).toHaveLength(1);
  expect(persisted.logs[0].output.model_version).toBe('tesseract-7-eng-vie');
  await page.screenshot({ path: info.outputPath('real-local-result.png'), fullPage: true });
  await info.attach('OCR lifecycle logs (no image or extracted text)', { body: ocrLogs.join('\n'), contentType: 'text/plain' });
  await page.reload();
  await expect(page.getByText('048098001234', { exact: true })).toBeVisible();
  await expect(page.getByTestId('ocr-processing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Xác nhận thông tin đúng', exact: true }).click();
  await expect(page.getByText('Đã đối chiếu và xác nhận chính xác')).toBeVisible();
  await page.getByTestId('node-M_CheckDocs').filter({ visible: true }).click();
  await expect(page).toHaveURL(/#\/kh\/03/);
  const count = await page.evaluate(async () => {
    const path = '/src/db/index.ts'; const { db } = await import(/* @vite-ignore */ path) as typeof import('../../src/db'); return db.ai_logs.count();
  });
  expect(count).toBe(1);
});

test('real BMP decoding and rejected PDF/oversize/corrupt upload preserve existing file', async ({ page }) => {
  const fileInput = page.getByLabel('Căn cước công dân (Mặt trước)', { exact: true });
  await fileInput.setInputFiles(await fixtureImage(page, 'front', 'image/bmp'));
  await expect(page.getByText('1/3 ảnh')).toBeVisible();
  await fileInput.setInputFiles({ name: 'bad.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 test') });
  await expect(page.getByText(/Chỉ hỗ trợ ảnh JPEG/)).toBeVisible();
  await fileInput.setInputFiles({ name: 'large.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) });
  await expect(page.getByText('Ảnh phải có dung lượng từ 1 byte đến 10 MB.')).toBeVisible();
  await fileInput.setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
  await expect(page.getByText(/Tệp tải lên không phải ảnh hợp lệ/)).toBeVisible();
  await expect(page.getByText('1/3 ảnh')).toBeVisible();
  await expect(page.getByTestId('ocr-processing')).toHaveCount(0);
});

test('MOCKED Gemini timeout: finite failure, retry, refresh during processing, no duplicate jobs', async ({ page }, info) => {
  await page.evaluate(() => sessionStorage.setItem('motocare_ai_config', JSON.stringify({ mode: 'LIVE', apiKey: 'fake-test-key', timeoutMs: 700 })));
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 1800));
    await route.abort().catch(() => {});
  });
  await uploadSet(page);
  await expect(page.getByTestId('ocr-processing')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('ocr-error')).toContainText(/TIMEOUT|quá thời gian/);
  await expect(page.getByTestId('ocr-processing')).toHaveCount(0);
  const afterFailure = calls;
  await page.waitForTimeout(1000);
  expect(calls).toBe(afterFailure);
  await page.getByRole('button', { name: 'Thử quét lại' }).click();
  await expect(page.getByTestId('ocr-error')).toContainText(/TIMEOUT|quá thời gian/);
  expect(calls).toBe(afterFailure + 1);
  await page.screenshot({ path: info.outputPath('controlled-timeout.png'), fullPage: true });
  expect(calls).toBeLessThanOrEqual(3);
});

test('MOCKED Gemini invalid JSON: FAILED with no account/default data prefilled', async ({ page }) => {
  await page.evaluate(() => sessionStorage.setItem('motocare_ai_config', JSON.stringify({ mode: 'LIVE', apiKey: 'fake-test-key', timeoutMs: 5000 })));
  let calls = 0;
  await page.route('https://generativelanguage.googleapis.com/**', route => {
    calls++; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) });
  });
  await uploadSet(page);
  await expect(page.getByTestId('ocr-error')).toContainText('INVALID_RESPONSE');
  await expect(page.getByTestId('ocr-processing')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhập thông tin thủ công' }).click();
  await expect(page.getByLabel('Họ và tên (chính xác theo CCCD)')).toHaveValue('');
  await expect(page.getByLabel('Hạng bằng lái xe')).toHaveValue('');
  expect(calls).toBe(1);
});
