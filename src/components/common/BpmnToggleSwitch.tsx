// src/components/common/BpmnToggleSwitch.tsx
// Nút công tắc chuyển đổi Chế độ Chấm thi BPMN trên Header

import { useBpmnModeStore } from '@/lib/bpmnModeStore';
import { GitFork } from 'lucide-react';

interface BpmnToggleSwitchProps {
  className?: string;
  isDark?: boolean;
}

export function BpmnToggleSwitch({ className = '', isDark = false }: BpmnToggleSwitchProps) {
  const { isBpmnMode, toggleBpmnMode } = useBpmnModeStore();

  return (
    <button
      type="button"
      onClick={toggleBpmnMode}
      title={
        isBpmnMode
          ? 'Đang bật Chế độ Chấm thi (Nhấn để tắt và xem giao diện sạch)'
          : 'Bật Chế độ Chấm thi BPMN (Hiển thị các mã node 110 phần tử To-Be cho giảng viên)'
      }
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-95 ${
        isBpmnMode
          ? 'bg-amber-500 hover:bg-amber-600 text-white ring-2 ring-amber-300 ring-offset-1 shadow-amber-200'
          : isDark
          ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
          : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
      } ${className}`}
    >
      <GitFork className={`w-3.5 h-3.5 ${isBpmnMode ? 'text-white' : isDark ? 'text-slate-400' : 'text-slate-500'}`} />
      <span className="hidden sm:inline">Chế độ BPMN</span>
      <span
        className={`w-2 h-2 rounded-full ${
          isBpmnMode ? 'bg-white animate-pulse' : 'bg-slate-400'
        }`}
      />
    </button>
  );
}
