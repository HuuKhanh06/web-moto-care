import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { db } from '@/db';
import { KH02Page } from '@/features/customer/KH02Page';
import { aiService } from '@/ai';
import type { AiOcrResponse } from '@/ai/types';
import { OcrError } from '@/ai/errors';

vi.mock('@/ai', () => ({ aiService: { processOcr: vi.fn() } }));
vi.mock('@/features/auth/authStore', () => ({
  useAuthStore: () => ({
    currentActor: { id: 'ocr-customer', role: 'khach_hang' },
    currentUser: { id: 'ocr-customer', full_name: 'Tên tài khoản khác giấy tờ' },
  }),
}));

const response: AiOcrResponse = {
  schema_version: '1.0', request_id: 'ocr-request', model_version: 'controlled-test',
  documents: {
    cccd: {
      full_name: { value: 'TRAN THI TEST', confidence: 0.9 },
      id_number: { value: '048098001234', confidence: 0.9 },
      date_of_birth: { value: '1998-05-20', confidence: 0.9 },
    },
    gplx: {
      full_name: { value: 'TRAN THI TEST', confidence: 0.9 },
      license_class: { value: 'A2', confidence: 0.9 },
      expiry_date: { value: null, confidence: null },
    },
  },
  checks: { image_quality: 'PASS', required_fields_present: true, name_consistency: 'PASS' },
  thresholds: { X: 0.95, Y: 0.8 }, minimum_required_confidence: 0.9,
  routing: { action: 'MANUAL_REVIEW', reason_codes: [], next_step: 'M_CheckDocs', business_rule_status: 'NOT_EVALUATED' },
};

function mount() {
  return render(<React.StrictMode><MemoryRouter initialEntries={['/kh/02?requestId=ocr-request']}><KH02Page /></MemoryRouter></React.StrictMode>);
}

describe('KH-02 OCR lifecycle (controlled provider, real test IndexedDB)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await db.clearAllTables();
    await db.rental_requests.add({
      id: 'ocr-request', customer_id: 'ocr-customer', status: 'CHO_HO_SO',
      start_at: '2026-11-08T08:00:00Z', end_at: '2026-11-09T08:00:00Z', doc_request_count: 0,
    });
    await db.customer_documents.bulkAdd([
      { id: 'front', request_id: 'ocr-request', doc_type: 'CCCD_TRUOC', file_url: 'data:image/png;base64,YQ==' },
      { id: 'back', request_id: 'ocr-request', doc_type: 'CCCD_SAU', file_url: 'data:image/png;base64,Yg==' },
      { id: 'license', request_id: 'ocr-request', doc_type: 'BANG_LAI_TRUOC', file_url: 'data:image/png;base64,Yw==' },
    ]);
    vi.mocked(aiService.processOcr).mockImplementation(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
      return structuredClone(response);
    });
  });
  afterEach(cleanup);

  it('quét đúng một lần cho bộ ảnh chưa xác nhận, kể cả StrictMode và rerender', async () => {
    mount();
    await screen.findByText('048098001234');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(aiService.processOcr).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText('Hệ thống đang tự động quét và xác thực thông tin giấy tờ...')).not.toBeInTheDocument());
    expect(screen.getByText('TRAN THI TEST')).toBeInTheDocument();
  });

  it('hiển thị PROCESSING trong lúc chờ, không bắt đầu lượt khác', async () => {
    let finish!: (value: AiOcrResponse) => void;
    vi.mocked(aiService.processOcr).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    mount();
    await screen.findByTestId('ocr-processing');
    expect(screen.queryByText('048098001234')).not.toBeInTheDocument();
    expect(aiService.processOcr).toHaveBeenCalledTimes(1);
    await act(async () => { finish(response); });
    await screen.findByText('048098001234');
    expect(screen.queryByTestId('ocr-processing')).not.toBeInTheDocument();
  });

  it('FAILED cho lỗi lưu, retry chỉ khi khách bấm và có thể hoàn tất lần kế tiếp', async () => {
    vi.mocked(aiService.processOcr).mockRejectedValueOnce(new OcrError('STORAGE_ERROR', 'Không lưu được kết quả OCR.'));
    mount();
    expect(await screen.findByTestId('ocr-error')).toHaveTextContent('Không lưu được kết quả OCR.');
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); });
    expect(aiService.processOcr).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Thử quét lại' }));
    await screen.findByText('048098001234');
    expect(aiService.processOcr).toHaveBeenCalledTimes(2);
  });

  it('không điền tên tài khoản, hạng A1, CCCD hoặc ngày sinh giả khi provider thất bại', async () => {
    vi.mocked(aiService.processOcr).mockResolvedValue({
      ...response, documents: {}, checks: { ...response.checks, required_fields_present: false },
      routing: { ...response.routing, action: 'FALLBACK_MANUAL', reason_codes: ['AI_ERROR: TIMEOUT: OCR quá thời gian xử lý.'] },
    });
    mount();
    expect(await screen.findByTestId('ocr-error')).toHaveTextContent('TIMEOUT');
    expect(screen.queryByTestId('ocr-processing')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nhập thông tin thủ công' }));
    expect(screen.getByLabelText('Họ và tên (chính xác theo CCCD)')).toHaveValue('');
    expect(screen.getByLabelText('Hạng bằng lái xe')).toHaveValue('');
    expect(screen.getByLabelText('Ngày sinh (YYYY-MM-DD)')).toHaveValue('');
    expect(screen.getByLabelText('Số CCCD (12 chữ số)')).toHaveValue('');
  });

  it('phục hồi kết quả đã lưu sau refresh mà không quét lại', async () => {
    await db.customer_documents.toCollection().modify({ ai_source: 'LOCAL' });
    await db.ai_logs.add({
      request_id: 'ocr-request', bpmn_node_id: 'M_CheckDocs', input_summary: 'LOCAL',
      output: response as unknown as Record<string, unknown>, confidence: 0.9,
      routing_action: 'MANUAL_REVIEW', is_overridden: false, created_at: '2026-11-07T00:00:00Z',
    });
    mount();
    await screen.findByText('048098001234');
    expect(aiService.processOcr).not.toHaveBeenCalled();
  });

  it('bỏ qua kết quả trở về sau khi rời trang', async () => {
    let finish!: (value: AiOcrResponse) => void;
    vi.mocked(aiService.processOcr).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = mount();
    await screen.findByTestId('ocr-processing');
    view.unmount();
    await act(async () => { finish(response); });
    expect(screen.queryByText('048098001234')).not.toBeInTheDocument();
  });
});
