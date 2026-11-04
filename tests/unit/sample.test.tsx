import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HashRouter } from 'react-router-dom';
import { HomePage } from '@/features/customer/HomePage';
import { StyleGuidePage } from '@/features/customer/StyleGuidePage';

describe('Giai đoạn 0: Kiểm tra Giao diện & Linh kiện cơ sở', () => {
  it('Trang chủ hiển thị đúng tiêu đề MOTO CARE', () => {
    render(
      <HashRouter>
        <HomePage />
      </HashRouter>
    );

    const titleElement = screen.getByText('MOTO CARE');
    expect(titleElement).toBeInTheDocument();
  });

  it('Trang /style hiển thị đầy đủ bảng kiểu và hệ thống màu', () => {
    render(
      <HashRouter>
        <StyleGuidePage />
      </HashRouter>
    );

    expect(screen.getByText(/Bảng Kiểu Mẫu Giao Diện/i)).toBeInTheDocument();
    expect(screen.getByText('brand-500')).toBeInTheDocument();
    expect(screen.getByText('brand-700')).toBeInTheDocument();
  });
});

