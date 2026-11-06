// src/features/customer/LandingPage.tsx
// Trang chủ thương hiệu (Landing Page) chuyên nghiệp dành cho Khách hàng & Công chúng
// Giữ nguyên 100% kết nối với quy trình BPMN lõi (M_START -> KH-01)

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/authStore';
import { Logo } from '@/components/common/Logo';
import { Button } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { getAssetUrl } from '@/lib/vehicleImages';
import {
  Bike,
  ShieldCheck,
  Sparkles,
  Clock,
  MapPin,
  Phone,
  Star,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Award,
  Zap,
  HelpCircle,
  Headphones,
  Check,
  X,
  Menu,
} from 'lucide-react';

interface FeaturedVehicle {
  id: string;
  name: string;
  type: 'xe_so' | 'tay_ga' | 'xe_con';
  typeName: string;
  pricePerDay: number;
  engine: string;
  fuel: string;
  storage: string;
  badge: string;
  badgeColor: 'brand' | 'amber' | 'blue';
  features: string[];
  imageUrl: string;
}

const FEATURED_VEHICLES: FeaturedVehicle[] = [
  {
    id: 'vision-2023',
    name: 'Honda Vision 2023 Smartkey',
    type: 'tay_ga',
    typeName: 'Xe tay ga',
    pricePerDay: 160000,
    engine: '110cc eSP',
    fuel: '1.87 L/100km',
    storage: 'Cốp 16L tiện lợi',
    badge: 'Phổ biến nhất',
    badgeColor: 'brand',
    imageUrl: getAssetUrl('images/vehicles/honda-vision.jpg'),
    features: ['Khóa thông minh Smartkey', 'Tiết kiệm xăng', 'Dễ lái cho nữ & gia đình'],
  },
  {
    id: 'airblade-125',
    name: 'Honda Air Blade 125cc',
    type: 'tay_ga',
    typeName: 'Xe tay ga',
    pricePerDay: 190000,
    engine: '125cc eSP+ 4 van',
    fuel: '2.26 L/100km',
    storage: 'Cốp lớn 23.2L',
    badge: 'Êm ái & Mạnh mẽ',
    badgeColor: 'brand',
    imageUrl: getAssetUrl('images/vehicles/honda-airblade.png'),
    features: ['Cổng sạc USB tiện lợi', 'Phanh đĩa an toàn', 'Vận hành đầm chắc'],
  },
  {
    id: 'wave-alpha-110',
    name: 'Honda Wave Alpha 110cc',
    type: 'xe_so',
    typeName: 'Xe số',
    pricePerDay: 120000,
    engine: '110cc tiết kiệm',
    fuel: '1.60 L/100km',
    storage: 'Cốp nhỏ vừa áo mưa',
    badge: 'Tiết kiệm chi phí',
    badgeColor: 'blue',
    imageUrl: getAssetUrl('images/vehicles/honda-wave-alpha.png'),
    features: ['Siêu tiết kiệm xăng', 'Dễ dàng leo dốc / đèo', 'Chi phí thuê tối ưu nhất'],
  },
  {
    id: 'future-125',
    name: 'Honda Future 125 Fi',
    type: 'xe_so',
    typeName: 'Xe số cao cấp',
    pricePerDay: 150000,
    engine: '125cc phun xăng Fi',
    fuel: '1.54 L/100km',
    storage: 'Cốp U-Box chứa nón',
    badge: 'Động cơ bốc & êm',
    badgeColor: 'blue',
    imageUrl: getAssetUrl('images/vehicles/honda-future.png'),
    features: ['Đèn pha LED siêu sáng', 'Bình xăng 4.6L lớn', 'Chạy đường trường tuyệt vời'],
  },
  {
    id: 'winner-x',
    name: 'Honda Winner X 150 ABS',
    type: 'xe_con',
    typeName: 'Xe côn tay',
    pricePerDay: 220000,
    engine: '150cc DOHC 6 số',
    fuel: '1.99 L/100km',
    storage: 'Balo kèm phụ kiện',
    badge: 'Phanh ABS Thể thao',
    badgeColor: 'amber',
    imageUrl: getAssetUrl('images/vehicles/honda-winner-x.png'),
    features: ['Phanh chống bó cứng ABS', 'Côn tay nhẹ bốc', 'Chuyên phượt đường dài'],
  },
  {
    id: 'grande-hybrid',
    name: 'Yamaha Grande Hybrid',
    type: 'tay_ga',
    typeName: 'Xe tay ga cao cấp',
    pricePerDay: 190000,
    engine: '125cc Blue Core Hybrid',
    fuel: '1.66 L/100km',
    storage: 'Cốp siêu rộng 27L',
    badge: 'Smartkey & Hybrid',
    badgeColor: 'brand',
    imageUrl: getAssetUrl('images/vehicles/yamaha-grande.png'),
    features: ['Trợ lực điện Hybrid êm ru', 'Cốp chứa 2 nón bảo hiểm', 'Nắp bình xăng phía trước'],
  },
];

