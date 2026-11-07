// src/features/manager/AiLogPage.tsx
// Màn hình Nhật Ký AI Agent OCR (/ai-log) dành cho Quản lý & Nhân viên
// Theo dõi toàn diện các lần gọi AI OCR tại bước M_CheckDocs theo bảng đặc tả của Trang

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { aiService } from '@/ai';
import { getAiConfig, saveAiConfig } from '@/config/ai';
import { Button, Card, Badge, Modal, Input, toast } from '@/components/ui';
import type { AiLog } from '@/db/types';
import type { RoutingAction } from '@/ai/types';
import {
  Sparkles,
  Bot,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Settings,
  Trash2,
  Eye,
  ShieldCheck,
  Cpu,
} from 'lucide-react';

export function AiLogPage() {
  const [filterAction, setFilterAction] = useState<RoutingAction | 'ALL'>('ALL');
  const [selectedLog, setSelectedLog] = useState<AiLog | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings form state
  const currentCfg = getAiConfig();
  const [configForm, setConfigForm] = useState(currentCfg);

  // Live query danh sách AI logs
  const logs = useLiveQuery(async () => {
    const all = await db.ai_logs.toCollection().reverse().sortBy('created_at');
    return all.filter((l) => {
      if (filterAction !== 'ALL' && l.routing_action !== filterAction) return false;
      return true;
    });
  }, [filterAction]);

  // Thống kê nhanh
  const allLogs = useLiveQuery(() => db.ai_logs.toArray()) || [];
  const totalCount = allLogs.length;
  const prefillCount = allLogs.filter((l) => l.routing_action === 'PREFILL_FOR_RULES').length;
  const manualCount = allLogs.filter((l) => l.routing_action === 'MANUAL_REVIEW').length;
  const reuploadCount = allLogs.filter((l) => l.routing_action === 'REQUEST_REUPLOAD').length;
  const fallbackCount = allLogs.filter((l) => l.routing_action === 'FALLBACK_MANUAL').length;

  const prefillRate = totalCount > 0 ? Math.round((prefillCount / totalCount) * 100) : 0;

  // Đổi mode LIVE / MOCK
  const handleToggleMode = () => {
    const nextMode = currentCfg.mode === 'LIVE' ? 'MOCK' : 'LIVE';
    aiService.updateConfig({ mode: nextMode });
    toast.success(`Đã chuyển AI Agent sang chế độ: ${nextMode}`);
    setConfigForm(getAiConfig());
  };

  // Thử nghiệm kịch bản nhanh
  const handleRunPresetTest = async (
    preset: 'HIGH_CONFIDENCE' | 'MEDIUM_CONFIDENCE' | 'LOW_CONFIDENCE' | 'BLURRY_IMAGE' | 'NAME_MISMATCH' | 'NETWORK_ERROR',
    name: string
  ) => {
    try {
      setIsTesting(true);
      const fakeReqId = 'AI-TEST-' + Date.now().toString().slice(-4);
      const res = await aiService.processOcr({
        requestId: fakeReqId,
        cccdImageRef: 'blob:test_cccd_sample.jpg',
        gplxImageRef: 'blob:test_gplx_sample.jpg',
        selectedVehicleType: 'xe_so',
        scenarioPreset: preset,
      });

      toast.success(`[${name}] Quyết định: ${res.routing.action} (m = ${res.minimum_required_confidence ?? 'N/A'})`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi test AI');
    } finally {
      setIsTesting(false);
    }
  };

  // Lưu cài đặt
  const handleSaveSettings = () => {
    saveAiConfig(configForm);
    toast.success('Đã lưu cấu hình AI Agent thành công.');
    setShowSettings(false);
  };

  // Xóa toàn bộ logs
  const handleClearLogs = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký AI OCR?')) {
      await db.ai_logs.clear();
      toast.success('Đã dọn sạch nhật ký AI OCR.');
    }
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PREFILL_FOR_RULES':
        return <Badge variant="success">Tự động điền (m ≥ 95%)</Badge>;
      case 'MANUAL_REVIEW':
        return <Badge variant="waiting">Xác minh thủ công (80% ≤ m &lt; 95%)</Badge>;
      case 'REQUEST_REUPLOAD':
        return <Badge variant="danger">Yêu cầu chụp lại (m &lt; 80%)</Badge>;
      case 'FALLBACK_MANUAL':
        return <Badge variant="neutral">Fallback thủ công (Lỗi/Timeout)</Badge>;
      default:
        return <Badge variant="neutral">{action}</Badge>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700 bg-purple-50 px-2.5 py-1 rounded">
              Hệ thống AI
            </span>
            <span className="text-xs text-slate-500 font-mono">Bóc tách &amp; Thẩm định hồ sơ</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-600" />
            Nhật Ký AI Agent OCR
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Giám sát thời gian thực năng lực trích xuất CCCD &amp; GPLX, phân nhánh thẩm định và độ tin cậy bóc tách.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút chuyển mode */}
          <button
            type="button"
            onClick={handleToggleMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
              currentCfg.mode === 'LIVE'
                ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Chế độ: {currentCfg.mode === 'LIVE' ? 'LIVE (Gemini API)' : 'MOCK (Giả lập)'}</span>
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="text-xs flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cấu hình AI &amp; Ngưỡng</span>
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card className="p-3.5 bg-slate-50 border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Tổng số lần gọi</div>
          <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
        </Card>
        <Card className="p-3.5 bg-emerald-50/60 border-emerald-200">
          <div className="text-xs text-emerald-800 font-medium">Tự động điền ({prefillRate}%)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-0.5">{prefillCount}</div>
        </Card>
        <Card className="p-3.5 bg-amber-50/60 border-amber-200">
          <div className="text-xs text-amber-800 font-medium">Cần xác minh</div>
          <div className="text-2xl font-bold text-amber-700 mt-0.5">{manualCount}</div>
        </Card>
        <Card className="p-3.5 bg-red-50/60 border-red-200">
          <div className="text-xs text-red-800 font-medium">Yêu cầu chụp lại</div>
          <div className="text-2xl font-bold text-red-700 mt-0.5">{reuploadCount}</div>
        </Card>
        <Card className="p-3.5 bg-purple-50/60 border-purple-200">
          <div className="text-xs text-purple-800 font-medium">Fallback thủ công</div>
          <div className="text-2xl font-bold text-purple-700 mt-0.5">{fallbackCount}</div>
        </Card>
      </div>

      {/* KHUNG CÔNG CỤ VẬN HÀNH & KIỂM THỬ AI */}
      <Card className="p-3.5 border-purple-100 bg-purple-50/20 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-purple-600" />
            <span>Công cụ kiểm thử kết nối &amp; thẩm định nhanh</span>
          </div>
          <span className="text-[11px] text-slate-400">
            Hỗ trợ quản trị viên kiểm tra dịch vụ AI trực tiếp
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => handleRunPresetTest('HIGH_CONFIDENCE', 'Kiểm thử ảnh chuẩn')}
            loading={isTesting}
            className="text-xs bg-white text-emerald-800 hover:bg-emerald-50 border border-emerald-300 flex items-center gap-1.5"
          >
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Kiểm thử mẫu hồ sơ đạt chuẩn (96%)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleRunPresetTest('MEDIUM_CONFIDENCE', 'Kiểm thử độ tin cậy vừa')}
            loading={isTesting}
            className="text-xs bg-white text-amber-800 hover:bg-amber-50 border border-amber-300 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Kiểm thử độ tin cậy trung bình (87%)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleRunPresetTest('LOW_CONFIDENCE', 'Kiểm thử ảnh mờ/lỗi')}
            loading={isTesting}
            className="text-xs bg-white text-red-800 hover:bg-red-50 border border-red-300 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5 text-red-600" />
            <span>Kiểm thử ảnh mờ (Yêu cầu nạp lại)</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleRunPresetTest('NAME_MISMATCH', 'Kiểm thử lệch tên')}
            loading={isTesting}
            className="text-xs bg-white text-amber-800 hover:bg-amber-50 border border-amber-300 flex items-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Kiểm thử lệch tên giữa CCCD &amp; GPLX</span>
          </Button>

          <Button
            size="sm"
            onClick={() => handleRunPresetTest('NETWORK_ERROR', 'Kiểm thử mất mạng')}
            loading={isTesting}
            className="text-xs bg-white text-purple-800 hover:bg-purple-50 border border-purple-300 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Kiểm thử Fallback thủ công</span>
          </Button>
        </div>
      </Card>

      {/* Bộ lọc và Danh sách nhật ký */}
      <Card className="p-4 border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">Lọc quyết định AI:</span>
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value as RoutingAction | 'ALL')}
              className="text-xs rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="ALL">Tất cả quyết định</option>
              <option value="PREFILL_FOR_RULES">Tự động điền (m ≥ X)</option>
              <option value="MANUAL_REVIEW">Xác minh thủ công (Y ≤ m &lt; X)</option>
              <option value="REQUEST_REUPLOAD">Yêu cầu chụp lại (m &lt; Y)</option>
              <option value="FALLBACK_MANUAL">Fallback thủ công</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">
              Hiển thị: <strong>{logs?.length || 0}</strong> bản ghi
            </span>
            {allLogs.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleClearLogs}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Dọn sạch
              </Button>
            )}
          </div>
        </div>

        {/* Bảng Logs */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100 text-slate-700 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Thời điểm</th>
                <th className="py-2.5 px-3">Mã hồ sơ</th>
                <th className="py-2.5 px-3">Độ tin cậy trích xuất</th>
                <th className="py-2.5 px-3">Quyết định chuyển nhánh</th>
                <th className="py-2.5 px-3">Tóm tắt đầu vào</th>
                <th className="py-2.5 px-3 text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {!logs || logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Chưa ghi nhận sự kiện AI OCR nào. Hệ thống sẽ tự động cập nhật nhật ký khi có hồ sơ thẩm định giấy tờ.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">
                      {new Date(log.created_at).toLocaleTimeString('vi-VN')}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">
                      {log.request_id}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {log.confidence !== null ? (
                        <span
                          className={
                            log.confidence >= currentCfg.thresholdX
                              ? 'text-emerald-600'
                              : log.confidence >= currentCfg.thresholdY
                              ? 'text-amber-600'
                              : 'text-red-600'
                          }
                        >
                          {(log.confidence * 100).toFixed(1)}%
                        </span>
                      ) : (
                        <span className="text-slate-400">N/A</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getActionBadge(log.routing_action)}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 truncate max-w-xs">
                      {log.input_summary}
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLog(log)}
                        className="text-[11px] h-7 px-2"
                      >
                        <Eye className="w-3 h-3 mr-1" />
                        JSON
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MODAL CHI TIẾT JSON */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title={`Chi tiết kết quả AI OCR #${selectedLog.id}`}
        >
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1">
              <div>
                <strong>Mã hồ sơ:</strong> {selectedLog.request_id}
              </div>
              <div>
                <strong>Thời điểm gọi:</strong>{' '}
                {new Date(selectedLog.created_at).toLocaleString('vi-VN')}
              </div>
              <div>
                <strong>Quyết định:</strong> {selectedLog.routing_action}
              </div>
              <div>
                <strong>Điểm m (Confidence nhỏ nhất):</strong>{' '}
                {selectedLog.confidence !== null ? `${(selectedLog.confidence * 100).toFixed(1)}%` : 'N/A'}
              </div>
            </div>

            <div>
              <div className="text-xs font-bold text-slate-700 mb-1">JSON Kết Quả Đặc Tả AI Agent:</div>
              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-xs font-mono overflow-auto max-h-72">
                {JSON.stringify(selectedLog.output, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end">
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL CÀI ĐẶT THAM SỐ AI */}
      {showSettings && (
        <Modal
          isOpen={true}
          onClose={() => setShowSettings(false)}
          title="Cấu Hình AI Agent OCR & Ngưỡng X/Y"
        >
          <div className="space-y-4">
            <div className="p-3 bg-purple-50 text-purple-800 rounded-lg text-xs">
              <strong>Lưu ý:</strong> Cấu hình được lưu vào <code>sessionStorage</code> của trình duyệt phục vụ demo đồ án.
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Chế độ hoạt động
                </label>
                <select
                  value={configForm.mode}
                  onChange={(e) =>
                    setConfigForm({ ...configForm, mode: e.target.value as 'LOCAL' | 'MOCK' | 'LIVE' })
                  }
                  className="w-full text-xs rounded-lg border border-slate-300 p-2"
                >
                  <option value="LOCAL">LOCAL (OCR thật trên thiết bị, không cần khóa)</option>
                  <option value="MOCK">MOCK (Chỉ giả lập khi chạy kịch bản thử nghiệm)</option>
                  <option value="LIVE">LIVE (Gọi Google Gemini API trực tiếp)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={configForm.apiKey || ''}
                  onChange={(e) => setConfigForm({ ...configForm, apiKey: e.target.value })}
                  className="w-full text-xs rounded-lg border border-slate-300 p-2 font-mono"
                />
                <span className="text-[10px] text-slate-500">
                  Khóa chỉ dùng trong phiên trình duyệt này. LOCAL không cần khóa; lần tải dữ liệu nhận diện đầu tiên cần mạng.
                </span>
              </div>

              <Input label="Mô hình Gemini" value={configForm.model}
                onChange={(e) => setConfigForm({ ...configForm, model: e.target.value })} />
              <Input label="Giới hạn xử lý OCR (mili giây)" type="number" min={1} max={120000}
                value={configForm.timeoutMs}
                onChange={(e) => setConfigForm({ ...configForm, timeoutMs: Number(e.target.value) })} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ngưỡng X (Tự động điền)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={configForm.thresholdX}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, thresholdX: parseFloat(e.target.value) || 0.95 })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Mặc định: 0.95 (95%)</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Ngưỡng Y (Xác minh thủ công)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={configForm.thresholdY}
                    onChange={(e) =>
                      setConfigForm({ ...configForm, thresholdY: parseFloat(e.target.value) || 0.80 })
                    }
                    className="w-full text-xs rounded-lg border border-slate-300 p-2 font-mono"
                  />
                  <span className="text-[10px] text-slate-500">Mặc định: 0.80 (80%)</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setShowSettings(false)}>
                Hủy bỏ
              </Button>
              <Button size="sm" onClick={handleSaveSettings}>
                Lưu cấu hình
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default AiLogPage;
