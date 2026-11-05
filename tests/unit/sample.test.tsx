import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Logo } from '@/components/common/Logo';

describe('Kiểm tra Linh kiện cơ sở & Thương hiệu (Core UI Components)', () => {
  it('Component Logo hiển thị đúng thương hiệu MOTO CARE', () => {
    render(<Logo />);
    expect(screen.getByText('MOTO')).toBeInTheDocument();
    expect(screen.getByText('CARE')).toBeInTheDocument();
  });

  it('Component Button và Badge hiển thị đúng nội dung và trạng thái', () => {
    render(
      <div>
        <Button variant="primary">Tiếp tục thanh toán</Button>
        <Badge variant="completed">Đã hoàn tất</Badge>
      </div>
    );

    expect(screen.getByText('Tiếp tục thanh toán')).toBeInTheDocument();
    expect(screen.getByText('Đã hoàn tất')).toBeInTheDocument();
  });
});