const TESTIMONIALS = [
  {
    name: 'Nguyễn Hoàng Nam',
    city: 'Hà Nội (Du lịch Đà Nẵng)',
    avatar: 'HN',
    rating: 5,
    vehicle: 'Honda Vision 2023 Smartkey',
    date: 'Tháng 10/2026',
    comment:
      'Thủ tục quá bất ngờ! Không hề phải để lại CCCD hay hộ chiếu gốc như các tiệm thuê xe khác. Chỉ cần chụp ảnh CCCD trên web, AI quét chưa đầy 1 phút là xong. Xe nhận ở Sân bay còn mới tinh, đầy đủ 2 nón bảo hiểm sạch sẽ.',
  },
  {
    name: 'Trần Thị Mai Anh',
    city: 'TP. Hồ Chí Minh',
    avatar: 'MA',
    rating: 5,
    vehicle: 'Honda Lead 125 Cốp rộng',
    date: 'Tháng 11/2026',
    comment:
      'Mình đi công tác 4 ngày, thuê chiếc Lead cốp to để vừa cả vali mini và túi laptop. Cọc tiền qua VietQR và khi trả xe là tiền cọc được hoàn lại tự động ngay tại chỗ. Dịch vụ quá chuyên nghiệp!',
  },
  {
    name: 'Lê Văn Đức',
    city: 'Đà Nẵng (Khách phượt)',
    avatar: 'LD',
    rating: 5,
    vehicle: 'Honda Winner X 150 ABS',
    date: 'Tháng 10/2026',
    comment:
      'Chiếc Winner X làm mình rất an tâm khi leo đèo Hải Vân và vào Hội An. Phanh ABS nhạy, lốp mới bám đường. Đặc biệt có số cứu hộ 24/7 trên web làm mình rất tự tin trên suốt hành trình.',
  },
];

const FAQS = [
  {
    q: 'Thủ tục thuê xe cần chuẩn bị những giấy tờ gì?',
    a: 'Bạn chỉ cần ảnh chụp CCCD (hoặc Hộ chiếu) và Giấy phép lái xe (GPLX) hợp lệ. Hệ thống sẽ tự động xác thực và nhận diện trong 60 giây. Moto Care KHÔNG GIỮ giấy tờ gốc của khách hàng.',
  },
  {
    q: 'Tiền cọc được tính như thế nào và khi nào được hoàn lại?',
    a: 'Tiền cọc là 30% giá trị đơn thuê. Bạn chỉ cần quét mã VietQR trên màn hình để thanh toán cọc. Khi trả xe và hoàn tất biên bản kiểm tra, số tiền cọc sẽ được hoàn trả tự động về tài khoản ngân hàng của bạn ngay lập tức.',
  },
  {
    q: 'Nếu xe gặp sự cố (thủng lốp, hỏng hóc) giữa đường thì phải làm sao?',
    a: 'Moto Care có mạng lưới đối tác cứu hộ chuyên nghiệp 24/7 trên toàn địa bàn. Bạn chỉ cần bấm nút "Báo sự cố" trên ứng dụng hoặc gọi Hotline 1900 6868, đội cứu hộ lưu động sẽ có mặt hỗ trợ tại chỗ trong vòng 20 - 30 phút.',
  },
  {
    q: 'Tôi có được giao xe tận nơi tại Sân bay hoặc Khách sạn không?',
    a: 'Có! Moto Care hỗ trợ giao nhận xe miễn phí tại Sân bay Quốc tế, Ga tàu và các khách sạn trong bán kính 10km cho các đơn thuê từ 2 ngày trở lên.',
  },
];

interface HeroBannerSlide {
  id: number;
  badge: string;
  badgeColor: string;
  title: string;
  highlightText: string;
  description: string;
  primaryCtaText: string;
  secondaryCtaText?: string;
  imageUrl: string;
  footnote?: string;
  targetAnchor?: string;
}

