// src/features/manager/TimelinePage.tsx
// Màn hình Quản lý Sơ đồ xe Timeline (Gantt Chart) - Kế thừa GOODBIKE

import { FleetTimeline } from '@/components/timeline/FleetTimeline';
import { LayoutGrid } from 'lucide-react';

export function TimelinePage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <LayoutGrid className="w-7 h-7 text-brand-600" />
            <span>Sơ đồ điều phối & Lịch trình xe</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Theo dõi trực quan trạng thái rảnh / bận theo thời gian thực và quản lý luân chuyển xe đệm ảo DUMP
          </p>
        </div>
      </div>

      {/* Component Gantt Timeline chính */}
      <FleetTimeline />
    </div>
  );
}
