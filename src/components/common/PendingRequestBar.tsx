// src/components/common/PendingRequestBar.tsx
// Thanh điều hướng nhanh hồ sơ đang chờ xử lý (Khuôn dùng chung cho các màn hình NV-02, NV-03, NV-04, NV-05)

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock, Check } from 'lucide-react';

export interface PendingRequestSummary {
  id: string;
  customerName?: string;
  vehicleModel?: string;
  plate?: string;
  status: string;
}

interface PendingRequestBarProps {
  label: string;
  currentRequestId: string;
  pendingList: PendingRequestSummary[];
  onSelect: (id: string) => void;
  nv01Path?: string;
}

export function PendingRequestBar({
  label,
  currentRequestId,
  pendingList,
  onSelect,
  nv01Path = '/nv/01',
}: PendingRequestBarProps) {
  const navigate = useNavigate();

  if (pendingList.length === 0) return null;

  return (
    <div className="bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl p-3 shadow-xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 animate-in fade-in duration-200">
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={() => navigate(nv01Path)}
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          title="Về Hộp việc điều hành NV-01"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-2 w-2 relative shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </span>
          <span className="text-xs font-semibold text-slate-500 shrink-0">{label}:</span>
          <span className="text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-full shrink-0">
            {pendingList.length} đơn
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
        {pendingList.map((item) => {
          const isSelected = item.id === currentRequestId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 ${
                isSelected
                  ? 'bg-brand-600 text-white font-bold shadow-xs'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200/70'
              }`}
            >
              {isSelected ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Clock className="w-3 h-3 text-slate-400 shrink-0" />}
              <span className="font-mono font-bold">#{item.id.slice(0, 8)}</span>
              {item.vehicleModel && (
                <span className={`text-[11px] truncate max-w-[120px] ${isSelected ? 'text-white/90' : 'text-slate-500'}`}>
                  {item.vehicleModel}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
