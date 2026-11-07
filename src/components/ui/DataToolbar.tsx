import { useState, useEffect } from 'react';
import { clock } from '@/lib/clock';
import { seedDatabase, SEED_USERS } from '@/db/seed';
import { importDatabase, downloadDatabaseBackup } from '@/db/backup';
import { db } from '@/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Clock, Database, Download, Upload, RefreshCw, FastForward, CheckCircle2 } from 'lucide-react';

export function DataToolbar() {
  const [currentDate, setCurrentDate] = useState<string>(clock.now().toLocaleString('vi-VN'));
  const [notification, setNotification] = useState<string | null>(null);

  // Theo dõi số lượng bản ghi của các bảng chính qua useLiveQuery
  const counts = useLiveQuery(async () => {
    return {
      vehicles: await db.vehicles.count(),
      requests: await db.rental_requests.count(),
      profiles: await db.profiles.count(),
      events: await db.process_events.count(),
    };
  }, []);

  useEffect(() => {
    const unsub = clock.subscribe((now) => {
      setCurrentDate(now.toLocaleString('vi-VN'));
    });
    const timer = setInterval(() => {
      setCurrentDate(clock.now().toLocaleString('vi-VN'));
    }, 1000);

    return () => {
      unsub();
      clearInterval(timer);
    };
  }, []);

  const showNotify = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const handleSeed = async () => {
    try {
      await seedDatabase();
      showNotify('Đã nạp dữ liệu mẫu thành công!');
    } catch (e) {
      showNotify('Lỗi nạp dữ liệu: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const handleAdvance = (minutes: number) => {
    const updated = clock.advance(minutes);
    setCurrentDate(updated.toLocaleString('vi-VN'));
    showNotify(`Đã tua nhanh +${minutes} phút`);
  };

  const handleResetClock = () => {
    const updated = clock.reset();
    setCurrentDate(updated.toLocaleString('vi-VN'));
    showNotify('Đã đặt lại đồng hồ về thời gian thực');
  };

  const handleExport = async () => {
    await downloadDatabaseBackup();
    showNotify('Đã tải xuống file sao lưu JSON');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const res = await importDatabase(text);
        showNotify(res.message);
      } catch (err) {
        showNotify('Lỗi đọc file: ' + (err instanceof Error ? err.message : String(err)));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <Card className="border-brand-300 bg-white shadow-md my-6">
      <CardHeader className="bg-brand-50/50 flex flex-wrap items-center justify-between gap-3 border-b border-brand-100">
        <div className="flex items-center gap-2 text-brand-900 font-bold">
          <Database className="w-5 h-5 text-brand-600" />
          <span>Bảng Điều Khiển Dữ Liệu &amp; Đồng Hồ Demo (Giai đoạn 1)</span>
        </div>
        <div className="flex items-center gap-2">
          {notification && (
            <Badge variant="completed" className="animate-fade-in flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{notification}</span>
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Phần 1: Đồng hồ demo */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Đồng hồ hệ thống (clock.now)</span>
              <p className="text-lg font-mono font-bold text-slate-900">{currentDate}</p>
              {clock.getOffsetMs() !== 0 && (
                <span className="text-xs text-brand-700 font-medium">
                  Độ lệch: {Math.round(clock.getOffsetMs() / 60000)} phút so với thực tế
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => handleAdvance(30)} className="flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5" />
              <span>+30 phút</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAdvance(120)} className="flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5" />
              <span>+2 giờ</span>
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleAdvance(24 * 60)} className="flex items-center gap-1">
              <FastForward className="w-3.5 h-3.5" />
              <span>+1 ngày</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleResetClock} className="flex items-center gap-1 text-slate-600">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Đặt lại</span>
            </Button>
          </div>
        </div>

        {/* Phần 2: Thao tác Dữ liệu Dexie */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              variant="primary"
              size="sm"
              onClick={handleSeed}
              className="flex items-center gap-1.5"
              data-testid="btn-seed-data"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Nạp dữ liệu mẫu</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Xuất JSON (Backup)</span>
            </Button>

            <label className="cursor-pointer inline-flex items-center justify-center font-medium rounded-xl transition-colors px-3 py-1.5 text-xs border border-brand-500 text-brand-700 hover:bg-brand-50">
              <Upload className="w-3.5 h-3.5 mr-1" />
              <span>Nhập JSON</span>
              <input type="file" accept=".json" onChange={handleImportFile} className="hidden" />
            </label>
          </div>

          {/* Trạng thái dữ liệu tức thì (Live Query) */}
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <span className="font-semibold">Thống kê IndexedDB:</span>
            <span className="bg-slate-100 px-2 py-1 rounded">Xe: <b>{counts?.vehicles ?? 0}</b></span>
            <span className="bg-slate-100 px-2 py-1 rounded">Hồ sơ: <b>{counts?.requests ?? 0}</b></span>
            <span className="bg-slate-100 px-2 py-1 rounded">User: <b>{counts?.profiles ?? 0}</b></span>
            <span className="bg-slate-100 px-2 py-1 rounded">Events: <b>{counts?.events ?? 0}</b></span>
          </div>
        </div>

        {/* Danh sách tài khoản vận hành */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <span className="text-xs font-bold text-slate-700 block mb-2">Tài khoản vận hành hệ thống (Mật khẩu: password123):</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {SEED_USERS.slice(0, 3).map((u) => (
              <div key={u.id} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-slate-800">{u.full_name}</span>
                  <Badge variant={u.role === 'quan_ly' ? 'danger' : 'processing'}>
                    {u.role === 'quan_ly' ? 'Quản lý' : 'Nhân viên'}
                  </Badge>
                </div>
                <div className="text-[11px] text-slate-500 font-mono truncate">{u.email}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
