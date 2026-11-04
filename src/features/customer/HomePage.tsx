import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { DataToolbar } from '@/components/ui/DataToolbar';
import { Bike, ShieldCheck, Zap, ArrowRight, Palette } from 'lucide-react';

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold border border-brand-200">
              <Bike className="w-6 h-6 text-brand-600" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-brand-700">MOTO CARE</span>
              <span className="text-[10px] block text-brand-600 font-semibold uppercase tracking-wider">Hệ Thống Thuê Xe Máy</span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <Link to="/style">
              <Button variant="outline" size="sm" className="flex items-center gap-1.5">
                <Palette className="w-4 h-4" />
                <span>Bảng kiểu (/style)</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-8 w-full space-y-8">
        <div className="bg-gradient-to-br from-brand-50 to-brand-100/50 rounded-2xl p-6 md:p-10 border border-brand-200 relative overflow-hidden">
          <div className="max-w-xl space-y-4">
            <Badge variant="processing">Đồ án môn Quản lý Quy trình Kinh doanh (BPMN)</Badge>
            <h1 className="text-3xl md:text-4xl font-extrabold text-brand-900 leading-tight">
              Dịch Vụ Thuê Xe Máy Nhanh Chóng, Tiện Lợi & An Toàn
            </h1>
            <p className="text-slate-600 text-sm md:text-base leading-relaxed">
              Trải nghiệm hành trình trọn vẹn với đội ngũ xe đời mới, thủ tục xác thực CCCD điện tử, đặt cọc linh hoạt và hợp đồng minh bạch trực tuyến 100%.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <Link to="/style" className="w-full sm:w-auto">
                <Button variant="primary" size="lg" className="w-full flex items-center gap-2">
                  <span>Khám phá Hệ Thống Thiết Kế</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Bảng điều khiển Dữ liệu & Đồng hồ Demo Giai đoạn 1 */}
        <DataToolbar />

        {/* Highlight Cards */}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="hover:border-brand-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Quy trình BPMN To-Be</h3>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Hiện thực hóa 110 phần tử nghiệp vụ hoàn toàn trên trình duyệt với Process Engine thuần TypeScript và Dexie IndexedDB.
            </CardContent>
          </Card>

          <Card className="hover:border-brand-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Thiết Kế Xanh Thân Thiện</h3>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Tone màu xanh lá phong cách xe điện hiện đại, card bo góc lớn <code>rounded-2xl</code>, đạt chuẩn tiếp cận WCAG AA.
            </CardContent>
          </Card>

          <Card className="hover:border-brand-300 transition-all">
            <CardHeader>
              <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-2">
                <Palette className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-800 text-lg">Bảng Kiểu Mẫu</h3>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Kiểm tra toàn bộ token màu sắc, nút bấm, trường nhập và huy hiệu trạng thái tại đường dẫn <code>/style</code>.
            </CardContent>
            <CardFooter>
              <Link to="/style" className="w-full">
                <Button variant="outline" size="sm" fullWidth>Xem chi tiết</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-6">
        <div className="max-w-5xl mx-auto px-4 text-center text-xs text-slate-500">
          MOTO CARE © 2026 - Đồ án môn Quản lý Quy trình Kinh doanh - Giai đoạn 0 (Khung dự án & Luật)
        </div>
      </footer>
    </div>
  );
}