const HERO_BANNER_SLIDES: HeroBannerSlide[] = [
  {
    id: 1,
    badge: 'RA MẮT DỊCH VỤ THUÊ XE DU LỊCH 4.0',
    badgeColor: 'bg-emerald-400 text-slate-950 font-black',
    title: 'MOTO CARE TRAVEL',
    highlightText: 'Khám Phá Việt Nam Tự Do & Tiện Lợi',
    description:
      'Giao nhận xe tận nơi tại Sân bay, Ga tàu & Khách sạn. Thủ tục 100% số hóa, không giữ CCCD/Hộ chiếu gốc.',
    primaryCtaText: 'ĐẶT XE NGAY',
    secondaryCtaText: 'Xem đội xe',
    imageUrl: getAssetUrl('images/banners/banner-1.jpg'),
    footnote: '(*) Miễn phí giao nhận xe trong bán kính 10km cho chuyến đi từ 2 ngày.',
    targetAnchor: '#booking-box',
  },
  {
    id: 2,
    badge: 'ĐỘI XE THẾ HỆ MỚI 2023 - 2024',
    badgeColor: 'bg-amber-400 text-slate-950 font-black',
    title: '100% XE MỚI ÊM ÁI',
    highlightText: 'Kiểm Định An Toàn 6 Bước Nghiêm Ngặt',
    description:
      'Đa dạng các mẫu xe: Honda Vision 2023 Smartkey, Air Blade 125, Wave Alpha, Future 125, Winner X, Yamaha Exciter 155.',
    primaryCtaText: 'CHỌN DÒNG XE',
    secondaryCtaText: 'Bảng giá niêm yết',
    imageUrl: getAssetUrl('images/banners/banner-2.jpg'),
    footnote: '(*) Trang bị sẵn 2 nón bảo hiểm đạt chuẩn an toàn & 2 áo mưa tiện lợi.',
    targetAnchor: '#fleet',
  },
  {
    id: 3,
    badge: 'THỦ TỤC THÔNG MINH SIÊU TỐC',
    badgeColor: 'bg-cyan-400 text-slate-950 font-black',
    title: 'NHẬN XE SAU 5 PHÚT',
    highlightText: 'Hợp Đồng Điện Tử Xác Thực Minh Bạch',
    description:
      'Quy trình số hóa toàn diện từ chọn xe, xác minh thông tin, thanh toán đặt cọc qua VietQR đến ký hợp đồng bảo mật.',
    primaryCtaText: 'TRẢI NGHIỆM NGAY',
    secondaryCtaText: 'Xem quy trình',
    imageUrl: getAssetUrl('images/banners/banner-3.jpg'),
    footnote: '(*) Tự động đối soát chuyển khoản ngân hàng 24/7 không cần chờ đợi.',
    targetAnchor: '#process',
  },
  {
    id: 4,
    badge: 'ĐỒNG HÀNH TRỌN VẸN HÀNH TRÌNH',
    badgeColor: 'bg-rose-500 text-white font-bold',
    title: 'CỨU HỘ 24/7 TOÀN QUỐC',
    highlightText: 'Mạng Lưới Đối Tác Kỹ Thuật Đa Tỉnh Thành',
    description:
      'Hotline cứu hộ khẩn cấp 1900 6868 luôn sẵn sàng 24/7. Hỗ trợ kỹ thuật tận nơi và đổi xe thay thế nhanh chóng nếu gặp sự cố.',
    primaryCtaText: 'GỌI CỨU HỘ 1900 6868',
    secondaryCtaText: 'Mạng lưới trạm xe',
    imageUrl: getAssetUrl('images/banners/banner-4.jpg'),
    footnote: '(*) Đội ngũ kỹ thuật viên lưu động chuyên nghiệp túc trực tại các địa bàn du lịch.',
    targetAnchor: '#stations',
  },
];

