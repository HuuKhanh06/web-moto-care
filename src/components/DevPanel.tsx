// src/components/DevPanel.tsx
// Bảng điều khiển DevPanel: Tua nhanh thời gian, chạy sweepTimers, sao lưu/khôi phục và theo dõi timers đang chạy

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db';
import { clock } from '@/lib/clock';
import { timerManager } from '@/engine/timers';
import { downloadDatabaseBackup, importDatabase } from '@/db/backup';
import { seedDatabase } from '@/db/seed';
import { formatDateTime } from '@/lib/format';
import { toast } from '@/components/ui/toastStore';
import {
  Clock,
  RotateCcw,
  Play,
  Trash2,
  Download,
  Upload,
  ChevronDown,
  Cpu,
  Timer,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(clock.now());
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cập nhật đồng hồ hiển thị mỗi giây
  useEffect(() => {
    const unsubscribe = clock.subscribe((now) => setCurrentTime(now));
    const interval = setInterval(() => setCurrentTime(clock.now()), 1000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  // Đọc danh sách Timer đang chờ từ bảng timers
  const activeTimers = useLiveQuery(
    async () => {
      return db.timers.where('status').equals('ACTIVE').toArray();
    },
    [],
    []
  );

  const handleAdvance = async (minutes: number) => {
    clock.advance(minutes);
    setCurrentTime(clock.now());
    const triggered = await timerManager.sweepTimers();
    if (triggered > 0) {
      toast.info(`Tua +${minutes} phút: Đã kích hoạt ${triggered} timer quá hạn!`);
    } else {
      toast.info(`Đã tua nhanh thời gian +${minutes} phút`);
    }
  };

  const handleResetClock = async () => {
    clock.reset();
    setCurrentTime(clock.now());
    toast.success('Đã đặt lại đồng hồ về thời gian thực tế');
  };

  const handleSweepNow = async () => {
    const triggered = await timerManager.sweepTimers();
    if (triggered > 0) {
      toast.success(`Đã quét timers: Kích hoạt ${triggered} timer quá hạn`);
    } else {
      toast.info('Đã quét timers: Chưa có timer nào đến hạn');
    }
  };

  const handleClearData = async () => {
    if (window.confirm('CẢNH BÁO: Thao tác này sẽ xóa toàn bộ dữ liệu trong IndexedDB. Bạn có chắc chắn?')) {
      await db.clearAllTables();
      clock.reset();
      toast.warning('Đã xóa toàn bộ dữ liệu hệ thống.');
    }
  };

  const handleSeedData = async () => {
    try {
      await seedDatabase();
      toast.success('Đã nạp đầy đủ dữ liệu mẫu (xe, tài khoản, đối tác)!');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi khi nạp dữ liệu mẫu');
    }
  };

  const handleExport = async () => {
    try {
      await downloadDatabaseBackup();
      toast.success('Đã tải xuống file sao lưu cơ sở dữ liệu');
    } catch (err) {
      console.error(err);
      toast.error('Lỗi xuất dữ liệu sao lưu');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importDatabase(text);
      if (result.success) {
        toast.success(result.message || 'Đã khôi phục cơ sở dữ liệu thành công từ file!');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        toast.error(result.message || 'File dữ liệu không đúng định dạng schema chuẩn');
      }
    } catch (err) {
      console.error(err);
      toast.error('Không thể đọc file khôi phục');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Nút thu nhỏ mở DevPanel */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900 text-white shadow-xl hover:bg-brand-700 transition-all text-xs font-semibold border border-slate-700 hover:scale-105"
        >
          <Cpu className="w-4 h-4 text-brand-400" />
          <span>Demo DevPanel</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      ) : (
        /* Hộp điều khiển nổi */
        <div className="w-96 rounded-2xl bg-slate-900 text-white shadow-2xl border border-slate-800 p-4 animate-in slide-in-from-bottom-3 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-brand-400" />
              <span className="font-bold text-xs uppercase tracking-wider text-slate-200">
                Bảng điều khiển Giả lập
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>

          {/* Đồng hồ Demo */}
          <div className="my-3 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-brand-400" />
                Đồng hồ hệ thống (clock.now):
              </span>
              <button
                type="button"
                onClick={handleResetClock}
                className="text-[10px] text-slate-400 hover:text-brand-300 flex items-center gap-1"
                title="Đặt lại về thời gian thực"
              >
                <RotateCcw className="w-3 h-3" />
                Về giờ thực
              </button>
            </div>
            <div className="text-base font-extrabold text-brand-300 font-mono mt-1">
              {formatDateTime(currentTime)}
            </div>
          </div>

          {/* Các nút tua nhanh */}
          <div className="space-y-1.5 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Tua nhanh thời gian:
            </span>
            <div className="grid grid-cols-4 gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => handleAdvance(15)}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 font-mono text-slate-200 transition-colors text-center"
              >
                +15p
              </button>
              <button
                type="button"
                onClick={() => handleAdvance(30)}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 font-mono text-slate-200 transition-colors text-center"
              >
                +30p
              </button>
              <button
                type="button"
                onClick={() => handleAdvance(120)}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 font-mono text-slate-200 transition-colors text-center"
              >
                +2h
              </button>
              <button
                type="button"
                onClick={() => handleAdvance(1440)}
                className="py-1.5 rounded-lg bg-slate-800 hover:bg-brand-600 font-mono text-slate-200 transition-colors text-center"
              >
                +24h
              </button>
            </div>
          </div>

          {/* Các nút hành động chính */}
          <div className="grid grid-cols-3 gap-1.5 mb-3 text-xs">
            <button
              type="button"
              onClick={handleSeedData}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 font-semibold text-white transition-colors"
              title="Khôi phục/nạp lại dữ liệu xe và tài khoản mẫu"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Nạp Data</span>
            </button>
            <button
              type="button"
              onClick={handleSweepNow}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-brand-600 hover:bg-brand-500 font-semibold text-white transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              <span>Sweep</span>
            </button>
            <button
              type="button"
              onClick={handleClearData}
              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-red-900/60 hover:bg-red-800 border border-red-700 text-red-200 transition-colors font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa Data</span>
            </button>
          </div>

          {/* Sao lưu & Khôi phục */}
          <div className="flex items-center gap-2 mb-3 pt-2 border-t border-slate-800 text-xs">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-brand-400" />
              Sao lưu (JSON)
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-blue-400" />
              Khôi phục file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>

          {/* Danh sách Timer đang đếm ngược */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
              <span className="flex items-center gap-1">
                <Timer className="w-3.5 h-3.5 text-amber-400" />
                Timers đang chạy ({activeTimers.length}):
              </span>
            </div>

            <div className="max-h-28 overflow-y-auto space-y-1 pr-1 text-xs">
              {activeTimers.length === 0 ? (
                <div className="text-[11px] text-slate-500 italic py-1">Không có timer boundary nào đang chạy.</div>
              ) : (
                activeTimers.map((t) => {
                  const dueMs = new Date(t.due_at).getTime();
                  const diffMinutes = Math.round((dueMs - currentTime.getTime()) / 60000);
                  const isExpired = diffMinutes <= 0;

                  return (
                    <div
                      key={t.id}
                      className="p-1.5 rounded-lg bg-slate-800/90 border border-slate-700/50 flex items-center justify-between text-[11px]"
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-amber-300">{t.bpmn_node_id}</span>
                        <span className="text-[10px] text-slate-400 ml-1.5 truncate">
                          ({t.request_id.slice(0, 8)})
                        </span>
                      </div>
                      <span
                        className={cn(
                          'font-mono font-semibold px-1.5 py-0.5 rounded text-[10px]',
                          isExpired ? 'bg-red-900/60 text-red-200' : 'bg-slate-700 text-slate-300'
                        )}
                      >
                        {isExpired ? 'Đã quá hạn' : `còn ~${diffMinutes}p`}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
