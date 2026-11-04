// src/features/manager/IntegrationLogPage.tsx
// Màn hình Nhật Ký Tích Hợp Bên Ngoài (/integration-log) dành cho Quản lý & Vận hành

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { integrations } from '@/integrations';
import { Button, Card, Badge, Input, Modal, toast } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import type { IntegrationType, IntegrationStatus, IntegrationLog } from '@/db/types';
import {
  Activity,
  Mail,
  QrCode,
  Webhook,
  Settings,
  Trash2,
  Send,
  Eye,
  ShieldAlert,
} from 'lucide-react';

export function IntegrationLogPage() {
  const [filterType, setFilterType] = useState<IntegrationType | 'ALL'>('ALL');
  const [filterStatus, setFilterStatus] = useState<IntegrationStatus | 'ALL'>('ALL');
  const [selectedLog, setSelectedLog] = useState<IntegrationLog | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings form state
  const currentCfg = integrations.getConfig();
  const [configForm, setConfigForm] = useState(currentCfg);

  // Live query danh sách logs
  const logs = useLiveQuery(async () => {
    const query = db.integration_logs.toCollection();
    const all = await query.reverse().sortBy('created_at');
    return all.filter((l) => {
      if (filterType !== 'ALL' && l.type !== filterType) return false;
      if (filterStatus !== 'ALL' && l.status !== filterStatus) return false;
      return true;
    });
  }, [filterType, filterStatus]);

  // Thống kê nhanh
  const allLogs = useLiveQuery(() => db.integration_logs.toArray()) || [];
  const totalCount = allLogs.length;
  const successCount = allLogs.filter((l) => l.status === 'SUCCESS').length;
  const errorCount = allLogs.filter((l) => l.status === 'ERROR').length;
  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100;
  const avgDuration =
    totalCount > 0
      ? Math.round(allLogs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / totalCount)
      : 0;

  // Đổi mode LIVE / MOCK
  const handleToggleMode = () => {
    const nextMode = currentCfg.mode === 'LIVE' ? 'MOCK' : 'LIVE';
    integrations.setMode(nextMode);
    setConfigForm(integrations.getConfig());
    toast.success(`Đã chuyển chế độ tích hợp sang: ${nextMode === 'LIVE' ? 'CHẠY THẬT (LIVE)' : 'GIẢ LẬP (MOCK)'}`);
  };

  // Lưu cấu hình
  const handleSaveSettings = () => {
    integrations.updateConfig(configForm);
    setShowSettings(false);
    toast.success('Đã lưu cấu hình tích hợp vào bộ nhớ trình duyệt!');
  };

  // 1. Test Notifier
  const handleTestEmail = async () => {
    try {
      setIsTesting(true);
      const res = await integrations.notifier.sendNotification({
        recipientEmail: configForm.notificationEmail || 'khach@motocare.vn',
        recipientName: 'Khách hàng Demo',
        template: 'QUOTE',
        subject: '[Test Moto Care] Thử nghiệm gửi thông báo hệ thống',
        content: 'Đây là email thử nghiệm kết nối dịch vụ Notifier của đồ án Moto Care.',
        requestId: 'TEST-REQ-' + Date.now().toString().slice(-4),
        bpmnNodeId: 'M_SendTerms',
      });

      if (res.success) {
        toast.success(`Gửi thông báo thành công (${res.channel})! ID: ${res.messageId}`);
      } else {
        toast.warning(`Thử nghiệm thông báo thất bại: ${res.error}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi test email');
    } finally {
      setIsTesting(false);
    }
  };

  // 2. Test VietQR
  const handleTestVietQr = async () => {
    try {
      setIsTesting(true);
      const res = await integrations.paymentQr.generateQr({
        accountNo: configForm.accountNo,
        accountName: configForm.accountName,
        bankBin: configForm.bankBin,
        amount: 150000,
        description: 'TEST_MC_VIETQR_' + Date.now().toString().slice(-4),
        requestId: 'TEST-REQ-' + Date.now().toString().slice(-4),
        bpmnNodeId: 'M_CreateDeposit',
      });

      if (res.success) {
        toast.success(`Tạo mã VietQR thành công (${res.provider})!`);
      } else {
        toast.warning(`Tạo VietQR thất bại: ${res.error}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi test VietQR');
    } finally {
      setIsTesting(false);
    }
  };

  // 3. Test Webhook
  const handleTestWebhook = async () => {
    try {
      setIsTesting(true);
      const res = await integrations.workflowHook.triggerWebhook({
        requestId: 'TEST-REQ-' + Date.now().toString().slice(-4),
        bpmnNodeId: 'M_START',
        event: 'TEST_WEBHOOK_PING',
        timestamp: new Date().toISOString(),
        data: { message: 'Kiểm tra webhook từ màn hình Nhật ký tích hợp' },
      });

      if (res.success) {
        toast.success(`Webhook kích hoạt thành công! HTTP Status: ${res.statusCode}`);
      } else {
        toast.warning(`Webhook kích hoạt thất bại: ${res.error}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi test webhook');
    } finally {
      setIsTesting(false);
    }
  };

  // Xóa toàn bộ logs
  const handleClearLogs = async () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử nhật ký tích hợp?')) {
      await db.integration_logs.clear();
      toast.success('Đã dọn sạch nhật ký tích hợp.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-1 rounded">
              Giai đoạn 7
            </span>
            <span className="text-xs text-slate-500 font-mono">Bằng chứng tích hợp ngoài</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">
            Nhật Ký Tích Hợp Bên Ngoài (Integration Log)
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Theo dõi thời gian thực các lần gọi: <strong>Email Notifier</strong>, <strong>VietQR Payment API</strong> và <strong>No-Code Workflow Webhook</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Nút chuyển mode */}
          <button
            type="button"
            onClick={handleToggleMode}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center gap-1.5 ${
              currentCfg.mode === 'LIVE'
                ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Chế độ: {currentCfg.mode === 'LIVE' ? 'LIVE (Thật)' : 'MOCK (Giả lập)'}</span>
          </button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowSettings(true)}
            className="text-xs flex items-center gap-1"
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Cài đặt khóa &amp; URL</span>
          </Button>
        </div>
      </div>

      {/* Thẻ thống kê */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3.5 bg-slate-50 border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Tổng số lần gọi</div>
          <div className="text-2xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
        </Card>
        <Card className="p-3.5 bg-emerald-50/60 border-emerald-200">
          <div className="text-xs text-emerald-800 font-medium">Thành công ({successRate}%)</div>
          <div className="text-2xl font-bold text-emerald-700 mt-0.5">{successCount}</div>
        </Card>
        <Card className="p-3.5 bg-red-50/60 border-red-200">
          <div className="text-xs text-red-800 font-medium">Thất bại / Lỗi</div>
          <div className="text-2xl font-bold text-red-700 mt-0.5">{errorCount}</div>
        </Card>
        <Card className="p-3.5 bg-brand-50/60 border-brand-200">
          <div className="text-xs text-brand-900 font-medium">Độ trễ trung bình</div>
          <div className="text-2xl font-bold text-brand-700 mt-0.5">{avgDuration} ms</div>
        </Card>
      </div>

      {/* KHUNG THỬ NGHIỆM TRỰC TIẾP (QUICK TEST CONNECTIONS) */}
      <Card className="p-4 border-brand-200 bg-brand-50/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5 text-brand-600" />
            <span>Thử nghiệm kết nối nhanh (Demo Test Actions)</span>
          </div>
          <span className="text-[11px] text-slate-500">
            Tự động ghi nhận vào nhật ký bên dưới
          </span>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            size="sm"
            onClick={handleTestEmail}
            loading={isTesting}
            className="text-xs bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Test Notifier (Gửi thông báo)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleTestVietQr}
            loading={isTesting}
            className="text-xs bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <QrCode className="w-3.5 h-3.5 text-brand-600" />
            <span>Test VietQR (Sinh mã QR)</span>
          </Button>

          <Button
            size="sm"
            onClick={handleTestWebhook}
            loading={isTesting}
            className="text-xs bg-white text-slate-800 hover:bg-slate-100 border border-slate-200 flex items-center gap-1.5"
          >
            <Webhook className="w-3.5 h-3.5 text-amber-600" />
            <span>Test Webhook (No-Code TP2)</span>
          </Button>

          {totalCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleClearLogs}
              className="text-xs text-red-600 border-red-200 hover:bg-red-50 ml-auto flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa nhật ký</span>
            </Button>
          )}
        </div>
      </Card>

      {/* BỘ LỌC VÀ DANH SÁCH NHẬT KÝ */}
      <Card className="p-4 border-slate-200 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-brand-600" />
            <h3 className="text-base font-bold text-slate-900">
              Lịch sử các lần gọi bên ngoài ({logs?.length || 0})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Lọc theo loại */}
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as IntegrationType | 'ALL')}
              className="text-xs p-1.5 border border-slate-200 rounded bg-white outline-none"
            >
              <option value="ALL">Tất cả loại tích hợp</option>
              <option value="EMAIL">Email Notifier</option>
              <option value="VIETQR">VietQR Payment API</option>
              <option value="WEBHOOK">Webhook No-Code</option>
            </select>

            {/* Lọc theo trạng thái */}
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as IntegrationStatus | 'ALL')}
              className="text-xs p-1.5 border border-slate-200 rounded bg-white outline-none"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="SUCCESS">Thành công (SUCCESS)</option>
              <option value="ERROR">Lỗi (ERROR)</option>
              <option value="RETRYING">Đang thử lại (RETRYING)</option>
            </select>
          </div>
        </div>

        {/* Bảng nhật ký */}
        {logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-semibold uppercase">
                  <th className="p-2.5 rounded-l">Thời gian</th>
                  <th className="p-2.5">Dịch vụ</th>
                  <th className="p-2.5">Endpoint / Đích đến</th>
                  <th className="p-2.5">Mã đơn &amp; Node</th>
                  <th className="p-2.5 text-center">Trạng thái</th>
                  <th className="p-2.5 text-center">Lần thử</th>
                  <th className="p-2.5 text-right">Độ trễ</th>
                  <th className="p-2.5 text-center rounded-r">Chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-2.5 text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.created_at)}
                    </td>

                    <td className="p-2.5 font-bold">
                      {log.type === 'EMAIL' && (
                        <span className="flex items-center gap-1 text-blue-700">
                          <Mail className="w-3.5 h-3.5" />
                          <span>EMAIL</span>
                        </span>
                      )}
                      {log.type === 'VIETQR' && (
                        <span className="flex items-center gap-1 text-brand-700">
                          <QrCode className="w-3.5 h-3.5" />
                          <span>VIETQR</span>
                        </span>
                      )}
                      {log.type === 'WEBHOOK' && (
                        <span className="flex items-center gap-1 text-amber-700">
                          <Webhook className="w-3.5 h-3.5" />
                          <span>WEBHOOK</span>
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 text-slate-600 max-w-xs truncate font-mono">
                      {log.endpoint}
                    </td>

                    <td className="p-2.5 text-slate-700 font-mono">
                      {log.request_id ? `#${log.request_id.slice(0, 6)}` : '—'}
                      {log.bpmn_node_id && (
                        <span className="ml-1 text-[11px] text-brand-700 font-bold bg-brand-50 px-1 py-0.5 rounded">
                          {log.bpmn_node_id}
                        </span>
                      )}
                    </td>

                    <td className="p-2.5 text-center">
                      <Badge
                        variant={
                          log.status === 'SUCCESS'
                            ? 'success'
                            : log.status === 'ERROR'
                            ? 'danger'
                            : 'waiting'
                        }
                      >
                        {log.status}
                      </Badge>
                    </td>

                    <td className="p-2.5 text-center font-mono text-slate-600">
                      {log.attempt}
                    </td>

                    <td className="p-2.5 text-right font-mono text-slate-900 font-semibold">
                      {log.duration_ms} ms
                    </td>

                    <td className="p-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedLog(log)}
                        className="p-1 text-brand-700 hover:bg-brand-50 rounded"
                        title="Xem payload & response"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-500 text-xs bg-slate-50 rounded-lg">
            <Activity className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Chưa có nhật ký tích hợp nào được ghi nhận.</p>
            <p className="text-slate-500 mt-0.5">
              Bấm các nút "Thử nghiệm kết nối nhanh" ở trên hoặc thực hiện quy trình thuê xe để sinh bản ghi.
            </p>
          </div>
        )}
      </Card>

      {/* MODAL XEM CHI TIẾT LOG */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title={`Chi tiết cuộc gọi tích hợp: ${selectedLog?.type} (${selectedLog?.status})`}
      >
        {selectedLog && (
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded border border-slate-200">
              <div>
                <span className="text-slate-500">Thời điểm:</span>{' '}
                <strong className="text-slate-900">{formatDateTime(selectedLog.created_at)}</strong>
              </div>
              <div>
                <span className="text-slate-500">Độ trễ:</span>{' '}
                <strong className="text-slate-900">{selectedLog.duration_ms} ms</strong>
              </div>
              <div className="col-span-2 truncate">
                <span className="text-slate-500">Endpoint:</span>{' '}
                <strong className="font-mono text-slate-900">{selectedLog.endpoint}</strong>
              </div>
              {selectedLog.error_message && (
                <div className="col-span-2 text-red-600 font-bold">
                  Lỗi: {selectedLog.error_message}
                </div>
              )}
            </div>

            <div>
              <div className="font-bold text-slate-700 mb-1">Dữ liệu gửi đi (Payload):</div>
              <pre className="p-2.5 bg-slate-900 text-emerald-400 rounded overflow-x-auto text-[11px] font-mono max-h-48">
                {typeof selectedLog.payload === 'string'
                  ? selectedLog.payload
                  : JSON.stringify(selectedLog.payload, null, 2)}
              </pre>
            </div>

            {selectedLog.response && (
              <div>
                <div className="font-bold text-slate-700 mb-1">Dữ liệu phản hồi (Response):</div>
                <pre className="p-2.5 bg-slate-900 text-sky-400 rounded overflow-x-auto text-[11px] font-mono max-h-48">
                  {typeof selectedLog.response === 'string'
                    ? selectedLog.response
                    : JSON.stringify(selectedLog.response, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={() => setSelectedLog(null)}>
                Đóng
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL CÀI ĐẶT THÔNG SỐ KHÓA VÀ URL */}
      <Modal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Cài đặt tham số tích hợp bên ngoài"
      >
        <div className="space-y-4 text-xs">
          {/* Cảnh báo bảo mật bắt buộc */}
          <div className="p-3 bg-amber-50 rounded border border-amber-300 text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Lưu ý bảo mật (Frontend-Only):</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Ứng dụng chạy 100% trong trình duyệt (không có server backend). Mọi khóa API nhập ở đây được lưu trong <code>sessionStorage / localStorage</code> phía máy khách. Chỉ sử dụng khóa giới hạn quyền (Public Key) phục vụ demo báo cáo môn học.
            </p>
          </div>

          <div className="space-y-2">
            <div className="font-bold text-slate-800 text-sm">1. Tài khoản ngân hàng VietQR thụ hưởng</div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Mã BIN ngân hàng"
                value={configForm.bankBin}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, bankBin: e.target.value }))}
                placeholder="970436 (VCB)"
              />
              <Input
                label="Số tài khoản thụ hưởng"
                value={configForm.accountNo}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, accountNo: e.target.value }))}
              />
            </div>
            <Input
              label="Tên chủ tài khoản thụ hưởng"
              value={configForm.accountName}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, accountName: e.target.value }))}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="font-bold text-slate-800 text-sm">2. Dịch vụ gửi Email (EmailJS REST API)</div>
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Service ID"
                value={configForm.emailServiceId || ''}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, emailServiceId: e.target.value }))}
                placeholder="service_xxx"
              />
              <Input
                label="Template ID"
                value={configForm.emailTemplateId || ''}
                onChange={(e) => setConfigForm((prev) => ({ ...prev, emailTemplateId: e.target.value }))}
                placeholder="template_xxx"
              />
            </div>
            <Input
              label="Public Key (User ID)"
              value={configForm.emailPublicKey || ''}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, emailPublicKey: e.target.value }))}
              placeholder="Nhập EmailJS Public Key..."
            />
            <Input
              label="Email nhận thông báo mẫu"
              value={configForm.notificationEmail || ''}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, notificationEmail: e.target.value }))}
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="font-bold text-slate-800 text-sm">3. Webhook No-Code Workflow (TP2 n8n / Make / Zapier)</div>
            <Input
              label="Webhook URL nhận sự kiện"
              value={configForm.webhookUrl || ''}
              onChange={(e) => setConfigForm((prev) => ({ ...prev, webhookUrl: e.target.value }))}
              placeholder="https://webhook.site/xxx hoặc https://n8n.cloud/webhook/xxx"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Hủy
            </Button>
            <Button onClick={handleSaveSettings} className="bg-brand-600 hover:bg-brand-700 text-white font-semibold">
              Lưu cấu hình
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
export default IntegrationLogPage;
