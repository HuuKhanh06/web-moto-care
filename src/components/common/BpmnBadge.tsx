// src/components/common/BpmnBadge.tsx
// Huy hiệu mã Node BPMN hiển thị khi Bật chế độ chấm thi

import { useBpmnModeStore } from '@/lib/bpmnModeStore';
import { GitFork } from 'lucide-react';

interface BpmnBadgeProps {
  nodeId: string;
  name?: string;
  className?: string;
}

export function BpmnBadge({ nodeId, name, className = '' }: BpmnBadgeProps) {
  const isBpmnMode = useBpmnModeStore((s) => s.isBpmnMode);
  if (!isBpmnMode) return null;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs transition-all ${className}`}
      title={`BPMN To-Be: ${nodeId}${name ? ` (${name})` : ''}`}
    >
      <GitFork className="w-3 h-3 text-amber-700 shrink-0" />
      <span>BPMN: {nodeId}</span>
    </span>
  );
}

