// src/components/PlaceholderScreen.tsx
// Màn hình giữ chỗ (Placeholder) cho các màn hình nghiệp vụ giai đoạn 4-5

import { useNavigate } from 'react-router-dom';
import { Card, Button, Badge } from '@/components/ui';
import { Construction, ArrowLeft, GitFork } from 'lucide-react';

export interface PlaceholderScreenProps {
  code: string;
  name: string;
  bpmnNodes?: string;
  description?: string;
  backUrl?: string;
}

export function PlaceholderScreen({
  code,
  name,
  bpmnNodes,
  description = 'Màn hình này thuộc phạm vi giao diện nghiệp vụ chi tiết của Giai đoạn 4-5.',
  backUrl,
}: PlaceholderScreenProps) {
  const navigate = useNavigate();

  return (
    <div className="max-w-2xl mx-auto py-8">
      <Card className="p-8 text-center border-slate-200 shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4 border border-amber-200">
          <Construction className="w-7 h-7" />
        </div>

        <div className="inline-flex items-center gap-2 mb-2">
          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
            {code}
          </span>
          <Badge variant="waiting">Đang phát triển (GĐ 4-5)</Badge>
        </div>

        <h2 className="text-xl font-bold text-slate-900 mt-1 mb-2">{name}</h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto leading-relaxed mb-6">{description}</p>

        {bpmnNodes && (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-left max-w-md mx-auto mb-6">
            <span className="font-semibold text-slate-700 flex items-center gap-1.5 mb-1">
              <GitFork className="w-3.5 h-3.5 text-brand-600" />
              Phần tử BPMN To-Be tương ứng:
            </span>
            <span className="font-mono text-brand-800 font-medium">{bpmnNodes}</span>
          </div>
        )}

        <div className="flex justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => (backUrl ? navigate(backUrl) : navigate(-1))}
            className="flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Button>
        </div>
      </Card>
    </div>
  );
}