export function LandingPage() {
  const navigate = useNavigate();
  const { currentActor, isAuthenticated } = useAuthStore();

  const [showBanner, setShowBanner] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'tay_ga' | 'xe_so' | 'xe_con'>('all');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);

  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 2);
  dayAfter.setHours(18, 0, 0, 0);

  const toInputDate = (d: Date) => d.toISOString().slice(0, 16);

  const [bookingVehicleType, setBookingVehicleType] = useState('tay_ga');
  const [bookingStart, setBookingStart] = useState(toInputDate(tomorrow));
  const [bookingEnd, setBookingEnd] = useState(toInputDate(dayAfter));
  const [pickupLocation, setPickupLocation] = useState('san_bay');
  const [showSosModal, setShowSosModal] = useState(false);

  // Trạng thái Banner Slider phong cách VinFast / Xanh SM
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isSlidePaused, setIsSlidePaused] = useState(false);

  useEffect(() => {
    if (isSlidePaused) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_BANNER_SLIDES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSlidePaused]);

  const handleNextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % HERO_BANNER_SLIDES.length);
  };

  const handlePrevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + HERO_BANNER_SLIDES.length) % HERO_BANNER_SLIDES.length);
  };

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Hàm cuộn mượt xuống từng phân mục khi nhấn trên thanh điều hướng
  const scrollToSection = (sectionId: string) => {
    const cleanId = sectionId.replace('#', '');
    const element = document.getElementById(cleanId);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });
      setMobileMenuOpen(false);
    }
  };

  const handleStartBooking = (typeOverride?: string) => {
    const selectedType = typeOverride || bookingVehicleType;
    navigate(`/kh/01?vehicleType=${selectedType}&startAt=${bookingStart}&endAt=${bookingEnd}&pickup=${pickupLocation}`);
  };

  const filteredVehicles =
    activeTab === 'all'
      ? FEATURED_VEHICLES
      : FEATURED_VEHICLES.filter((v) => v.type === activeTab);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-brand-500 selection:text-white relative">
      {/* 1. THANH THÔNG BÁO TRÊN CÙNG (TOP ANNOUNCEMENT BAR) */}
      {showBanner && (
        <aside
          aria-label="Thông báo ưu đãi"
          className="bg-gradient-to-r from-brand-900 via-brand-700 to-emerald-800 text-white text-xs py-2 px-4 transition-all duration-300"
        >
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-hidden truncate">
              <span className="bg-amber-400 text-slate-950 font-black px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider shrink-0">
                Ưu đãi đặc quyền
              </span>
              <p className="truncate font-medium">
                Giảm ngay 10% cho chuyến đi từ 3 ngày | Miễn phí giao xe tại Sân bay &amp; Ga tàu | Hotline Cứu hộ 24/7:{' '}
                <strong className="text-amber-300 font-bold">1900 6868</strong>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowBanner(false)}
              className="p-1 hover:bg-white/15 rounded-md transition-colors shrink-0 text-white/80 hover:text-white"
              title="Đóng thông báo"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </aside>
      )}

      {/* 2. HEADER / NAVBAR CÔNG CHÚNG */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2 group">
            <Logo />
          </Link>

          <nav className="hidden lg:flex items-center gap-6 xl:gap-8 text-sm font-semibold text-slate-700 whitespace-nowrap shrink-0">
            <button
              type="button"
              onClick={() => scrollToSection('fleet')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Đội xe &amp; Bảng giá
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('process')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Quy trình thuê xe
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('benefits')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Cam kết dịch vụ
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stations')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Trạm xe &amp; Bản đồ
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reviews')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Đánh giá khách hàng
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="hover:text-brand-600 transition-colors font-semibold cursor-pointer py-1 whitespace-nowrap shrink-0"
            >
              Hỏi đáp
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            {isAuthenticated && currentActor ? (
              currentActor.role === 'khach_hang' ? (
                <>
                  <Link to="/kh/06">
                    <Button variant="outline" size="sm" className="text-xs">
                      Đơn thuê của tôi
                    </Button>
                  </Link>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleStartBooking()}
                    className="text-xs flex items-center gap-1.5"
                  >
                    <span>Thuê xe mới</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <Link to="/nv/01">
                  <Button variant="primary" size="sm" className="text-xs flex items-center gap-1.5">
                    <span>Vào Hộp việc điều hành</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              )
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm" className="text-xs text-slate-700 hover:text-slate-900">
                    Đăng nhập
                  </Button>
                </Link>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleStartBooking()}
                  className="text-xs flex items-center gap-1.5 shadow-sm hover:shadow"
                >
                  <Bike className="w-4 h-4" />
                  <span>Thuê xe ngay</span>
                </Button>
              </>
            )}

            {/* Nút bật/tắt Menu trên thiết bị di động */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Menu điều hướng"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Menu mở rộng trên thiết bị di động */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-200">
            <button
              type="button"
              onClick={() => scrollToSection('fleet')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Đội xe &amp; Bảng giá
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('process')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Quy trình thuê xe
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('benefits')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Cam kết dịch vụ
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('stations')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Trạm xe &amp; Bản đồ
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('reviews')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Đánh giá khách hàng
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('faq')}
              className="w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-brand-600 transition-colors cursor-pointer"
            >
              Hỏi đáp thường gặp
            </button>
          </div>
        )}
      </header>

      {/* 3. HERO SECTION: SLIDER ẢNH QUẢNG CÁO PHONG CÁCH VINFAST / XANH SM + FORM TÌM & ĐẶT XE */}
      <section className="relative overflow-hidden pt-4 pb-6 lg:pt-6 lg:pb-8 bg-gradient-to-b from-brand-50/40 via-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          {/* BANNER CAROUSEL 4 ẢNH TRƯỢT THAM KHẢO VINFAST / XANH SM */}
          <div
            className="group relative w-full h-[360px] sm:h-[440px] lg:h-[490px] rounded-3xl overflow-hidden shadow-2xl border border-slate-200/80 bg-slate-900 select-none"
            onMouseEnter={() => setIsSlidePaused(true)}
            onMouseLeave={() => setIsSlidePaused(false)}
          >
            {HERO_BANNER_SLIDES.map((slide, idx) => {
              const isActive = idx === currentSlide;
              return (
                <div
                  key={slide.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isActive ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {/* Ảnh nền Full-width */}
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover object-center transform scale-100 transition-transform duration-1000 ease-out"
                  />

                  {/* Lớp phủ Gradient chuẩn phong cách VinFast / Xanh SM để chữ hiển thị rõ nét */}
                  <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/70 to-transparent sm:w-3/4 lg:w-3/5" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent sm:hidden" />

                  {/* Nội dung Banner */}
                  <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-12 lg:px-16 max-w-2xl text-left z-20 space-y-3 sm:space-y-4">
                    {/* Badge */}
                    <div className="inline-flex items-center gap-1.5 self-start">
                      <span className={`px-3 py-1 rounded-full text-[10px] sm:text-xs font-black tracking-wider uppercase shadow-md ${slide.badgeColor}`}>
                        {slide.badge}
                      </span>
                    </div>

                    {/* Tiêu đề & Highlight */}
                    <div>
                      <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-none uppercase drop-shadow-md">
                        {slide.title}
                      </h1>
                      <span className="text-lg sm:text-2xl lg:text-3xl font-extrabold text-amber-300 sm:text-emerald-300 block mt-1.5 drop-shadow-sm">
                        {slide.highlightText}
                      </span>
                    </div>

                    {/* Mô tả */}
                    <p className="text-slate-200 text-xs sm:text-sm lg:text-base leading-relaxed line-clamp-2 sm:line-clamp-3 max-w-xl drop-shadow">
                      {slide.description}
                    </p>

                    {/* Nút Kêu gọi Hành động (CTA) */}
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          const target = slide.targetAnchor || 'booking-box';
                          scrollToSection(target);
                        }}
                        className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs sm:text-sm shadow-xl shadow-amber-400/25 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                      >
                        <span>{slide.primaryCtaText}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>

                      {slide.secondaryCtaText && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = slide.targetAnchor || 'fleet';
                            scrollToSection(target);
                          }}
                          className="bg-white/15 hover:bg-white/25 text-white border border-white/30 backdrop-blur font-bold px-5 py-3 rounded-2xl text-xs sm:text-sm hover:scale-105 active:scale-95 transition-all cursor-pointer"
                        >
                          {slide.secondaryCtaText}
                        </button>
                      )}
                    </div>

                    {/* Chú thích chân ảnh */}
                    {slide.footnote && (
                      <p className="text-[10px] text-white/60 italic pt-1">
                        {slide.footnote}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* NÚT ĐIỀU HƯỚNG TRÁI / PHẢI (PREV / NEXT ARROWS) */}
            <button
              type="button"
              onClick={handlePrevSlide}
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-80 hover:scale-110 active:scale-90 cursor-pointer"
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            <button
              type="button"
              onClick={handleNextSlide}
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 z-30 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/40 hover:bg-black/70 text-white backdrop-blur-md border border-white/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 sm:opacity-80 hover:scale-110 active:scale-90 cursor-pointer"
              aria-label="Ảnh tiếp theo"
            >
              <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* CHẤM ĐIỀU HƯỚNG DOTS (VINFAST / XANH SM STYLE) */}
            <div className="absolute bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15">
              {HERO_BANNER_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentSlide(idx)}
                  className={`transition-all duration-300 rounded-full cursor-pointer ${
                    idx === currentSlide
                      ? 'w-8 h-2.5 bg-emerald-400 shadow-md'
                      : 'w-2.5 h-2.5 bg-white/40 hover:bg-white/80'
                  }`}
                  aria-label={`Chuyển đến ảnh ${idx + 1}`}
                />
              ))}
            </div>
          </div>

          {/* DÒNG TIÊU CHÍ NHANH */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-8 text-xs text-slate-600 font-semibold">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-brand-600" />
              <span>100% Xe đời 2023 - 2024 bảo dưỡng định kỳ</span>
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-brand-600" />
              <span>Không giữ CCCD / Hộ chiếu gốc</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <span>4.9/5 (2.800+ khách hài lòng)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-emerald-600" />
              <span>Nhận xe siêu tốc chỉ sau 5 phút</span>
            </div>
          </div>

          {/* KHUNG TÌM & ĐẶT XE NHANH */}
          <div id="booking-box" className="mt-8 max-w-4xl mx-auto bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-7 shadow-xl shadow-slate-200/50 hover:shadow-2xl transition-all duration-300 scroll-mt-24">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 font-bold">
                  <Bike className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Tìm xe có sẵn &amp; Đặt xe nhanh</h2>
                  <p className="text-[11px] text-slate-500">Giá thuê niêm yết rõ ràng, đã bao gồm 2 nón bảo hiểm chuẩn</p>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                <Zap className="w-3 h-3 text-emerald-600" />
                Nhận xe ngay sau 5 phút
              </span>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleStartBooking();
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Dòng xe mong muốn</label>
                <select
                  value={bookingVehicleType}
                  onChange={(e) => setBookingVehicleType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="tay_ga">Xe tay ga (Vision, Air Blade...)</option>
                  <option value="xe_so">Xe số (Wave Alpha, Future...)</option>
                  <option value="xe_con">Xe côn tay (Winner X, Exciter...)</option>
                </select>
                <span className="text-[10px] text-slate-500 block">Động cơ 110cc - 155cc</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Ngày &amp; Giờ nhận xe</label>
                <input
                  type="datetime-local"
                  value={bookingStart}
                  onChange={(e) => setBookingStart(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <span className="text-[10px] text-slate-500 block">Mở cửa từ 06:00 sáng</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Ngày &amp; Giờ trả xe</label>
                <input
                  type="datetime-local"
                  value={bookingEnd}
                  onChange={(e) => setBookingEnd(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                />
                <span className="text-[10px] text-slate-500 block">Linh hoạt gia hạn online</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Điểm nhận xe</label>
                <select
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                >
                  <option value="san_bay">Trạm Sân bay Quốc tế</option>
                  <option value="trung_tam">Trạm Trung tâm &amp; Ga tàu</option>
                  <option value="bai_bien">Trạm Bãi biển Võ Nguyên Giáp</option>
                  <option value="khach_san">Giao tận nơi Khách sạn</option>
                </select>
                <span className="text-[10px] text-slate-500 block">Miễn phí giao tận nơi</span>
              </div>

              <div className="sm:col-span-2 lg:col-span-4 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="w-full flex items-center justify-center gap-2 text-sm font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <span>Tìm xe phù hợp &amp; Tiến hành thuê ngay</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* 4. DÀN XE NỔI BẬT (FEATURED FLEET GRID) KÈM FILTER TAB & HOVER EFFECT */}
      <section id="fleet" className="pt-4 pb-16 bg-white scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
              Đội xe chất lượng cao
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Bảng Giá &amp; Dòng Xe Du Lịch Nổi Bật
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Tất cả xe đều được bảo dưỡng định kỳ, rửa sạch và kiểm tra an toàn kỹ thuật trước khi trao tận tay khách hàng.
            </p>
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'all'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Tất cả xe ({FEATURED_VEHICLES.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('tay_ga')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'tay_ga'
                  ? 'bg-brand-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Xe tay ga (Đô thị &amp; Dễ lái)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('xe_so')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'xe_so'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Xe số (Tiết kiệm xăng)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('xe_con')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'xe_con'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Xe côn tay (Đi phượt &amp; Leo đèo)
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVehicles.map((bike) => (
              <div
                key={bike.id}
                className="group relative bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs hover:shadow-xl hover:border-brand-300 hover:-translate-y-1.5 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      {bike.typeName}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        bike.badgeColor === 'brand'
                          ? 'bg-brand-50 text-brand-800 border-brand-200'
                          : bike.badgeColor === 'amber'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-blue-50 text-blue-800 border-blue-200'
                      }`}
                    >
                      {bike.badge}
                    </span>
                  </div>

                  <div className="h-48 rounded-2xl bg-white border border-slate-100 flex items-center justify-center relative overflow-hidden p-3 group-hover:border-brand-200 transition-all duration-300">
                    <img
                      src={bike.imageUrl}
                      alt={bike.name}
                      className="h-full w-full object-contain filter drop-shadow-sm group-hover:scale-108 transition-transform duration-300"
                      loading="lazy"
                    />
                    <span className="absolute bottom-2 right-2 text-[10px] font-bold text-slate-500 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md border border-slate-200/60 shadow-2xs">
                      Đời 2023 - 2024
                    </span>
                  </div>

                  <div className="mt-4">
                    <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-700 transition-colors">
                      {bike.name}
                    </h3>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-xl font-black text-brand-600">
                        {formatCurrency(bike.pricePerDay)}
                      </span>
                      <span className="text-xs text-slate-500">/ 24 giờ</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 py-3 my-3 border-y border-slate-100 text-center">
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <span className="block text-[10px] text-slate-400 font-medium">Động cơ</span>
                      <span className="block text-xs font-bold text-slate-800 truncate">{bike.engine}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <span className="block text-[10px] text-slate-400 font-medium">Tiêu hao</span>
                      <span className="block text-xs font-bold text-slate-800 truncate">{bike.fuel}</span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-slate-50">
                      <span className="block text-[10px] text-slate-400 font-medium">Chứa đồ</span>
                      <span className="block text-xs font-bold text-slate-800 truncate">{bike.storage}</span>
                    </div>
                  </div>

                  <ul className="space-y-1.5 mb-5 text-xs text-slate-600">
                    {bike.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-emerald-700 font-medium">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Kèm 2 nón CR + 2 áo mưa + giá kẹp ĐT</span>
                    </li>
                  </ul>
                </div>

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleStartBooking(bike.type)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-bold group-hover:shadow-md transition-all"
                >
                  <span>Chọn thuê xe này</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. QUY TRÌNH THUÊ XE 4 BƯỚC CÔNG NGHỆ SIÊU TỐC */}
      <section id="process" className="py-16 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100/70 px-3 py-1 rounded-full">
              Thủ tục không giấy tờ gốc
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Thuê Xe Nhanh Chóng Trong 4 Bước
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Quy trình số hóa chuẩn quốc tế — tiện lợi, minh bạch và bảo vệ quyền lợi tối đa cho khách hàng.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative space-y-3 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-brand-50 text-brand-700 font-black flex items-center justify-center text-sm border border-brand-200">
                01
              </div>
              <h3 className="text-base font-bold text-slate-900">Chọn xe &amp; Báo giá</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chọn mẫu xe mong muốn, ngày nhận và điểm nhận xe. Hệ thống tự kiểm tra xe trống và tính giá trọn gói ngay.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative space-y-3 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-700 font-black flex items-center justify-center text-sm border border-purple-200">
                02
              </div>
              <h3 className="text-base font-bold text-slate-900">AI Quét Giấy Tờ 60s</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Chụp ảnh CCCD và GPLX. Trí tuệ nhân tạo Gemini AI tự động bóc tách thông tin, <strong>không giữ giấy tờ gốc</strong>.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative space-y-3 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-700 font-black flex items-center justify-center text-sm border border-blue-200">
                03
              </div>
              <h3 className="text-base font-bold text-slate-900">Cọc VietQR &amp; Ký Số</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Quét mã VietQR cọc 30% và ký hợp đồng điện tử trực tuyến. Hợp đồng pháp lý rõ ràng gửi thẳng về email của bạn.
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs relative space-y-3 hover:shadow-lg hover:-translate-y-1 transition-all">
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 font-black flex items-center justify-center text-sm border border-emerald-200">
                04
              </div>
              <h3 className="text-base font-bold text-slate-900">Nhận Xe &amp; An Tâm Lái</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nhân viên bàn giao xe kiểm định 6 bước, chụp ảnh đối soát tình trạng xe. Bảo hiểm và cứu hộ 24/7 trọn chuyến đi.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 6. LÝ DO LỰA CHỌN MOTO CARE (6 CAM KẾT VÀNG) */}
      <section id="benefits" className="py-16 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 bg-amber-100/70 px-3 py-1 rounded-full">
              An tâm tuyệt đối
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              6 Cam Kết Dịch Vụ Vàng Từ MOTO CARE
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Chúng tôi bảo đảm toàn bộ rủi ro kỹ thuật để bạn an tâm tận hưởng trọn vẹn từng cung đường du lịch và công tác.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Không giữ giấy tờ gốc</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Hệ thống xác thực danh tính điện tử bảo mật qua ảnh chụp. Bạn giữ nguyên vẹn CCCD và hộ chiếu để làm thủ tục khách sạn hay sân bay.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                <Bike className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Xe mới &amp; Kiểm định 6 bước</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tất cả xe đều được thử lốp, đo phanh, kiểm tra đèn còi, thay nhớt chính hãng định kỳ. Không có xe cũ kỹ hay chạy yếu.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
                <Headphones className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Cứu hộ khẩn cấp 24/7</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mạng lưới đối tác sửa xe lưu động có mặt trong 30 phút. Nếu xe gặp sự cố không thể khắc phục ngay, chúng tôi đổi xe mới tận nơi.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                <Award className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Hoàn cọc tự động qua QR</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Biên bản thanh lý hợp đồng minh bạch. Tiền cọc thừa sẽ được bộ máy thanh toán hoàn trả về tài khoản ngân hàng của bạn tức thì.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Trọn bộ phụ kiện an toàn</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Mỗi xe đều được trang bị miễn phí 2 mũ bảo hiểm đạt chuẩn chất lượng CR, 2 áo mưa dự phòng và kẹp điện thoại chống rung.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-3 hover:bg-brand-50/30 hover:border-brand-200 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900">Đổi xe linh hoạt trong 2 giờ</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Nếu bạn không cảm thấy thoải mái hoặc muốn đổi sang dòng xe khác, Moto Care hỗ trợ đổi xe hoàn toàn miễn phí trong 2 giờ đầu tiên.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. MẠNG LƯỚI TRẠM XE & GIỜ PHỤC VỤ (STATIONS & LOCATIONS) */}
      <section id="stations" className="py-16 bg-white border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Điểm giao nhận thuận tiện
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Hệ Thống Trạm Xe &amp; Giao Tận Nơi
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Nhận xe tiện lợi ngay khi vừa bước xuống máy bay hoặc ga tàu hỏa — không phải di chuyển xa.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-lg border border-brand-200">
                  Trạm 01 &bull; Sân bay
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">06:00 - 23:00</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">Trạm Sân bay Quốc tế</h3>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>Cổng Ga đến Quốc nội, Sân bay Quốc tế Đà Nẵng</span>
              </p>
              <div className="pt-2 text-[11px] text-slate-500">
                Nhân viên đón tận cổng ga để bàn giao xe và hướng dẫn lộ trình.
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                  Trạm 02 &bull; Trung tâm TP
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">06:00 - 22:00</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">Trạm Trung tâm &amp; Ga tàu</h3>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>120 Đường Nguyễn Thị Minh Khai, Hải Châu, Đà Nẵng</span>
              </p>
              <div className="pt-2 text-[11px] text-slate-500">
                Cách Ga xe lửa 300m, thuận tiện di chuyển khắp các tuyến phố trung tâm.
              </div>
            </div>

            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Trạm 03 &bull; Bãi biển
                </span>
                <span className="text-[11px] text-slate-500 font-semibold">06:00 - 22:00</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">Trạm Bãi biển Mỹ Khê</h3>
              <p className="text-xs text-slate-600 flex items-start gap-1.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>280 Đường Võ Nguyên Giáp, Sơn Trà, Đà Nẵng</span>
              </p>
              <div className="pt-2 text-[11px] text-slate-500">
                Phục vụ trực tiếp khách nghỉ dưỡng tại dãy khách sạn &amp; resort ven biển.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 8. ĐÁNH GIÁ KHÁCH HÀNG (TESTIMONIALS) */}
      <section id="reviews" className="py-16 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-3 py-1 rounded-full">
              Khách hàng nói về chúng tôi
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Trải Nghiệm Thực Tế Từ Người Thuê
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto leading-relaxed">
              Hơn 3.200 chuyến đi an toàn và hài lòng được ghi nhận trên toàn hệ thống.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between hover:shadow-lg transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-center gap-1">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>

                  <p className="text-xs text-slate-600 italic leading-relaxed">
                    &ldquo;{t.comment}&rdquo;
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-800 font-bold text-xs flex items-center justify-center">
                    {t.avatar}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                    <span className="text-[10px] text-slate-400 block">{t.city}</span>
                    <span className="text-[10px] font-semibold text-brand-700 block mt-0.5">
                      {t.vehicle}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 9. CẨM NANG THUÊ XE & FAQ (ACCORDION) */}
      <section id="faq" className="py-16 bg-slate-50 border-t border-slate-200/80 scroll-mt-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-8">
          <div className="text-center space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
              Hỏi đáp thường gặp
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Những Điều Cần Biết Khi Thuê Xe
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              Giải đáp nhanh các thắc mắc về giấy tờ, thanh toán cọc và quy chế vận hành.
            </p>
          </div>

          <div className="space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full py-4 px-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-slate-900 hover:text-brand-700 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-brand-600 shrink-0" />
                      <span>{faq.q}</span>
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3 animate-in fade-in duration-200">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 10. CHÂN TRANG THƯƠNG HIỆU (FOOTER) */}
      <footer className="bg-slate-950 text-slate-400 pt-14 pb-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-brand-600 text-white font-black text-xs flex items-center justify-center">
                  MC
                </div>
                <span className="font-extrabold text-base text-white tracking-tight">MOTO CARE</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Nền tảng cho thuê xe máy thế hệ mới. Ứng dụng quy trình số hóa tự động và trí tuệ nhân tạo AI để mang đến trải nghiệm thuận tiện và an tâm nhất cho khách hàng.
              </p>
              <div className="text-[11px] text-slate-500">
                GPKD: 0402189689 do Sở Kế hoạch &amp; Đầu tư TP. Đà Nẵng cấp.
              </div>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Đội Xe &amp; Dịch Vụ</h4>
              <ul className="space-y-1.5 text-xs">
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('fleet')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Thuê xe tay ga đời mới
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('fleet')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Thuê xe số tiết kiệm xăng
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('fleet')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Thuê xe côn tay đi phượt
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('stations')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Dịch vụ giao xe sân bay miễn phí
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection('benefits')}
                    className="hover:text-white transition-colors cursor-pointer text-left"
                  >
                    Dịch vụ cứu hộ xe máy 24/7
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Chính Sách &amp; Pháp Lý</h4>
              <ul className="space-y-1.5 text-xs">
                <li className="hover:text-white transition-colors cursor-pointer">Điều khoản hợp đồng điện tử</li>
                <li className="hover:text-white transition-colors cursor-pointer">Chính sách bảo mật thông tin</li>
                <li className="hover:text-white transition-colors cursor-pointer">Quy chế giải quyết tranh chấp</li>
                <li className="hover:text-white transition-colors cursor-pointer">Chính sách bảo hiểm &amp; bồi thường</li>
                <li className="hover:text-white transition-colors cursor-pointer">Quy định hoàn cọc trực tuyến</li>
              </ul>
            </div>

            <div className="space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">Tổng Đài Hỗ Trợ</h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Phone className="w-4 h-4 text-brand-500" />
                  <span>1900 6868 (Cứu hộ 24/7)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Email:</span>
                  <span className="text-slate-300">hotro@motocare.vn</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <span className="text-slate-300">120 Nguyễn Thị Minh Khai, Hải Châu, TP. Đà Nẵng</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-600">
            <div>&copy; 2026 MOTO CARE VIỆT NAM. Bảo lưu mọi quyền.</div>
            <div className="flex items-center gap-4 text-[11px]">
              <span>Dịch vụ chuẩn quốc tế</span>
              <span>&bull;</span>
              <span>Xác thực tự động</span>
              <span>&bull;</span>
              <span>Thanh toán VietQR Napas</span>
            </div>
          </div>
        </div>
      </footer>

      {/* 11. NÚT NỔI CỨU HỘ KHẨN CẤP 24/7 (FLOATING ACTION BUTTON) */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
        {showSosModal && (
          <div className="bg-white rounded-2xl border border-red-200 p-4 shadow-2xl mb-2 w-72 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-red-600 font-bold text-xs uppercase tracking-wide">
                <AlertTriangle className="w-4 h-4" />
                <span>Cứu Hộ Khẩn Cấp 24/7</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSosModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-slate-600 mb-3">
              Bạn đang gặp sự cố trên đường? Đội cứu hộ lưu động sẽ có mặt ngay lập tức.
            </p>
            <div className="space-y-2">
              <a
                href="tel:19006868"
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Gọi Hotline 1900 6868</span>
              </a>
              {isAuthenticated && currentActor?.role === 'khach_hang' ? (
                <Link
                  to="/kh/08"
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs py-2 px-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Báo sự cố trên app</span>
                </Link>
              ) : null}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowSosModal(!showSosModal)}
          className="bg-gradient-to-r from-red-600 to-rose-600 text-white font-bold text-xs py-2.5 px-4 rounded-full shadow-lg shadow-red-500/30 hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2 border border-white/20"
          title="Tổng đài cứu hộ khẩn cấp 24/7"
        >
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
          </span>
          <Phone className="w-3.5 h-3.5" />
          <span>SOS Cứu Hộ 24/7</span>
        </button>
      </div>
    </div>
  );
}
