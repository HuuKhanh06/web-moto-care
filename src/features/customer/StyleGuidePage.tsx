import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ArrowLeft, CheckCircle2, AlertTriangle, Info, Sparkles } from 'lucide-react';

export function StyleGuidePage() {
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState('');

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Navigation & Header */}
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="sm" className="flex items-center gap-1.5 text-slate-600">
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại Trang chủ</span>
            </Button>
          </Link>
          <Badge variant="completed">Phiên bản Giai đoạn 0</Badge>
        </div>

        <div>
          <h1 className="text-3xl font-extrabold text-brand-900 tracking-tight">
            Bảng Kiểu Mẫu Giao Diện (Design System Showcase)
          </h1>
          <p className="mt-1 text-slate-600 text-sm">
            Tông màu xanh lá chuẩn hiện đại (lấy cảm hứng từ phong cách xe điện: nền sáng, nhấn xanh lá, thân thiện), tuân thủ kiểm tra tương phản WCAG AA &gt;= 4.5:1.
          </p>
        </div>

        {/* 1. PALETTE MÀU SẮC */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-brand-600" />
            1. Bảng Màu Thương Hiệu (Brand Palette)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
            <div className="p-3 bg-brand-50 rounded-2xl border border-brand-200 text-center">
              <div className="h-10 rounded-xl bg-brand-50 border border-brand-200 mb-2"></div>
              <span className="block font-bold text-xs text-brand-900">brand-50</span>
              <span className="text-[10px] text-slate-500">#ECFAF2</span>
            </div>

            <div className="p-3 bg-brand-100 rounded-2xl border border-brand-200 text-center">
              <div className="h-10 rounded-xl bg-brand-100 mb-2"></div>
              <span className="block font-bold text-xs text-brand-900">brand-100</span>
              <span className="text-[10px] text-slate-500">#D3F3E2</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="h-10 rounded-xl bg-brand-300 mb-2"></div>
              <span className="block font-bold text-xs text-slate-800">brand-300</span>
              <span className="text-[10px] text-slate-500">#7ADDAB</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="h-10 rounded-xl bg-brand-500 mb-2"></div>
              <span className="block font-bold text-xs text-slate-800">brand-500</span>
              <span className="text-[10px] text-slate-500">#00A651</span>
              <span className="text-[9px] block text-brand-600 font-semibold">(Xanh chính)</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="h-10 rounded-xl bg-brand-600 mb-2"></div>
              <span className="block font-bold text-xs text-slate-800">brand-600</span>
              <span className="text-[10px] text-slate-500">#00914A</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="h-10 rounded-xl bg-brand-700 mb-2"></div>
              <span className="block font-bold text-xs text-slate-800">brand-700</span>
              <span className="text-[10px] text-slate-500">#00803F</span>
              <span className="text-[9px] block text-brand-700 font-semibold">(Nút & Chữ chính)</span>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="h-10 rounded-xl bg-brand-900 mb-2"></div>
              <span className="block font-bold text-xs text-slate-800">brand-900</span>
              <span className="text-[10px] text-slate-500">#0B3D26</span>
            </div>
          </div>

          {/* Màu chức năng */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500 flex-shrink-0"></div>
              <div>
                <span className="block font-bold text-xs text-slate-800">Thành công</span>
                <span className="text-[10px] text-slate-500">#10B981</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500 flex-shrink-0"></div>
              <div>
                <span className="block font-bold text-xs text-slate-800">Cảnh báo</span>
                <span className="text-[10px] text-slate-500">#F59E0B</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-red-600 flex-shrink-0"></div>
              <div>
                <span className="block font-bold text-xs text-slate-800">Lỗi / Hủy</span>
                <span className="text-[10px] text-slate-500">#DC2626</span>
              </div>
            </div>

            <div className="p-3 bg-white rounded-2xl border border-slate-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-sky-500 flex-shrink-0"></div>
              <div>
                <span className="block font-bold text-xs text-slate-800">Thông tin</span>
                <span className="text-[10px] text-slate-500">#0EA5E9</span>
              </div>
            </div>
          </div>
        </section>

        {/* 2. HUY HIỆU TRẠNG THÁI (BADGES) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-brand-600" />
            2. Huy Hiệu Trạng Thái Hồ Sơ (Badges)
          </h2>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Badge variant="processing">Đang xử lý (Xanh nhạt)</Badge>
                <Badge variant="waiting">Chờ khách / Chờ việc (Vàng)</Badge>
                <Badge variant="danger">Từ chối / Hủy / Lỗi (Đỏ)</Badge>
                <Badge variant="completed">Hoàn tất (Xanh đậm)</Badge>
                <Badge variant="neutral">Trung tính (Mặc định)</Badge>
              </div>
              <p className="text-xs text-slate-500">
                Quy ước đồng nhất màu sắc giúp người dùng và nhân viên dễ dàng phân biệt trạng thái hồ sơ thuê xe trong toàn bộ tiến trình BPMN.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* 3. NÚT BẤM (BUTTONS) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">3. Nút Bấm (Buttons - Bo góc rounded-xl)</h2>
          <Card>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 items-center">
                <Button variant="primary">Nút Chính (Primary)</Button>
                <Button variant="secondary">Nút Phụ (Secondary)</Button>
                <Button variant="outline">Nút Viền (Outline)</Button>
                <Button variant="ghost">Nút Trong suốt (Ghost)</Button>
                <Button variant="danger">Nút Nguy hiểm (Danger)</Button>
                <Button variant="primary" disabled>Bị Vô Hiệu</Button>
              </div>

              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-600 mb-2">Nút Toàn Chiều Rộng (Full-width trên Mobile):</p>
                <Button variant="primary" fullWidth size="lg">
                  Xác Nhận Thuê Xe Ngay (Full Width)
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 4. Ô NHẬP LIỆU (INPUTS) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">4. Ô Nhập Liệu (Inputs - Bo góc rounded-xl)</h2>
          <Card>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Họ và tên khách hàng"
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  helperText="Nhập chính xác theo căn cước công dân"
                />

                <Input
                  label="Số Căn cước công dân (CCCD)"
                  placeholder="12 chữ số"
                  error={inputError}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.length > 0 && val.length !== 12) {
                      setInputError('Số CCCD phải gồm đúng 12 chữ số');
                    } else {
                      setInputError('');
                    }
                  }}
                  helperText="Kiểm tra xác thực định danh tự động"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Trường bị vô hiệu hóa"
                  placeholder="Không thể chỉnh sửa"
                  disabled
                  defaultValue="Hệ thống tự động điền"
                />
                <Input
                  label="Số điện thoại liên hệ"
                  placeholder="09xx xxx xxx"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* 5. THẺ CHỨA (CARDS - Bo góc rounded-2xl) */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800">5. Thẻ Chứa (Cards - Bo góc rounded-2xl)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Honda Vision 2024</h3>
                  <Badge variant="completed">Sẵn sàng</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-slate-600">Động cơ eSP+ tiết kiệm nhiên liệu, phù hợp di chuyển nội thành.</p>
                <div className="text-xl font-extrabold text-brand-700">150.000 đ <span className="text-xs font-normal text-slate-500">/ ngày</span></div>
              </CardContent>
              <CardFooter className="flex justify-between items-center">
                <span className="text-xs text-slate-500">Biển số: 29-A1 123.45</span>
                <Button variant="primary" size="sm">Chọn xe này</Button>
              </CardFooter>
            </Card>

            <Card className="border-amber-200 bg-amber-50/20">
              <CardHeader className="border-amber-100">
                <div className="flex items-center gap-2 text-amber-800 font-bold">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span>Cảnh Báo Kiểm Tra Xe</span>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-slate-700 space-y-2">
                <p>Khách hàng cần chụp đủ 4 góc xe và ghi nhận mức xăng hiện tại trước khi ký nhận xe bàn giao.</p>
              </CardContent>
              <CardFooter className="border-amber-100 bg-amber-50/50">
                <Button variant="outline" size="sm" fullWidth className="border-amber-500 text-amber-800 hover:bg-amber-100">
                  Xem Hướng Dẫn Chụp Ảnh
                </Button>
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* 6. KIỂM TRA ĐỘ TƯƠNG PHẢN WCAG AA */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Info className="w-5 h-5 text-brand-600" />
            6. Tiêu Chuẩn Tiếp Cận &amp; Tương Phản (WCAG AA &gt;= 4.5:1)
          </h2>
          <Card>
            <CardContent className="space-y-3">
              <div className="p-4 bg-brand-700 text-white rounded-xl flex items-center justify-between">
                <span className="font-semibold text-sm">Chữ trắng trên nền Nút Chính (#00803F)</span>
                <span className="text-xs bg-brand-900/40 px-2 py-1 rounded">Tỷ lệ tương phản: 4.8:1 (Đạt WCAG AA)</span>
              </div>
              <div className="p-4 bg-white text-brand-700 border border-brand-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-sm">Chữ thương hiệu (#00803F) trên nền Trắng (#FFFFFF)</span>
                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700">Tỷ lệ tương phản: 4.8:1 (Đạt WCAG AA)</span>
              </div>
              <div className="p-4 bg-brand-50 text-brand-900 border border-brand-200 rounded-xl flex items-center justify-between">
                <span className="font-bold text-sm">Tiêu đề đậm (#0B3D26) trên nền Xanh nhạt (#ECFAF2)</span>
                <span className="text-xs bg-white px-2 py-1 rounded text-brand-900">Tỷ lệ tương phản: 11.2:1 (Đạt WCAG AAA)</span>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
